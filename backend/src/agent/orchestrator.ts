import { z } from "zod";
import { getGeminiApiKeys, getGeminiModels } from "../config/env";
import {
  executeTool,
  toolDeclarations,
  ToolExecutionContext,
} from "./toolRegistry";
import {
  GovernanceDecision,
  SwapPlanResult,
} from "../services/swapPlanner.service";
import {
  detectMaliciousIntent,
  validatePolicyConfigUpdate,
} from "../services/deterministicPolicy.service";
import {
  AgentPolicyConfig,
  appendAuditLog,
  getAgentProfile,
} from "../services/store.service";
import {
  appendSessionTurn,
  getSessionHistory,
} from "../services/sessionMemory.service";

export interface ExecutionStepEvidence {
  step: string;
  durationMs: number;
  status: "ok" | "error";
}

export interface AgentChatResponse {
  reply: string;
  sessionId: string;
  decision: GovernanceDecision;
  modelUsed: string;
  swapPlan?: SwapPlanResult;
  toolsUsed: string[];
  executionEvidence: ExecutionStepEvidence[];
  securityEvent?: {
    riskLevel: "LOW" | "HIGH" | "CRITICAL";
    flags: string[];
    blockedBy: "DETERMINISTIC_GUARD";
  };
}

let globalKeyIndex = 0;

const SYSTEM_INSTRUCTION = `You are AgentVault DeFi Copilot on Avalanche Fuji Testnet.
Your role is to help users inspect real on-chain data, analyze portfolio/DeFi risk deterministically, and prepare policy-checked transactions that ONLY the user can confirm and sign with their wallet.

Strict Behavioral Rules:
1. NEVER predict or forecast future token prices (e.g., "Will AVAX go up tomorrow?", "Predict AVAX price next week"). Politely refuse price predictions and offer verifiable current/historical data instead.
2. NEVER invent or guess balances, transaction history, APY, TVL, quotes, collateral, or liquidation prices. Only report numbers returned by your tools.
3. NEVER present historical or snapshot APYs as guaranteed future returns.
4. Distinguish clearly between: (a) live on-chain Fuji data, (b) MockDEXRouter testnet quotes, (c) Avalanche Mainnet DeFiLlama reference yields, and (d) hypothetical simulations.
5. For any write action (swap, set allowance, revoke allowance), use plan_swap, plan_set_allowance, or plan_revoke_allowance. Never claim a transaction has succeeded on-chain before the user signs and verifies it.
6. If the user asks about a wallet action without a connected wallet address, ask them to connect their Avalanche wallet first.
7. Respond concisely in the same language the user used (Vietnamese or English).
8. DO NOT call any tools for casual greetings, thank-yous, or general conceptual/workflow questions (e.g., "What is Tx Guardian?", "How does AgentVault work?", "Slippage là gì?"). Answer those directly and concisely. ONLY call tools when real wallet/on-chain data, protocol yields, risk math, or transaction plans are requested.`;

export function detectCasualGreeting(message: string): "vi" | "en" | null {
  const trimmed = message.trim();
  if (/^(?:xin\s+chào|chào(?:\s+(?:bạn|copilot|bot|ai))?|cảm\s+ơn(?:\s+bạn)?)[!.,?\s]*$/iu.test(trimmed)) {
    return "vi";
  }
  if (/^(?:hi|hello|hey|good\s+(?:morning|afternoon|evening)|thanks|thank\s+you)[!.,?\s]*$/iu.test(trimmed)) {
    return "en";
  }
  return null;
}

export function detectForecastRequest(message: string): boolean {
  const lower = message.toLowerCase();
  const hasForecastVerb =
    /\b(predict|forecast|price prediction|go up|go down|moon|pump|dump|target price|guarantee|highest return|highest apy|best apy)\b|dự đoán|tăng hay giảm|lên hay xuống|giá.*ngày mai|giá.*tuần sau|giá.*tháng tới|nên mua.*lời nhất|lợi nhuận cao nhất|cam kết lãi|đảm bảo lãi/i.test(
      lower
    );
  const hasMarketSubject =
    /\b(avax|usdc|musdc|btc|eth|token|coin|price|apy|yield|return)\b|giá|lãi|lợi nhuận|đồng nào/i.test(
      lower
    );
  return hasForecastVerb && hasMarketSubject;
}

function isRetryableGeminiError(status: number, message: string): boolean {
  const msg = message.toLowerCase();
  return (
    status === 400 ||
    status === 403 ||
    status === 404 ||
    status === 429 ||
    status === 503 ||
    msg.includes("leaked") ||
    msg.includes("api key") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("overloaded") ||
    msg.includes("timeout")
  );
}

async function callGeminiGenerateContent(
  apiKey: string,
  modelName: string,
  contents: any[],
  systemInstruction = SYSTEM_INSTRUCTION,
  withTools = true
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    const body: any = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };
    if (withTools) {
      body.tools = [{ functionDeclarations: toolDeclarations }];
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    const data: any = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message || `HTTP ${res.status}`;
      const err: any = new Error(errMsg);
      err.status = res.status;
      throw err;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

async function callGeminiStreamContent(
  apiKey: string,
  modelName: string,
  contents: any[],
  onChunk?: (chunk: string) => void,
  systemInstruction = SYSTEM_INSTRUCTION,
  withTools = true
): Promise<any> {
  if (!onChunk) {
    return callGeminiGenerateContent(
      apiKey,
      modelName,
      contents,
      systemInstruction,
      withTools
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse&key=${apiKey}`;
    const body: any = {
      system_instruction: { parts: [{ text: systemInstruction }] },
      contents,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
      },
    };
    if (withTools) {
      body.tools = [{ functionDeclarations: toolDeclarations }];
    }

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(body),
    });

    if (!res.ok || !res.body) {
      const errData: any = await res.json().catch(() => ({}));
      const errMsg = errData?.error?.message || `HTTP ${res.status}`;
      const err: any = new Error(errMsg);
      err.status = res.status;
      throw err;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    const functionCallParts: any[] = [];

    const processLine = (line: string) => {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) return;
      const jsonStr = trimmed.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") return;
      try {
        const parsed = JSON.parse(jsonStr);
        const parts: any[] = parsed?.candidates?.[0]?.content?.parts || [];
        for (const p of parts) {
          if (typeof p.text === "string" && p.text.length > 0) {
            fullText += p.text;
            onChunk(p.text);
          }
          if (p.functionCall) {
            functionCallParts.push(p);
          }
        }
      } catch {
        // Ignore partial SSE JSON fragments
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        processLine(line);
      }
    }
    if (buffer.trim()) {
      processLine(buffer);
    }

    const mergedParts: any[] = [];
    if (fullText) mergedParts.push({ text: fullText });
    mergedParts.push(...functionCallParts);
    return { candidates: [{ content: { parts: mergedParts } }] };
  } finally {
    clearTimeout(timer);
  }
}

export async function runAgentChat(
  message: string,
  userAddress?: string,
  sessionId = "default",
  onChunk?: (chunk: string) => void
): Promise<AgentChatResponse> {
  // 1. Deterministic Intent & Prompt Injection Guard (runs BEFORE LLM)
  const intentCheck = detectMaliciousIntent(message);
  if (intentCheck.isMalicious) {
    appendAuditLog({
      userAddress: userAddress || "UNCONNECTED",
      userRequest: message,
      governanceDecision: "REJECT",
      policyDecision: "BLOCKED_BY_INTENT_GUARD",
      securityFlags: intentCheck.flags,
      executionResult: "NO_CALLDATA_GENERATED",
    });
    return {
      reply: `🛡️ [Zero-Trust Guard Blocked] ${intentCheck.reason}`,
      sessionId,
      decision: "REJECT",
      modelUsed: "deterministic-guard",
      toolsUsed: [],
      executionEvidence: [
        { step: "Deterministic Intent Guard", durationMs: 1, status: "ok" },
      ],
      securityEvent: {
        riskLevel: intentCheck.riskLevel,
        flags: intentCheck.flags,
        blockedBy: "DETERMINISTIC_GUARD",
      },
    };
  }

  // 2. Deterministic No-Forecasting Guard (Topic 13 requirement)
  if (detectForecastRequest(message)) {
    const isVi = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
      message
    );
    const refusal = isVi
      ? "Tôi là DeFi Copilot hoạt động dựa trên dữ liệu on-chain xác thực và **không dự đoán giá tương lai** hay cam kết lợi nhuận. Tôi có thể kiểm tra số dư ví, báo giá swap hiện tại trên Fuji, hoặc dữ liệu TVL/APY tham khảo mới nhất nếu bạn muốn."
      : "I am a DeFi Copilot grounded in verifiable on-chain data and **cannot predict future prices** or guarantee returns. I can check your current wallet balances, fetch a live swap quote on Fuji, or look up current Avalanche protocol TVL/APY snapshots instead.";
    appendAuditLog({
      userAddress: userAddress || "UNCONNECTED",
      userRequest: message,
      governanceDecision: "REJECT",
      policyDecision: "FORECAST_REFUSED",
      executionResult: "NO_FORECAST_ISSUED",
    });
    appendSessionTurn(sessionId, message, refusal);
    return {
      reply: refusal,
      sessionId,
      decision: "REJECT",
      modelUsed: "no-forecast-guard",
      toolsUsed: [],
      executionEvidence: [
        { step: "No-Forecasting Guard", durationMs: 1, status: "ok" },
      ],
    };
  }

  // 2.5. Fast-path for pure greetings / thank-yous (avoid unnecessary tool & RPC calls)
  const greetingLang = detectCasualGreeting(message);
  if (greetingLang) {
    const reply =
      greetingLang === "vi"
        ? "Chào bạn! Mình là **AgentVault DeFi Copilot** trên Avalanche Fuji. Bạn có thể hỏi mình về:\n- **Số dư & giá Chainlink:** *\"Phân tích danh mục hiện tại của tôi\"*\n- **Rủi ro & Lãi suất:** *\"Tính Health Factor nếu thế chấp 10 AVAX vay 150 USD\"*\n- **Giao dịch an toàn qua Tx Guardian:** *\"Swap 10 mUSDC sang AVAX\"*"
        : "Hello! I'm **AgentVault DeFi Copilot** on Avalanche Fuji. You can ask me to:\n- **Inspect Portfolio & Chainlink Price:** *\"Analyze my current portfolio allocation\"*\n- **Check Risk & Yields:** *\"Calculate Health Factor for 10 AVAX collateral and $150 debt\"*\n- **Prepare Safe Transactions:** *\"Swap 10 mUSDC to AVAX\"*";
    appendSessionTurn(sessionId, message, reply);
    return {
      reply,
      sessionId,
      decision: "ROUTINE",
      modelUsed: "greeting-fastpath",
      toolsUsed: [],
      executionEvidence: [
        { step: "Greeting Fast-Path", durationMs: 1, status: "ok" },
      ],
    };
  }

  // 3. Check Agent Status before planning (isolated per wallet)
  const profile = getAgentProfile(userAddress);
  if (profile.status !== "ACTIVE") {
    appendAuditLog({
      userAddress: userAddress || "UNCONNECTED",
      userRequest: message,
      governanceDecision: "REJECT",
      policyDecision: `AGENT_${profile.status}`,
      executionResult: "BLOCKED",
    });
    return {
      reply: `Copilot hiện đang ở trạng thái **${profile.status}**. Vui lòng kích hoạt lại trong tab Agent Config để tiếp tục.`,
      sessionId,
      decision: "REJECT",
      modelUsed: "policy-guard",
      toolsUsed: [],
      executionEvidence: [
        { step: `Agent Status Check (${profile.status})`, durationMs: 1, status: "ok" },
      ],
    };
  }

  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    throw new Error(
      "GEMINI_API_KEY / GEMINI_API_KEYS is not configured in backend/.env."
    );
  }

  const models = getGeminiModels();
  const promptWithContext = userAddress
    ? `[Connected Wallet: ${userAddress} | Network: Avalanche Fuji (43113)]\nUser request: ${message}`
    : `[Connected Wallet: NOT CONNECTED | Network: Avalanche Fuji (43113)]\nUser request: ${message}`;

  const priorHistory = getSessionHistory(sessionId);
  let lastError: any = null;

  for (const modelName of models) {
    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
      const activeKey = apiKeys[globalKeyIndex % apiKeys.length];
      globalKeyIndex++;

      try {
        const ctx: ToolExecutionContext = {};
        const toolsUsed: string[] = [];
        const executionEvidence: ExecutionStepEvidence[] = [];
        const contents: any[] = [
          ...priorHistory,
          { role: "user", parts: [{ text: promptWithContext }] },
        ];

        const llmStart = Date.now();
        let data = await callGeminiStreamContent(
          activeKey,
          modelName,
          contents,
          onChunk
        );
        executionEvidence.push({
          step: `LLM (${modelName})`,
          durationMs: Date.now() - llmStart,
          status: "ok",
        });

        let iterations = 0;
        const MAX_ITERATIONS = 5;

        while (iterations < MAX_ITERATIONS) {
          const candidateParts: any[] =
            data?.candidates?.[0]?.content?.parts || [];
          const functionCalls = candidateParts
            .filter((p) => p.functionCall)
            .map((p) => p.functionCall);

          if (functionCalls.length === 0) {
            break;
          }

          contents.push({ role: "model", parts: candidateParts });

          const functionResponseParts = [];
          for (const call of functionCalls) {
            toolsUsed.push(call.name);
            const t0 = Date.now();
            try {
              const output = await executeTool(call.name, call.args || {}, ctx);
              executionEvidence.push({
                step: `Tool: ${call.name}`,
                durationMs: Date.now() - t0,
                status: "ok",
              });
              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { result: output },
                },
              });
            } catch (err: any) {
              executionEvidence.push({
                step: `Tool: ${call.name}`,
                durationMs: Date.now() - t0,
                status: "error",
              });
              functionResponseParts.push({
                functionResponse: {
                  name: call.name,
                  response: { error: err?.message || "Tool execution failed" },
                },
              });
            }
          }

          contents.push({ role: "user", parts: functionResponseParts });

          const followUpStart = Date.now();
          data = await callGeminiStreamContent(
            activeKey,
            modelName,
            contents,
            onChunk
          );
          executionEvidence.push({
            step: `LLM Synthesis (${modelName})`,
            durationMs: Date.now() - followUpStart,
            status: "ok",
          });
          iterations++;
        }

        const finalParts: any[] = data?.candidates?.[0]?.content?.parts || [];
        const replyText =
          finalParts
            .filter((p) => typeof p.text === "string")
            .map((p) => p.text)
            .join("\n")
            .trim() ||
          "Đã kiểm tra dữ liệu on-chain. Vui lòng xem chi tiết kết quả.";

        let decision: GovernanceDecision = ctx.latestSwapPlan?.decision ?? "ASK";
        if (!ctx.latestSwapPlan) {
          const lowerReply = replyText.toLowerCase();
          if (
            lowerReply.includes("vượt") ||
            lowerReply.includes("không thể") ||
            lowerReply.includes("từ chối") ||
            lowerReply.includes("không dự đoán") ||
            lowerReply.includes("cannot predict") ||
            lowerReply.includes("exceed") ||
            lowerReply.includes("rejected")
          ) {
            decision = "REJECT";
          } else if (toolsUsed.length > 0) {
            decision = "ROUTINE";
          }
        }

        appendSessionTurn(sessionId, promptWithContext, replyText);

        appendAuditLog({
          userAddress: userAddress || "UNCONNECTED",
          userRequest: message,
          planId: ctx.latestSwapPlan?.planId,
          governanceDecision: decision,
          policyDecision:
            ctx.latestSwapPlan?.structuredPlan.policyCheck.decision ??
            "INFO_ONLY",
        });

        return {
          reply: replyText,
          sessionId,
          decision,
          modelUsed: modelName,
          swapPlan: ctx.latestSwapPlan,
          toolsUsed,
          executionEvidence,
        };
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status || 0);
        if (!isRetryableGeminiError(status, String(err?.message || ""))) {
          throw err;
        }
      }
    }
  }

  throw new Error(
    `All Gemini API keys/models failed: ${lastError?.message || "Unknown error"}`
  );
}

const policyDraftSchema = z.object({
  maxAmountPerSwapMusdc: z.number().positive(),
  dailySpendingLimitMusdc: z.number().positive(),
  maxTransactionsPerDay: z.number().int().positive(),
  maxSlippageBps: z.number().int().positive(),
  executionMode: z.enum(["ADVISORY", "APPROVAL_REQUIRED"]).default("APPROVAL_REQUIRED"),
  notes: z.string().optional(),
});

export async function draftPolicyFromNaturalLanguage(
  prompt: string,
  userAddress?: string
): Promise<{
  draft: AgentPolicyConfig;
  executionMode: "ADVISORY" | "APPROVAL_REQUIRED";
  validation: { valid: boolean; errors: string[] };
  notes: string;
}> {
  const apiKeys = getGeminiApiKeys();
  if (apiKeys.length === 0) {
    throw new Error("GEMINI_API_KEY / GEMINI_API_KEYS is not configured.");
  }

  const current = getAgentProfile(userAddress);
  const sys = `Extract a DeFi Copilot Allowance Policy configuration from the user's natural language request.
Return ONLY valid JSON matching this schema:
{
  "maxAmountPerSwapMusdc": number,
  "dailySpendingLimitMusdc": number,
  "maxTransactionsPerDay": integer,
  "maxSlippageBps": integer (100 = 1%, 200 = 2%),
  "executionMode": "ADVISORY" | "APPROVAL_REQUIRED",
  "notes": "short summary in Vietnamese"
}
If a field is not mentioned, use current defaults: maxAmountPerSwapMusdc=${current.policy.maxAmountPerSwapMusdc}, dailySpendingLimitMusdc=${current.policy.dailySpendingLimitMusdc}, maxTransactionsPerDay=${current.policy.maxTransactionsPerDay}, maxSlippageBps=${current.policy.maxSlippageBps}.`;

  const models = getGeminiModels();
  let lastError: any = null;

  for (const modelName of models) {
    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
      const activeKey = apiKeys[globalKeyIndex % apiKeys.length];
      globalKeyIndex++;
      try {
        const data = await callGeminiGenerateContent(
          activeKey,
          modelName,
          [{ role: "user", parts: [{ text: prompt }] }],
          sys,
          false
        );
        const rawText = (data?.candidates?.[0]?.content?.parts || [])
          .map((p: any) => p.text || "")
          .join("");
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("LLM did not return JSON policy draft.");
        const parsed = policyDraftSchema.parse(JSON.parse(jsonMatch[0]));

        const draftPolicy: AgentPolicyConfig = {
          ...current.policy,
          maxAmountPerSwapMusdc: parsed.maxAmountPerSwapMusdc,
          dailySpendingLimitMusdc: parsed.dailySpendingLimitMusdc,
          maxTransactionsPerDay: parsed.maxTransactionsPerDay,
          maxSlippageBps: parsed.maxSlippageBps,
        };
        const validation = validatePolicyConfigUpdate(draftPolicy);
        return {
          draft: draftPolicy,
          executionMode: parsed.executionMode,
          validation,
          notes: parsed.notes || "Policy Draft trích xuất từ ngôn ngữ tự nhiên.",
        };
      } catch (err: any) {
        lastError = err;
        const status = Number(err?.status || 0);
        if (!isRetryableGeminiError(status, String(err?.message || ""))) {
          throw err;
        }
      }
    }
  }

  throw new Error(
    `Failed to draft policy: ${lastError?.message || "Unknown error"}`
  );
}
