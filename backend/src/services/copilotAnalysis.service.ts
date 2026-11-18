import { ethers } from "ethers";
import { env } from "../config/env";
import { getContracts, provider, withRpcTimeout } from "./blockchain.service";
import {
  AvaxPriceSource,
  fetchLiveAvaxPriceUsd,
  getPortfolio,
} from "./portfolio.service";
import { getAavePosition, AaveUserAccountData } from "./aave.service";

export type RiskDataSource =
  | "ON_CHAIN"
  | "EXTERNAL_API"
  | "DETERMINISTIC_MATH"
  | "INSUFFICIENT_DATA";

export interface MetricProvenance {
  source: RiskDataSource;
  updatedAt: string;
  detail: string;
}

export interface AllowanceExposureMetric {
  spenderAddress: string;
  approvedMusdc: string;
  walletBalanceMusdc: string;
  exceedsWalletBalance: boolean;
  riskLevel: "NONE" | "LOW" | "MODERATE" | "HIGH" | "INSUFFICIENT_DATA";
  source: RiskDataSource;
  updatedAt: string;
}

export interface RouterLiquidityMetric {
  routerAddress: string;
  availableAvax: string;
  maxSwappableMusdc: string;
  priceImpactBps: number;
  priceImpactModel: string;
  riskLevel: "ADEQUATE" | "LIMITED" | "DEPLETED" | "INSUFFICIENT_DATA";
  source: RiskDataSource;
  updatedAt: string;
}

export async function getAllowanceAndLiquidityRisk(
  userAddress: string
): Promise<{
  allowanceExposure: AllowanceExposureMetric;
  routerLiquidityRisk: RouterLiquidityMetric;
}> {
  const nowIso = new Date().toISOString();
  try {
    const { musdc, router } = getContracts();
    const [allowanceRaw, musdcBalRaw, routerAvaxWei, rateRaw] =
      await withRpcTimeout(
        Promise.all([
          musdc.allowance(userAddress, env.EXECUTOR_ADDRESS) as Promise<bigint>,
          musdc.balanceOf(userAddress) as Promise<bigint>,
          provider.getBalance(env.ROUTER_ADDRESS),
          router.rateMusdcPerAvax() as Promise<bigint>,
        ]),
        "Fetch allowance exposure & router liquidity risk"
      );

    const approvedNum = Number(ethers.formatUnits(allowanceRaw, 6));
    const balNum = Number(ethers.formatUnits(musdcBalRaw, 6));
    const routerAvaxNum = Number(ethers.formatEther(routerAvaxWei));
    const rateNum = Number(ethers.formatUnits(rateRaw, 6));
    const maxSwapMusdc = routerAvaxNum * rateNum;

    let allowanceRisk: AllowanceExposureMetric["riskLevel"] = "NONE";
    if (approvedNum > 300) {
      allowanceRisk = "HIGH";
    } else if (approvedNum > 50 || (approvedNum > 0 && approvedNum > balNum)) {
      allowanceRisk = "MODERATE";
    } else if (approvedNum > 0) {
      allowanceRisk = "LOW";
    }

    let liqRisk: RouterLiquidityMetric["riskLevel"] = "ADEQUATE";
    if (routerAvaxNum <= 0) {
      liqRisk = "DEPLETED";
    } else if (routerAvaxNum < 2) {
      liqRisk = "LIMITED";
    }

    return {
      allowanceExposure: {
        spenderAddress: env.EXECUTOR_ADDRESS,
        approvedMusdc: approvedNum.toFixed(2),
        walletBalanceMusdc: balNum.toFixed(2),
        exceedsWalletBalance: approvedNum > balNum && approvedNum > 0,
        riskLevel: allowanceRisk,
        source: "ON_CHAIN",
        updatedAt: nowIso,
      },
      routerLiquidityRisk: {
        routerAddress: env.ROUTER_ADDRESS,
        availableAvax: routerAvaxNum.toFixed(4),
        maxSwappableMusdc: maxSwapMusdc.toFixed(2),
        priceImpactBps: 0,
        priceImpactModel:
          "Chainlink Oracle-pegged Router (0 bps curve price impact up to pool liquidity cap; reverts 100% if output exceeds available AVAX).",
        riskLevel: liqRisk,
        source: "ON_CHAIN",
        updatedAt: nowIso,
      },
    };
  } catch {
    return {
      allowanceExposure: {
        spenderAddress: env.EXECUTOR_ADDRESS,
        approvedMusdc: "INSUFFICIENT_DATA",
        walletBalanceMusdc: "INSUFFICIENT_DATA",
        exceedsWalletBalance: false,
        riskLevel: "INSUFFICIENT_DATA",
        source: "INSUFFICIENT_DATA",
        updatedAt: nowIso,
      },
      routerLiquidityRisk: {
        routerAddress: env.ROUTER_ADDRESS,
        availableAvax: "INSUFFICIENT_DATA",
        maxSwappableMusdc: "INSUFFICIENT_DATA",
        priceImpactBps: 0,
        priceImpactModel: "INSUFFICIENT_DATA",
        riskLevel: "INSUFFICIENT_DATA",
        source: "INSUFFICIENT_DATA",
        updatedAt: nowIso,
      },
    };
  }
}

export interface SwapQuoteResult {
  tokenIn: "mUSDC";
  tokenOut: "AVAX";
  amountInMusdc: string;
  expectedOutAvax: string;
  minAmountOutAvax: string;
  slippageBps: number;
  effectiveRateMusdcPerAvax: string;
  routerAvailableAvax: string;
  sufficientRouterLiquidity: boolean;
  priceImpactBps: number;
  priceImpactNote: string;
  routerType: string;
  oracleEnabled: boolean;
  dataSource: "ON_CHAIN";
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

  const [expectedOutWei, rateRaw, oracleEnabled, routerAvaxWei] =
    await withRpcTimeout(
      Promise.all([
        router.getAmountOut(amountInRaw) as Promise<bigint>,
        router.rateMusdcPerAvax() as Promise<bigint>,
        router.useOracle().catch(() => false) as Promise<boolean>,
        provider.getBalance(env.ROUTER_ADDRESS),
      ]),
      "Fetch deterministic swap quote"
    );

  const minAmountOutWei =
    (expectedOutWei * BigInt(10_000 - slippageBps)) / 10_000n;
  const sufficientLiq = routerAvaxWei >= minAmountOutWei;
  const routerAvaxFormatted = Number(ethers.formatEther(routerAvaxWei)).toFixed(4);

  return {
    tokenIn: "mUSDC",
    tokenOut: "AVAX",
    amountInMusdc: ethers.formatUnits(amountInRaw, 6),
    expectedOutAvax: ethers.formatEther(expectedOutWei),
    minAmountOutAvax: ethers.formatEther(minAmountOutWei),
    slippageBps,
    effectiveRateMusdcPerAvax: ethers.formatUnits(rateRaw, 6),
    routerAvailableAvax: routerAvaxFormatted,
    sufficientRouterLiquidity: sufficientLiq,
    priceImpactBps: 0,
    priceImpactNote: sufficientLiq
      ? `0 bps curve impact (Chainlink Oracle linear rate; Router holds ${routerAvaxFormatted} AVAX). Quote only — transaction NOT executed.`
      : `WARNING: Router holds only ${routerAvaxFormatted} AVAX (< required ${ethers.formatEther(minAmountOutWei)} AVAX); swap execution will revert with InsufficientRouterLiquidity.`,
    routerType: oracleEnabled
      ? "Chainlink-Backed Router (Avalanche Fuji Testnet)"
      : "MockDEXRouter (Avalanche Fuji Testnet)",
    oracleEnabled,
    dataSource: "ON_CHAIN",
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
  assetExposure: {
    volatileUsd: number;
    volatilePct: number;
    stableUsd: number;
    stablePct: number;
    topAssetSymbol: string;
    topAssetSharePct: number;
  };
  concentrationRisk: "HIGH_VOLATILE" | "BALANCED" | "HIGH_STABLE" | "EMPTY";
  allowanceExposure: AllowanceExposureMetric;
  routerLiquidityRisk: RouterLiquidityMetric;
  metricSources: Record<string, MetricProvenance>;
  hypotheticalAfterSwap?: {
    status: "SIMULATED" | "INSUFFICIENT_BALANCE" | "INSUFFICIENT_ROUTER_LIQUIDITY";
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
  const analyzedAt = new Date().toISOString();
  const [portfolio, onChainRisks] = await Promise.all([
    getPortfolio(address),
    getAllowanceAndLiquidityRisk(address),
  ]);

  const avaxAsset = portfolio.assets.find((a) => a.symbol === "AVAX");
  const musdcAsset = portfolio.assets.find((a) => a.symbol === "mUSDC");

  const avaxBal = Number(avaxAsset?.balance ?? 0);
  const musdcBal = Number(musdcAsset?.balance ?? 0);
  const avaxUsd = Number(avaxAsset?.valueUsd ?? 0);
  const musdcUsd = Number(musdcAsset?.valueUsd ?? 0);
  const avaxPct = avaxAsset?.percentage ?? 0;
  const musdcPct = musdcAsset?.percentage ?? 0;
  const avaxPrice = avaxAsset?.priceUsd ?? 0;

  let concentrationRisk: PortfolioAllocationAnalysis["concentrationRisk"] =
    "BALANCED";
  if (portfolio.totalValueUsd <= 0) {
    concentrationRisk = "EMPTY";
  } else if (avaxPct >= 80) {
    concentrationRisk = "HIGH_VOLATILE";
  } else if (musdcPct >= 80) {
    concentrationRisk = "HIGH_STABLE";
  }

  const topAssetSymbol = avaxPct >= musdcPct ? "AVAX" : "mUSDC";
  const topAssetSharePct = Math.max(avaxPct, musdcPct);

  let hypotheticalAfterSwap: PortfolioAllocationAnalysis["hypotheticalAfterSwap"];
  if (hypotheticalSwapMusdc && hypotheticalSwapMusdc > 0) {
    const quote = await getSwapQuoteDeterministic(hypotheticalSwapMusdc, 100);
    const outAvax = Number(quote.expectedOutAvax);
    const projAvax = avaxBal + outAvax;
    const projMusdc = Math.max(0, musdcBal - hypotheticalSwapMusdc);
    const projAvaxUsd = projAvax * avaxPrice;
    const projMusdcUsd = projMusdc * 1;
    const projTotal = projAvaxUsd + projMusdcUsd;

    const insufficientWallet = hypotheticalSwapMusdc > musdcBal;
    const status = insufficientWallet
      ? "INSUFFICIENT_BALANCE"
      : !quote.sufficientRouterLiquidity
        ? "INSUFFICIENT_ROUTER_LIQUIDITY"
        : "SIMULATED";

    hypotheticalAfterSwap = {
      status,
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
      note: insufficientWallet
        ? `Hypothetical projection only: wallet currently holds ${musdcBal.toFixed(2)} mUSDC (< ${hypotheticalSwapMusdc} mUSDC requested).`
        : !quote.sufficientRouterLiquidity
          ? `Hypothetical projection only: Router currently holds ${quote.routerAvailableAvax} AVAX (< ${quote.expectedOutAvax} AVAX required), so on-chain swap would revert.`
          : "Hypothetical simulation only (not executed). Uses Chainlink-backed Fuji Router quote + live AVAX price.",
    };
  }

  const priceProvenanceSource: RiskDataSource =
    portfolio.priceSource === "CHAINLINK_FUJI"
      ? "ON_CHAIN"
      : portfolio.priceSource === "LIVE_API"
        ? "EXTERNAL_API"
        : "INSUFFICIENT_DATA";

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
    assetExposure: {
      volatileUsd: avaxUsd,
      volatilePct: avaxPct,
      stableUsd: musdcUsd,
      stablePct: musdcPct,
      topAssetSymbol,
      topAssetSharePct,
    },
    concentrationRisk,
    allowanceExposure: onChainRisks.allowanceExposure,
    routerLiquidityRisk: onChainRisks.routerLiquidityRisk,
    metricSources: {
      walletBalances: {
        source: "ON_CHAIN",
        updatedAt: analyzedAt,
        detail: "Avalanche Fuji RPC eth_getBalance & MockERC20.balanceOf",
      },
      avaxUsdPrice: {
        source: priceProvenanceSource,
        updatedAt: portfolio.oracleUpdatedAt || analyzedAt,
        detail: `Price source: ${portfolio.priceSource}${portfolio.fallbackReason ? ` (${portfolio.fallbackReason})` : ""}`,
      },
      allocationAndConcentration: {
        source: "DETERMINISTIC_MATH",
        updatedAt: analyzedAt,
        detail: "Deterministic USD weight & concentration classification",
      },
      allowanceExposure: {
        source: onChainRisks.allowanceExposure.source,
        updatedAt: onChainRisks.allowanceExposure.updatedAt,
        detail: `MockERC20.allowance(user, ${env.EXECUTOR_ADDRESS})`,
      },
      routerLiquidity: {
        source: onChainRisks.routerLiquidityRisk.source,
        updatedAt: onChainRisks.routerLiquidityRisk.updatedAt,
        detail: `eth_getBalance(${env.ROUTER_ADDRESS}) & router.rateMusdcPerAvax()`,
      },
    },
    hypotheticalAfterSwap,
    analyzedAt,
  };
}

export interface PositionRiskResult {
  address: string;
  onChainLendingPositionFound: boolean;
  network: "Avalanche Fuji (43113)";
  portfolioVolatilityExposurePct: number;
  avaxPriceDrop20PctImpactUsd: number;
  liquidationRiskStatus:
    | "SAFE"
    | "CAUTION"
    | "LIQUIDATABLE"
    | "INSUFFICIENT_DATA";
  allowanceExposure: AllowanceExposureMetric;
  routerLiquidityRisk: RouterLiquidityMetric;
  aavePosition?: AaveUserAccountData;
  lendingRisk?: {
    collateralAvax: number;
    debtUsd: number;
    liquidationThreshold: number;
    currentCollateralValueUsd: number;
    healthFactor: number;
    liquidationPriceAvaxUsd: number;
    status: "SAFE" | "CAUTION" | "LIQUIDATABLE";
    source: "DETERMINISTIC_MATH";
  };
  metricSources: Record<string, MetricProvenance>;
  limitations: string;
  calculatedAt: string;
}

export async function calculatePositionRisk(params: {
  address: string;
  collateralAvax?: number;
  debtUsd?: number;
  liquidationThreshold?: number;
}): Promise<PositionRiskResult> {
  const calculatedAt = new Date().toISOString();
  const [portfolio, priceInfo, aavePosition, onChainRisks] = await Promise.all([
    getPortfolio(params.address),
    fetchLiveAvaxPriceUsd(),
    getAavePosition(params.address),
    getAllowanceAndLiquidityRisk(params.address),
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
      source: "DETERMINISTIC_MATH",
    };
  }

  const hasLiveAave = Boolean(aavePosition?.hasPosition);
  let liquidationRiskStatus: PositionRiskResult["liquidationRiskStatus"] =
    "INSUFFICIENT_DATA";
  let liqSource: MetricProvenance;

  if (
    hasLiveAave &&
    aavePosition &&
    (aavePosition.status === "SAFE" ||
      aavePosition.status === "CAUTION" ||
      aavePosition.status === "LIQUIDATABLE")
  ) {
    liquidationRiskStatus = aavePosition.status;
    liqSource = {
      source: "ON_CHAIN",
      updatedAt: aavePosition.fetchedAt,
      detail: `Live Aave V3 Fuji Pool (${aavePosition.poolAddress}) getUserAccountData`,
    };
  } else if (lendingRisk) {
    liquidationRiskStatus = lendingRisk.status;
    liqSource = {
      source: "DETERMINISTIC_MATH",
      updatedAt: calculatedAt,
      detail:
        "Computed deterministically from user-supplied collateral/debt parameters and live AVAX price.",
    };
  } else {
    liquidationRiskStatus = "INSUFFICIENT_DATA";
    liqSource = {
      source: "INSUFFICIENT_DATA",
      updatedAt: aavePosition?.fetchedAt || calculatedAt,
      detail: aavePosition?.bytecodeVerified
        ? `Verified Aave V3 Fuji Pool (${aavePosition.poolAddress}) returned totalCollateralUsd=0 & totalDebtUsd=0 (no active position), and no external lending protocol (e.g. Benqi) position exists on Fuji. Returning INSUFFICIENT_DATA instead of guessing Liquidation Price.`
        : aavePosition?.reason ||
          "No active lending position or collateral/debt parameters available.",
    };
  }

  let limitations: string;
  if (hasLiveAave) {
    limitations = `Live Aave V3 Fuji position metrics were read directly on-chain from verified Pool ${aavePosition?.poolAddress}. Other lending protocols (e.g. Benqi) are not integrated on Fuji (INSUFFICIENT_DATA).`;
  } else if (hasUserSuppliedLending) {
    limitations =
      "No active Aave V3 position found on Fuji for this wallet; Health Factor and Liquidation Price were computed deterministically (DETERMINISTIC_MATH) from user-supplied parameters and live AVAX price.";
  } else {
    limitations = aavePosition?.bytecodeVerified
      ? `INSUFFICIENT_DATA for Liquidation Price: Verified Aave V3 Fuji Pool (${aavePosition.poolAddress}) shows no active collateral/debt for this wallet, and unintegrated protocols (e.g. Benqi) cannot be queried on Fuji. Supply collateral & debt parameters to simulate Health Factor.`
      : `INSUFFICIENT_DATA: ${aavePosition?.reason || "Lending pool data unavailable."}`;
  }

  return {
    address: params.address,
    onChainLendingPositionFound: hasLiveAave,
    network: "Avalanche Fuji (43113)",
    portfolioVolatilityExposurePct: avaxPct,
    avaxPriceDrop20PctImpactUsd: drop20Impact,
    liquidationRiskStatus,
    allowanceExposure: onChainRisks.allowanceExposure,
    routerLiquidityRisk: onChainRisks.routerLiquidityRisk,
    aavePosition,
    lendingRisk,
    metricSources: {
      drawdownStressTest: {
        source: "DETERMINISTIC_MATH",
        updatedAt: calculatedAt,
        detail: "-20% AVAX spot shock applied to live on-chain AVAX balance",
      },
      aaveV3FujiPool: {
        source: aavePosition?.dataSource ?? "INSUFFICIENT_DATA",
        updatedAt: aavePosition?.fetchedAt ?? calculatedAt,
        detail: aavePosition?.bytecodeVerified
          ? `Aave V3 Pool (${aavePosition.poolAddress}) bytecode verified on Fuji`
          : aavePosition?.reason || "Unavailable",
      },
      liquidationRisk: liqSource,
      allowanceExposure: {
        source: onChainRisks.allowanceExposure.source,
        updatedAt: onChainRisks.allowanceExposure.updatedAt,
        detail: `ERC20.allowance(user, ${env.EXECUTOR_ADDRESS})`,
      },
      routerLiquidity: {
        source: onChainRisks.routerLiquidityRisk.source,
        updatedAt: onChainRisks.routerLiquidityRisk.updatedAt,
        detail: `Router AVAX liquidity on ${env.ROUTER_ADDRESS}`,
      },
    },
    limitations,
    calculatedAt,
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
  source: "DEFILLAMA_LIVE" | "INSUFFICIENT_DATA";
  dataCategory: "EXTERNAL_API" | "INSUFFICIENT_DATA";
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

    if (topPools.length === 0) {
      return {
        source: "INSUFFICIENT_DATA",
        dataCategory: "INSUFFICIENT_DATA",
        chainScope:
          "Avalanche Mainnet (reference data only, separate from Fuji testnet)",
        pools: [],
        disclaimer: protocolFilter
          ? `INSUFFICIENT_DATA: No verified Avalanche yield pools matched '${protocolFilter}' on DeFiLlama. Refusing to fabricate APY/TVL.`
          : "INSUFFICIENT_DATA: No Avalanche pools returned from DeFiLlama.",
        fetchedAt: new Date().toISOString(),
      };
    }

    const result: AvalancheYieldsResponse = {
      source: "DEFILLAMA_LIVE",
      dataCategory: "EXTERNAL_API",
      chainScope:
        "Avalanche Mainnet (reference data only, separate from Fuji testnet)",
      pools: topPools,
      disclaimer:
        "EXTERNAL_API snapshot (DeFiLlama): APYs are variable historical/current snapshots and are NOT guaranteed future returns.",
      fetchedAt: new Date().toISOString(),
    };

    if (!protocolFilter) {
      cachedYields = { data: result, fetchedAt: Date.now() };
    }
    return result;
  } catch {
    return {
      source: "INSUFFICIENT_DATA",
      dataCategory: "INSUFFICIENT_DATA",
      chainScope:
        "Avalanche Mainnet (reference data only, separate from Fuji testnet)",
      pools: [],
      disclaimer:
        "INSUFFICIENT_DATA: Live DeFiLlama yield API is currently unreachable. Refusing to fabricate APY/TVL numbers.",
      fetchedAt: new Date().toISOString(),
    };
  }
}
