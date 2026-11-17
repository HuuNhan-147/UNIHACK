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
  assets: PortfolioAsset[];
}

const FALLBACK_AVAX_PRICE_USD = 25;
const MUSDC_REF_PRICE_USD = 1;
const PRICE_CACHE_TTL_MS = 60_000;

let cachedAvaxPrice: { price: number; source: AvaxPriceSource; fetchedAt: number } | null = null;

export async function fetchLiveAvaxPriceUsd(): Promise<{
  price: number;
  source: AvaxPriceSource;
}> {
  if (
    cachedAvaxPrice &&
    Date.now() - cachedAvaxPrice.fetchedAt < PRICE_CACHE_TTL_MS
  ) {
    return { price: cachedAvaxPrice.price, source: cachedAvaxPrice.source };
  }

  // 1. Primary: On-chain Chainlink AVAX/USD Price Feed on Avalanche Fuji
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
      const answer = Number(roundData.answer);
      const scale = 10 ** Number(decimals);
      const chainlinkPrice = answer / scale;
      if (Number.isFinite(chainlinkPrice) && chainlinkPrice > 0) {
        const rounded = Number(chainlinkPrice.toFixed(4));
        cachedAvaxPrice = {
          price: rounded,
          source: "CHAINLINK_FUJI",
          fetchedAt: Date.now(),
        };
        return { price: rounded, source: "CHAINLINK_FUJI" };
      }
    } catch {
      // Fall through to DeFiLlama API
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
        cachedAvaxPrice = { price, source: "LIVE_API", fetchedAt: Date.now() };
        return { price, source: "LIVE_API" };
      }
    }
  } catch {
    // Fallback below
  }

  cachedAvaxPrice = {
    price: FALLBACK_AVAX_PRICE_USD,
    source: "FALLBACK_REF",
    fetchedAt: Date.now(),
  };
  return { price: FALLBACK_AVAX_PRICE_USD, source: "FALLBACK_REF" };
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
    assets: [
      {
        symbol: "AVAX",
        name: "Avalanche (Testnet)",
        balance: avaxBalance.toFixed(4),
        priceUsd: Number(priceInfo.price.toFixed(2)),
        valueUsd: avaxValueUsd,
        percentage: calcPct(avaxValueUsd),
      },
      {
        symbol: "mUSDC",
        name: "Mock USD Coin",
        balance: musdcBalance.toFixed(2),
        priceUsd: MUSDC_REF_PRICE_USD,
        valueUsd: musdcValueUsd,
        percentage: calcPct(musdcValueUsd),
      },
    ],
  };
}
