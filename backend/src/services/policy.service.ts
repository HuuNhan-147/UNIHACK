import { ethers } from "ethers";
import { env } from "../config/env";
import { getContracts, withRpcTimeout } from "./blockchain.service";

export interface PolicyStatus {
  maxAmountPerTxMusdc: string;
  maxSlippageBps: number;
  paused: boolean;
  musdcAllowed: boolean;
  nativeAvaxAllowed: boolean;
  routerAllowed: boolean;
}

export async function getPolicyRules(): Promise<PolicyStatus> {
  const { policy } = getContracts();

  const [
    maxAmountRaw,
    maxSlippageRaw,
    paused,
    musdcAllowed,
    nativeAvaxAllowed,
    routerAllowed,
  ] = await withRpcTimeout(
    Promise.all([
      policy.maxAmountPerTx(),
      policy.maxSlippageBps(),
      policy.paused(),
      policy.allowedTokens(env.MUSDC_ADDRESS),
      policy.allowedTokens(ethers.ZeroAddress),
      policy.allowedRouters(env.ROUTER_ADDRESS),
    ]),
    "Fetch policy rules"
  );

  return {
    maxAmountPerTxMusdc: ethers.formatUnits(maxAmountRaw, 6),
    maxSlippageBps: Number(maxSlippageRaw),
    paused: Boolean(paused),
    musdcAllowed: Boolean(musdcAllowed),
    nativeAvaxAllowed: Boolean(nativeAvaxAllowed),
    routerAllowed: Boolean(routerAllowed),
  };
}

export async function precheckSwapPolicy(
  amountInMusdc: number,
  slippageBps = 100
): Promise<{ allowed: boolean; reason?: string }> {
  const { policy } = getContracts();
  const amountRaw = ethers.parseUnits(amountInMusdc.toString(), 6);

  try {
    await withRpcTimeout(
      policy.validateSwap(
        env.MUSDC_ADDRESS,
        ethers.ZeroAddress,
        amountRaw,
        slippageBps,
        env.ROUTER_ADDRESS
      ),
      "Policy validateSwap pre-check"
    );
    return { allowed: true };
  } catch (err: any) {
    const rawData = err?.data || err?.info?.error?.data;
    if (typeof rawData === "string" && rawData.startsWith("0x")) {
      try {
        const parsed = policy.interface.parseError(rawData);
        if (parsed?.name === "ExceedsMaxTxAmount") {
          const req = ethers.formatUnits(parsed.args[0], 6);
          const max = ethers.formatUnits(parsed.args[1], 6);
          return {
            allowed: false,
            reason: `ExceedsMaxTxAmount: Yêu cầu ${req} mUSDC vượt hạn mức ${max} mUSDC/giao dịch.`,
          };
        }
        if (parsed) {
          return { allowed: false, reason: `Policy rejected: ${parsed.name}` };
        }
      } catch {
        // fall through
      }
    }
    const msg = err?.shortMessage || err?.reason || err?.message || "Policy rejected";
    return { allowed: false, reason: msg };
  }
}
