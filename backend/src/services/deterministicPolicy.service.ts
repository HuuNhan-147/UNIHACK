import {
  AgentPolicyConfig,
  getAgentProfile,
  getDailyUsage,
} from "./store.service";
import { precheckSwapPolicy } from "./policy.service";

export const ON_CHAIN_MAX_PER_TX_MUSDC = 300;
export const ON_CHAIN_MAX_SLIPPAGE_BPS = 200;

export interface PolicyCheckItem {
  name: string;
  passed: boolean;
  layer: "ON_CHAIN" | "BACKEND";
  detail: string;
}

export interface PolicyValidationResult {
  decision: "ALLOW" | "REQUIRE_APPROVAL" | "ESCALATE" | "REJECT";
  checks: PolicyCheckItem[];
  reason?: string;
}

export interface MaliciousIntentResult {
  isMalicious: boolean;
  riskLevel: "LOW" | "HIGH" | "CRITICAL";
  flags: string[];
  reason?: string;
}

export function validateMusdcDecimals(amount: number): {
  valid: boolean;
  reason?: string;
} {
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      valid: false,
      reason: "Số lượng mUSDC phải lớn hơn 0.",
    };
  }
  const fixed = amount.toFixed(12).replace(/0+$/, "");
  const parts = fixed.split(".");
  if (amount < 0.000001 || (parts[1] && parts[1].length > 6)) {
    return {
      valid: false,
      reason:
        "Invalid mUSDC precision: Số lượng mUSDC tối thiểu là 0.000001 mUSDC và tối đa 6 chữ số thập phân (6 decimals).",
    };
  }
  return { valid: true };
}

export function detectMaliciousIntent(message: string): MaliciousIntentResult {
  const lower = message.toLowerCase();
  const flags: string[] = [];

  if (
    /ignore|bỏ qua|override|bypass|forget.*rule|không cần hỏi|without asking|system\s*notification|"role"\s*:\s*"system"|disable\s*all\s*policy|vô hiệu hóa.*chính sách|đánh dấu là valid/i.test(
      lower
    )
  ) {
    flags.push("POLICY_BYPASS_ATTEMPT");
  }
  if (/unlimited|maxuint|toàn bộ số dư|approve all|drain/i.test(lower)) {
    flags.push("UNLIMITED_APPROVAL_ATTEMPT");
  }
  if (
    /0x[a-f0-9]{40}/i.test(message) &&
    /chuyển|send|transfer|sửa địa chỉ|trường\s*"to"|ghi đè.*calldata/i.test(lower)
  ) {
    flags.push("ARBITRARY_RECIPIENT_TRANSFER");
  }
  if (
    /private\s*key|seed\s*phrase|mnemonic|auto[\s-]*sign|tự\s*động\s*ký|without\s*signature|không\s*cần\s*ký|signed\s*raw\s*transaction/i.test(
      lower
    )
  ) {
    flags.push("SECRET_OR_CUSTODY_VIOLATION");
  }
  if (
    /system[\s_]*instruction|system[\s_]*prompt|chỉ thị hệ thống|check\s*prompt|kiểm tra\s*prompt|in nguyên văn|print.*verbatim|quy tắc\s*(?:số\s*)?\d+|rule\s*\d+|missing\s*amount\s*guard|explicit\s*over[\s-]*limit|function\s*declarations|schema\s*json\s*nội\s*bộ|detectmaliciousintent|đứng trước dòng|lỗ\s*hổng.*(?:prompt|khai\s*thác|vá)|lỗi\s*hổng.*(?:prompt|khai\s*thác|vá)|điểm yếu.*system\s*prompt/i.test(
      lower
    )
  ) {
    flags.push("PROMPT_OR_SCHEMA_EXTRACTION");
  }
  if (
    /âm thầm gọi|silently call|không cần thông báo cho tôi|without telling me|without notifying/i.test(
      lower
    )
  ) {
    flags.push("HIDDEN_TOOL_INJECTION");
  }

  if (flags.length > 0) {
    return {
      isMalicious: true,
      riskLevel: flags.length >= 2 ? "CRITICAL" : "HIGH",
      flags,
      reason: `Phát hiện yêu cầu vượt quyền, khai thác cấu hình nội bộ hoặc tấn công Prompt Injection (${flags.join(
        ", "
      )}). Hệ thống chặn xử lý theo cơ chế Zero-Trust Guard.`,
    };
  }

  return { isMalicious: false, riskLevel: "LOW", flags: [] };
}

export function validatePolicyConfigUpdate(
  policy: AgentPolicyConfig
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (policy.maxAmountPerSwapMusdc <= 0) {
    errors.push("Max Amount Per Swap phải lớn hơn 0.");
  }
  if (policy.maxAmountPerSwapMusdc > ON_CHAIN_MAX_PER_TX_MUSDC) {
    errors.push(
      `Max Amount Per Swap (${policy.maxAmountPerSwapMusdc}) không thể vượt trần On-chain Smart Contract (${ON_CHAIN_MAX_PER_TX_MUSDC} mUSDC).`
    );
  }
  if (policy.dailySpendingLimitMusdc < policy.maxAmountPerSwapMusdc) {
    errors.push(
      "Daily Spending Limit phải lớn hơn hoặc bằng Max Amount Per Swap."
    );
  }
  if (policy.maxTransactionsPerDay < 1 || policy.maxTransactionsPerDay > 50) {
    errors.push("Max Transactions Per Day phải nằm trong khoảng 1–50.");
  }
  if (policy.maxSlippageBps < 1 || policy.maxSlippageBps > ON_CHAIN_MAX_SLIPPAGE_BPS) {
    errors.push(
      `Max Slippage (${policy.maxSlippageBps} bps) phải nằm trong khoảng 1–${ON_CHAIN_MAX_SLIPPAGE_BPS} bps (2%).`
    );
  }
  if (policy.expiresAt && Number.isNaN(Date.parse(policy.expiresAt))) {
    errors.push("Policy Expiration không đúng định dạng ngày.");
  }

  return { valid: errors.length === 0, errors };
}

export async function validateActionAgainstPolicy(params: {
  userAddress: string;
  tokenIn: string;
  tokenOut: string;
  amountInMusdc: number;
  slippageBps: number;
}): Promise<PolicyValidationResult> {
  const profile = getAgentProfile(params.userAddress);
  const policy = profile.policy;
  const usage = getDailyUsage(params.userAddress);
  const checks: PolicyCheckItem[] = [];

  // 1. Agent Status
  const isActive = profile.status === "ACTIVE";
  checks.push({
    name: "Agent Status",
    passed: isActive,
    layer: "BACKEND",
    detail: isActive
      ? "Agent đang ACTIVE"
      : `Agent đang ở trạng thái ${profile.status}`,
  });

  // 2. Policy Expiration
  const notExpired =
    !policy.expiresAt || new Date(policy.expiresAt).getTime() > Date.now();
  checks.push({
    name: "Policy Expiration",
    passed: notExpired,
    layer: "BACKEND",
    detail: policy.expiresAt
      ? notExpired
        ? `Còn hiệu lực đến ${policy.expiresAt}`
        : `Đã hết hạn từ ${policy.expiresAt}`
      : "Không giới hạn thời gian",
  });

  // 3. Token & Pair Whitelist
  const pairKey = `${params.tokenIn}->${params.tokenOut}`;
  const pairAllowed =
    policy.allowedTokens.includes(params.tokenIn) &&
    policy.allowedTokens.includes(params.tokenOut) &&
    policy.allowedPairs.includes(pairKey);
  checks.push({
    name: "Asset & Pair Whitelist",
    passed: pairAllowed,
    layer: "ON_CHAIN",
    detail: pairAllowed
      ? `Cặp ${pairKey} được phép`
      : `Cặp ${pairKey} không nằm trong whitelist`,
  });

  // 4. Per-Swap Limit
  const withinPerSwap =
    params.amountInMusdc > 0 &&
    params.amountInMusdc <= policy.maxAmountPerSwapMusdc;
  checks.push({
    name: "Max Amount Per Swap",
    passed: withinPerSwap,
    layer:
      policy.maxAmountPerSwapMusdc === ON_CHAIN_MAX_PER_TX_MUSDC
        ? "ON_CHAIN"
        : "BACKEND",
    detail: `${params.amountInMusdc} / ${policy.maxAmountPerSwapMusdc} mUSDC (On-chain cap: ${ON_CHAIN_MAX_PER_TX_MUSDC})`,
  });

  // 5. Daily Spending Limit
  const projectedDaily = usage.spentMusdc + params.amountInMusdc;
  const withinDaily = projectedDaily <= policy.dailySpendingLimitMusdc;
  checks.push({
    name: "Daily Spending Limit (UTC)",
    passed: withinDaily,
    layer: "BACKEND",
    detail: `Đã dùng ${usage.spentMusdc} + ${params.amountInMusdc} = ${projectedDaily} / ${policy.dailySpendingLimitMusdc} mUSDC`,
  });

  // 6. Max Transactions Per Day
  const withinTxCount = usage.txCount + 1 <= policy.maxTransactionsPerDay;
  checks.push({
    name: "Max Transactions Per Day",
    passed: withinTxCount,
    layer: "BACKEND",
    detail: `Giao dịch thứ ${usage.txCount + 1} / ${policy.maxTransactionsPerDay}`,
  });

  // 7. Slippage
  const withinSlippage =
    params.slippageBps > 0 && params.slippageBps <= policy.maxSlippageBps;
  checks.push({
    name: "Slippage Tolerance",
    passed: withinSlippage,
    layer: "ON_CHAIN",
    detail: `${params.slippageBps} bps / ${policy.maxSlippageBps} bps`,
  });

  // 8. On-chain Smart Contract Pre-check
  const onChainCheck = await precheckSwapPolicy(
    params.amountInMusdc,
    params.slippageBps
  );
  checks.push({
    name: "On-Chain Policy Contract",
    passed: onChainCheck.allowed,
    layer: "ON_CHAIN",
    detail: onChainCheck.allowed
      ? "AgentVaultPolicy.validateSwap() PASSED"
      : onChainCheck.reason || "Reverted on-chain",
  });

  const failed = checks.filter((c) => !c.passed);
  if (failed.length > 0) {
    return {
      decision: "REJECT",
      checks,
      reason: failed.map((f) => `${f.name}: ${f.detail}`).join(" | "),
    };
  }

  if (profile.executionMode === "ADVISORY") {
    return {
      decision: "REJECT",
      checks,
      reason:
        "Agent đang ở chế độ ADVISORY (chỉ phân tích & đề xuất, không tạo transaction thực thi).",
    };
  }

  if (
    params.amountInMusdc >= policy.maxAmountPerSwapMusdc * 0.85 ||
    params.slippageBps >= 150
  ) {
    return {
      decision: "ESCALATE",
      checks,
      reason:
        "Giao dịch hợp lệ nhưng tiệm cận ngưỡng trần rủi ro. Yêu cầu User kiểm tra kỹ trên Tx Guardian.",
    };
  }

  return {
    decision: "REQUIRE_APPROVAL",
    checks,
  };
}
