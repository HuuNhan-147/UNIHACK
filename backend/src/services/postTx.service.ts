import { ethers } from "ethers";
import { env } from "../config/env";
import { EXECUTOR_ABI } from "../abi";
import { provider, withRpcTimeout } from "./blockchain.service";
import { getPortfolio, PortfolioResponse } from "./portfolio.service";
import {
  appendAuditLog,
  getPlan,
  hasVerifiedTx,
  markTxVerified,
  recordDailyUsage,
  savePlan,
} from "./store.service";

const executorIface = new ethers.Interface(EXECUTOR_ABI);

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
  if (!ethers.isAddress(params.userAddress)) {
    throw new Error("Invalid userAddress");
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

  if (receipt.from.toLowerCase() !== params.userAddress.toLowerCase()) {
    throw new Error("Transaction sender does not match userAddress.");
  }

  if (hasVerifiedTx(params.txHash)) {
    const postPortfolio = await getPortfolio(params.userAddress);
    const afterAvax =
      postPortfolio.assets.find((a) => a.symbol === "AVAX")?.balance ?? "0";
    const afterMusdc =
      postPortfolio.assets.find((a) => a.symbol === "mUSDC")?.balance ?? "0";
    const afterAvaxPct =
      postPortfolio.assets.find((a) => a.symbol === "AVAX")?.percentage ?? 0;

    return {
      status: receipt.status === 1 ? "SUCCESS" : "FAILED",
      txHash: params.txHash,
      blockNumber: receipt.blockNumber,
      actualAfter: {
        avax: afterAvax,
        musdc: afterMusdc,
        avaxPct: afterAvaxPct,
      },
      summary: `Giao dịch đã được xác nhận trước đó (Block #${receipt.blockNumber}).`,
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

  let verifiedSwapAmountMusdc = 0;
  if (params.amountInMusdc && params.amountInMusdc > 0) {
    if (
      !receipt.to ||
      receipt.to.toLowerCase() !== env.EXECUTOR_ADDRESS.toLowerCase()
    ) {
      throw new Error(
        "Transaction target is not AgentVaultExecutor; cannot record swap usage."
      );
    }

    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== env.EXECUTOR_ADDRESS.toLowerCase()) {
        continue;
      }
      try {
        const parsed = executorIface.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (
          parsed?.name === "SwapExecuted" &&
          String(parsed.args.user).toLowerCase() ===
            params.userAddress.toLowerCase()
        ) {
          verifiedSwapAmountMusdc = Number(
            ethers.formatUnits(parsed.args.amountIn, 6)
          );
          break;
        }
      } catch {
        // ignore non-matching logs
      }
    }

    if (verifiedSwapAmountMusdc <= 0) {
      throw new Error(
        "No matching SwapExecuted event found in transaction receipt."
      );
    }
  }

  if (verifiedSwapAmountMusdc > 0) {
    recordDailyUsage(params.userAddress, verifiedSwapAmountMusdc);
  }
  markTxVerified(params.txHash);

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
