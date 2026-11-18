import { ethers } from "ethers";
import { env } from "../config/env";
import { MOCK_ERC20_ABI } from "../abi";
import { getContracts, withRpcTimeout } from "./blockchain.service";
import {
  ON_CHAIN_MAX_PER_TX_MUSDC,
  PolicyCheckItem,
} from "./deterministicPolicy.service";
import {
  GovernanceDecision,
  SwapPlanResult,
  TxGuardianSummary,
  UnsignedTx,
} from "./swapPlanner.service";
import { getAgentProfile, savePlan, StructuredPlanRecord } from "./store.service";

const musdcIface = new ethers.Interface(MOCK_ERC20_ABI);

export async function buildAllowancePlan(params: {
  userAddress: string;
  amountMusdc: number;
  mode: "SET" | "REVOKE";
}): Promise<SwapPlanResult> {
  if (!ethers.isAddress(params.userAddress)) {
    throw new Error("Invalid userAddress");
  }
  if (params.mode === "SET" && (!Number.isFinite(params.amountMusdc) || params.amountMusdc <= 0)) {
    throw new Error("Allowance amount must be greater than 0");
  }

  const profile = getAgentProfile(params.userAddress);
  const { musdc } = getContracts();
  const targetAmount = params.mode === "REVOKE" ? 0 : params.amountMusdc;
  const amountRaw =
    params.mode === "REVOKE"
      ? 0n
      : ethers.parseUnits(targetAmount.toFixed(6), 6);

  const currentAllowance = (await withRpcTimeout(
    musdc.allowance(params.userAddress, env.EXECUTOR_ADDRESS),
    "Fetch current mUSDC allowance"
  )) as bigint;

  const checks: PolicyCheckItem[] = [
    {
      name: "Agent Status",
      passed: profile.status === "ACTIVE",
      layer: "BACKEND",
      detail:
        profile.status === "ACTIVE"
          ? "Copilot đang ACTIVE"
          : `Copilot đang ${profile.status}`,
    },
    {
      name: "Exact Allowance Cap",
      passed: targetAmount <= ON_CHAIN_MAX_PER_TX_MUSDC,
      layer: "ON_CHAIN",
      detail:
        params.mode === "REVOKE"
          ? "Thu hồi về 0 mUSDC (an toàn tối đa)"
          : `${targetAmount} / ${ON_CHAIN_MAX_PER_TX_MUSDC} mUSDC (không cấp Unlimited Approval)`,
    },
    {
      name: "Whitelisted Spender",
      passed: Boolean(env.EXECUTOR_ADDRESS),
      layer: "ON_CHAIN",
      detail: `Spender cố định: AgentVaultExecutor (${env.EXECUTOR_ADDRESS})`,
    },
  ];

  const failed = checks.filter((c) => !c.passed);
  const valid = failed.length === 0 && profile.executionMode !== "ADVISORY";
  const decision: GovernanceDecision = !valid ? "REJECT" : "ASK";
  const reason =
    failed.length > 0
      ? failed.map((f) => `${f.name}: ${f.detail}`).join(" | ")
      : profile.executionMode === "ADVISORY"
      ? "Copilot đang ở chế độ ADVISORY (chỉ đọc & phân tích, không tạo transaction)."
      : undefined;

  const approveTx: UnsignedTx = {
    to: env.MUSDC_ADDRESS,
    data: musdcIface.encodeFunctionData("approve", [
      env.EXECUTOR_ADDRESS,
      amountRaw,
    ]),
    value: "0",
    chainId: env.CHAIN_ID,
    description:
      params.mode === "REVOKE"
        ? "Revoke mUSDC allowance (set to 0) for AgentVaultExecutor"
        : `Set exact mUSDC allowance to ${targetAmount} mUSDC for AgentVaultExecutor`,
  };

  const currentAllowanceFormatted = ethers.formatUnits(currentAllowance, 6);
  const guardian: TxGuardianSummary = {
    overallDecision: valid ? "PASS" : "BLOCKED",
    exactApproval: {
      passed: targetAmount <= ON_CHAIN_MAX_PER_TX_MUSDC,
      detail:
        params.mode === "REVOKE"
          ? `Thu hồi quyền chi tiêu từ ${currentAllowanceFormatted} mUSDC về 0 mUSDC.`
          : `Đặt quyền chi tiêu chính xác ${targetAmount} mUSDC (hiện tại: ${currentAllowanceFormatted} mUSDC).`,
    },
    whitelistedTarget: {
      passed: true,
      executorAddress: env.EXECUTOR_ADDRESS,
      routerAddress: env.ROUTER_ADDRESS,
      detail: "Spender là AgentVaultExecutor đã xác minh trên Avalanche Fuji.",
    },
    onChainSlippageGuard: {
      passed: true,
      detail: "Không áp dụng slippage cho giao dịch approve ERC-20.",
    },
    plainLanguageSummary:
      params.mode === "REVOKE"
        ? `Bạn đang thu hồi toàn bộ quyền chi tiêu mUSDC của AgentVaultExecutor (từ ${currentAllowanceFormatted} về 0 mUSDC).`
        : `Bạn đang cấp quyền cho AgentVaultExecutor chi tiêu tối đa ${targetAmount} mUSDC từ ví của bạn (không cấp Unlimited).`,
  };

  const planId = `plan_allow_${Date.now()}`;
  const now = new Date().toISOString();
  const structuredPlan: StructuredPlanRecord = savePlan({
    planId,
    userAddress: params.userAddress,
    objective:
      params.mode === "REVOKE"
        ? "Revoke mUSDC Allowance for AgentVaultExecutor"
        : `Set Exact mUSDC Allowance (${targetAmount} mUSDC)`,
    status: valid ? "PENDING_REVIEW" : "REJECTED",
    reasoning:
      reason ||
      "Giao dịch allowance hợp lệ. Chờ User kiểm tra trên Tx Guardian và ký bằng ví.",
    actions: [
      {
        action: "SWAP",
        tokenIn: "mUSDC",
        tokenOut: "mUSDC",
        amountIn: targetAmount.toString(),
        maxSlippageBps: 0,
      },
    ],
    estimatedImpact: {
      portfolioChange:
        params.mode === "REVOKE"
          ? `Allowance thay đổi: ${currentAllowanceFormatted} → 0 mUSDC`
          : `Allowance thay đổi: ${currentAllowanceFormatted} → ${targetAmount} mUSDC`,
    },
    policyCheck: {
      decision: valid ? "REQUIRE_APPROVAL" : "REJECT",
      checks,
      reason,
    },
    createdAt: now,
    updatedAt: now,
  });

  return {
    planId,
    decision,
    valid,
    reason,
    tokenIn: "mUSDC",
    tokenOut: "AVAX",
    amountIn: targetAmount.toString(),
    estimatedOutAvax: "0",
    minAmountOutAvax: "0",
    slippageBps: 0,
    needsApproval: true,
    approveTx,
    swapTx: approveTx,
    policyChecks: checks,
    guardian,
    structuredPlan,
  };
}
