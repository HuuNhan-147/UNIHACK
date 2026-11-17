import fs from "fs";
import path from "path";

export type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";
export type ExecutionMode = "ADVISORY" | "APPROVAL_REQUIRED";
export type RiskProfile = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export interface AgentPolicyConfig {
  maxAmountPerSwapMusdc: number;
  dailySpendingLimitMusdc: number;
  maxTransactionsPerDay: number;
  maxSlippageBps: number;
  allowedTokens: string[];
  allowedPairs: string[];
  allowedRouters: string[];
  expiresAt: string | null;
}

export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  status: AgentStatus;
  executionMode: ExecutionMode;
  riskProfile: RiskProfile;
  policy: AgentPolicyConfig;
  createdAt: string;
  updatedAt: string;
}

export interface DailyUsageRecord {
  spentMusdc: number;
  txCount: number;
}

export interface StructuredPlanAction {
  action: "SWAP";
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  maxSlippageBps: number;
}

export interface StructuredPlanRecord {
  planId: string;
  userAddress: string;
  objective: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
  reasoning: string;
  actions: StructuredPlanAction[];
  estimatedImpact: {
    estimatedOutAvax?: string;
    portfolioChange: string;
  };
  policyCheck: {
    decision: "ALLOW" | "REQUIRE_APPROVAL" | "ESCALATE" | "REJECT";
    checks: Array<{ name: string; passed: boolean; layer: "ON_CHAIN" | "BACKEND"; detail: string }>;
    reason?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEvent {
  id: string;
  timestamp: string;
  userAddress: string;
  userRequest: string;
  planId?: string;
  governanceDecision: string;
  policyDecision: string;
  txHash?: string;
  executionResult?: string;
  postTxSummary?: string;
  securityFlags?: string[];
}

interface VaultStoreData {
  agentProfile: AgentProfile;
  dailyUsage: Record<string, Record<string, DailyUsageRecord>>;
  plans: Record<string, StructuredPlanRecord>;
  auditLogs: AuditLogEvent[];
}

const DATA_DIR = path.resolve(__dirname, "../../data");
const STORE_PATH = path.join(DATA_DIR, "vault-store.json");

function createDefaultStore(): VaultStoreData {
  const now = new Date().toISOString();
  return {
    agentProfile: {
      id: "agent_default",
      name: "AgentVault Guardian",
      description:
        "Policy-governed DeFi portfolio assistant on Avalanche Fuji Testnet",
      status: "ACTIVE",
      executionMode: "APPROVAL_REQUIRED",
      riskProfile: "BALANCED",
      policy: {
        maxAmountPerSwapMusdc: 300,
        dailySpendingLimitMusdc: 600,
        maxTransactionsPerDay: 5,
        maxSlippageBps: 200,
        allowedTokens: ["mUSDC", "AVAX"],
        allowedPairs: ["mUSDC->AVAX"],
        allowedRouters: ["MockDEXRouter"],
        expiresAt: null,
      },
      createdAt: now,
      updatedAt: now,
    },
    dailyUsage: {},
    plans: {},
    auditLogs: [],
  };
}

function readStore(): VaultStoreData {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(STORE_PATH)) {
    const initial = createDefaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    return JSON.parse(raw) as VaultStoreData;
  } catch {
    const initial = createDefaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
}

function writeStore(data: VaultStoreData): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function getUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getAgentProfile(): AgentProfile {
  return readStore().agentProfile;
}

export function updateAgentProfile(
  patch: Partial<Omit<AgentProfile, "id" | "createdAt">>
): AgentProfile {
  const store = readStore();
  store.agentProfile = {
    ...store.agentProfile,
    ...patch,
    policy: patch.policy
      ? { ...store.agentProfile.policy, ...patch.policy }
      : store.agentProfile.policy,
    updatedAt: new Date().toISOString(),
  };
  writeStore(store);
  return store.agentProfile;
}

export function getDailyUsage(userAddress: string): DailyUsageRecord {
  const store = readStore();
  const dateKey = getUtcDateKey();
  const addr = userAddress.toLowerCase();
  return store.dailyUsage[dateKey]?.[addr] ?? { spentMusdc: 0, txCount: 0 };
}

export function recordDailyUsage(
  userAddress: string,
  amountMusdc: number
): DailyUsageRecord {
  const store = readStore();
  const dateKey = getUtcDateKey();
  const addr = userAddress.toLowerCase();
  if (!store.dailyUsage[dateKey]) {
    store.dailyUsage[dateKey] = {};
  }
  const current = store.dailyUsage[dateKey][addr] ?? {
    spentMusdc: 0,
    txCount: 0,
  };
  const updated: DailyUsageRecord = {
    spentMusdc: Number((current.spentMusdc + amountMusdc).toFixed(4)),
    txCount: current.txCount + 1,
  };
  store.dailyUsage[dateKey][addr] = updated;
  writeStore(store);
  return updated;
}

export function savePlan(plan: StructuredPlanRecord): StructuredPlanRecord {
  const store = readStore();
  store.plans[plan.planId] = plan;
  writeStore(store);
  return plan;
}

export function getPlan(planId: string): StructuredPlanRecord | null {
  return readStore().plans[planId] ?? null;
}

export function appendAuditLog(
  event: Omit<AuditLogEvent, "id" | "timestamp">
): AuditLogEvent {
  const store = readStore();
  const entry: AuditLogEvent = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  store.auditLogs.unshift(entry);
  store.auditLogs = store.auditLogs.slice(0, 100);
  writeStore(store);
  return entry;
}

export function getAuditLogs(): AuditLogEvent[] {
  return readStore().auditLogs;
}
