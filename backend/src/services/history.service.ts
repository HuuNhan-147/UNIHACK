import { ethers } from "ethers";
import { env } from "../config/env";
import { getContracts, provider, withRpcTimeout } from "./blockchain.service";

export interface OnChainTxRecord {
  hash: string;
  action: string;
  amount: string;
  status: "SUCCESS" | "REVERTED";
  detail: string;
  timestamp: string;
  blockNumber?: number;
  sortTime?: number;
}

export async function getOnChainHistory(
  userAddress: string
): Promise<OnChainTxRecord[]> {
  if (!ethers.isAddress(userAddress)) {
    throw new Error("Invalid wallet address");
  }

  const { executor } = getContracts();
  const latestBlock = await withRpcTimeout(
    provider.getBlockNumber(),
    "Get latest block for history"
  );

  // Fuji public RPC restricts total block range in a batch to <= 100 blocks.
  const fromBlock = Math.max(0, latestBlock - 95);
  const filter = executor.filters.SwapExecuted(userAddress);
  const logs = await withRpcTimeout(
    executor.queryFilter(filter, fromBlock, latestBlock),
    "Query SwapExecuted logs"
  );

  return logs
    .map((log: any) => {
      const amountIn = ethers.formatUnits(log.args?.amountIn ?? 0n, 6);
      const amountOut = ethers.formatEther(log.args?.amountOut ?? 0n);
      const ts = Number(log.args?.timestamp ?? 0n);
      return {
        hash: log.transactionHash,
        action: "Swap mUSDC → AVAX",
        amount: `${amountIn} mUSDC → ${Number(amountOut).toFixed(4)} AVAX`,
        status: "SUCCESS" as const,
        detail: "Verified On-chain (SwapExecuted · Fuji 43113)",
        timestamp: ts ? new Date(ts * 1000).toLocaleTimeString() : "On-chain",
        blockNumber: log.blockNumber,
        sortTime: ts || 0,
      };
    })
    .sort((a, b) => (b.blockNumber ?? 0) - (a.blockNumber ?? 0));
}

export interface GlacierTxSummary {
  txHash: string;
  blockTimestamp: number;
  txStatus: string;
  from: string;
  to: string;
  valueAvax: string;
  methodName?: string;
}

export async function getAvalancheTxHistory(userAddress: string): Promise<{
  address: string;
  chainId: 43113;
  glacierAvailable: boolean;
  glacierTransactions: GlacierTxSummary[];
  swapExecutedEvents: OnChainTxRecord[];
  note: string;
}> {
  if (!ethers.isAddress(userAddress)) {
    throw new Error("Invalid wallet address");
  }

  const swapPromise = getOnChainHistory(userAddress).catch(() => []);
  const glacierPromise = (async (): Promise<{
    ok: boolean;
    txs: GlacierTxSummary[];
  }> => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const url = `https://glacier-api.avax.network/v1/chains/43113/addresses/${userAddress}/transactions?pageSize=12`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, txs: [] };
      const data: any = await res.json();
      const items: any[] = Array.isArray(data?.transactions)
        ? data.transactions
        : [];
      const txs: GlacierTxSummary[] = items
        .map((t) => {
          const native = t?.nativeTransaction || t;
          return {
            txHash: String(native?.txHash || ""),
            blockTimestamp: Number(native?.blockTimestamp || 0),
            txStatus: String(native?.txStatus ?? "1"),
            from: String(native?.from?.address || native?.from || ""),
            to: String(native?.to?.address || native?.to || ""),
            valueAvax: ethers.formatEther(BigInt(native?.value || "0")),
            methodName: native?.method?.methodName || undefined,
          };
        })
        .filter((tx) => tx.txHash.startsWith("0x"));
      return { ok: true, txs };
    } catch {
      return { ok: false, txs: [] };
    }
  })();

  const [swapExecutedEvents, glacierRes] = await Promise.all([
    swapPromise,
    glacierPromise,
  ]);

  // Enrich swapExecutedEvents with confirmed AgentVaultExecutor swaps from Glacier
  // when they are older than the 95-block RPC log window.
  const execLower = (env.EXECUTOR_ADDRESS || "").toLowerCase();
  const seenSwapHashes = new Set(
    swapExecutedEvents.map((e) => e.hash.toLowerCase())
  );
  const mergedSwapEvents = [...swapExecutedEvents];
  for (const g of glacierRes.txs) {
    if (
      execLower &&
      g.to.toLowerCase() === execLower &&
      g.txStatus === "1" &&
      !seenSwapHashes.has(g.txHash.toLowerCase())
    ) {
      seenSwapHashes.add(g.txHash.toLowerCase());
      mergedSwapEvents.push({
        hash: g.txHash,
        action: "Swap mUSDC → AVAX (AgentVaultExecutor)",
        amount: "mUSDC → AVAX",
        status: "SUCCESS",
        detail: "Verified via Avalanche Glacier (AgentVaultExecutor · Fuji 43113)",
        timestamp: g.blockTimestamp
          ? new Date(g.blockTimestamp * 1000).toISOString()
          : "On-chain",
        sortTime: g.blockTimestamp || 0,
      });
    }
  }

  return {
    address: userAddress,
    chainId: 43113,
    glacierAvailable: glacierRes.ok,
    glacierTransactions: glacierRes.txs,
    swapExecutedEvents: mergedSwapEvents,
    note: glacierRes.ok
      ? "Combined Avalanche Fuji Glacier API history and AgentVaultExecutor SwapExecuted events."
      : "Glacier API unavailable; showing AgentVaultExecutor SwapExecuted events from Fuji RPC (last ~95 blocks).",
  };
}

function classifyGlacierTx(tx: GlacierTxSummary): {
  action: string;
  amount: string;
  detail: string;
} {
  const toLower = tx.to.toLowerCase();
  const execLower = (env.EXECUTOR_ADDRESS || "").toLowerCase();
  const musdcLower = (env.MUSDC_ADDRESS || "").toLowerCase();
  const method = (tx.methodName || "").toLowerCase();

  if (toLower === execLower || method.includes("executeswap")) {
    return {
      action: "AgentVault Swap",
      amount: Number(tx.valueAvax) > 0 ? `${Number(tx.valueAvax).toFixed(4)} AVAX` : "mUSDC → AVAX",
      detail: "Indexed via Avalanche Glacier (Fuji 43113)",
    };
  }
  if (toLower === musdcLower) {
    if (method.includes("faucet")) {
      return {
        action: "Faucet Mint",
        amount: "mUSDC",
        detail: "MockERC20 Faucet (Fuji 43113)",
      };
    }
    return {
      action: "mUSDC Allowance / Token Tx",
      amount: "ERC-20",
      detail: `${tx.methodName || "Contract Call"} · Fuji 43113`,
    };
  }
  if (!tx.to) {
    return {
      action: "Contract Deployment",
      amount: `${Number(tx.valueAvax).toFixed(4)} AVAX`,
      detail: "Avalanche Fuji (43113)",
    };
  }
  return {
    action: tx.methodName ? `Call: ${tx.methodName}` : "Fuji Transaction",
    amount: `${Number(tx.valueAvax).toFixed(4)} AVAX`,
    detail: `To ${tx.to.slice(0, 8)}...${tx.to.slice(-4)} (Fuji 43113)`,
  };
}

export function deduplicateHistoryRecords(
  swapEvents: OnChainTxRecord[],
  glacierTxs: GlacierTxSummary[]
): OnChainTxRecord[] {
  const byHash = new Map<string, OnChainTxRecord>();

  for (const ev of swapEvents) {
    if (!ev.hash) continue;
    byHash.set(ev.hash.toLowerCase(), ev);
  }

  for (const g of glacierTxs) {
    const key = g.txHash.toLowerCase();
    if (!key || byHash.has(key)) continue;
    const info = classifyGlacierTx(g);
    const failed = g.txStatus === "0" || g.txStatus.toLowerCase() === "failed";
    byHash.set(key, {
      hash: g.txHash,
      action: info.action,
      amount: info.amount,
      status: failed ? "REVERTED" : "SUCCESS",
      detail: info.detail,
      timestamp: g.blockTimestamp
        ? new Date(g.blockTimestamp * 1000).toLocaleTimeString()
        : "Fuji",
      sortTime: g.blockTimestamp || 0,
    });
  }

  return Array.from(byHash.values()).sort(
    (a, b) => (b.sortTime ?? 0) - (a.sortTime ?? 0)
  );
}

export async function getUnifiedDashboardHistory(
  userAddress: string
): Promise<{
  records: OnChainTxRecord[];
  glacierAvailable: boolean;
  sourceNote: string;
}> {
  const combined = await getAvalancheTxHistory(userAddress);
  const records = deduplicateHistoryRecords(
    combined.swapExecutedEvents,
    combined.glacierTransactions
  );
  return {
    records,
    glacierAvailable: combined.glacierAvailable,
    sourceNote: combined.note,
  };
}
