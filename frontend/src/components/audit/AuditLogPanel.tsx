import React from "react";
import { ExternalLink, ShieldAlert } from "lucide-react";
import { AuditLogEvent } from "../../services/api";

const EXPLORER_URL =
  import.meta.env.VITE_EXPLORER_URL || "https://testnet.snowtrace.io";

export const AuditLogPanel: React.FC<{ logs: AuditLogEvent[] }> = ({ logs }) => {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#131722] p-5">
      <h2 className="text-sm font-semibold text-white mb-4">
        Governance & Security Audit Log
      </h2>
      {logs.length === 0 ? (
        <p className="text-xs text-slate-400">Chưa có sự kiện audit nào.</p>
      ) : (
        <div className="space-y-2.5">
          {logs.map((log) => (
            <div
              key={log.id}
              className="rounded-xl border border-slate-800 bg-[#0B0E14] p-3.5 text-xs space-y-1.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-slate-400">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="rounded bg-slate-800 px-2 py-0.5 font-semibold text-slate-200">
                    {log.governanceDecision}
                  </span>
                  <span className="rounded bg-blue-500/15 px-2 py-0.5 text-blue-300">
                    {log.policyDecision}
                  </span>
                </div>
                {log.txHash && (
                  <a
                    href={`${EXPLORER_URL}/tx/${log.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-blue-400 hover:underline"
                  >
                    Snowtrace <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <p className="text-slate-200">
                <span className="text-slate-400">Request:</span> {log.userRequest}
              </p>
              {log.securityFlags && log.securityFlags.length > 0 && (
                <p className="flex items-center gap-1 text-red-400">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Security Flags: {log.securityFlags.join(", ")}
                </p>
              )}
              {log.postTxSummary && (
                <p className="text-emerald-400">{log.postTxSummary}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
