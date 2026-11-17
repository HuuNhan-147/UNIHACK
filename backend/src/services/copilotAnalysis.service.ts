import { ethers } from "ethers";
import { getContracts, withRpcTimeout } from "./blockchain.service";
import {
  AvaxPriceSource,
  fetchLiveAvaxPriceUsd,
  getPortfolio,
} from "./portfolio.service";
import { getAavePosition, AaveUserAccountData } from "./aave.service";

export interface SwapQuoteResult {
  tokenIn: "mUSDC";
  tokenOut: "AVAX";
  amountInMusdc: string;
  expectedOutAvax: string;
  minAmountOutAvax: string;
  slippageBps: number;
  effectiveRateMusdcPerAvax: string;
  routerType: string;
  oracleEnabled: boolean;
  isExecuted: false;
  quotedAt: string;
}

export async function getSwapQuoteDeterministic(
  amountInMusdc: number,
  slippageBps = 100
): Promise<SwapQuoteResult> {
  if (!Number.isFinite(amountInMusdc) || amountInMusdc <= 0) {
    throw new Error("amountInMusdc must be a positive number.");
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 1 || slippageBps > 1000) {
    throw new Error("slippageBps must be an integer between 1 and 1000.");
  }

  const { router } = getContracts();
  const amountInRaw = ethers.parseUnits(amountInMusdc.toFixed(6), 6);

  const [expectedOutWei, rateRaw, oracleEnabled] = await withRpcTimeout(
    Promise.all([
      router.getAmountOut(amountInRaw) as Promise<bigint>,
      router.rateMusdcPerAvax() as Promise<bigint>,
      router.useOracle().catch(() => false) as Promise<boolean>,
    ]),
    "Fetch deterministic swap quote"
  );

  const minAmountOutWei =
    (expectedOutWei * BigInt(10_000 - slippageBps)) / 10_000n;

  return {
    tokenIn: "mUSDC",
    tokenOut: "AVAX",
    amountInMusdc: ethers.formatUnits(amountInRaw, 6),
    expectedOutAvax: ethers.formatEther(expectedOutWei),
    minAmountOutAvax: ethers.formatEther(minAmountOutWei),
    slippageBps,
    effectiveRateMusdcPerAvax: ethers.formatUnits(rateRaw, 6),
    routerType: oracleEnabled
      ? "Chainlink-Backed Router (Avalanche Fuji Testnet)"
      : "MockDEXRouter (Avalanche Fuji Testnet)",
    oracleEnabled,
    isExecuted: false,
    quotedAt: new Date().toISOString(),
  };
}

export interface PortfolioAllocationAnalysis {
  address: string;
  totalValueUsd: number;
  priceSource: AvaxPriceSource;
  avaxPriceUsd: number;
  currentAllocation: {
    avaxBalance: string;
    avaxPct: number;
    musdcBalance: string;
    musdcPct: number;
  };
  concentrationRisk: "HIGH_VOLATILE" | "BALANCED" | "HIGH_STABLE" | "EMPTY";
  hypotheticalAfterSwap?: {
    assumedSwapMusdc: string;
    quotedOutAvax: string;
    projectedAvaxBalance: string;
    projectedMusdcBalance: string;
    projectedAvaxPct: number;
    projectedMusdcPct: number;
    note: string;
  };
  analyzedAt: string;
}

export async function analyzePortfolioAllocation(
  address: string,
  hypotheticalSwapMusdc?: number
): Promise<PortfolioAllocationAnalysis> {
  const portfolio = await getPortfolio(address);
  const avaxAsset = portfolio.assets.find((a) => a.symbol === "AVAX");
  const musdcAsset = portfolio.assets.find((a) => a.symbol === "mUSDC");

  const avaxBal = Number(avaxAsset?.balance ?? 0);
  const musdcBal = Number(musdcAsset?.balance ?? 0);
  const avaxPct = avaxAsset?.percentage ?? 0;
  const musdcPct = musdcAsset?.percentage ?? 0;
  const avaxPrice = avaxAsset?.priceUsd ?? 25;

  let concentrationRisk: PortfolioAllocationAnalysis["concentrationRisk"] =
    "BALANCED";
  if (portfolio.totalValueUsd <= 0) {
    concentrationRisk = "EMPTY";
  } else if (avaxPct >= 80) {
    concentrationRisk = "HIGH_VOLATILE";
  } else if (musdcPct >= 80) {
    concentrationRisk = "HIGH_STABLE";
  }

  let hypotheticalAfterSwap: PortfolioAllocationAnalysis["hypotheticalAfterSwap"];
  if (hypotheticalSwapMusdc && hypotheticalSwapMusdc > 0) {
    if (hypotheticalSwapMusdc > musdcBal) {
      throw new Error(
        `Insufficient mUSDC for hypothetical swap (${musdcBal} available < ${hypotheticalSwapMusdc} requested).`
      );
    }
    const quote = await getSwapQuoteDeterministic(hypotheticalSwapMusdc, 100);
    const outAvax = Number(quote.expectedOutAvax);
    const projAvax = avaxBal + outAvax;
    const projMusdc = musdcBal - hypotheticalSwapMusdc;
    const projAvaxUsd = projAvax * avaxPrice;
    const projMusdcUsd = projMusdc * 1;
    const projTotal = projAvaxUsd + projMusdcUsd;

    hypotheticalAfterSwap = {
      assumedSwapMusdc: quote.amountInMusdc,
      quotedOutAvax: quote.expectedOutAvax,
      projectedAvaxBalance: projAvax.toFixed(4),
      projectedMusdcBalance: projMusdc.toFixed(2),
      projectedAvaxPct:
        projTotal > 0 ? Number(((projAvaxUsd / projTotal) * 100).toFixed(1)) : 0,
      projectedMusdcPct:
        projTotal > 0
          ? Number(((projMusdcUsd / projTotal) * 100).toFixed(1))
          : 0,
      note: "Hypothetical simulation only (not executed). Uses MockDEXRouter Fuji quote + live AVAX reference price.",
    };
  }

  return {
    address,
    totalValueUsd: portfolio.totalValueUsd,
    priceSource: portfolio.priceSource,
    avaxPriceUsd: avaxPrice,
    currentAllocation: {
      avaxBalance: avaxAsset?.balance ?? "0",
      avaxPct,
      musdcBalance: musdcAsset?.balance ?? "0",
      musdcPct,
    },
    concentrationRisk,
    hypotheticalAfterSwap,
    analyzedAt: new Date().toISOString(),
  };
}

export interface PositionRiskResult {
  address: string;
  onChainLendingPositionFound: boolean;
  network: "Avalanche Fuji (43113)";
  portfolioVolatilityExposurePct: number;
  avaxPriceDrop20PctImpactUsd: number;
  aavePosition?: AaveUserAccountData;
  lendingRisk?: {
    collateralAvax: number;
    debtUsd: number;
    liquidationThreshold: number;
    currentCollateralValueUsd: number;
    healthFactor: number;
    liquidationPriceAvaxUsd: number;
    status: "SAFE" | "CAUTION" | "LIQUIDATABLE";
  };
  limitations: string;
  calculatedAt: string;
}

export async function calculatePositionRisk(params: {
  address: string;
  collateralAvax?: number;
  debtUsd?: number;
  liquidationThreshold?: number;
}): Promise<PositionRiskResult> {
  const [portfolio, priceInfo, aavePosition] = await Promise.all([
    getPortfolio(params.address),
    fetchLiveAvaxPriceUsd(),
    getAavePosition(params.address).catch(() => undefined),
  ]);

  const avaxAsset = portfolio.assets.find((a) => a.symbol === "AVAX");
  const avaxValueUsd = avaxAsset?.valueUsd ?? 0;
  const avaxPct = avaxAsset?.percentage ?? 0;
  const drop20Impact = Number((avaxValueUsd * 0.2).toFixed(2));

  const hasUserSuppliedLending =
    typeof params.collateralAvax === "number" &&
    params.collateralAvax > 0 &&
    typeof params.debtUsd === "number" &&
    params.debtUsd > 0;

  let lendingRisk: PositionRiskResult["lendingRisk"];
  if (hasUserSuppliedLending) {
    const threshold =
      params.liquidationThreshold &&
      params.liquidationThreshold > 0 &&
      params.liquidationThreshold <= 1
        ? params.liquidationThreshold
        : 0.8;
    const collateralUsd = params.collateralAvax! * priceInfo.price;
    const hf = (collateralUsd * threshold) / params.debtUsd!;
    const liqPrice = params.debtUsd! / (params.collateralAvax! * threshold);

    lendingRisk = {
      collateralAvax: params.collateralAvax!,
      debtUsd: params.debtUsd!,
      liquidationThreshold: threshold,
      currentCollateralValueUsd: Number(collateralUsd.toFixed(2)),
      healthFactor: Number(hf.toFixed(3)),
      liquidationPriceAvaxUsd: Number(liqPrice.toFixed(2)),
      status: hf < 1 ? "LIQUIDATABLE" : hf < 1.3 ? "CAUTION" : "SAFE",
    };
  }

  const hasLiveAave = Boolean(aavePosition?.hasPosition);
  let limitations: string;
  if (hasLiveAave) {
    limitations =
      "Live Aave V3 Fuji position metrics were read directly from Aave V3 Pool on-chain.";
  } else if (hasUserSuppliedLending) {
    limitations =
      "No live Aave V3 position found on Fuji for this wallet; Health Factor and Liquidation Price were computed deterministically from user-supplied parameters and current AVAX reference price.";
  } else {
    limitations = aavePosition?.configured
      ? "No active Aave V3 Fuji lending/borrowing position found for this wallet. Supply collateral/debt parameters to simulate Health Factor."
      : "AAVE_V3_POOL_ADDRESS is not configured in backend/.env. Supply collateral, debt, and liquidation threshold parameters to simulate Health Factor.";
  }

  return {
    address: params.address,
    onChainLendingPositionFound: hasLiveAave,
    network: "Avalanche Fuji (43113)",
    portfolioVolatilityExposurePct: avaxPct,
    avaxPriceDrop20PctImpactUsd: drop20Impact,
    aavePosition,
    lendingRisk,
    limitations,
    calculatedAt: new Date().toISOString(),
  };
}

export interface AvalancheYieldPool {
  protocol: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number | null;
  apyReward: number | null;
}

export interface AvalancheYieldsResponse {
  source: "DEFILLAMA_LIVE" | "UNAVAILABLE";
  chainScope: "Avalanche Mainnet (reference data only, separate from Fuji testnet)";
  pools: AvalancheYieldPool[];
  disclaimer: string;
  fetchedAt: string;
}

let cachedYields: { data: AvalancheYieldsResponse; fetchedAt: number } | null =
  null;
const YIELD_CACHE_MS = 5 * 60_000;

export async function getAvalancheProtocolYields(
  protocolFilter?: string
): Promise<AvalancheYieldsResponse> {
  if (
    !protocolFilter &&
    cachedYields &&
    Date.now() - cachedYields.fetchedAt < YIELD_CACHE_MS
  ) {
    return cachedYields.data;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch("https://yields.llama.fi/pools", {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`DeFiLlama HTTP ${res.status}`);
    }

    const json: any = await res.json();
    const rawPools: any[] = Array.isArray(json?.data) ? json.data : [];

    let avaxPools = rawPools.filter(
      (p) =>
        p?.chain === "Avalanche" &&
        typeof p?.tvlUsd === "number" &&
        p.tvlUsd > 100_000 &&
        typeof p?.apy === "number"
    );

    if (protocolFilter && protocolFilter.trim()) {
      const q = protocolFilter.trim().toLowerCase();
      avaxPools = avaxPools.filter(
        (p) =>
          String(p.project || "")
            .toLowerCase()
            .includes(q) ||
          String(p.symbol || "")
            .toLowerCase()
            .includes(q)
      );
    }

    const topPools: AvalancheYieldPool[] = avaxPools
      .sort((a, b) => b.tvlUsd - a.tvlUsd)
      .slice(0, 6)
      .map((p) => ({
        protocol: String(p.project),
        symbol: String(p.symbol),
        tvlUsd: Math.round(p.tvlUsd),
        apy: Number(p.apy.toFixed(2)),
        apyBase:
          typeof p.apyBase === "number" ? Number(p.apyBase.toFixed(2)) : null,
        apyReward:
          typeof p.apyReward === "number"
            ? Number(p.apyReward.toFixed(2))
            : null,
      }));

    const result: AvalancheYieldsResponse = {
      source: "DEFILLAMA_LIVE",
      chainScope:
        "Avalanche Mainnet (reference data only, separate from Fuji testnet)",
      pools: topPools,
      disclaimer:
        "APYs are variable historical/current snapshots from DeFiLlama and are NOT guaranteed future returns.",
      fetchedAt: new Date().toISOString(),
    };

    if (!protocolFilter) {
      cachedYields = { data: result, fetchedAt: Date.now() };
    }
    return result;
  } catch {
    return {
      source: "UNAVAILABLE",
      chainScope:
        "Avalanche Mainnet (reference data only, separate from Fuji testnet)",
      pools: [],
      disclaimer:
        "Live DeFiLlama yield API is currently unreachable. Refusing to fabricate APY/TVL numbers.",
      fetchedAt: new Date().toISOString(),
    };
  }
}
