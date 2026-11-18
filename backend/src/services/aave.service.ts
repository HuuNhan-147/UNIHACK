import { ethers } from "ethers";
import { env } from "../config/env";
import { AAVE_V3_POOL_ABI } from "../abi";
import { provider, withRpcTimeout } from "./blockchain.service";

export interface AaveUserAccountData {
  configured: boolean;
  bytecodeVerified: boolean;
  poolAddress?: string;
  hasPosition: boolean;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  availableBorrowsUsd: number;
  liquidationThresholdPct: number;
  ltvPct: number;
  healthFactor: number | null;
  status:
    | "NO_POSITION"
    | "SAFE"
    | "CAUTION"
    | "LIQUIDATABLE"
    | "INSUFFICIENT_DATA";
  dataSource: "ON_CHAIN" | "INSUFFICIENT_DATA";
  fetchedAt: string;
  reason?: string;
}

const verifiedPoolCache = new Map<string, boolean>();

/**
 * Reads live lending position metrics from verified Aave V3 Pool on Avalanche Fuji.
 * Verifies contract bytecode via eth_getCode before querying getUserAccountData.
 * Aave V3 base currency decimals = 8 (USD). Health Factor = 18 decimals.
 */
export async function getAavePosition(
  userAddress: string,
  customPoolAddress?: string,
  customProvider?: ethers.JsonRpcProvider
): Promise<AaveUserAccountData> {
  const poolAddr = customPoolAddress ?? env.AAVE_V3_POOL_ADDRESS;
  const activeProvider = customProvider ?? provider;
  const fetchedAt = new Date().toISOString();

  if (!ethers.isAddress(poolAddr)) {
    return {
      configured: false,
      bytecodeVerified: false,
      hasPosition: false,
      totalCollateralUsd: 0,
      totalDebtUsd: 0,
      availableBorrowsUsd: 0,
      liquidationThresholdPct: 0,
      ltvPct: 0,
      healthFactor: null,
      status: "INSUFFICIENT_DATA",
      dataSource: "INSUFFICIENT_DATA",
      fetchedAt,
      reason: "AAVE_V3_POOL_ADDRESS is not configured or invalid.",
    };
  }

  try {
    const cacheKey = poolAddr.toLowerCase();
    let hasCode = customProvider ? undefined : verifiedPoolCache.get(cacheKey);
    if (hasCode === undefined) {
      const code = await withRpcTimeout(
        activeProvider.getCode(poolAddr),
        "Verify Aave V3 Fuji Pool bytecode"
      );
      hasCode = Boolean(code && code !== "0x" && code.length > 2);
      if (!customProvider) {
        verifiedPoolCache.set(cacheKey, hasCode);
      }
    }

    if (!hasCode) {
      return {
        configured: true,
        bytecodeVerified: false,
        poolAddress: poolAddr,
        hasPosition: false,
        totalCollateralUsd: 0,
        totalDebtUsd: 0,
        availableBorrowsUsd: 0,
        liquidationThresholdPct: 0,
        ltvPct: 0,
        healthFactor: null,
        status: "INSUFFICIENT_DATA",
        dataSource: "INSUFFICIENT_DATA",
        fetchedAt,
        reason: `No valid contract bytecode found at ${poolAddr} on Avalanche Fuji.`,
      };
    }

    const pool = new ethers.Contract(poolAddr, AAVE_V3_POOL_ABI, activeProvider);
    const data = await withRpcTimeout(
      pool.getUserAccountData(userAddress),
      "Fetch Aave V3 getUserAccountData"
    );

    const totalCollateralUsd = Number(
      ethers.formatUnits(data.totalCollateralBase, 8)
    );
    const totalDebtUsd = Number(ethers.formatUnits(data.totalDebtBase, 8));
    const availableBorrowsUsd = Number(
      ethers.formatUnits(data.availableBorrowsBase, 8)
    );
    const liquidationThresholdPct =
      Number(data.currentLiquidationThreshold) / 100;
    const ltvPct = Number(data.ltv) / 100;

    const hasPosition = totalCollateralUsd > 0 || totalDebtUsd > 0;
    let healthFactor: number | null = null;
    let status: AaveUserAccountData["status"] = "NO_POSITION";

    if (totalDebtUsd > 0) {
      const rawHf = Number(ethers.formatUnits(data.healthFactor, 18));
      healthFactor = Number.isFinite(rawHf) ? Number(rawHf.toFixed(3)) : null;
      if (healthFactor !== null) {
        status =
          healthFactor < 1
            ? "LIQUIDATABLE"
            : healthFactor < 1.3
              ? "CAUTION"
              : "SAFE";
      }
    } else if (totalCollateralUsd > 0) {
      status = "SAFE";
    }

    return {
      configured: true,
      bytecodeVerified: true,
      poolAddress: poolAddr,
      hasPosition,
      totalCollateralUsd: Number(totalCollateralUsd.toFixed(2)),
      totalDebtUsd: Number(totalDebtUsd.toFixed(2)),
      availableBorrowsUsd: Number(availableBorrowsUsd.toFixed(2)),
      liquidationThresholdPct: Number(liquidationThresholdPct.toFixed(2)),
      ltvPct: Number(ltvPct.toFixed(2)),
      healthFactor,
      status,
      dataSource: "ON_CHAIN",
      fetchedAt,
    };
  } catch (err: any) {
    return {
      configured: true,
      bytecodeVerified: false,
      poolAddress: poolAddr,
      hasPosition: false,
      totalCollateralUsd: 0,
      totalDebtUsd: 0,
      availableBorrowsUsd: 0,
      liquidationThresholdPct: 0,
      ltvPct: 0,
      healthFactor: null,
      status: "INSUFFICIENT_DATA",
      dataSource: "INSUFFICIENT_DATA",
      fetchedAt,
      reason: `Aave V3 RPC query failed: ${err?.message || "unavailable"}`,
    };
  }
}
