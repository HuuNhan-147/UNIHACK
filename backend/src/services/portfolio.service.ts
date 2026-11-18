import { ethers } from "ethers";
import { env } from "../config/env";
import { CHAINLINK_AGGREGATOR_ABI } from "../abi";
import { getContracts, provider, withRpcTimeout } from "./blockchain.service";

export interface PortfolioAsset {
  symbol: "AVAX" | "mUSDC";
  name: string;
  balance: string;
  priceUsd: number;
  valueUsd: number;
  percentage: number;
}

export type AvaxPriceSource = "CHAINLINK_FUJI" | "LIVE_API" | "FALLBACK_REF";

export interface PortfolioResponse {
  address: string;
  chainId: number;
  totalValueUsd: number;
  priceSource: AvaxPriceSource;
  oracleUpdatedAt?: string;
  fallbackReason?: string;
  assets: PortfolioAsset[];
}

const FALLBACK_AVAX_PRICE_USD = 25;
const MUSDC_REF_PRICE_USD = 1;
const PRICE_CACHE_TTL_MS = 60_000;
export const MAX_CHAINLINK_STALE_SEC = 86_400; // 24 hours for Fuji testnet feed

export function validateChainlinkRound(params: {
  roundId: bigint;
  answer: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;
  decimals: number;
  nowSec?: number;
  maxAgeSec?: number;
}): { valid: boolean; priceUsd?: number; updatedAtIso?: string; reason?: string } {
  const nowSec = params.nowSec ?? Math.floor(Date.now() / 1000);
  const maxAgeSec = params.maxAgeSec ?? MAX_CHAINLINK_STALE_SEC;

  if (params.roundId <= 0n) {
    return { valid: false, reason: "Invalid Chainlink roundId (0)." };
  }
  if (params.answeredInRound < params.roundId) {
    return {
      valid: false,
      reason: `Incomplete Chainlink round (answeredInRound ${params.answeredInRound} < roundId ${params.roundId}).`,
    };
  }
  if (params.answer <= 0n) {
    return {
      valid: false,
      reason: `Invalid Chainlink answer (${params.answer}).`,
    };
  }
  if (params.updatedAt <= 0n) {
    return { valid: false, reason: "Chainlink updatedAt is 0." };
  }

  const updatedSec = Number(params.updatedAt);
  if (updatedSec > nowSec + 300) {
    return { valid: false, reason: "Chainlink updatedAt is in the future." };
  }
  if (nowSec - updatedSec > maxAgeSec) {
    return {
      valid: false,
      reason: `Stale Chainlink price (age ${nowSec - updatedSec}s > ${maxAgeSec}s).`,
    };
  }

  const price = Number(params.answer) / 10 ** params.decimals;
  if (!Number.isFinite(price) || price <= 0) {
    return { valid: false, reason: "Computed Chainlink price is non-positive." };
  }

  return {
    valid: true,
    priceUsd: Number(price.toFixed(4)),
    updatedAtIso: new Date(updatedSec * 1000).toISOString(),
  };
}

let cachedAvaxPrice: {
  price: number;
  source: AvaxPriceSource;
  oracleUpdatedAt?: string;
  fallbackReason?: string;
  fetchedAt: number;
} | null = null;

export async function fetchLiveAvaxPriceUsd(): Promise<{
  price: number;
  source: AvaxPriceSource;
  oracleUpdatedAt?: string;
  fallbackReason?: string;
}> {
  if (
    cachedAvaxPrice &&
    Date.now() - cachedAvaxPrice.fetchedAt < PRICE_CACHE_TTL_MS
  ) {
    return {
      price: cachedAvaxPrice.price,
      source: cachedAvaxPrice.source,
      oracleUpdatedAt: cachedAvaxPrice.oracleUpdatedAt,
      fallbackReason: cachedAvaxPrice.fallbackReason,
    };
  }

  let chainlinkRejectReason: string | undefined;

  // 1. Primary: Validated On-chain Chainlink AVAX/USD Price Feed on Avalanche Fuji
  if (ethers.isAddress(env.CHAINLINK_AVAX_USD_FEED)) {
    try {
      const feed = new ethers.Contract(
        env.CHAINLINK_AVAX_USD_FEED,
        CHAINLINK_AGGREGATOR_ABI,
        provider
      );
      const [decimals, roundData] = await withRpcTimeout(
        Promise.all([feed.decimals(), feed.latestRoundData()]),
        "Chainlink AVAX/USD feed"
      );

      const check = validateChainlinkRound({
        roundId: BigInt(roundData.roundId),
        answer: BigInt(roundData.answer),
        updatedAt: BigInt(roundData.updatedAt),
        answeredInRound: BigInt(roundData.answeredInRound),
        decimals: Number(decimals),
      });

      if (check.valid && check.priceUsd) {
        cachedAvaxPrice = {
          price: check.priceUsd,
          source: "CHAINLINK_FUJI",
          oracleUpdatedAt: check.updatedAtIso,
          fetchedAt: Date.now(),
        };
        return {
          price: check.priceUsd,
          source: "CHAINLINK_FUJI",
          oracleUpdatedAt: check.updatedAtIso,
        };
      }
      chainlinkRejectReason = check.reason;
      console.warn(`[OracleGuard] Rejected Chainlink data: ${check.reason}`);
    } catch (err: any) {
      chainlinkRejectReason = err?.message || "Chainlink RPC error";
      console.warn(`[OracleGuard] Chainlink feed error: ${chainlinkRejectReason}`);
    }
  }

  // 2. Secondary: DeFiLlama live price API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      "https://coins.llama.fi/prices/current/coingecko:avalanche-2",
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (res.ok) {
      const data: any = await res.json();
      const price = Number(data?.coins?.["coingecko:avalanche-2"]?.price);
      if (Number.isFinite(price) && price > 0) {
        cachedAvaxPrice = {
          price,
          source: "LIVE_API",
          fallbackReason: chainlinkRejectReason,
          fetchedAt: Date.now(),
        };
        return {
          price,
          source: "LIVE_API",
          fallbackReason: chainlinkRejectReason,
        };
      }
    }
  } catch {
    // Fallback below
  }

  const finalReason =
    chainlinkRejectReason || "Both Chainlink Fuji and DeFiLlama API unavailable";
  cachedAvaxPrice = {
    price: FALLBACK_AVAX_PRICE_USD,
    source: "FALLBACK_REF",
    fallbackReason: finalReason,
    fetchedAt: Date.now(),
  };
  return {
    price: FALLBACK_AVAX_PRICE_USD,
    source: "FALLBACK_REF",
    fallbackReason: finalReason,
  };
}

export async function getPortfolio(address: string): Promise<PortfolioResponse> {
  if (!ethers.isAddress(address)) {
    throw new Error("Invalid wallet address");
  }

  const { musdc } = getContracts();

  const [[avaxWei, musdcRaw], priceInfo] = await Promise.all([
    withRpcTimeout(
      Promise.all([provider.getBalance(address), musdc.balanceOf(address)]),
      "Fetch portfolio balances"
    ),
    fetchLiveAvaxPriceUsd(),
  ]);

  const avaxBalance = Number(ethers.formatEther(avaxWei));
  const musdcBalance = Number(ethers.formatUnits(musdcRaw, 6));

  const avaxValueUsd = Number((avaxBalance * priceInfo.price).toFixed(2));
  const musdcValueUsd = Number((musdcBalance * MUSDC_REF_PRICE_USD).toFixed(2));
  const totalValueUsd = Number((avaxValueUsd + musdcValueUsd).toFixed(2));

  const calcPct = (val: number) =>
    totalValueUsd > 0 ? Number(((val / totalValueUsd) * 100).toFixed(1)) : 0;

  return {
    address,
    chainId: 43113,
    totalValueUsd,
    priceSource: priceInfo.source,
    oracleUpdatedAt: priceInfo.oracleUpdatedAt,
    fallbackReason: priceInfo.fallbackReason,
    assets: [
      {
        symbol: "AVAX",
        name: "Avalanche (Fuji Testnet)",
        balance: avaxBalance.toFixed(4),
        priceUsd: Number(priceInfo.price.toFixed(2)),
        valueUsd: avaxValueUsd,
        percentage: calcPct(avaxValueUsd),
      },
      {
        symbol: "mUSDC",
        name: "Mock USD Coin (Fuji Testnet)",
        balance: musdcBalance.toFixed(2),
        priceUsd: MUSDC_REF_PRICE_USD,
        valueUsd: musdcValueUsd,
        percentage: calcPct(musdcValueUsd),
      },
    ],
  };
}
