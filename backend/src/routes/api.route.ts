import { Router } from "express";
import { z } from "zod";
import { areContractsConfigured } from "../config/env";
import { getPortfolio } from "../services/portfolio.service";
import { getPolicyRules } from "../services/policy.service";
import { buildSwapPlan } from "../services/swapPlanner.service";
import { getOnChainHistory } from "../services/history.service";
import {
  draftPolicyFromNaturalLanguage,
  runAgentChat,
} from "../agent/orchestrator";
import { clearSessionHistory } from "../services/sessionMemory.service";
import {
  appendAuditLog,
  getAgentProfile,
  getAuditLogs,
  getDailyUsage,
  getPlan,
  savePlan,
  updateAgentProfile,
} from "../services/store.service";
import { validatePolicyConfigUpdate } from "../services/deterministicPolicy.service";
import { verifyAndRecordTransaction } from "../services/postTx.service";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    chainId: 43113,
    contractsConfigured: areContractsConfigured(),
    timestamp: new Date().toISOString(),
  });
});

apiRouter.get("/portfolio/:address", async (req, res) => {
  try {
    const data = await getPortfolio(req.params.address);
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to fetch portfolio" });
  }
});

apiRouter.get("/policy", async (_req, res) => {
  try {
    const data = await getPolicyRules();
    res.json(data);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to fetch policy" });
  }
});

apiRouter.get("/history/:address", async (req, res) => {
  try {
    const data = await getOnChainHistory(req.params.address);
    res.json({ records: data });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to fetch history" });
  }
});

// === Agent Profile & Policy Builder ===
apiRouter.get("/agent/profile", (req, res) => {
  const userAddress =
    typeof req.query.userAddress === "string" ? req.query.userAddress : "";
  const profile = getAgentProfile();
  const dailyUsage = userAddress
    ? getDailyUsage(userAddress)
    : { spentMusdc: 0, txCount: 0 };
  res.json({ profile, dailyUsage });
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(300).optional(),
  status: z.enum(["ACTIVE", "PAUSED", "REVOKED"]).optional(),
  executionMode: z.enum(["ADVISORY", "APPROVAL_REQUIRED"]).optional(),
  riskProfile: z.enum(["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]).optional(),
  policy: z
    .object({
      maxAmountPerSwapMusdc: z.number(),
      dailySpendingLimitMusdc: z.number(),
      maxTransactionsPerDay: z.number().int(),
      maxSlippageBps: z.number().int(),
      allowedTokens: z.array(z.string()),
      allowedPairs: z.array(z.string()),
      allowedRouters: z.array(z.string()),
      expiresAt: z.string().nullable(),
    })
    .optional(),
});

apiRouter.put("/agent/profile", (req, res) => {
  try {
    const parsed = updateProfileSchema.parse(req.body);
    if (parsed.policy) {
      const check = validatePolicyConfigUpdate(parsed.policy);
      if (!check.valid) {
        return res.status(400).json({ error: check.errors.join(" ") });
      }
    }
    const updated = updateAgentProfile(parsed);
    appendAuditLog({
      userAddress: "ADMIN_USER",
      userRequest: "Update Agent Profile & Policy",
      governanceDecision: "CONFIG_UPDATED",
      policyDecision: `MaxSwap=${updated.policy.maxAmountPerSwapMusdc}, Daily=${updated.policy.dailySpendingLimitMusdc}, Status=${updated.status}`,
    });
    res.json({ profile: updated });
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Invalid profile update" });
  }
});

apiRouter.post("/agent/policy-draft", async (req, res) => {
  try {
    const { prompt } = z.object({ prompt: z.string().min(3).max(500) }).parse(req.body);
    const result = await draftPolicyFromNaturalLanguage(prompt);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to draft policy" });
  }
});

// === Plan Management & Revalidation ===
apiRouter.post("/plans/:planId/revalidate", async (req, res) => {
  try {
    const existing = getPlan(req.params.planId);
    if (!existing) {
      return res.status(404).json({ error: "Plan not found" });
    }
    const { amountInMusdc, slippageBps } = z
      .object({
        amountInMusdc: z.number().positive(),
        slippageBps: z.number().int().min(1).max(1000).default(100),
      })
      .parse(req.body);

    const freshPlan = await buildSwapPlan(
      existing.userAddress,
      amountInMusdc,
      slippageBps,
      existing.objective
    );
    res.json(freshPlan);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to revalidate plan" });
  }
});

apiRouter.post("/plans/:planId/reject", (req, res) => {
  const existing = getPlan(req.params.planId);
  if (!existing) {
    return res.status(404).json({ error: "Plan not found" });
  }
  const updated = savePlan({
    ...existing,
    status: "REJECTED",
    updatedAt: new Date().toISOString(),
  });
  appendAuditLog({
    userAddress: existing.userAddress,
    userRequest: "User Rejected Plan",
    planId: existing.planId,
    governanceDecision: "USER_REJECTED",
    policyDecision: existing.policyCheck.decision,
  });
  res.json({ plan: updated });
});

// === Transaction Prepare & Post-Tx Verification ===
const prepareTxSchema = z.object({
  userAddress: z.string().min(42).max(42),
  amountInMusdc: z.number().positive(),
  slippageBps: z.number().int().min(1).max(1000).optional().default(100),
});

apiRouter.post("/tx/prepare", async (req, res) => {
  try {
    const parsed = prepareTxSchema.parse(req.body);
    const plan = await buildSwapPlan(
      parsed.userAddress,
      parsed.amountInMusdc,
      parsed.slippageBps
    );
    res.json(plan);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to prepare swap" });
  }
});

apiRouter.post("/tx/verify", async (req, res) => {
  try {
    const parsed = z
      .object({
        txHash: z.string().min(66).max(66),
        userAddress: z.string().min(42).max(42),
        planId: z.string().optional(),
        amountInMusdc: z.number().optional(),
        prePortfolio: z.any().optional(),
      })
      .parse(req.body);
    const result = await verifyAndRecordTransaction(parsed);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err?.message || "Failed to verify tx" });
  }
});

// === AI Agent Chat & Audit Logs ===
const agentChatSchema = z.object({
  message: z.string().min(1).max(1000),
  userAddress: z.string().optional(),
  sessionId: z.string().min(1).max(80).optional(),
});

apiRouter.post("/agent/chat", async (req, res) => {
  try {
    const parsed = agentChatSchema.parse(req.body);
    const response = await runAgentChat(
      parsed.message,
      parsed.userAddress,
      parsed.sessionId || "default"
    );
    res.json(response);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "AI Agent error" });
  }
});

apiRouter.post("/agent/session/reset", (req, res) => {
  const sessionId =
    typeof req.body?.sessionId === "string" && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : "default";
  clearSessionHistory(sessionId);
  res.json({ ok: true, sessionId });
});

apiRouter.get("/audit-logs", (_req, res) => {
  res.json({ logs: getAuditLogs() });
});
