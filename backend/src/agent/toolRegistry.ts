import { SchemaType, FunctionDeclaration } from "@google/generative-ai";
import { z } from "zod";
import { getPortfolio } from "../services/portfolio.service";
import { getPolicyRules } from "../services/policy.service";
import { getAvalancheTxHistory } from "../services/history.service";
import { buildSwapPlan, SwapPlanResult } from "../services/swapPlanner.service";
import { buildAllowancePlan } from "../services/allowancePlanner.service";
import { getAgentProfile, getDailyUsage } from "../services/store.service";
import {
  analyzePortfolioAllocation,
  calculatePositionRisk,
  getAvalancheProtocolYields,
  getSwapQuoteDeterministic,
} from "../services/copilotAnalysis.service";

const addressSchema = z.object({
  address: z.string().min(42).max(42),
});

const swapQuoteSchema = z.object({
  amountInMusdc: z.number().positive(),
  slippageBps: z.number().int().min(1).max(1000).optional().default(100),
});

const allocationSchema = z.object({
  address: z.string().min(42).max(42),
  hypotheticalSwapMusdc: z.number().positive().optional(),
});

const riskSchema = z.object({
  address: z.string().min(42).max(42),
  collateralAvax: z.number().positive().optional(),
  debtUsd: z.number().positive().optional(),
  liquidationThreshold: z.number().positive().max(1).optional(),
});

const yieldsSchema = z.object({
  protocolFilter: z.string().max(60).optional(),
});

const planSwapArgsSchema = z.object({
  userAddress: z.string().min(42).max(42),
  amountInMusdc: z.number().positive(),
  slippageBps: z.number().int().min(1).max(1000).optional().default(100),
  objective: z.string().optional(),
});

const planSetAllowanceSchema = z.object({
  userAddress: z.string().min(42).max(42),
  amountMusdc: z.number().positive(),
});

const planRevokeAllowanceSchema = z.object({
  userAddress: z.string().min(42).max(42),
});

export const toolDeclarations: FunctionDeclaration[] = [
  // === READ TOOLS (7) ===
  {
    name: "get_portfolio",
    description:
      "Read the user's current AVAX and mUSDC balances, live AVAX reference price, and portfolio allocation on Avalanche Fuji.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        address: {
          type: SchemaType.STRING,
          description: "The user's EVM wallet address (0x...)",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "get_policy_rules",
    description:
      "Read both on-chain AgentVaultPolicy allowance rules (maxAmountPerTx, maxSlippageBps, whitelists) and user-configured limits.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userAddress: {
          type: SchemaType.STRING,
          description: "Optional wallet address to check daily spending usage.",
        },
      },
    },
  },
  {
    name: "get_tx_history",
    description:
      "Retrieve actual Avalanche Fuji transaction history via Glacier API and AgentVaultExecutor SwapExecuted events.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        address: {
          type: SchemaType.STRING,
          description: "The user's EVM wallet address (0x...)",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "get_swap_quote",
    description:
      "Get a deterministic swap quote (mUSDC -> AVAX) from MockDEXRouter on Avalanche Fuji without creating or executing a transaction.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        amountInMusdc: {
          type: SchemaType.NUMBER,
          description: "Amount of mUSDC to quote.",
        },
        slippageBps: {
          type: SchemaType.NUMBER,
          description: "Slippage tolerance in bps (e.g. 100 = 1%).",
        },
      },
      required: ["amountInMusdc"],
    },
  },
  {
    name: "get_avalanche_protocol_yields",
    description:
      "Fetch live Avalanche protocol TVL and variable APY snapshot from DeFiLlama. MUST be called for any Avalanche APY/TVL query (including unfamiliar protocol names) to verify live data or return INSUFFICIENT_DATA.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        protocolFilter: {
          type: SchemaType.STRING,
          description: "Optional protocol or token filter (e.g. 'benqi', 'aave', 'usdc').",
        },
      },
    },
  },
  {
    name: "analyze_portfolio_allocation",
    description:
      "Deterministically analyze current token allocation, concentration risk, mUSDC allowance exposure, and Router AVAX liquidity risk with explicit data sources (ON_CHAIN, DETERMINISTIC_MATH), optionally simulating a hypothetical swap.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        address: {
          type: SchemaType.STRING,
          description: "The user's EVM wallet address (0x...)",
        },
        hypotheticalSwapMusdc: {
          type: SchemaType.NUMBER,
          description: "Optional hypothetical mUSDC amount to simulate swapping into AVAX.",
        },
      },
      required: ["address"],
    },
  },
  {
    name: "calculate_position_risk",
    description:
      "Evaluate portfolio -20% AVAX drawdown stress risk, live Aave V3 Fuji Pool (0xccEa5C...) lending position, mUSDC allowance exposure, and router liquidity risk; computes Health Factor / Liquidation Price ONLY from live Aave debt or user-supplied collateral/debt, otherwise returns INSUFFICIENT_DATA.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        address: {
          type: SchemaType.STRING,
          description: "The user's EVM wallet address (0x...)",
        },
        collateralAvax: {
          type: SchemaType.NUMBER,
          description: "Optional user-supplied AVAX collateral amount.",
        },
        debtUsd: {
          type: SchemaType.NUMBER,
          description: "Optional user-supplied USD debt amount.",
        },
        liquidationThreshold: {
          type: SchemaType.NUMBER,
          description: "Optional liquidation threshold (0-1, default 0.8).",
        },
      },
      required: ["address"],
    },
  },

  // === WRITE TOOLS (3 — always produce a pending plan for user confirmation) ===
  {
    name: "plan_swap",
    description:
      "Create a pending Swap Plan (mUSDC -> AVAX) through AgentVaultPolicy and Tx Guardian. User must explicitly confirm and sign with their wallet.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userAddress: {
          type: SchemaType.STRING,
          description: "The user's EVM wallet address (0x...)",
        },
        amountInMusdc: {
          type: SchemaType.NUMBER,
          description: "Amount of mUSDC to swap into AVAX.",
        },
        slippageBps: {
          type: SchemaType.NUMBER,
          description: "Slippage tolerance in basis points (100 = 1%).",
        },
        objective: {
          type: SchemaType.STRING,
          description: "Short objective description for the plan.",
        },
      },
      required: ["userAddress", "amountInMusdc"],
    },
  },
  {
    name: "plan_set_allowance",
    description:
      "Prepare an unsigned ERC-20 exact approve transaction for AgentVaultExecutor (also validates and blocks over-cap requests > 300 mUSDC via Policy Engine). Requires an explicit numeric amount from user.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userAddress: {
          type: SchemaType.STRING,
          description: "The user's EVM wallet address (0x...)",
        },
        amountMusdc: {
          type: SchemaType.NUMBER,
          description: "Explicit mUSDC allowance amount requested by the user.",
        },
      },
      required: ["userAddress", "amountMusdc"],
    },
  },
  {
    name: "plan_revoke_allowance",
    description:
      "Prepare an unsigned ERC-20 approve(0) transaction to revoke AgentVaultExecutor spending allowance. User must confirm and sign.",
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        userAddress: {
          type: SchemaType.STRING,
          description: "The user's EVM wallet address (0x...)",
        },
      },
      required: ["userAddress"],
    },
  },
];

export interface ToolExecutionContext {
  connectedWallet?: string;
  latestSwapPlan?: SwapPlanResult;
  hadToolError?: boolean;
}

function assertConnectedWalletOwner(
  requestedAddress: string,
  ctx: ToolExecutionContext
): string {
  if (!ctx.connectedWallet) {
    return requestedAddress;
  }
  if (
    requestedAddress.trim().toLowerCase() !==
    ctx.connectedWallet.trim().toLowerCase()
  ) {
    ctx.hadToolError = true;
    throw new Error(
      `FORBIDDEN_CROSS_WALLET: Bạn chỉ được phép truy vấn hoặc thao tác trên chính địa chỉ ví đang kết nối (${ctx.connectedWallet}), không được phép truy cập ví của người khác (${requestedAddress}).`
    );
  }
  return ctx.connectedWallet;
}

export async function executeTool(
  name: string,
  rawArgs: unknown,
  ctx: ToolExecutionContext
): Promise<unknown> {
  switch (name) {
    case "get_portfolio": {
      const args = addressSchema.parse(rawArgs);
      const ownerAddr = assertConnectedWalletOwner(args.address, ctx);
      return await getPortfolio(ownerAddr);
    }
    case "get_policy_rules": {
      const onChain = await getPolicyRules();
      const rawAddr =
        typeof (rawArgs as any)?.userAddress === "string"
          ? (rawArgs as any).userAddress
          : "";
      const addr = ctx.connectedWallet || rawAddr;
      const profile = getAgentProfile(addr || undefined);
      const dailyUsage = addr ? getDailyUsage(addr) : { spentMusdc: 0, txCount: 0 };
      return {
        onChain,
        agentProfile: {
          name: profile.name,
          status: profile.status,
          executionMode: profile.executionMode,
          policy: profile.policy,
        },
        dailyUsage,
      };
    }
    case "get_tx_history": {
      const args = addressSchema.parse(rawArgs);
      const ownerAddr = assertConnectedWalletOwner(args.address, ctx);
      return await getAvalancheTxHistory(ownerAddr);
    }
    case "get_swap_quote": {
      const args = swapQuoteSchema.parse(rawArgs);
      return await getSwapQuoteDeterministic(args.amountInMusdc, args.slippageBps);
    }
    case "get_avalanche_protocol_yields": {
      const args = yieldsSchema.parse(rawArgs || {});
      return await getAvalancheProtocolYields(args.protocolFilter);
    }
    case "analyze_portfolio_allocation": {
      const args = allocationSchema.parse(rawArgs);
      const ownerAddr = assertConnectedWalletOwner(args.address, ctx);
      return await analyzePortfolioAllocation(
        ownerAddr,
        args.hypotheticalSwapMusdc
      );
    }
    case "calculate_position_risk": {
      const args = riskSchema.parse(rawArgs);
      const ownerAddr = assertConnectedWalletOwner(args.address, ctx);
      return await calculatePositionRisk({ ...args, address: ownerAddr });
    }
    case "plan_swap": {
      if (ctx.latestSwapPlan) {
        throw new Error(
          "Duplicate write plan prevented: only one transaction plan may be prepared per turn."
        );
      }
      const args = planSwapArgsSchema.parse(rawArgs);
      const ownerAddr = assertConnectedWalletOwner(args.userAddress, ctx);
      const plan = await buildSwapPlan(
        ownerAddr,
        args.amountInMusdc,
        args.slippageBps,
        args.objective
      );
      ctx.latestSwapPlan = plan;
      return {
        planId: plan.planId,
        decision: plan.decision,
        valid: plan.valid,
        reason: plan.reason,
        amountIn: plan.amountIn,
        estimatedOutAvax: plan.estimatedOutAvax,
        minAmountOutAvax: plan.minAmountOutAvax,
        simulationStatus: plan.guardian.simulation.status,
        simulationRevertReason: plan.guardian.simulation.revertReason,
        policyChecks: plan.policyChecks,
      };
    }
    case "plan_set_allowance": {
      if (ctx.latestSwapPlan) {
        throw new Error(
          "Duplicate write plan prevented: only one transaction plan may be prepared per turn."
        );
      }
      const args = planSetAllowanceSchema.parse(rawArgs);
      const ownerAddr = assertConnectedWalletOwner(args.userAddress, ctx);
      const plan = await buildAllowancePlan({
        userAddress: ownerAddr,
        amountMusdc: args.amountMusdc,
        mode: "SET",
      });
      ctx.latestSwapPlan = plan;
      return {
        planId: plan.planId,
        decision: plan.decision,
        valid: plan.valid,
        reason: plan.reason,
        allowanceAmountMusdc: plan.amountIn,
        simulationStatus: plan.guardian.simulation.status,
        simulationRevertReason: plan.guardian.simulation.revertReason,
        policyChecks: plan.policyChecks,
      };
    }
    case "plan_revoke_allowance": {
      if (ctx.latestSwapPlan) {
        throw new Error(
          "Duplicate write plan prevented: only one transaction plan may be prepared per turn."
        );
      }
      const args = planRevokeAllowanceSchema.parse(rawArgs);
      const ownerAddr = assertConnectedWalletOwner(args.userAddress, ctx);
      const plan = await buildAllowancePlan({
        userAddress: ownerAddr,
        amountMusdc: 0,
        mode: "REVOKE",
      });
      ctx.latestSwapPlan = plan;
      return {
        planId: plan.planId,
        decision: plan.decision,
        valid: plan.valid,
        reason: plan.reason,
        allowanceAmountMusdc: "0",
        simulationStatus: plan.guardian.simulation.status,
        simulationRevertReason: plan.guardian.simulation.revertReason,
        policyChecks: plan.policyChecks,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
