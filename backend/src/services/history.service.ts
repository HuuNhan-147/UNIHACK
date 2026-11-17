import { ethers } from "ethers";
import { getContracts, provider, withRpcTimeout } from "./blockchain.service";

export interface OnChainTxRecord {
  hash: string;
  action: string;
  amount: string;
  status: "SUCCESS";
  detail: string;
  timestamp: string;
  blockNumber: number;
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
        detail: "Verified On-chain (SwapExecuted)",
        timestamp: ts ? new Date(ts * 1000).toLocaleTimeString() : "On-chain",
        blockNumber: log.blockNumber,
      };
    })
    .sort((a, b) => b.blockNumber - a.blockNumber);
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
      const url = `https://glacier-api.avax.network/v1/chains/43113/addresses/${userAddress}/transactions?pageSize=8`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, txs: [] };
      const data: any = await res.json();
      const items: any[] = Array.isArray(data?.transactions)
        ? data.transactions
        : [];
      const txs: GlacierTxSummary[] = items.map((t) => ({
        txHash: String(t?.nativeTransaction?.txHash || ""),
        blockTimestamp: Number(t?.nativeTransaction?.blockTimestamp || 0),
        txStatus: String(t?.nativeTransaction?.txStatus || "unknown"),
        from: String(t?.nativeTransaction?.from?.address || ""),
        to: String(t?.nativeTransaction?.to?.address || ""),
        valueAvax: ethers.formatEther(
          BigInt(t?.nativeTransaction?.value || "0")
        ),
        methodName: t?.nativeTransaction?.method?.methodName || undefined,
      }));
      return { ok: true, txs };
    } catch {
      return { ok: false, txs: [] };
    }
  })();

  const [swapExecutedEvents, glacierRes] = await Promise.all([
    swapPromise,
    glacierPromise,
  ]);

  return {
    address: userAddress,
    chainId: 43113,
    glacierAvailable: glacierRes.ok,
    glacierTransactions: glacierRes.txs,
    swapExecutedEvents,
    note: glacierRes.ok
      ? "Combined Avalanche Fuji Glacier API history and AgentVaultExecutor SwapExecuted events (last ~95 blocks)."
      : "Glacier API unavailable; showing AgentVaultExecutor SwapExecuted events from Fuji RPC (last ~95 blocks).",
  };
}
