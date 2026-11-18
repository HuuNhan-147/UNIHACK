import React, { useState, useEffect } from "react";
import { CheckCircle2, XCircle, RefreshCw, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { SwapPlan, revalidatePlan, rejectPlan } from "../../services/api";

interface Props {
  plan: SwapPlan | null;
  onPlanUpdated: (plan: SwapPlan) => void;
  onInspect: (plan: SwapPlan) => void;
  onRejected: () => void;
}

export const PlanCard: React.FC<Props> = ({
  plan,
  onPlanUpdated,
  onInspect,
  onRejected,
}) => {
  const [editAmount, setEditAmount] = useState<string>(plan?.amountIn || "1");
  const [revalidating, setRevalidating] = useState(false);
  const [showAllChecks, setShowAllChecks] = useState(false);

  useEffect(() => {
    if (plan?.amountIn) {
      setEditAmount(plan.amountIn);
    }
  }, [plan?.planId, plan?.amountIn]);

  if (!plan) return null;

  const passedCount = plan.policyChecks.filter((c) => c.passed).length;
  const failedChecks = plan.policyChecks.filter((c) => !c.passed);
  const visibleChecks = showAllChecks ? plan.policyChecks : failedChecks;

  const handleRevalidate = async () => {
    const num = Number(editAmount);
    if (!Number.isFinite(num) || num <= 0) return;
    setRevalidating(true);
    try {
      const fresh = await revalidatePlan(plan.planId, num, plan.slippageBps);
      onPlanUpdated(fresh);
    } finally {
      setRevalidating(false);
    }
  };

  const handleReject = async () => {
    await rejectPlan(plan.planId);
    onRejected();
  };

  return (
    <div className="rounded-2xl border border-slate-700 bg-[#131722] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-mono text-slate-400 truncate">
            PLAN ID: {plan.planId}
          </p>
          <h3 className="text-sm font-bold text-white truncate">
            {plan.structuredPlan.objective}
          </h3>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {plan.guardian?.simulation && (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                plan.guardian.simulation.status === "SIMULATION_PASSED"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : plan.guardian.simulation.status === "SIMULATION_FAILED"
                    ? "bg-red-500/15 text-red-400"
                    : "bg-amber-500/15 text-amber-300"
              }`}
            >
              {plan.guardian.simulation.status.replace("_", " ")}
            </span>
          )}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
              plan.valid
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-red-500/15 text-red-400"
            }`}
          >
            Policy: {plan.structuredPlan.policyCheck.decision}
          </span>
        </div>
      </div>

      {/* Edit & Revalidate */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#0B0E14] border border-slate-800 p-2.5 text-xs">
        <span className="text-slate-400">Số lượng (mUSDC):</span>
        <input
          type="number"
          value={editAmount}
          onChange={(e) => setEditAmount(e.target.value)}
          className="w-20 rounded-lg border border-slate-700 bg-[#131722] px-2 py-1 text-white"
        />
        <button
          type="button"
          onClick={handleRevalidate}
          disabled={revalidating}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-700 px-2.5 py-1 text-white hover:bg-slate-600"
        >
          <RefreshCw className={`h-3 w-3 ${revalidating ? "animate-spin" : ""}`} />
          Revalidate
        </button>
      </div>

      {/* Compact Policy Summary + Toggle */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-300 font-medium">
            Deterministic Checks:{" "}
            <strong
              className={
                failedChecks.length === 0 ? "text-emerald-400" : "text-red-400"
              }
            >
              {passedCount}/{plan.policyChecks.length} Passed
            </strong>
          </span>
          <button
            type="button"
            onClick={() => setShowAllChecks((v) => !v)}
            className="inline-flex items-center gap-1 text-[11px] text-blue-400 hover:underline"
          >
            {showAllChecks ? (
              <>
                Thu gọn <ChevronUp className="h-3 w-3" />
              </>
            ) : (
              <>
                Chi tiết ({plan.policyChecks.length}) <ChevronDown className="h-3 w-3" />
              </>
            )}
          </button>
        </div>

        {visibleChecks.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
            {visibleChecks.map((c, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-2 text-[11px] rounded-lg bg-[#0B0E14] px-2.5 py-1.5 border border-slate-800/80"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {c.passed ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                  )}
                  <span className="text-slate-200 font-medium truncate">
                    {c.name}
                  </span>
                  <span className="rounded bg-slate-800 px-1 py-0.5 text-[9px] text-slate-400 shrink-0">
                    {c.layer}
                  </span>
                </div>
                <span className="text-slate-400 text-right truncate max-w-[48%]">
                  {c.detail}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onInspect(plan)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
        >
          <Shield className="h-3.5 w-3.5" />
          Tx Guardian Inspector
        </button>
        <button
          type="button"
          onClick={handleReject}
          className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
        >
          Reject
        </button>
      </div>
    </div>
  );
};
