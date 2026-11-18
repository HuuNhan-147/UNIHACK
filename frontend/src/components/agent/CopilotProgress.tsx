import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";

const COPILOT_STEPS = [
  {
    id: 1,
    name: "1. Read On-Chain & Chainlink Data",
    desc: "Truy vấn số dư Fuji, Chainlink AVAX/USD Feed & Glacier History",
  },
  {
    id: 2,
    name: "2. Deterministic Policy & Guardrails",
    desc: "Kiểm tra hạn mức 300 mUSDC, slippage <= 2% & No-Forecast Guard",
  },
  {
    id: 3,
    name: "3. Synthesize Response / Tx Plan",
    desc: "Tổng hợp phân tích xác định hoặc chuẩn bị Unsigned Tx cho Tx Guardian",
  },
];

export const CopilotProgress: React.FC = () => {
  const [activeStep, setActiveStep] = useState(1);
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const timer = setInterval(() => {
      const diff = Date.now() - start;
      setElapsedMs(diff);
      if (diff > 1800) setActiveStep(3);
      else if (diff > 700) setActiveStep(2);
    }, 100);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="rounded-xl border border-blue-500/30 bg-[#0B0E14] p-3 text-xs space-y-2">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 font-semibold text-blue-300">
          <Sparkles className="h-3.5 w-3.5 animate-pulse" />
          <span>AgentVault Copilot đang xử lý...</span>
        </div>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
          {(elapsedMs / 1000).toFixed(1)}s
        </span>
      </div>
      <div className="space-y-1.5">
        {COPILOT_STEPS.map((st) => {
          const isDone = st.id < activeStep;
          const isCurrent = st.id === activeStep;
          return (
            <div
              key={st.id}
              className={`flex items-start gap-2 rounded-lg px-2 py-1.5 ${
                isCurrent
                  ? "bg-blue-500/10 border border-blue-500/20 text-slate-100"
                  : isDone
                    ? "text-slate-300"
                    : "text-slate-500"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                ) : isCurrent ? (
                  <Loader2 className="h-3.5 w-3.5 text-blue-400 animate-spin" />
                ) : (
                  <span className="inline-block h-3.5 w-3.5 rounded-full border border-slate-700" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-[11px]">{st.name}</div>
                <div className="text-[10px] text-slate-400 truncate">
                  {st.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
