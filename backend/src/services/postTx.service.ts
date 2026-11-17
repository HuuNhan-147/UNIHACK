import { ethers } from "ethers";
import { provider, withRpcTimeout } from "./blockchain.service";
import { getPortfolio, PortfolioResponse } from "./portfolio.service";
import {
  appendAuditLog,
  getPlan,
  recordDailyUsage,
  savePlan,
} from "./store.service";

export interface PostTxVerificationResult {
  status: "SUCCESS" | "FAILED" | "PENDING";
  txHash: string;
  blockNumber?: number;
  actualBefore?: { avax: string; musdc: string; avaxPct: number };
  actualAfter?: { avax: string; musdc: string; avaxPct: number };
  summary: string;
}

export async function verifyAndRecordTransaction(params: {
  txHash: string;
  userAddress: string;
  planId?: string;
  amountInMusdc?: number;
  prePortfolio?: PortfolioResponse | null;
}): Promise<PostTxVerificationResult> {
  if (!ethers.isHexString(params.txHash, 32)) {
    throw new Error("Invalid transaction hash");
  }

  const receipt = await withRpcTimeout(
    provider.getTransactionReceipt(params.txHash),
    "Fetch transaction receipt"
  );

  if (!receipt) {
    return {
      status: "PENDING",
      txHash: params.txHash,
      summary:
        "Giao dịch đang chờ xác nhận trên Avalanche Fuji. Chưa cập nhật số dư thực tế.",
    };
  }

  if (receipt.status !== 1) {
    if (params.planId) {
      const plan = getPlan(params.planId);
      if (plan) {
        savePlan({ ...plan, status: "FAILED", updatedAt: new Date().toISOString() });
      }
    }
    appendAuditLog({
      userAddress: params.userAddress,
      userRequest: "On-chain Swap Execution",
      planId: params.planId,
      governanceDecision: "EXECUTED",
      policyDecision: "FAILED_ON_CHAIN",
      txHash: params.txHash,
      executionResult: "REVERTED",
      postTxSummary: "Transaction reverted on-chain (receipt.status = 0).",
    });

    return {
      status: "FAILED",
      txHash: params.txHash,
      blockNumber: receipt.blockNumber,
      summary:
        "Giao dịch thất bại (reverted on-chain). Không cập nhật daily limit hay số dư.",
    };
  }

  // Confirmed success on-chain: read actual post-tx portfolio
  const postPortfolio = await getPortfolio(params.userAddress);
  const afterAvax =
    postPortfolio.assets.find((a) => a.symbol === "AVAX")?.balance ?? "0";
  const afterMusdc =
    postPortfolio.assets.find((a) => a.symbol === "mUSDC")?.balance ?? "0";
  const afterAvaxPct =
    postPortfolio.assets.find((a) => a.symbol === "AVAX")?.percentage ?? 0;

  let beforeSnapshot: { avax: string; musdc: string; avaxPct: number } | undefined;
  if (params.prePortfolio) {
    beforeSnapshot = {
      avax:
        params.prePortfolio.assets.find((a) => a.symbol === "AVAX")?.balance ??
        "0",
      musdc:
        params.prePortfolio.assets.find((a) => a.symbol === "mUSDC")?.balance ??
        "0",
      avaxPct:
        params.prePortfolio.assets.find((a) => a.symbol === "AVAX")
          ?.percentage ?? 0,
    };
  }

  if (params.amountInMusdc && params.amountInMusdc > 0) {
    recordDailyUsage(params.userAddress, params.amountInMusdc);
  }

  if (params.planId) {
    const plan = getPlan(params.planId);
    if (plan) {
      savePlan({
        ...plan,
        status: "EXECUTED",
        updatedAt: new Date().toISOString(),
      });
    }
  }

  const summary = beforeSnapshot
    ? `Swap thành công (Block #${receipt.blockNumber}). Số dư AVAX thực tế: ${beforeSnapshot.avax} → ${afterAvax} AVAX (tỷ trọng AVAX: ${beforeSnapshot.avaxPct}% → ${afterAvaxPct}%).`
    : `Swap thành công (Block #${receipt.blockNumber}). Số dư thực tế hiện tại: ${afterAvax} AVAX, ${afterMusdc} mUSDC.`;

  appendAuditLog({
    userAddress: params.userAddress,
    userRequest: "On-chain Swap Execution",
    planId: params.planId,
    governanceDecision: "EXECUTED",
    policyDecision: "CONFIRMED",
    txHash: params.txHash,
    executionResult: "SUCCESS",
    postTxSummary: summary,
  });

  return {
    status: "SUCCESS",
    txHash: params.txHash,
    blockNumber: receipt.blockNumber,
    actualBefore: beforeSnapshot,
    actualAfter: {
      avax: afterAvax,
      musdc: afterMusdc,
      avaxPct: afterAvaxPct,
    },
    summary,
  };
}
