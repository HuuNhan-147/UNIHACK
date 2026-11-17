import React from "react";
import { PortfolioAsset } from "../../services/api";

interface Props {
  assets: PortfolioAsset[];
  totalValueUsd: number;
}

export const AssetAllocation: React.FC<Props> = ({ assets, totalValueUsd }) => {
  const avaxPct = assets.find((a) => a.symbol === "AVAX")?.percentage ?? 0;
  const musdcPct = assets.find((a) => a.symbol === "mUSDC")?.percentage ?? 0;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const avaxStroke = (avaxPct / 100) * circumference;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#131722] p-5">
      <h2 className="text-sm font-semibold text-slate-200 mb-4">
        Asset Allocation
      </h2>
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative h-40 w-40 flex items-center justify-center">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 140 140">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="transparent"
              stroke="#3B82F6"
              strokeWidth="16"
            />
            {avaxPct > 0 && (
              <circle
                cx="70"
                cy="70"
                r={radius}
                fill="transparent"
                stroke="#EF4444"
                strokeWidth="16"
                strokeDasharray={`${avaxStroke} ${circumference}`}
              />
            )}
          </svg>
          <div className="absolute text-center">
            <p className="text-lg font-bold text-white">
              ${totalValueUsd.toLocaleString()}
            </p>
            <p className="text-[11px] text-slate-400">2 ASSETS</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span className="text-slate-300">AVAX ({avaxPct}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
            <span className="text-slate-300">mUSDC ({musdcPct}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
