import React from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { PolicyData } from "../../services/api";

interface Props {
  policy: PolicyData | null;
}

export const PolicyStatusCard: React.FC<Props> = ({ policy }) => {
  if (!policy) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#131722] p-5 text-xs text-slate-400">
        Loading On-chain Policy Rules...
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#131722] p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {policy.paused ? (
            <ShieldAlert className="h-5 w-5 text-red-400" />
          ) : (
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
          )}
          <h2 className="text-sm font-semibold text-slate-200">
            On-Chain Policy Guardrails
          </h2>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
            policy.paused
              ? "bg-red-500/15 text-red-400"
              : "bg-emerald-500/15 text-emerald-400"
          }`}
        >
          {policy.paused ? "PAUSED" : "ACTIVE"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="rounded-xl bg-[#0B0E14] p-3 border border-slate-800/80">
          <p className="text-slate-400">Max Tx Limit</p>
          <p className="mt-1 text-base font-bold text-white">
            {policy.maxAmountPerTxMusdc} mUSDC
          </p>
        </div>
        <div className="rounded-xl bg-[#0B0E14] p-3 border border-slate-800/80">
          <p className="text-slate-400">Max Slippage</p>
          <p className="mt-1 text-base font-bold text-white">
            {(policy.maxSlippageBps / 100).toFixed(2)}%
          </p>
        </div>
        <div className="rounded-xl bg-[#0B0E14] p-3 border border-slate-800/80">
          <p className="text-slate-400">Allowed Pair</p>
          <p className="mt-1 text-sm font-semibold text-blue-400">
            mUSDC → AVAX
          </p>
        </div>
        <div className="rounded-xl bg-[#0B0E14] p-3 border border-slate-800/80">
          <p className="text-slate-400">Router Whitelist</p>
          <p className="mt-1 text-sm font-semibold text-emerald-400">
            {policy.routerAllowed ? "Verified" : "Blocked"}
          </p>
        </div>
      </div>
    </div>
  );
};
