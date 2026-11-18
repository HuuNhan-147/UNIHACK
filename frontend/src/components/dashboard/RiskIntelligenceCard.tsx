import React from "react";
import { ShieldAlert, Activity, Lock, Droplets } from "lucide-react";
import { RiskOverviewResponse } from "../../services/api";

interface Props {
  risk: RiskOverviewResponse | null;
  loading?: boolean;
}

export const RiskIntelligenceCard: React.FC<Props> = ({ risk, loading }) => {
  if (!risk) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#131722] p-4 text-xs text-slate-400">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-semibold text-white flex items-center gap-1.5">
            <Activity className="h-4 w-4 text-blue-400" />
            Risk Intelligence
          </span>
          {loading && <span className="text-[11px] text-blue-400">Syncing...</span>}
        </div>
        <p>Connect wallet on Avalanche Fuji to inspect live Allowance Exposure, Router Liquidity, and Aave V3 Fuji Position.</p>
      </div>
    );
  }

  const { allocation, positionRisk } = risk;
  const aave = positionRisk.aavePosition;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#131722] p-4 space-y-2.5 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-bold text-white flex items-center gap-1.5 text-sm">
          <Activity className="h-4 w-4 text-blue-400" />
          Risk Intelligence
        </span>
        <span className="text-[10px] text-slate-400 font-mono">
          {new Date(positionRisk.calculatedAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {/* Concentration & -20% Drawdown */}
        <div className="rounded-xl bg-[#0B0E14] border border-slate-800/80 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Concentration & Drawdown</span>
            <span className="rounded bg-blue-500/15 px-1.5 py-0.5 text-[10px] font-mono text-blue-300">
              DETERMINISTIC_MATH
            </span>
          </div>
          <p className="mt-1 text-slate-200 font-medium">
            {allocation.concentrationRisk} ({allocation.assetExposure.topAssetSymbol}{" "}
            {allocation.assetExposure.topAssetSharePct}%) · -20% AVAX Shock:{" "}
            <span className="text-amber-300">
              -${positionRisk.avaxPriceDrop20PctImpactUsd.toFixed(2)}
            </span>
          </p>
        </div>

        {/* Allowance Exposure */}
        <div className="rounded-xl bg-[#0B0E14] border border-slate-800/80 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Lock className="h-3 w-3 text-emerald-400" />
              mUSDC Allowance Exposure
            </span>
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">
              {allocation.allowanceExposure.source}
            </span>
          </div>
          <p className="mt-1 text-slate-200 font-medium">
            Approved: <span className="font-mono">{allocation.allowanceExposure.approvedMusdc} mUSDC</span>{" "}
            · Risk:{" "}
            <span
              className={
                allocation.allowanceExposure.riskLevel === "NONE"
                  ? "text-emerald-400"
                  : "text-amber-300"
              }
            >
              {allocation.allowanceExposure.riskLevel}
            </span>
          </p>
        </div>

        {/* Router Liquidity & Price Impact */}
        <div className="rounded-xl bg-[#0B0E14] border border-slate-800/80 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <Droplets className="h-3 w-3 text-cyan-400" />
              Router Liquidity & Impact
            </span>
            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-mono text-emerald-300">
              {allocation.routerLiquidityRisk.source}
            </span>
          </div>
          <p className="mt-1 text-slate-200 font-medium">
            Pool: <span className="font-mono">{allocation.routerLiquidityRisk.availableAvax} AVAX</span>{" "}
            (Max ~{allocation.routerLiquidityRisk.maxSwappableMusdc} mUSDC) ·{" "}
            {allocation.routerLiquidityRisk.priceImpactBps} bps Oracle curve
          </p>
        </div>

        {/* Aave V3 Fuji Position */}
        <div className="rounded-xl bg-[#0B0E14] border border-slate-800/80 p-2.5">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-purple-400" />
              Aave V3 Fuji Lending Risk
            </span>
            <span className="rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-mono text-purple-300">
              {aave?.bytecodeVerified ? "ON_CHAIN_VERIFIED" : "INSUFFICIENT_DATA"}
            </span>
          </div>
          {aave?.hasPosition ? (
            <p className="mt-1 text-slate-200 font-medium">
              Collateral: ${aave.totalCollateralUsd} · Debt: ${aave.totalDebtUsd} · HF:{" "}
              <span className="font-mono text-emerald-400">
                {aave.healthFactor ?? "∞"}
              </span>{" "}
              ({aave.status})
            </p>
          ) : (
            <p className="mt-1 text-slate-300 text-[11px]">
              Pool <span className="font-mono">{aave?.poolAddress?.slice(0, 8)}...</span> verified ·{" "}
              <span className="text-amber-300 font-mono">
                {positionRisk.liquidationRiskStatus}
              </span>{" "}
              (0 active debt)
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
