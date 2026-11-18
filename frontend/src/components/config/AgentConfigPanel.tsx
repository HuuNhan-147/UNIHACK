import React, { useState, useEffect } from "react";
import { Sliders, Sparkles, Save, ShieldOff, Play, Pause } from "lucide-react";
import {
  AgentProfile,
  buildProfileAuthMessage,
  DailyUsageRecord,
  draftPolicyFromNL,
  saveAgentProfile,
} from "../../services/api";
import { useWallet, decodeWeb3Error } from "../../context/WalletContext";

interface Props {
  profile: AgentProfile | null;
  dailyUsage: DailyUsageRecord;
  onUpdated: () => void;
}

export const AgentConfigPanel: React.FC<Props> = ({
  profile,
  dailyUsage,
  onUpdated,
}) => {
  const { address, signMessage } = useWallet();
  const [form, setForm] = useState<AgentProfile | null>(profile);
  const [nlPrompt, setNlPrompt] = useState("");
  const [nlNotes, setNlNotes] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  useEffect(() => {
    if (profile) setForm(profile);
  }, [profile]);

  if (!form) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#131722] p-6 text-sm text-slate-400">
        Loading Agent Configuration...
      </div>
    );
  }

  const handleSave = async () => {
    if (!address) {
      setMsg({
        type: "err",
        text: "Vui lòng Connect Wallet trước để ký xác thực chủ sở hữu Policy.",
      });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const timestamp = Date.now();
      const authMessage = buildProfileAuthMessage(address, timestamp);
      const signature = await signMessage(authMessage);
      await saveAgentProfile({
        userAddress: address,
        timestamp,
        signature,
        name: form.name,
        description: form.description,
        status: form.status,
        executionMode: form.executionMode,
        riskProfile: form.riskProfile,
        policy: form.policy,
      });
      setMsg({ type: "ok", text: "Đã xác thực chữ ký ví & lưu cấu hình Policy riêng cho ví của bạn." });
      onUpdated();
    } catch (err: any) {
      setMsg({ type: "err", text: decodeWeb3Error(err) });
    } finally {
      setSaving(false);
    }
  };

  const handleDraftNL = async () => {
    if (!nlPrompt.trim()) return;
    setDrafting(true);
    setMsg(null);
    setNlNotes(null);
    try {
      const res = await draftPolicyFromNL(nlPrompt, address ?? undefined);
      setForm((prev) =>
        prev
          ? {
              ...prev,
              executionMode: res.executionMode,
              policy: res.draft,
            }
          : prev
      );
      setNlNotes(res.notes);
      if (!res.validation.valid) {
        setMsg({
          type: "err",
          text: `Policy Draft có cảnh báo: ${res.validation.errors.join(" ")}`,
        });
      } else {
        setMsg({
          type: "ok",
          text: "AI đã tạo Policy Draft. Vui lòng kiểm tra bên dưới và bấm Save để áp dụng.",
        });
      }
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message || "Không thể tạo Policy Draft." });
    } finally {
      setDrafting(false);
    }
  };

  const setStatusQuick = async (status: "ACTIVE" | "PAUSED" | "REVOKED") => {
    if (!address) {
      setMsg({
        type: "err",
        text: "Vui lòng Connect Wallet trước để ký thay đổi trạng thái Agent.",
      });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const timestamp = Date.now();
      const signature = await signMessage(
        buildProfileAuthMessage(address, timestamp)
      );
      await saveAgentProfile({ userAddress: address, timestamp, signature, status });
      setMsg({ type: "ok", text: `Đã ký xác thực & chuyển trạng thái Agent sang ${status}.` });
      onUpdated();
    } catch (err: any) {
      setMsg({ type: "err", text: decodeWeb3Error(err) });
    } finally {
      setSaving(false);
    }
  };

  const remainingDaily = Math.max(
    0,
    form.policy.dailySpendingLimitMusdc - dailyUsage.spentMusdc
  );

  return (
    <div className="space-y-6">
      {/* Natural Language Policy Builder */}
      <div className="rounded-2xl border border-blue-500/30 bg-[#131722] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">
              Natural Language Policy Builder (AI Draft Only)
            </h2>
          </div>
          <button
            type="button"
            onClick={() =>
              setNlPrompt(
                "Quản lý tối đa 100 mUSDC mỗi ngày, mỗi lần swap không quá 20 mUSDC, tối đa 5 giao dịch/ngày, slippage 1%, yêu cầu tôi xác nhận."
              )
            }
            className="text-xs text-blue-400 hover:underline"
          >
            Điền mẫu Policy 20/100 mUSDC
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={nlPrompt}
            onChange={(e) => setNlPrompt(e.target.value)}
            placeholder="Ví dụ: Tối đa 100 mUSDC/ngày, mỗi lần swap <= 20 mUSDC, slippage 1%..."
            className="flex-1 rounded-xl border border-slate-700 bg-[#0B0E14] px-3.5 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={handleDraftNL}
            disabled={drafting}
            className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {drafting ? "Đang phân tích..." : "Tạo Policy Draft"}
          </button>
        </div>
        {nlNotes && (
          <p className="mt-2 text-xs text-slate-300">AI Summary: {nlNotes}</p>
        )}
      </div>

      {msg && (
        <div
          className={`rounded-xl border px-4 py-3 text-xs ${
            msg.type === "ok"
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
              : "border-red-500/30 bg-red-500/10 text-red-300"
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile & Execution Mode */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-800 bg-[#131722] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="h-4 w-4 text-slate-400" />
              Agent Profile & Control
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                form.status === "ACTIVE"
                  ? "bg-emerald-500/15 text-emerald-400"
                  : form.status === "PAUSED"
                  ? "bg-amber-500/15 text-amber-300"
                  : "bg-red-500/15 text-red-400"
              }`}
            >
              {form.status}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStatusQuick("ACTIVE")}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-1.5 text-xs text-emerald-300 hover:bg-emerald-500/20"
            >
              <Play className="h-3.5 w-3.5" /> Activate
            </button>
            <button
              type="button"
              onClick={() => setStatusQuick("PAUSED")}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-1.5 text-xs text-amber-300 hover:bg-amber-500/20"
            >
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
            <button
              type="button"
              onClick={() => setStatusQuick("REVOKED")}
              className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 py-1.5 text-xs text-red-300 hover:bg-red-500/20"
            >
              <ShieldOff className="h-3.5 w-3.5" /> Revoke
            </button>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400">Agent Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0B0E14] px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400">Execution Mode</label>
              <select
                value={form.executionMode}
                onChange={(e) =>
                  setForm({
                    ...form,
                    executionMode: e.target.value as any,
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0B0E14] px-3 py-2 text-white"
              >
                <option value="APPROVAL_REQUIRED">
                  Mode 2: Approval Required (User ký từng Tx)
                </option>
                <option value="ADVISORY">
                  Mode 1: Advisory Only (Chỉ phân tích, không tạo Tx)
                </option>
                <option value="AUTONOMOUS" disabled>
                  Mode 3: Autonomous (Cần Session Key / Smart Account - Future)
                </option>
              </select>
            </div>
            <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-3 space-y-1">
              <p className="text-slate-400">Daily Budget Tracker (UTC)</p>
              <p className="text-sm font-semibold text-white">
                Đã dùng: {dailyUsage.spentMusdc} / {form.policy.dailySpendingLimitMusdc} mUSDC
                <span className="text-emerald-400 ml-2">
                  (Còn {remainingDaily} mUSDC)
                </span>
              </p>
              <p className="text-slate-400">
                Số giao dịch hôm nay: {dailyUsage.txCount} / {form.policy.maxTransactionsPerDay}
              </p>
            </div>
          </div>
        </div>

        {/* Policy Limits */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-800 bg-[#131722] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">
              Configurable Policy Limits
            </h3>
            <span className="text-[11px] text-slate-400">
              On-chain Hard Cap: 300 mUSDC/tx · 200 bps
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-400">
                Max Amount Per Swap (mUSDC, ≤ 300)
              </label>
              <input
                type="number"
                value={form.policy.maxAmountPerSwapMusdc}
                onChange={(e) =>
                  setForm({
                    ...form,
                    policy: {
                      ...form.policy,
                      maxAmountPerSwapMusdc: Number(e.target.value),
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0B0E14] px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400">
                Daily Spending Limit (mUSDC)
              </label>
              <input
                type="number"
                value={form.policy.dailySpendingLimitMusdc}
                onChange={(e) =>
                  setForm({
                    ...form,
                    policy: {
                      ...form.policy,
                      dailySpendingLimitMusdc: Number(e.target.value),
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0B0E14] px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400">Max Transactions Per Day</label>
              <input
                type="number"
                value={form.policy.maxTransactionsPerDay}
                onChange={(e) =>
                  setForm({
                    ...form,
                    policy: {
                      ...form.policy,
                      maxTransactionsPerDay: Number(e.target.value),
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0B0E14] px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="text-slate-400">
                Max Slippage (bps, 100 = 1%, ≤ 200)
              </label>
              <input
                type="number"
                value={form.policy.maxSlippageBps}
                onChange={(e) =>
                  setForm({
                    ...form,
                    policy: {
                      ...form.policy,
                      maxSlippageBps: Number(e.target.value),
                    },
                  })
                }
                className="mt-1 w-full rounded-xl border border-slate-700 bg-[#0B0E14] px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="rounded-xl bg-[#0B0E14] border border-slate-800 p-3 text-xs text-slate-300 space-y-1">
            <p>
              <span className="text-slate-400">Allowed Pair:</span>{" "}
              {form.policy.allowedPairs.join(", ")}
            </p>
            <p>
              <span className="text-slate-400">Allowed Router:</span>{" "}
              {form.policy.allowedRouters.join(", ")}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            {saving ? "Đang lưu..." : "Save Policy Configuration"}
          </button>
        </div>
      </div>
    </div>
  );
};
