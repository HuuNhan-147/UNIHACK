import React from "react";
import { AvaxPriceSource, PolicyData, PortfolioAsset } from "../../services/api";

interface Props {
  assets: PortfolioAsset[];
  loading: boolean;
  priceSource?: AvaxPriceSource;
  fallbackReason?: string;
  policy?: PolicyData | null;
}

export const HoldingsTable: React.FC<Props> = ({
  assets,
  loading,
  priceSource,
  fallbackReason,
  policy,
}) => {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#131722] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-200">
            On-Chain Holdings (Avalanche Fuji)
          </h2>
          {priceSource && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                priceSource === "CHAINLINK_FUJI"
                  ? "bg-blue-500/15 text-blue-300"
                  : priceSource === "LIVE_API"
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {priceSource === "CHAINLINK_FUJI"
                ? "Chainlink Fuji Feed"
                : priceSource === "LIVE_API"
                  ? "Live Market Price"
                  : "Fallback Ref Price"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400">
            {policy?.oracleEnabled
              ? `Chainlink Router: $${policy.activeRateMusdcPerAvax}/AVAX · Pool ${policy.routerLiquidityAvax} AVAX`
              : policy?.activeRateMusdcPerAvax
                ? `Fallback Router: ${policy.activeRateMusdcPerAvax} mUSDC/AVAX`
                : "Router: Syncing Fuji..."}
          </span>
          {loading && (
            <span className="text-xs text-blue-400 animate-pulse">Syncing...</span>
          )}
        </div>
      </div>
      {fallbackReason && priceSource !== "CHAINLINK_FUJI" && (
        <p className="mb-3 rounded-lg bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-300">
          Oracle Fallback Active: {fallbackReason}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-xs text-slate-400">
              <th className="pb-3 font-medium">Asset</th>
              <th className="pb-3 font-medium text-right">Market Price</th>
              <th className="pb-3 font-medium text-right">Balance</th>
              <th className="pb-3 font-medium text-right">Value (USD)</th>
              <th className="pb-3 font-medium text-right">Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {assets.map((asset) => (
              <tr key={asset.symbol} className="hover:bg-slate-800/30">
                <td className="py-3.5">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold ${
                        asset.symbol === "AVAX"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {asset.symbol === "AVAX" ? "A" : "$"}
                    </div>
                    <div>
                      <p className="font-medium text-white">{asset.symbol}</p>
                      <p className="text-xs text-slate-400">{asset.name}</p>
                    </div>
                  </div>
                </td>
                <td className="py-3.5 text-right text-slate-300">
                  ${asset.priceUsd.toFixed(2)}
                </td>
                <td className="py-3.5 text-right font-mono text-slate-100">
                  {asset.balance}
                </td>
                <td className="py-3.5 text-right font-medium text-white">
                  ${asset.valueUsd.toFixed(2)}
                </td>
                <td className="py-3.5 text-right text-slate-400">
                  {asset.percentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
