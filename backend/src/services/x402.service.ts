import { ethers } from "ethers";
import { env } from "../config/env";
import { MOCK_ERC20_ABI, SPEND_GUARD_VAULT_ABI } from "../abi";
import { provider, withRpcTimeout } from "./blockchain.service";
import {
  getAgentGasBalance,
  getAgentWalletAddress,
  payVendorFromVault,
} from "./agentSigner.service";
import { appendAuditLog } from "./store.service";
import { fetchLiveAvaxPriceUsd } from "./portfolio.service";

export const DEMO_VENDOR_A = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export interface X402EndpointSpec {
  id: "onchain-alpha" | "deep-audit";
  name: string;
  vendorAddress: string;
  priceMusdc: number;
  description: string;
}

export const X402_CATALOG: Record<string, X402EndpointSpec> = {
  "onchain-alpha": {
    id: "onchain-alpha",
    name: "Avalanche On-Chain Alpha Feed",
    vendorAddress: DEMO_VENDOR_A,
    priceMusdc: 5,
    description: "Real-time AVAX market valuation & Avalanche Fuji network pulse.",
  },
  "deep-audit": {
    id: "deep-audit",
    name: "Enterprise Deep Contract Audit API",
    vendorAddress: DEMO_VENDOR_A,
    priceMusdc: 25,
    description: "High-tier security report exceeding standard 10 mUSDC per-call cap.",
  },
};

export interface VaultStatusSummary {
  vaultAddress: string;
  musdcAddress: string;
  ownerAddress: string;
  vaultBalanceMusdc: string;
  paused: boolean;
  agentAddress: string;
  agentGasAvax: string;
  agentPolicy: {
    perCallCapMusdc: string;
    dailyCapMusdc: string;
    active: boolean;
    revoked: boolean;
  };
  dailyUsage: {
    spentTodayMusdc: string;
    txCountToday: number;
  };
  vendorWhitelisted: boolean;
  demoVendorAddress: string;
}

export async function getVaultStatus(): Promise<VaultStatusSummary> {
  if (!env.SPEND_GUARD_VAULT_ADDRESS) {
    throw new Error("SPEND_GUARD_VAULT_ADDRESS not configured.");
  }

  const vault = new ethers.Contract(
    env.SPEND_GUARD_VAULT_ADDRESS,
    SPEND_GUARD_VAULT_ABI,
    provider
  );
  const agentAddr = getAgentWalletAddress();

  const [
    ownerAddress,
    vaultBalRaw,
    paused,
    pol,
    usage,
    vendorAllowed,
    agentGasAvax,
  ] = await withRpcTimeout(
    Promise.all([
      vault.owner(),
      vault.vaultBalance(),
      vault.paused(),
      vault.agentPolicies(agentAddr),
      vault.getAgentDailyUsage(agentAddr),
      vault.allowedVendors(DEMO_VENDOR_A),
      getAgentGasBalance(),
    ]),
    "Fetch SpendGuardVault status"
  );

  return {
    vaultAddress: env.SPEND_GUARD_VAULT_ADDRESS,
    musdcAddress: env.MUSDC_ADDRESS,
    ownerAddress,
    vaultBalanceMusdc: ethers.formatUnits(vaultBalRaw, 6),
    paused: Boolean(paused),
    agentAddress: agentAddr,
    agentGasAvax,
    agentPolicy: {
      perCallCapMusdc: ethers.formatUnits(pol.perCallCap, 6),
      dailyCapMusdc: ethers.formatUnits(pol.dailyCap, 6),
      active: Boolean(pol.active),
      revoked: Boolean(pol.revoked),
    },
    dailyUsage: {
      spentTodayMusdc: ethers.formatUnits(usage.spentToday, 6),
      txCountToday: Number(usage.txCountToday),
    },
    vendorWhitelisted: Boolean(vendorAllowed),
    demoVendorAddress: DEMO_VENDOR_A,
  };
}

export async function verifyX402PaymentReceipt(
  txHash: string,
  expectedVendor: string,
  minAmountMusdc: number
): Promise<{ valid: boolean; reason?: string }> {
  if (!ethers.isHexString(txHash, 32)) {
    return { valid: false, reason: "Invalid payment txHash format." };
  }
  const receipt = await withRpcTimeout(
    provider.getTransactionReceipt(txHash),
    "Verify x402 payment receipt"
  );
  if (!receipt || receipt.status !== 1) {
    return { valid: false, reason: "Payment transaction not confirmed or failed." };
  }

  const iface = new ethers.Interface(SPEND_GUARD_VAULT_ABI);
  const minRaw = ethers.parseUnits(minAmountMusdc.toString(), 6);

  for (const log of receipt.logs) {
    if (
      log.address.toLowerCase() !== env.SPEND_GUARD_VAULT_ADDRESS.toLowerCase()
    ) {
      continue;
    }
    try {
      const parsed = iface.parseLog(log);
      if (parsed?.name === "VendorPaid") {
        const vendor = String(parsed.args.vendor).toLowerCase();
        const amount = BigInt(parsed.args.amount);
        if (vendor === expectedVendor.toLowerCase() && amount >= minRaw) {
          return { valid: true };
        }
      }
    } catch {
      // skip unrelated logs
    }
  }
  return {
    valid: false,
    reason: "No matching VendorPaid event found in transaction receipt.",
  };
}

export async function buildPaidVendorPayload(spec: X402EndpointSpec) {
  const [priceInfo, blockNum] = await Promise.all([
    fetchLiveAvaxPriceUsd(),
    withRpcTimeout(provider.getBlockNumber(), "Get Fuji block for x402 data"),
  ]);
  return {
    provider: spec.name,
    settledVia: "x402 + SpendGuardVault (Avalanche Fuji)",
    timestamp: new Date().toISOString(),
    data: {
      avaxUsdPrice: priceInfo.price,
      priceSource: priceInfo.source,
      fujiLatestBlock: blockNum,
      signal:
        spec.id === "onchain-alpha"
          ? "Avalanche Fuji C-Chain finality nominal; Agent spend verified on-chain."
          : "Full enterprise security report unlocked.",
    },
  };
}

export interface ProcurementResult {
  decision: "ROUTINE" | "ASK" | "REJECT" | "ESCALATE";
  status: "PAID_AND_DELIVERED" | "BLOCKED_BY_POLICY" | "NEEDS_SETUP";
  endpointId: string;
  priceMusdc: number;
  vendorAddress: string;
  txHash?: string;
  blockNumber?: number;
  reason?: string;
  apiData?: any;
}

export async function executeX402Procurement(
  endpointId: "onchain-alpha" | "deep-audit"
): Promise<ProcurementResult> {
  const spec = X402_CATALOG[endpointId];
  if (!spec) {
    throw new Error(`Unknown x402 endpoint: ${endpointId}`);
  }

  const vaultStatus = await getVaultStatus();
  const perCallCap = Number(vaultStatus.agentPolicy.perCallCapMusdc);
  const dailyCap = Number(vaultStatus.agentPolicy.dailyCapMusdc);
  const spentToday = Number(vaultStatus.dailyUsage.spentTodayMusdc);
  const vaultBal = Number(vaultStatus.vaultBalanceMusdc);
  const gasAvax = Number(vaultStatus.agentGasAvax);

  if (vaultStatus.paused) {
    return {
      decision: "REJECT",
      status: "BLOCKED_BY_POLICY",
      endpointId,
      priceMusdc: spec.priceMusdc,
      vendorAddress: spec.vendorAddress,
      reason: "SpendGuardVault đang ở trạng thái Emergency Pause.",
    };
  }
  if (vaultStatus.agentPolicy.revoked || !vaultStatus.agentPolicy.active) {
    return {
      decision: "REJECT",
      status: "BLOCKED_BY_POLICY",
      endpointId,
      priceMusdc: spec.priceMusdc,
      vendorAddress: spec.vendorAddress,
      reason: vaultStatus.agentPolicy.revoked
        ? "Agent Wallet đã bị Owner thu hồi quyền (Revoked On-chain)."
        : "Agent Wallet chưa được Owner kích hoạt trên SpendGuardVault.",
    };
  }
  if (!vaultStatus.vendorWhitelisted) {
    return {
      decision: "REJECT",
      status: "BLOCKED_BY_POLICY",
      endpointId,
      priceMusdc: spec.priceMusdc,
      vendorAddress: spec.vendorAddress,
      reason: `Vendor ${spec.vendorAddress} chưa nằm trong On-chain Whitelist.`,
    };
  }
  if (spec.priceMusdc > perCallCap) {
    appendAuditLog({
      userAddress: vaultStatus.agentAddress,
      userRequest: `x402 Procure ${spec.name} (${spec.priceMusdc} mUSDC)`,
      governanceDecision: "REJECT",
      policyDecision: `ExceedsPerCallCap (${spec.priceMusdc} > ${perCallCap} mUSDC)`,
      executionResult: "BLOCKED_ON_CHAIN_POLICY",
    });
    return {
      decision: "REJECT",
      status: "BLOCKED_BY_POLICY",
      endpointId,
      priceMusdc: spec.priceMusdc,
      vendorAddress: spec.vendorAddress,
      reason: `ExceedsPerCallCap: API yêu cầu ${spec.priceMusdc} mUSDC vượt giới hạn mỗi lần gọi (${perCallCap} mUSDC) trên SpendGuardVault.`,
    };
  }
  if (spentToday + spec.priceMusdc > dailyCap) {
    appendAuditLog({
      userAddress: vaultStatus.agentAddress,
      userRequest: `x402 Procure ${spec.name} (${spec.priceMusdc} mUSDC)`,
      governanceDecision: "REJECT",
      policyDecision: `ExceedsDailyCap (${spentToday + spec.priceMusdc} > ${dailyCap} mUSDC)`,
      executionResult: "BLOCKED_ON_CHAIN_POLICY",
    });
    return {
      decision: "REJECT",
      status: "BLOCKED_BY_POLICY",
      endpointId,
      priceMusdc: spec.priceMusdc,
      vendorAddress: spec.vendorAddress,
      reason: `ExceedsDailyCap: Đã chi ${spentToday} + ${spec.priceMusdc} > hạn mức ngày ${dailyCap} mUSDC.`,
    };
  }
  if (vaultBal < spec.priceMusdc) {
    return {
      decision: "ASK",
      status: "NEEDS_SETUP",
      endpointId,
      priceMusdc: spec.priceMusdc,
      vendorAddress: spec.vendorAddress,
      reason: `Số dư SpendGuardVault không đủ (${vaultBal} mUSDC < ${spec.priceMusdc} mUSDC). Owner cần Deposit thêm mUSDC vào Vault.`,
    };
  }
  if (gasAvax < 0.005) {
    return {
      decision: "ASK",
      status: "NEEDS_SETUP",
      endpointId,
      priceMusdc: spec.priceMusdc,
      vendorAddress: spec.vendorAddress,
      reason: `Agent Wallet (${vaultStatus.agentAddress}) thiếu AVAX trả gas (${gasAvax} AVAX). Bấm "Fund 0.03 AVAX Gas" trong Owner Console.`,
    };
  }

  // Autonomous On-chain Execution by Agent Wallet within On-chain Policy
  const reqId = `x402_${endpointId}_${Date.now()}`;
  const { txHash, blockNumber } = await payVendorFromVault({
    vendorAddress: spec.vendorAddress,
    amountMusdc: spec.priceMusdc,
    requestId: reqId,
  });

  const apiData = await buildPaidVendorPayload(spec);

  appendAuditLog({
    userAddress: vaultStatus.agentAddress,
    userRequest: `x402 Auto-Pay ${spec.name} (${spec.priceMusdc} mUSDC)`,
    governanceDecision: "ROUTINE",
    policyDecision: "ALLOWED_ON_CHAIN",
    txHash,
    executionResult: "PAID_AND_DELIVERED",
    postTxSummary: `Agent Wallet đã tự thanh toán ${spec.priceMusdc} mUSDC (Block #${blockNumber}) và mở khóa API thành công.`,
  });

  return {
    decision: "ROUTINE",
    status: "PAID_AND_DELIVERED",
    endpointId,
    priceMusdc: spec.priceMusdc,
    vendorAddress: spec.vendorAddress,
    txHash,
    blockNumber,
    apiData,
  };
}

export function encodeOwnerVaultTx(params: {
  action: "deposit" | "configureAgent" | "revokeAgent" | "setAllowedVendor" | "approveVault";
  amountMusdc?: number;
  perCallCapMusdc?: number;
  dailyCapMusdc?: number;
  vendorAddress?: string;
  allowed?: boolean;
}) {
  const vaultIface = new ethers.Interface(SPEND_GUARD_VAULT_ABI);
  const musdcIface = new ethers.Interface(MOCK_ERC20_ABI);
  const agentAddr = getAgentWalletAddress();

  switch (params.action) {
    case "approveVault": {
      const amt = ethers.parseUnits((params.amountMusdc ?? 100).toString(), 6);
      return {
        to: env.MUSDC_ADDRESS,
        data: musdcIface.encodeFunctionData("approve", [
          env.SPEND_GUARD_VAULT_ADDRESS,
          amt,
        ]),
        value: "0",
      };
    }
    case "deposit": {
      const amt = ethers.parseUnits((params.amountMusdc ?? 100).toString(), 6);
      return {
        to: env.SPEND_GUARD_VAULT_ADDRESS,
        data: vaultIface.encodeFunctionData("deposit", [amt]),
        value: "0",
      };
    }
    case "configureAgent": {
      const perCall = ethers.parseUnits(
        (params.perCallCapMusdc ?? 10).toString(),
        6
      );
      const daily = ethers.parseUnits(
        (params.dailyCapMusdc ?? 50).toString(),
        6
      );
      return {
        to: env.SPEND_GUARD_VAULT_ADDRESS,
        data: vaultIface.encodeFunctionData("configureAgent", [
          agentAddr,
          perCall,
          daily,
          true,
        ]),
        value: "0",
      };
    }
    case "revokeAgent": {
      return {
        to: env.SPEND_GUARD_VAULT_ADDRESS,
        data: vaultIface.encodeFunctionData("revokeAgent", [agentAddr]),
        value: "0",
      };
    }
    case "setAllowedVendor": {
      return {
        to: env.SPEND_GUARD_VAULT_ADDRESS,
        data: vaultIface.encodeFunctionData("setAllowedVendor", [
          params.vendorAddress || DEMO_VENDOR_A,
          params.allowed ?? true,
        ]),
        value: "0",
      };
    }
  }
}
