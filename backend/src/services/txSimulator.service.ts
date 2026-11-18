import { ethers } from "ethers";
import { env } from "../config/env";
import {
  EXECUTOR_ABI,
  MOCK_ERC20_ABI,
  POLICY_ABI,
} from "../abi";
import { provider, withRpcTimeout } from "./blockchain.service";

export type SimulationStatus =
  | "SIMULATION_PASSED"
  | "SIMULATION_FAILED"
  | "SIMULATION_UNAVAILABLE";

export interface TxSimulationReport {
  status: SimulationStatus;
  txType: "SWAP" | "APPROVE" | "REVOKE_ALLOWANCE";
  chainId: number;
  from: string;
  to: string;
  functionName: string;
  integrityHash: string;
  simulatedBlock?: number;
  estimatedGas?: string;
  simulatedOutputAvax?: string;
  revertReason?: string;
  warnings: string[];
  unverifiedConditions: string[];
  simulatedAt: string;
}

const combinedErrorIface = new ethers.Interface([
  ...POLICY_ABI,
  ...EXECUTOR_ABI,
  "error UnauthorizedCaller(address caller)",
  "error UnsupportedTokenDecimals(uint8 actual, uint8 expected)",
  "error InsufficientOutputAmount(uint256 actual, uint256 minimum)",
  "error InsufficientRouterLiquidity(uint256 available, uint256 required)",
  "error InvalidOraclePrice(int256 answer)",
  "error StaleOraclePrice(uint256 updatedAt, uint256 maxAge)",
  "error IncompleteOracleRound(uint80 roundId, uint80 answeredInRound)",
  "error ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed)",
  "error ERC20InsufficientAllowance(address spender, uint256 allowance, uint256 needed)",
]);

const executorIface = new ethers.Interface(EXECUTOR_ABI);
const musdcIface = new ethers.Interface(MOCK_ERC20_ABI);

export function computeTxIntegrityHash(params: {
  chainId: number;
  to: string;
  data: string;
  value: string;
}): string {
  const packed = `${params.chainId}:${params.to.toLowerCase()}:${params.data.toLowerCase()}:${params.value || "0"}`;
  return ethers.keccak256(ethers.toUtf8Bytes(packed));
}

export function decodeSimulationError(err: any): string {
  const rawData =
    err?.data || err?.info?.error?.data || err?.error?.data || null;
  if (typeof rawData === "string" && rawData.startsWith("0x") && rawData.length >= 10) {
    try {
      const parsed = combinedErrorIface.parseError(rawData);
      if (parsed) {
        switch (parsed.name) {
          case "ExceedsMaxTxAmount":
            return `ExceedsMaxTxAmount: Requested ${ethers.formatUnits(parsed.args[0], 6)} mUSDC > limit ${ethers.formatUnits(parsed.args[1], 6)} mUSDC.`;
          case "InsufficientRouterLiquidity":
            return `InsufficientRouterLiquidity: Pool only has ${Number(ethers.formatEther(parsed.args[0])).toFixed(4)} AVAX, needs ${Number(ethers.formatEther(parsed.args[1])).toFixed(4)} AVAX.`;
          case "ERC20InsufficientBalance":
            return `ERC20InsufficientBalance: Wallet has ${ethers.formatUnits(parsed.args[1], 6)} mUSDC, needs ${ethers.formatUnits(parsed.args[2], 6)} mUSDC.`;
          case "ERC20InsufficientAllowance":
            return `ERC20InsufficientAllowance: Current allowance is ${ethers.formatUnits(parsed.args[1], 6)} mUSDC, needs ${ethers.formatUnits(parsed.args[2], 6)} mUSDC.`;
          case "SlippageTooHigh":
            return `SlippageTooHigh: ${parsed.args[0]} bps exceeds max ${parsed.args[1]} bps.`;
          case "StaleOraclePrice":
            return "StaleOraclePrice: Chainlink price feed on Fuji exceeded max age.";
          case "IncompleteOracleRound":
            return "IncompleteOracleRound: Chainlink round is not finalized.";
          case "EnforcedPause":
            return "EnforcedPause: Contract is currently paused.";
          default:
            return `Reverted with ${parsed.name}`;
        }
      }
    } catch {
      // fall through
    }
  }
  return (
    err?.shortMessage ||
    err?.reason ||
    err?.message ||
    "EVM simulation reverted"
  );
}

export async function simulateUnsignedTransaction(params: {
  from: string;
  to: string;
  data: string;
  value?: string;
  chainId?: number;
  customProvider?: ethers.JsonRpcProvider;
}): Promise<TxSimulationReport> {
  const activeProvider = params.customProvider || provider;
  const chainId = params.chainId ?? env.CHAIN_ID;
  const valueStr = params.value || "0";
  const nowIso = new Date().toISOString();
  const warnings: string[] = [];
  const unverifiedConditions: string[] = [
    "Trạng thái on-chain (số dư pool, tỷ giá Chainlink, gas price) có thể thay đổi giữa thời điểm mô phỏng và thời điểm giao dịch được đưa vào block.",
  ];

  const integrityHash = computeTxIntegrityHash({
    chainId,
    to: params.to,
    data: params.data,
    value: valueStr,
  });

  // 1. Validate chainId, addresses, and function selector
  if (chainId !== env.CHAIN_ID) {
    return {
      status: "SIMULATION_FAILED",
      txType: "SWAP",
      chainId,
      from: params.from,
      to: params.to,
      functionName: "unknown",
      integrityHash,
      revertReason: `Wrong Chain ID (${chainId} !== expected Avalanche Fuji ${env.CHAIN_ID}).`,
      warnings: ["Chain ID mismatch blocked."],
      unverifiedConditions,
      simulatedAt: nowIso,
    };
  }

  if (!ethers.isAddress(params.from) || !ethers.isAddress(params.to)) {
    return {
      status: "SIMULATION_FAILED",
      txType: "SWAP",
      chainId,
      from: params.from,
      to: params.to,
      functionName: "unknown",
      integrityHash,
      revertReason: "Invalid sender or target contract address.",
      warnings: ["Malformed EVM address."],
      unverifiedConditions,
      simulatedAt: nowIso,
    };
  }

  const toLower = params.to.toLowerCase();
  const execLower = (env.EXECUTOR_ADDRESS || "").toLowerCase();
  const musdcLower = (env.MUSDC_ADDRESS || "").toLowerCase();

  let txType: TxSimulationReport["txType"] = "SWAP";
  let functionName = "unknown";

  if (toLower === execLower) {
    try {
      const decoded = executorIface.parseTransaction({ data: params.data });
      if (!decoded || decoded.name !== "executeSwap") {
        throw new Error("Unsupported Executor selector");
      }
      functionName = decoded.name;
      txType = "SWAP";
    } catch {
      return {
        status: "SIMULATION_FAILED",
        txType: "SWAP",
        chainId,
        from: params.from,
        to: params.to,
        functionName: "invalid_selector",
        integrityHash,
        revertReason: "Calldata does not match AgentVaultExecutor.executeSwap.",
        warnings: ["Unrecognized calldata selector."],
        unverifiedConditions,
        simulatedAt: nowIso,
      };
    }
  } else if (toLower === musdcLower) {
    try {
      const decoded = musdcIface.parseTransaction({ data: params.data });
      if (!decoded || decoded.name !== "approve") {
        throw new Error("Unsupported ERC20 selector");
      }
      functionName = "approve";
      const amt = BigInt(decoded.args[1]);
      txType = amt === 0n ? "REVOKE_ALLOWANCE" : "APPROVE";
      if (String(decoded.args[0]).toLowerCase() !== execLower) {
        return {
          status: "SIMULATION_FAILED",
          txType,
          chainId,
          from: params.from,
          to: params.to,
          functionName,
          integrityHash,
          revertReason: `Unauthorized approve spender (${decoded.args[0]}). Only AgentVaultExecutor is permitted.`,
          warnings: ["Spender not whitelisted."],
          unverifiedConditions,
          simulatedAt: nowIso,
        };
      }
    } catch {
      return {
        status: "SIMULATION_FAILED",
        txType: "APPROVE",
        chainId,
        from: params.from,
        to: params.to,
        functionName: "invalid_selector",
        integrityHash,
        revertReason: "Calldata does not match ERC20.approve.",
        warnings: ["Unrecognized ERC20 calldata."],
        unverifiedConditions,
        simulatedAt: nowIso,
      };
    }
  } else {
    return {
      status: "SIMULATION_FAILED",
      txType: "SWAP",
      chainId,
      from: params.from,
      to: params.to,
      functionName: "untrusted_contract",
      integrityHash,
      revertReason: `Target contract ${params.to} is not in AgentVault whitelist.`,
      warnings: ["Target contract rejected by Guardian."],
      unverifiedConditions,
      simulatedAt: nowIso,
    };
  }

  // 2. Verify target contract bytecode exists & execute live eth_call + estimateGas
  let blockNumber: number;
  try {
    const [blk, code] = await withRpcTimeout(
      Promise.all([
        activeProvider.getBlockNumber(),
        activeProvider.getCode(params.to),
      ]),
      "Pre-simulation RPC check"
    );
    blockNumber = blk;
    if (!code || code === "0x") {
      return {
        status: "SIMULATION_FAILED",
        txType,
        chainId,
        from: params.from,
        to: params.to,
        functionName,
        integrityHash,
        simulatedBlock: blockNumber,
        revertReason: `No contract bytecode found at ${params.to} on Fuji.`,
        warnings: ["Invalid contract deployment."],
        unverifiedConditions,
        simulatedAt: nowIso,
      };
    }
  } catch (rpcErr: any) {
    return {
      status: "SIMULATION_UNAVAILABLE",
      txType,
      chainId,
      from: params.from,
      to: params.to,
      functionName,
      integrityHash,
      revertReason: `RPC unavailable during simulation: ${rpcErr?.message || "timeout"}`,
      warnings: ["Không thể kết nối Fuji RPC để chạy eth_call."],
      unverifiedConditions,
      simulatedAt: nowIso,
    };
  }

  // 3. Execute live eth_call first with exact `from` user address so on-chain Policy/Oracle
  // errors (ExceedsMaxTxAmount, SlippageTooHigh, StaleOraclePrice, EnforcedPause) are caught
  // directly from EVM execution even before ERC20 allowance is granted.
  const callReq = {
    from: params.from,
    to: params.to,
    data: params.data,
    value: BigInt(valueStr),
  };

  try {
    const [rawReturn, gasEst] = await withRpcTimeout(
      Promise.all([
        activeProvider.call(callReq),
        activeProvider.estimateGas(callReq),
      ]),
      "EVM eth_call & estimateGas"
    );

    let simulatedOutputAvax: string | undefined;
    if (txType === "SWAP" && rawReturn && rawReturn !== "0x") {
      const decodedResult = executorIface.decodeFunctionResult(
        "executeSwap",
        rawReturn
      );
      simulatedOutputAvax = ethers.formatEther(decodedResult[0]);
    }

    return {
      status: "SIMULATION_PASSED",
      txType,
      chainId,
      from: params.from,
      to: params.to,
      functionName,
      integrityHash,
      simulatedBlock: blockNumber,
      estimatedGas: gasEst.toString(),
      simulatedOutputAvax,
      warnings,
      unverifiedConditions,
      simulatedAt: nowIso,
    };
  } catch (simErr: any) {
    const reason = decodeSimulationError(simErr);

    // If SWAP reverted specifically due to ERC20InsufficientAllowance (Step 1 Exact Approve not signed yet),
    // verify user balance & router liquidity: fail fast if either is insufficient, otherwise mark
    // SIMULATION_UNAVAILABLE until Step 1 Exact Approve is confirmed on-chain.
    if (txType === "SWAP" && reason.startsWith("ERC20InsufficientAllowance")) {
      try {
        const decoded = executorIface.parseTransaction({ data: params.data })!;
        const amountInRaw = BigInt(decoded.args[2]);
        const minOutWei = BigInt(decoded.args[3]);
        const musdc = new ethers.Contract(
          env.MUSDC_ADDRESS,
          MOCK_ERC20_ABI,
          activeProvider
        );
        const [bal, allow, routerLiq] = await withRpcTimeout(
          Promise.all([
            musdc.balanceOf(params.from) as Promise<bigint>,
            musdc.allowance(params.from, env.EXECUTOR_ADDRESS) as Promise<bigint>,
            activeProvider.getBalance(env.ROUTER_ADDRESS),
          ]),
          "Check swap balance & liquidity after allowance revert"
        );

        if (bal < amountInRaw) {
          const balMsg = `ERC20InsufficientBalance: Ví hiện có ${ethers.formatUnits(bal, 6)} mUSDC, cần ${ethers.formatUnits(amountInRaw, 6)} mUSDC.`;
          return {
            status: "SIMULATION_FAILED",
            txType,
            chainId,
            from: params.from,
            to: params.to,
            functionName,
            integrityHash,
            simulatedBlock: blockNumber,
            revertReason: balMsg,
            warnings: [balMsg],
            unverifiedConditions,
            simulatedAt: nowIso,
          };
        }

        if (routerLiq < minOutWei) {
          const liqMsg = `InsufficientRouterLiquidity: Pool chỉ còn ${Number(ethers.formatEther(routerLiq)).toFixed(4)} AVAX, cần tối thiểu ${Number(ethers.formatEther(minOutWei)).toFixed(4)} AVAX.`;
          return {
            status: "SIMULATION_FAILED",
            txType,
            chainId,
            from: params.from,
            to: params.to,
            functionName,
            integrityHash,
            simulatedBlock: blockNumber,
            revertReason: liqMsg,
            warnings: [liqMsg],
            unverifiedConditions,
            simulatedAt: nowIso,
          };
        }

        warnings.push(
          `Allowance hiện tại (${ethers.formatUnits(allow, 6)} mUSDC) nhỏ hơn ${ethers.formatUnits(amountInRaw, 6)} mUSDC — cần ký Bước 1 (Exact Approve) trước khi chạy eth_call toàn trình cho executeSwap.`
        );
        unverifiedConditions.push(
          "Phần thực thi swap sau bước safeTransferFrom chỉ có thể mô phỏng trọn vẹn sau khi giao dịch Exact Approve được xác nhận on-chain."
        );
        return {
          status: "SIMULATION_UNAVAILABLE",
          txType,
          chainId,
          from: params.from,
          to: params.to,
          functionName,
          integrityHash,
          simulatedBlock: blockNumber,
          revertReason:
            "Chờ cấp Exact Allowance (Bước 1). Policy on-chain, số dư mUSDC và thanh khoản Router đều hợp lệ.",
          warnings,
          unverifiedConditions,
          simulatedAt: nowIso,
        };
      } catch (innerErr: any) {
        return {
          status: "SIMULATION_UNAVAILABLE",
          txType,
          chainId,
          from: params.from,
          to: params.to,
          functionName,
          integrityHash,
          simulatedBlock: blockNumber,
          revertReason:
            innerErr?.message || "RPC error while checking post-allowance state",
          warnings: ["Không đọc được trạng thái phụ trợ sau khi kiểm tra allowance."],
          unverifiedConditions,
          simulatedAt: nowIso,
        };
      }
    }

    return {
      status: "SIMULATION_FAILED",
      txType,
      chainId,
      from: params.from,
      to: params.to,
      functionName,
      integrityHash,
      simulatedBlock: blockNumber,
      revertReason: reason,
      warnings: [reason],
      unverifiedConditions,
      simulatedAt: nowIso,
    };
  }
}
