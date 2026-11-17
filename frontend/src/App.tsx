import React, { useEffect, useState, useCallback } from "react";
import { Shield, Wallet, Coins, RefreshCw, AlertCircle } from "lucide-react";
import { WalletProvider, useWallet, decodeWeb3Error } from "./context/WalletContext";
import {
  fetchPortfolio,
  fetchPolicy,
  fetchOnChainHistory,
  fetchAgentProfile,
  fetchAuditLogs,
  PortfolioData,
  PolicyData,
  SwapPlan,
  AgentProfile,
  DailyUsageRecord,
  AuditLogEvent,
} from "./services/api";
import { AssetAllocation } from "./components/dashboard/AssetAllocation";
import { HoldingsTable } from "./components/dashboard/HoldingsTable";
import { PolicyStatusCard } from "./components/dashboard/PolicyStatusCard";
import { ChatPanel } from "./components/agent/ChatPanel";
import { PlanCard } from "./components/agent/PlanCard";
import { TxPreviewModal, TxRecord } from "./components/agent/TxPreviewModal";
import { TxHistoryTable } from "./components/history/TxHistoryTable";
import { AgentConfigPanel } from "./components/config/AgentConfigPanel";
import { AuditLogPanel } from "./components/audit/AuditLogPanel";

type TabKey = "workspace" | "config" | "audit";

const DashboardContent: React.FC = () => {
  const {
    address,
    isConnecting,
    isWrongNetwork,
    connect,
    disconnect,
    switchToFuji,
    callFaucet,
  } = useWallet();

  const [tab, setTab] = useState<TabKey>("workspace");
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [policy, setPolicy] = useState<PolicyData | null>(null);
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageRecord>({
    spentMusdc: 0,
    txCount: 0,
  });
  const [auditLogs, setAuditLogs] = useState<AuditLogEvent[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [faucetLoading, setFaucetLoading] = useState(false);
  const [bannerMsg, setBannerMsg] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<SwapPlan | null>(null);
  const [inspectPlan, setInspectPlan] = useState<SwapPlan | null>(null);
  const [history, setHistory] = useState<TxRecord[]>([]);

  const loadOnChainData = useCallback(async () => {
    setLoadingData(true);
    try {
      const [pol, profRes, logs] = await Promise.all([
        fetchPolicy().catch(() => null),
        fetchAgentProfile(address ?? undefined).catch(() => null),
        fetchAuditLogs().catch(() => []),
      ]);
      if (pol) setPolicy(pol);
      if (profRes) {
        setAgentProfile(profRes.profile);
        setDailyUsage(profRes.dailyUsage);
      }
      setAuditLogs(logs);

      if (address) {
        const [port, onChainHist] = await Promise.all([
          fetchPortfolio(address),
          fetchOnChainHistory(address).catch(() => []),
        ]);
        setPortfolio(port);
        if (onChainHist.length > 0) {
          setHistory((prev) => {
            const seen = new Set(onChainHist.map((x) => x.hash));
            const localOnly = prev.filter((x) => !x.hash || !seen.has(x.hash));
            return [...localOnly, ...onChainHist];
          });
        }
      } else {
        setPortfolio(null);
      }
    } catch (err: any) {
      setBannerMsg(err?.message || "Không thể tải dữ liệu từ Backend.");
    } finally {
      setLoadingData(false);
    }
  }, [address]);

  useEffect(() => {
    loadOnChainData();
  }, [loadOnChainData]);

  const handleFaucet = async () => {
    setFaucetLoading(true);
    setBannerMsg(null);
    try {
      const hash = await callFaucet();
      setHistory((prev) => [
        {
          hash,
          action: "Faucet Mint",
          amount: "1000 mUSDC",
          status: "SUCCESS",
          detail: "Minted test mUSDC on Avalanche Fuji",
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
      await loadOnChainData();
    } catch (err) {
      setBannerMsg(decodeWeb3Error(err));
    } finally {
      setFaucetLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0E14] text-slate-100">
      <header className="border-b border-slate-800 bg-[#131722]/90 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white">
                AgentVault
              </h1>
              <p className="text-[11px] text-slate-400">
                AI DeFi Copilot · Avalanche Fuji (Testnet)
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 rounded-xl bg-[#0B0E14] p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setTab("workspace")}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                tab === "workspace"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Workspace
            </button>
            <button
              onClick={() => setTab("config")}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                tab === "config"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Agent Config
            </button>
            <button
              onClick={() => setTab("audit")}
              className={`rounded-lg px-3 py-1.5 font-medium ${
                tab === "audit"
                  ? "bg-blue-600 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Audit Log ({auditLogs.length})
            </button>
          </nav>

          <div className="flex items-center gap-2">
            {address && (
              <>
                <button
                  onClick={handleFaucet}
                  disabled={faucetLoading}
                  className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  <Coins className="h-3.5 w-3.5" />
                  {faucetLoading ? "Minting..." : "Faucet 1000 mUSDC"}
                </button>
                <button
                  onClick={loadOnChainData}
                  className="rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-slate-300 hover:text-white"
                  title="Refresh"
                >
                  <RefreshCw className={`h-4 w-4 ${loadingData ? "animate-spin" : ""}`} />
                </button>
              </>
            )}

            {isWrongNetwork && (
              <button
                onClick={switchToFuji}
                className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500"
              >
                Switch to Fuji (43113)
              </button>
            )}

            {address ? (
              <button
                onClick={disconnect}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0B0E14] px-3.5 py-2 text-xs font-mono text-slate-200 hover:border-slate-500"
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                {address.slice(0, 6)}...{address.slice(-4)}
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
              >
                <Wallet className="h-4 w-4" />
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        {bannerMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{bannerMsg}</span>
          </div>
        )}

        {tab === "workspace" && (
          <>
            {/* Agent Status Strip */}
            {agentProfile && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-[#131722] px-5 py-3 text-xs">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-white">
                    {agentProfile.name}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 font-bold ${
                      agentProfile.status === "ACTIVE"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-red-500/15 text-red-400"
                    }`}
                  >
                    {agentProfile.status}
                  </span>
                  <span className="text-slate-400">
                    Mode: <strong className="text-slate-200">{agentProfile.executionMode}</strong>
                  </span>
                  <span className="text-slate-400">
                    Max/Swap: <strong className="text-slate-200">{agentProfile.policy.maxAmountPerSwapMusdc} mUSDC</strong>
                  </span>
                </div>
                <div className="text-slate-300">
                  Daily Budget:{" "}
                  <strong>
                    {dailyUsage.spentMusdc} / {agentProfile.policy.dailySpendingLimitMusdc} mUSDC
                  </strong>{" "}
                  · Tx: <strong>{dailyUsage.txCount}/{agentProfile.policy.maxTransactionsPerDay}</strong>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 space-y-5">
                <AssetAllocation
                  assets={portfolio?.assets ?? []}
                  totalValueUsd={portfolio?.totalValueUsd ?? 0}
                />
                <PolicyStatusCard policy={policy} />
              </div>
              <div className="lg:col-span-8">
                <HoldingsTable
                  assets={portfolio?.assets ?? []}
                  loading={loadingData}
                  priceSource={portfolio?.priceSource}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7">
                <ChatPanel
                  onSelectPlan={(p) => {
                    setActivePlan(p);
                    loadOnChainData();
                  }}
                />
              </div>
              <div className="lg:col-span-5 space-y-5">
                <PlanCard
                  plan={activePlan}
                  onPlanUpdated={(p) => setActivePlan(p)}
                  onInspect={(p) => setInspectPlan(p)}
                  onRejected={() => {
                    setActivePlan(null);
                    loadOnChainData();
                  }}
                />
                <TxHistoryTable records={history} />
              </div>
            </div>
          </>
        )}

        {tab === "config" && (
          <AgentConfigPanel
            profile={agentProfile}
            dailyUsage={dailyUsage}
            onUpdated={loadOnChainData}
          />
        )}

        {tab === "audit" && <AuditLogPanel logs={auditLogs} />}
      </main>

      <TxPreviewModal
        plan={inspectPlan}
        prePortfolio={portfolio}
        onClose={() => setInspectPlan(null)}
        onTxComplete={(rec) => {
          setHistory((prev) => [rec, ...prev]);
          loadOnChainData();
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <WalletProvider>
      <DashboardContent />
    </WalletProvider>
  );
}
