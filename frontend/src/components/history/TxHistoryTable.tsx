import React from "react";
import { ExternalLink } from "lucide-react";
import { TxRecord } from "../agent/TxPreviewModal";

const EXPLORER_URL =
  import.meta.env.VITE_EXPLORER_URL || "https://testnet.snowtrace.io";

export const TxHistoryTable: React.FC<{ records: TxRecord[] }> = ({
  records,
}) => {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#131722] p-5">
      <h2 className="text-sm font-semibold text-slate-200 mb-3">
        Transaction History (Avalanche Fuji & Glacier)
      </h2>
      {records.length === 0 ? (
        <p className="text-xs text-slate-500">
          Chưa ghi nhận giao dịch nào cho ví này trên Avalanche Fuji.
        </p>
      ) : (
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {records.map((rec, i) => (
            <div
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-[#0B0E14] px-4 py-3 text-xs"
            >
              <div>
                <p className="font-semibold text-white">
                  {rec.action} — <span className="text-slate-300">{rec.amount}</span>
                </p>
                <p className="text-slate-400 mt-0.5">{rec.detail}</p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2.5 py-0.5 font-medium ${
                    rec.status === "SUCCESS"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                  }`}
                >
                  {rec.status}
                </span>
                {rec.hash && (
                  <a
                    href={`${EXPLORER_URL}/tx/${rec.hash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                  >
                    Explorer <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
