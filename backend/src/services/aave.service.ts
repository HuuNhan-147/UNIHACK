import { ethers } from "ethers";
import { env } from "../config/env";
import { AAVE_V3_POOL_ABI } from "../abi";
import { provider, withRpcTimeout } from "./blockchain.service";

export interface AaveUserAccountData {
  configured: boolean;
  poolAddress?: string;
  hasPosition: boolean;
  totalCollateralUsd: number;
  totalDebtUsd: number;
  availableBorrowsUsd: number;
  liquidationThresholdPct: number;
  ltvPct: number;
  healthFactor: number | null;
  status: "NO_POSITION" | "SAFE" | "CAUTION" | "LIQUIDATABLE";
}

/**
 * Reads live lending position metrics from Aave V3 Pool on Avalanche Fuji when AAVE_V3_POOL_ADDRESS is configured.
 * Aave V3 base currency decimals = 8 (USD). Health Factor = 18 decimals.
 */
export async function getAavePosition(
  userAddress: string
): Promise<AaveUserAccountData> {
  if (!ethers.isAddress(env.AAVE_V3_POOL_ADDRESS)) {
    return {
      configured: false,
      hasPosition: false,
      totalCollateralUsd: 0,
      totalDebtUsd: 0,
      availableBorrowsUsd: 0,
      liquidationThresholdPct: 0,
      ltvPct: 0,
      healthFactor: null,
      status: "NO_POSITION",
    };
  }

  const pool = new ethers.Contract(
    env.AAVE_V3_POOL_ADDRESS,
    AAVE_V3_POOL_ABI,
    provider
  );

  const data = await withRpcTimeout(
    pool.getUserAccountData(userAddress),
    "Fetch Aave V3 getUserAccountData"
  );

  const totalCollateralUsd = Number(ethers.formatUnits(data.totalCollateralBase, 8));
  const totalDebtUsd = Number(ethers.formatUnits(data.totalDebtBase, 8));
  const availableBorrowsUsd = Number(ethers.formatUnits(data.availableBorrowsBase, 8));
  const liquidationThresholdPct = Number(data.currentLiquidationThreshold) / 100;
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
    poolAddress: env.AAVE_V3_POOL_ADDRESS,
    hasPosition,
    totalCollateralUsd: Number(totalCollateralUsd.toFixed(2)),
    totalDebtUsd: Number(totalDebtUsd.toFixed(2)),
    availableBorrowsUsd: Number(availableBorrowsUsd.toFixed(2)),
    liquidationThresholdPct: Number(liquidationThresholdPct.toFixed(2)),
    ltvPct: Number(ltvPct.toFixed(2)),
    healthFactor,
    status,
  };
}
