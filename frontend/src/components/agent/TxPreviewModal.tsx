import React, { useState, useEffect } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Cpu,
} from "lucide-react";
import {
  PortfolioData,
  PostTxVerificationResult,
  simulateTransaction,
  SwapPlan,
  TxSimulationReport,
  verifyTransaction,
} from "../../services/api";
import { useWallet, decodeWeb3Error } from "../../context/WalletContext";

export interface TxRecord {
  hash?: string;
  action: string;
  amount: string;
  status: "SUCCESS" | "REVERTED";
  detail: string;
  timestamp: string;
}

interface Props {
  plan: SwapPlan | null;
  prePortfolio: PortfolioData | null;
  onClose: () => void;
  onTxComplete: (record: TxRecord) => void;
}

const EXPLORER_URL =
  import.meta.env.VITE_EXPLORER_URL || "https://testnet.snowtrace.io";

export const TxPreviewModal: React.FC<Props> = ({
  plan,
  prePortfolio,
  onClose,
  onTxComplete,
}) => {
  const { address, sendTx } = useWallet();
  const [step, setStep] = useState<
    "idle" | "approving" | "approved" | "swapping" | "verifying"
  >("idle");
  const [simulating, setSimulating] = useState(false);
  const [liveSim, setLiveSim] = useState<TxSimulationReport | undefined>(
    plan?.guardian?.simulation
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [postTx, setPostTx] = useState<PostTxVerificationResult | null>(null);
  const [allowBlockedTest, setAllowBlockedTest] = useState(false);

  useEffect(() => {
    setLiveSim(plan?.guardian?.simulation);
    setStep("idle");
    setErrorMsg(null);
    setTxHash(null);
    setPostTx(null);
    setAllowBlockedTest(false);
  }, [plan]);

  if (!plan) return null;

  const isAllowanceOnly = plan.planId.startsWith("plan_allow_");
  const needsApproveFirst =
    !isAllowanceOnly && plan.needsApproval && step !== "approved";
  const guardian = plan.guardian;
  const activeSim = liveSim || guardian.simulation;

  const runLiveSimulation = async () => {
    if (!address) return;
    setSimulating(true);
    try {
      const targetTx = isAllowanceOnly ? plan.approveTx || plan.swapTx : plan.swapTx;
      const report = await simulateTransaction({
        from: address,
        to: targetTx.to,
        data: targetTx.data,
        value: targetTx.value,
        chainId: targetTx.chainId,
      });
      setLiveSim(report);
    } catch (err: any) {
      setErrorMsg(err?.message || "Không thể chạy mô phỏng eth_call.");
    } finally {
      setSimulating(false);
    }
  };

  const handleApprove = async () => {
    if (!plan.approveTx) return;
    setErrorMsg(null);
    setStep("approving");
    try {
      const hash = await sendTx(plan.approveTx);
      setStep("approved");
      onTxComplete({
        hash,
        action: "Exact Approve mUSDC",
        amount: `${plan.amountIn} mUSDC`,
        status: "SUCCESS",
        detail: "Exact Approval for AgentVaultExecutor",
        timestamp: new Date().toLocaleTimeString(),
      });
      // Immediately run live eth_call simulation on swapTx now that allowance is active on-chain
      await runLiveSimulation();
    } catch (err) {
      setStep("idle");
      setErrorMsg(decodeWeb3Error(err));
    }
  };

  const handleSwap = async () => {
    setErrorMsg(null);
    setPostTx(null);
    setStep("swapping");
    try {
      const targetTx = isAllowanceOnly ? plan.approveTx || plan.swapTx : plan.swapTx;
      const hash = await sendTx(targetTx);
      setTxHash(hash);
      setStep("verifying");

      if (address) {
        const verified = await verifyTransaction({
          txHash: hash,
          userAddress: address,
          planId: plan.planId,
          amountInMusdc: isAllowanceOnly ? 0 : Number(plan.amountIn),
          prePortfolio,
        });
        setPostTx(verified);
        onTxComplete({
          hash,
          action: isAllowanceOnly ? "Allowance Update" : "Swap mUSDC → AVAX",
          amount: isAllowanceOnly
            ? `${plan.amountIn} mUSDC`
            : `${plan.amountIn} mUSDC → ${plan.estimatedOutAvax} AVAX`,
          status: verified.status === "FAILED" ? "REVERTED" : "SUCCESS",
          detail: verified.summary,
          timestamp: new Date().toLocaleTimeString(),
        });
      }
      setStep("idle");
    } catch (err) {
      const decoded = decodeWeb3Error(err);
      setStep("idle");
      setErrorMsg(decoded);
      onTxComplete({
        action: isAllowanceOnly ? "Allowance Update" : "Swap mUSDC → AVAX",
        amount: `${plan.amountIn} mUSDC`,
        status: "REVERTED",
        detail: decoded,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const effectiveDecision =
    activeSim?.status === "SIMULATION_FAILED"
      ? "BLOCKED"
      : activeSim?.status === "SIMULATION_PASSED" && plan.valid
        ? "PASS"
        : guardian.overallDecision;

  const overallBadge =
    effectiveDecision === "PASS"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : effectiveDecision === "WARNING"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
        : "border-red-500/30 bg-red-500/10 text-red-300";

  const simStatusLabel =
    activeSim?.status === "SIMULATION_PASSED"
      ? "SIMULATION PASSED"
      : activeSim?.status === "SIMULATION_FAILED"
        ? "SIMULATION FAILED"
        : "SIMULATION UNAVAILABLE";

  const simBadgeClass =
    activeSim?.status === "SIMULATION_PASSED"
      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
      : activeSim?.status === "SIMULATION_FAILED"
        ? "bg-red-500/15 text-red-400 border-red-500/30"
        : "bg-amber-500/15 text-amber-300 border-amber-500/30";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-[#131722] p-5 shadow-2xl space-y-3.5 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {effectiveDecision === "PASS" ? (
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-400" />
            )}
            <h3 className="text-base font-bold text-white">
              Tx Guardian Inspector & Live EVM Simulator
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Overall Security Decision */}
        <div className={`rounded-xl border p-3 text-xs ${overallBadge}`}>
          <p className="font-bold">
            Overall Security Decision: {effectiveDecision}
          </p>
          {plan.reason && <p className="mt-1 opacity-90">{plan.reason}</p>}
        </div>

        {/* Live EVM Simulation Panel */}
        {activeSim && (
          <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-3.5 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-blue-400" />
                <span className="font-semibold text-white">
                  Pre-Sign EVM Simulation (`eth_call`)
                </span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${simBadgeClass}`}
                >
                  {simStatusLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={runLiveSimulation}
                disabled={simulating || !address}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-800 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-700 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3 w-3 ${simulating ? "animate-spin" : ""}`}
                />
                Re-Simulate
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 pt-1">
              <div>
                <span className="text-slate-500">Transaction Type:</span>{" "}
                <span className="font-mono text-white">
                  {activeSim.txType} ({activeSim.functionName})
                </span>
              </div>
              <div>
                <span className="text-slate-500">Token & Amount:</span>{" "}
                <span className="font-mono text-white">
                  {plan.amountIn} {plan.tokenIn}
                  {!isAllowanceOnly
                    ? ` → ~${Number(plan.estimatedOutAvax).toFixed(4)} ${plan.tokenOut}`
                    : ""}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Target Contract:</span>{" "}
                <span className="font-mono text-slate-200 break-all">
                  {activeSim.to}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Simulated Block:</span>{" "}
                <span className="font-mono text-white">
                  {activeSim.simulatedBlock ? `#${activeSim.simulatedBlock}` : "N/A"}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Estimated Gas:</span>{" "}
                <span className="font-mono text-white">
                  {activeSim.estimatedGas
                    ? `${Number(activeSim.estimatedGas).toLocaleString()} units`
                    : guardian.approveSimulation?.estimatedGas
                      ? `Approve: ${Number(guardian.approveSimulation.estimatedGas).toLocaleString()} units`
                      : "Pending allowance / N/A"}
                </span>
              </div>
              {activeSim.simulatedOutputAvax && (
                <div className="col-span-2">
                  <span className="text-slate-500">Simulated Output:</span>{" "}
                  <span className="font-mono text-emerald-400 font-semibold">
                    {Number(activeSim.simulatedOutputAvax).toFixed(6)} AVAX
                  </span>
                </div>
              )}
            </div>

            {activeSim.revertReason && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-200">
                {activeSim.revertReason}
              </div>
            )}

            {activeSim.warnings.length > 0 && (
              <div className="space-y-1">
                <p className="text-[11px] font-semibold text-amber-300">
                  Risk Warnings:
                </p>
                {activeSim.warnings.map((w, i) => (
                  <p key={i} className="text-[11px] text-amber-200/90 pl-2">
                    • {w}
                  </p>
                ))}
              </div>
            )}

            <div className="border-t border-slate-800/80 pt-2 text-[10px] text-slate-400 space-y-0.5">
              <p className="font-semibold text-slate-300">
                Unverified Conditions & Disclaimer:
              </p>
              {activeSim.unverifiedConditions.map((u, i) => (
                <p key={i}>• {u}</p>
              ))}
            </div>
          </div>
        )}

        {/* Plain-Language Summary */}
        <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-3 text-xs text-slate-200">
          <p className="text-slate-400 font-semibold mb-1">
            Plain-Language Summary
          </p>
          <p>{guardian.plainLanguageSummary}</p>
        </div>

        {/* Security Guardrails */}
        <div className="space-y-1.5 text-xs">
          <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-2.5 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">1. Exact Approval</p>
              <p className="text-slate-400">{guardian.exactApproval.detail}</p>
            </div>
          </div>

          <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-2.5 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-white">
                2. Whitelisted Target Contract
              </p>
              <p className="text-[10px] font-mono text-slate-400 truncate">
                Executor: {guardian.whitelistedTarget.executorAddress}
              </p>
              <p className="text-[10px] font-mono text-slate-500 truncate">
                Router: {guardian.whitelistedTarget.routerAddress}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-2.5 flex items-start gap-2">
            {guardian.onChainSlippageGuard.passed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-semibold text-white">
                3. On-Chain Slippage Guard
              </p>
              <p className="text-slate-400">
                {guardian.onChainSlippageGuard.detail}
              </p>
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {txHash && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300 space-y-1">
            <p className="font-semibold">
              {step === "verifying"
                ? "Đang xác minh Receipt & số dư thực tế on-chain..."
                : postTx?.summary || "Giao dịch đã gửi lên Avalanche Fuji!"}
            </p>
            <a
              href={`${EXPLORER_URL}/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 underline"
            >
              Xem trên Snowtrace <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <div className="flex flex-col gap-2 pt-1">
          {effectiveDecision === "BLOCKED" && (
            <label className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-[11px] text-red-200 cursor-pointer">
              <input
                type="checkbox"
                checked={allowBlockedTest}
                onChange={(e) => setAllowBlockedTest(e.target.checked)}
                className="mt-0.5 accent-red-500"
              />
              <span>
                Developer Revert Demo: Giao dịch đã bị chặn bởi Policy/Simulation. Bật tùy chọn này nếu bạn muốn cố tình gửi lên Fuji để kiểm chứng Smart Contract Revert.
              </span>
            </label>
          )}
          {needsApproveFirst && (
            <button
              onClick={handleApprove}
              disabled={step === "approving" || effectiveDecision === "BLOCKED"}
              className="w-full rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
            >
              {step === "approving"
                ? "Đang Exact Approve..."
                : `1. Exact Approve ${plan.amountIn} mUSDC`}
            </button>
          )}
          <button
            onClick={handleSwap}
            disabled={
              needsApproveFirst ||
              step === "swapping" ||
              step === "verifying" ||
              (effectiveDecision === "BLOCKED" && !allowBlockedTest)
            }
            className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
              effectiveDecision !== "BLOCKED"
                ? "bg-blue-600 hover:bg-blue-500"
                : "bg-red-600/80 hover:bg-red-600"
            }`}
          >
            {step === "swapping"
              ? "Đang ký & thực thi..."
              : step === "verifying"
                ? "Đang xác minh Post-Tx..."
                : isAllowanceOnly
                  ? "Confirm & Sign Allowance"
                  : effectiveDecision !== "BLOCKED"
                    ? "Confirm & Sign Swap"
                    : "Blocked by Tx Guardian (Tick Demo Box to Force Revert)"}
          </button>
        </div>
      </div>
    </div>
  );
};
