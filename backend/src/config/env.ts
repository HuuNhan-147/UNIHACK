

import dotenv from "dotenv";
import path from "path";
import { z } from "zod";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  FRONTEND_URL: z.string().default("http://localhost:5173"),
  FUJI_RPC_URL: z
    .string()
    .url()
    .default("https://api.avax-test.network/ext/bc/C/rpc"),
  CHAIN_ID: z.coerce.number().default(43113),
  GEMINI_API_KEY: z.string().optional().default(""),
  GEMINI_API_KEYS: z.string().optional().default(""),
  GEMINI_MODEL: z.string().default("gemini-3.8-flash"),
  GEMINI_FALLBACK_MODELS: z
    .string()
    .default("gemini-3.8-flash,gemini-2.5-flash"),
  MUSDC_ADDRESS: z.string().optional().default(""),
  POLICY_ADDRESS: z.string().optional().default(""),
  ROUTER_ADDRESS: z.string().optional().default(""),
  EXECUTOR_ADDRESS: z.string().optional().default(""),
  SPEND_GUARD_VAULT_ADDRESS: z.string().optional().default(""),
  CHAINLINK_AVAX_USD_FEED: z
    .string()
    .default("0x5498BB86BC934c8D34FDA08E81D444153d0D06aD"),
  AAVE_V3_POOL_ADDRESS: z.string().optional().default(""),
});

export const env = envSchema.parse(process.env);

export function getGeminiApiKeys(): string[] {
  const combined = [env.GEMINI_API_KEYS, env.GEMINI_API_KEY]
    .filter(Boolean)
    .join(",");
  const unique = new Set(
    combined
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean)
  );
  return Array.from(unique);
}

export function getGeminiModels(): string[] {
  const raw = [
    env.GEMINI_MODEL,
    env.GEMINI_FALLBACK_MODELS,
    "gemini-3.8-flash",
    "gemini-2.5-flash",
  ]
    .filter(Boolean)
    .join(",");
  const unique = new Set(
    raw
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean)
  );
  return Array.from(unique);
}

export function areContractsConfigured(): boolean {
  return Boolean(
    env.MUSDC_ADDRESS &&
      env.POLICY_ADDRESS &&
      env.ROUTER_ADDRESS &&
      env.EXECUTOR_ADDRESS
  );
}
