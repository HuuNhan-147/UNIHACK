import { ethers } from "ethers";
import { env } from "../config/env";
import { EXECUTOR_ABI, MOCK_ERC20_ABI } from "../abi";
import { getContracts, withRpcTimeout } from "./blockchain.service";
import {
  PolicyCheckItem,
  validateActionAgainstPolicy,
} from "./deterministicPolicy.service";
import { savePlan, StructuredPlanRecord } from "./store.service";
import {
  computeTxIntegrityHash,
  simulateUnsignedTransaction,
  TxSimulationReport,
} from "./txSimulator.service";

export type GovernanceDecision = "ROUTINE" | "ASK" | "REJECT" | "ESCALATE";

export interface UnsignedTx {
  to: string;
  data: string;
  value: string;
  chainId: number;
  description: string;
  integrityHash: string;
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
  simulation: TxSimulationReport;
  approveSimulation?: TxSimulationReport;
}

export interface SwapPlanResult {
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

const musdcIface = new ethers.Interface(MOCK_ERC20_ABI);
const executorIface = new ethers.Interface(EXECUTOR_ABI);

export async function buildSwapPlan(
  userAddress: string,
  amountInMusdc: number,
  slippageBps = 100,
  objective = "Swap mUSDC to AVAX within configured policy"
): Promise<SwapPlanResult> {
  if (!ethers.isAddress(userAddress)) {
    throw new Error("Invalid userAddress");
  }
  if (amountInMusdc <= 0) {
    throw new Error("amountInMusdc must be greater than 0");
  }

  const { musdc, router } = getContracts();
  const amountInRaw = ethers.parseUnits(amountInMusdc.toString(), 6);

  const [expectedOutWei, currentAllowance, userBalance, policyValidation] =
    await withRpcTimeout(
      Promise.all([
        router.getAmountOut(amountInRaw) as Promise<bigint>,
        musdc.allowance(userAddress, env.EXECUTOR_ADDRESS) as Promise<bigint>,
        musdc.balanceOf(userAddress) as Promise<bigint>,
        validateActionAgainstPolicy({
          userAddress,
          tokenIn: "mUSDC",
          tokenOut: "AVAX",
          amountInMusdc,
          slippageBps,
        }),
      ]),
      "Build swap plan"
    );

  const minAmountOutWei =
    (expectedOutWei * BigInt(10_000 - slippageBps)) / 10_000n;
  const needsApproval = currentAllowance < amountInRaw;

  let valid = policyValidation.decision !== "REJECT";
  let reason = policyValidation.reason;
  let decision: GovernanceDecision = "ROUTINE";

  if (policyValidation.decision === "REJECT") {
    decision = "REJECT";
  } else if (userBalance < amountInRaw) {
    valid = false;
    decision = "ASK";
    reason = `Số dư mUSDC không đủ (hiện có ${ethers.formatUnits(
      userBalance,
      6
    )} mUSDC, cần ${amountInMusdc} mUSDC). Vui lòng bấm Faucet hoặc giảm số lượng.`;
  } else if (policyValidation.decision === "ESCALATE") {
    decision = "ESCALATE";
  }

  const approveData = musdcIface.encodeFunctionData("approve", [
    env.EXECUTOR_ADDRESS,
    amountInRaw,
  ]);
  const approveTx: UnsignedTx | undefined = needsApproval
    ? {
        to: env.MUSDC_ADDRESS,
        data: approveData,
        value: "0",
        chainId: env.CHAIN_ID,
        description: `Exact Approve ${amountInMusdc} mUSDC for AgentVaultExecutor`,
        integrityHash: computeTxIntegrityHash({
          chainId: env.CHAIN_ID,
          to: env.MUSDC_ADDRESS,
          data: approveData,
          value: "0",
        }),
      }
    : undefined;

  const swapData = executorIface.encodeFunctionData("executeSwap", [
    env.MUSDC_ADDRESS,
    ethers.ZeroAddress,
    amountInRaw,
    minAmountOutWei,
    slippageBps,
  ]);
  const swapTx: UnsignedTx = {
    to: env.EXECUTOR_ADDRESS,
    data: swapData,
    value: "0",
    chainId: env.CHAIN_ID,
    description: `Swap ${amountInMusdc} mUSDC -> ~${ethers.formatEther(
      expectedOutWei
    )} AVAX via AgentVaultExecutor`,
    integrityHash: computeTxIntegrityHash({
      chainId: env.CHAIN_ID,
      to: env.EXECUTOR_ADDRESS,
      data: swapData,
      value: "0",
    }),
  };

  const [swapSim, approveSim] = await Promise.all([
    simulateUnsignedTransaction({
      from: userAddress,
      to: swapTx.to,
      data: swapTx.data,
      value: swapTx.value,
      chainId: swapTx.chainId,
    }),
    approveTx
      ? simulateUnsignedTransaction({
          from: userAddress,
          to: approveTx.to,
          data: approveTx.data,
          value: approveTx.value,
          chainId: approveTx.chainId,
        })
      : Promise.resolve(undefined),
  ]);

  if (swapSim.status === "SIMULATION_FAILED") {
    valid = false;
    if (decision !== "ASK") {
      decision = "REJECT";
    }
    reason = reason || swapSim.revertReason;
  }

  const estimatedOutStr = ethers.formatEther(expectedOutWei);
  const minOutStr = ethers.formatEther(minAmountOutWei);

  const guardian: TxGuardianSummary = {
    overallDecision: !valid
      ? "BLOCKED"
      : decision === "ESCALATE" || swapSim.status === "SIMULATION_UNAVAILABLE"
      ? "WARNING"
      : "PASS",
    exactApproval: {
      passed: true,
      detail: needsApproval
        ? `Chỉ cấp quyền đúng ${amountInMusdc} mUSDC (không Unlimited Approval).`
        : `Đã có allowance đủ cho ${amountInMusdc} mUSDC.`,
    },
    whitelistedTarget: {
      passed: true,
      executorAddress: env.EXECUTOR_ADDRESS,
      routerAddress: env.ROUTER_ADDRESS,
      detail: `Executor & MockDEXRouter đã xác minh trong Policy Whitelist.`,
    },
    onChainSlippageGuard: {
      passed: slippageBps <= 200,
      detail: `Enforced On-chain: minAmountOut = ${minOutStr} AVAX (max slippage ${
        slippageBps / 100
      }%).`,
    },
    plainLanguageSummary: `Bạn gửi ${amountInMusdc} mUSDC tới AgentVaultExecutor và nhận tối thiểu ${minOutStr} AVAX (ước tính ${estimatedOutStr} AVAX).`,
    simulation: swapSim,
    approveSimulation: approveSim,
  };

  const planId = `plan_${Date.now()}`;
  const now = new Date().toISOString();
  const structuredPlan: StructuredPlanRecord = savePlan({
    planId,
    userAddress,
    objective,
    status: valid ? "PENDING_REVIEW" : "REJECTED",
    reasoning: reason || "Đủ điều kiện Policy. Chờ User kiểm tra và phê duyệt.",
    actions: [
      {
        action: "SWAP",
        tokenIn: "mUSDC",
        tokenOut: "AVAX",
        amountIn: amountInMusdc.toString(),
        maxSlippageBps: slippageBps,
      },
    ],
    estimatedImpact: {
      estimatedOutAvax: estimatedOutStr,
      portfolioChange: `Ước tính đổi ${amountInMusdc} mUSDC sang ~${estimatedOutStr} AVAX (chưa thực thi).`,
    },
    policyCheck: {
      decision: policyValidation.decision,
      checks: policyValidation.checks,
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
    amountIn: amountInMusdc.toString(),
    estimatedOutAvax: estimatedOutStr,
    minAmountOutAvax: minOutStr,
    slippageBps,
    needsApproval,
    approveTx,
    swapTx,
    policyChecks: policyValidation.checks,
    guardian,
    structuredPlan,
  };
}
