import React, { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  X,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";
import {
  PortfolioData,
  PostTxVerificationResult,
  SwapPlan,
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [postTx, setPostTx] = useState<PostTxVerificationResult | null>(null);

  if (!plan) return null;

  const isAllowanceOnly = plan.planId.startsWith("plan_allow_");
  const needsApproveFirst = !isAllowanceOnly && plan.needsApproval && step !== "approved";
  const guardian = plan.guardian;

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
      const hash = await sendTx(plan.swapTx);
      setTxHash(hash);
      setStep("verifying");

      if (address) {
        const verified = await verifyTransaction({
          txHash: hash,
          userAddress: address,
          planId: plan.planId,
          amountInMusdc: Number(plan.amountIn),
          prePortfolio,
        });
        setPostTx(verified);
        onTxComplete({
          hash,
          action: "Swap mUSDC → AVAX",
          amount: `${plan.amountIn} mUSDC → ${plan.estimatedOutAvax} AVAX`,
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
        action: "Swap mUSDC → AVAX",
        amount: `${plan.amountIn} mUSDC`,
        status: "REVERTED",
        detail: decoded,
        timestamp: new Date().toLocaleTimeString(),
      });
    }
  };

  const overallBadge =
    guardian.overallDecision === "PASS"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
      : guardian.overallDecision === "WARNING"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
      : "border-red-500/30 bg-red-500/10 text-red-300";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-slate-700 bg-[#131722] p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {guardian.overallDecision === "PASS" ? (
              <ShieldCheck className="h-5 w-5 text-emerald-400" />
            ) : (
              <ShieldAlert className="h-5 w-5 text-red-400" />
            )}
            <h3 className="text-base font-bold text-white">
              Tx Guardian Inspector
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Overall Security Decision */}
        <div className={`rounded-xl border p-3 text-xs ${overallBadge}`}>
          <p className="font-bold">
            Overall Security Decision: {guardian.overallDecision}
          </p>
          {plan.reason && <p className="mt-1 opacity-90">{plan.reason}</p>}
        </div>

        {/* Plain-Language Summary */}
        <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-3.5 text-xs text-slate-200">
          <p className="text-slate-400 font-semibold mb-1">
            Plain-Language Simulation
          </p>
          <p>{guardian.plainLanguageSummary}</p>
        </div>

        {/* 4 Security Checks */}
        <div className="space-y-2 text-xs">
          <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-white">1. Exact Approval</p>
              <p className="text-slate-400">{guardian.exactApproval.detail}</p>
            </div>
          </div>

          <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-3 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-semibold text-white">2. Whitelisted Target</p>
              <p className="text-slate-400">{guardian.whitelistedTarget.detail}</p>
              <p className="text-[10px] font-mono text-slate-500 truncate mt-0.5">
                Executor: {guardian.whitelistedTarget.executorAddress}
              </p>
              <p className="text-[10px] font-mono text-slate-500 truncate">
                Router: {guardian.whitelistedTarget.routerAddress}
              </p>
            </div>
          </div>

          <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-3 flex items-start gap-2">
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
          {needsApproveFirst && (
            <button
              onClick={handleApprove}
              disabled={step === "approving" || !plan.valid}
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
              needsApproveFirst || step === "swapping" || step === "verifying"
            }
            className={`w-full rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 ${
              plan.valid
                ? "bg-blue-600 hover:bg-blue-500"
                : "bg-red-600/80 hover:bg-red-600"
            }`}
          >
            {step === "swapping"
              ? "Đang ký & thực thi..."
              : step === "verifying"
              ? "Đang xác minh Post-Tx..."
              : isAllowanceOnly
              ? `Confirm & Sign ${Number(plan.amountIn) === 0 ? "Revoke Allowance" : `Set Allowance (${plan.amountIn} mUSDC)`}`
              : plan.valid
              ? "Confirm & Sign Swap"
              : "Force Test On-chain (Demo Contract Revert)"}
          </button>
        </div>
      </div>
    </div>
  );
};
