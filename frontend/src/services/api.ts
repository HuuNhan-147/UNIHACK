const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

export type GovernanceDecision = "ROUTINE" | "ASK" | "REJECT" | "ESCALATE";
export type AgentStatus = "ACTIVE" | "PAUSED" | "REVOKED";
export type ExecutionMode = "ADVISORY" | "APPROVAL_REQUIRED";
export type RiskProfile = "CONSERVATIVE" | "BALANCED" | "AGGRESSIVE";

export interface PortfolioAsset {
  symbol: "AVAX" | "mUSDC";
  name: string;
  balance: string;
  priceUsd: number;
  valueUsd: number;
  percentage: number;
}

export type AvaxPriceSource = "CHAINLINK_FUJI" | "LIVE_API" | "FALLBACK_REF";

export interface PortfolioData {
  address: string;
  chainId: number;
  totalValueUsd: number;
  priceSource: AvaxPriceSource;
  oracleUpdatedAt?: string;
  fallbackReason?: string;
  assets: PortfolioAsset[];
}

export interface PolicyData {
  maxAmountPerTxMusdc: string;
  maxSlippageBps: number;
  paused: boolean;
  musdcAllowed: boolean;
  nativeAvaxAllowed: boolean;
  routerAllowed: boolean;
  oracleEnabled?: boolean;
  activeRateMusdcPerAvax?: string;
  routerLiquidityAvax?: string;
}

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

export interface PolicyCheckItem {
  name: string;
  passed: boolean;
  layer: "ON_CHAIN" | "BACKEND";
  detail: string;
}

export interface StructuredPlanRecord {
  planId: string;
  userAddress: string;
  objective: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "EXECUTED" | "FAILED";
  reasoning: string;
  actions: Array<{
    action: "SWAP";
    tokenIn: string;
    tokenOut: string;
    amountIn: string;
    maxSlippageBps: number;
  }>;
  estimatedImpact: {
    estimatedOutAvax?: string;
    portfolioChange: string;
  };
  policyCheck: {
    decision: "ALLOW" | "REQUIRE_APPROVAL" | "ESCALATE" | "REJECT";
    checks: PolicyCheckItem[];
    reason?: string;
  };
}

export type SimulationStatus =
  | "SIMULATION_PASSED"
  | "SIMULATION_FAILED"
  | "SIMULATION_UNAVAILABLE";

export interface TxSimulationReport {
  status: SimulationStatus;
  txType: "SWAP" | "APPROVE" | "REVOKE_ALLOWANCE";
  chainId: number;
  from: string;
  to: string;
  functionName: string;
  integrityHash: string;
  simulatedBlock?: number;
  estimatedGas?: string;
  simulatedOutputAvax?: string;
  revertReason?: string;
  warnings: string[];
  unverifiedConditions: string[];
  simulatedAt: string;
}

export interface TxGuardianSummary {
  overallDecision: "PASS" | "WARNING" | "BLOCKED";
  exactApproval: { passed: boolean; detail: string };
  whitelistedTarget: {
    passed: boolean;
    executorAddress: string;
    routerAddress: string;
    detail: string;
  };
  onChainSlippageGuard: { passed: boolean; detail: string };
  plainLanguageSummary: string;
  simulation?: TxSimulationReport;
  approveSimulation?: TxSimulationReport;
}

export interface UnsignedTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  description: string;
  integrityHash?: string;
}

export interface SwapPlan {
  planId: string;
  decision: GovernanceDecision;
  valid: boolean;
  reason?: string;
  tokenIn: "mUSDC";
  tokenOut: "AVAX";
  amountIn: string;
  estimatedOutAvax: string;
  minAmountOutAvax: string;
  slippageBps: number;
  needsApproval: boolean;
  approveTx?: UnsignedTx;
  swapTx: UnsignedTx;
  policyChecks: PolicyCheckItem[];
  guardian: TxGuardianSummary;
  structuredPlan: StructuredPlanRecord;
}

export interface ExecutionStepEvidence {
  step: string;
  durationMs: number;
  status: "ok" | "error";
}

export interface AgentChatResult {
  reply: string;
  sessionId: string;
  decision: GovernanceDecision;
  modelUsed: string;
  swapPlan?: SwapPlan;
  toolsUsed: string[];
  executionEvidence: ExecutionStepEvidence[];
  securityEvent?: {
    riskLevel: "LOW" | "HIGH" | "CRITICAL";
    flags: string[];
    blockedBy: "DETERMINISTIC_GUARD";
  };
}

export interface OnChainHistoryItem {
  hash?: string;
  action: string;
  amount: string;
  status: "SUCCESS" | "REVERTED";
  detail: string;
  timestamp: string;
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

export interface PostTxVerificationResult {
  status: "SUCCESS" | "FAILED" | "PENDING";
  txHash: string;
  blockNumber?: number;
  actualBefore?: { avax: string; musdc: string; avaxPct: number };
  actualAfter?: { avax: string; musdc: string; avaxPct: number };
  summary: string;
}

async function handleJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export async function fetchPortfolio(address: string): Promise<PortfolioData> {
  const res = await fetch(`${API_BASE}/portfolio/${address}`);
  return handleJson<PortfolioData>(res);
}

export async function fetchPolicy(): Promise<PolicyData> {
  const res = await fetch(`${API_BASE}/policy`);
  return handleJson<PolicyData>(res);
}

export async function fetchOnChainHistory(
  address: string
): Promise<OnChainHistoryItem[]> {
  const res = await fetch(`${API_BASE}/history/${address}`);
  const data = await handleJson<{ records: OnChainHistoryItem[] }>(res);
  return data.records || [];
}

export async function fetchAgentProfile(
  userAddress?: string
): Promise<{ profile: AgentProfile; dailyUsage: DailyUsageRecord }> {
  const q = userAddress ? `?userAddress=${userAddress}` : "";
  const res = await fetch(`${API_BASE}/agent/profile${q}`);
  return handleJson(res);
}

export function buildProfileAuthMessage(
  userAddress: string,
  timestamp: number
): string {
  return `AgentVault Policy Update\nWallet: ${userAddress.toLowerCase()}\nTimestamp: ${timestamp}`;
}

export async function saveAgentProfile(
  patch: Partial<AgentProfile> & {
    userAddress: string;
    timestamp: number;
    signature: string;
  }
): Promise<{ profile: AgentProfile }> {
  const res = await fetch(`${API_BASE}/agent/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  return handleJson(res);
}

export async function draftPolicyFromNL(
  prompt: string,
  userAddress?: string
): Promise<{
  draft: AgentPolicyConfig;
  executionMode: ExecutionMode;
  validation: { valid: boolean; errors: string[] };
  notes: string;
}> {
  const res = await fetch(`${API_BASE}/agent/policy-draft`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt, userAddress }),
  });
  return handleJson(res);
}

export async function revalidatePlan(
  planId: string,
  amountInMusdc: number,
  slippageBps: number
): Promise<SwapPlan> {
  const res = await fetch(`${API_BASE}/plans/${planId}/revalidate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amountInMusdc, slippageBps }),
  });
  return handleJson(res);
}

export async function rejectPlan(planId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/plans/${planId}/reject`, {
    method: "POST",
  });
  await handleJson(res);
}

export async function verifyTransaction(params: {
  txHash: string;
  userAddress: string;
  planId?: string;
  amountInMusdc?: number;
  prePortfolio?: PortfolioData | null;
}): Promise<PostTxVerificationResult> {
  const res = await fetch(`${API_BASE}/tx/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleJson(res);
}

export async function simulateTransaction(params: {
  from: string;
  to: string;
  data: string;
  value?: string;
  chainId?: number;
}): Promise<TxSimulationReport> {
  const res = await fetch(`${API_BASE}/tx/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return handleJson(res);
}

export async function fetchAuditLogs(
  userAddress?: string
): Promise<AuditLogEvent[]> {
  const query = userAddress
    ? `?userAddress=${encodeURIComponent(userAddress)}`
    : "";
  const res = await fetch(`${API_BASE}/audit-logs${query}`);
  const data = await handleJson<{ logs: AuditLogEvent[] }>(res);
  return data.logs || [];
}

export async function sendAgentMessage(
  message: string,
  userAddress?: string,
  sessionId = "default"
): Promise<AgentChatResult> {
  const res = await fetch(`${API_BASE}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, userAddress, sessionId }),
  });
  return handleJson<AgentChatResult>(res);
}

export async function sendAgentMessageStream(
  message: string,
  userAddress: string | undefined,
  sessionId: string,
  onChunk: (chunk: string) => void
): Promise<AgentChatResult> {
  const res = await fetch(`${API_BASE}/agent/chat-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, userAddress, sessionId }),
  });

  if (!res.ok || !res.body) {
    return sendAgentMessage(message, userAddress, sessionId);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalResult: AgentChatResult | null = null;
  let currentEvent = "message";

  const dispatchBlock = (block: string) => {
    const lines = block.split("\n");
    let ev = "message";
    const dataLines: string[] = [];
    for (const line of lines) {
      if (line.startsWith("event:")) {
        ev = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    if (dataLines.length === 0) return;
    currentEvent = ev;
    const payload = JSON.parse(dataLines.join("\n"));
    if (currentEvent === "chunk" && typeof payload.chunk === "string") {
      onChunk(payload.chunk);
    } else if (currentEvent === "done") {
      finalResult = payload as AgentChatResult;
    } else if (currentEvent === "error") {
      throw new Error(payload.error || "Streaming error");
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split("\n\n");
    buffer = blocks.pop() ?? "";
    for (const block of blocks) {
      if (block.trim()) dispatchBlock(block);
    }
  }
  if (buffer.trim()) {
    dispatchBlock(buffer);
  }

  if (!finalResult) {
    throw new Error("Stream ended without final response.");
  }
  return finalResult;
}

export async function resetAgentSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/agent/session/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sessionId }),
  });
  await handleJson(res);
}

export interface RiskOverviewResponse {
  allocation: {
    concentrationRisk: "HIGH_VOLATILE" | "BALANCED" | "HIGH_STABLE" | "EMPTY";
    assetExposure: {
      volatileUsd: number;
      volatilePct: number;
      stableUsd: number;
      stablePct: number;
      topAssetSymbol: string;
      topAssetSharePct: number;
    };
    allowanceExposure: {
      spenderAddress: string;
      approvedMusdc: string;
      walletBalanceMusdc: string;
      exceedsWalletBalance: boolean;
      riskLevel: string;
      source: string;
      updatedAt: string;
    };
    routerLiquidityRisk: {
      routerAddress: string;
      availableAvax: string;
      maxSwappableMusdc: string;
      priceImpactBps: number;
      priceImpactModel: string;
      riskLevel: string;
      source: string;
      updatedAt: string;
    };
    analyzedAt: string;
  };
  positionRisk: {
    portfolioVolatilityExposurePct: number;
    avaxPriceDrop20PctImpactUsd: number;
    liquidationRiskStatus: string;
    aavePosition?: {
      configured: boolean;
      bytecodeVerified: boolean;
      poolAddress?: string;
      hasPosition: boolean;
      totalCollateralUsd: number;
      totalDebtUsd: number;
      availableBorrowsUsd: number;
      healthFactor: number | null;
      status: string;
      dataSource: string;
      fetchedAt: string;
    };
    limitations: string;
    calculatedAt: string;
  };
}

export async function fetchRiskOverview(
  address: string
): Promise<RiskOverviewResponse> {
  const res = await fetch(`${API_BASE}/risk/${address}`);
  return handleJson(res);
}
