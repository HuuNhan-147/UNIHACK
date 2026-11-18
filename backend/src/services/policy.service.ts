import { ethers } from "ethers";
import { env } from "../config/env";
import { getContracts, provider, withRpcTimeout } from "./blockchain.service";
import { decodeSimulationError } from "./txSimulator.service";

export interface PolicyStatus {
  maxAmountPerTxMusdc: string;
  maxSlippageBps: number;
  paused: boolean;
  musdcAllowed: boolean;
  nativeAvaxAllowed: boolean;
  routerAllowed: boolean;
  oracleEnabled: boolean;
  activeRateMusdcPerAvax: string;
  routerLiquidityAvax: string;
}

export async function getPolicyRules(): Promise<PolicyStatus> {
  const { policy, router } = getContracts();

  const [
    maxAmountRaw,
    maxSlippageRaw,
    paused,
    musdcAllowed,
    nativeAvaxAllowed,
    routerAllowed,
    oracleEnabled,
    rateRaw,
    routerLiqWei,
  ] = await withRpcTimeout(
    Promise.all([
      policy.maxAmountPerTx(),
      policy.maxSlippageBps(),
      policy.paused(),
      policy.allowedTokens(env.MUSDC_ADDRESS),
      policy.allowedTokens(ethers.ZeroAddress),
      policy.allowedRouters(env.ROUTER_ADDRESS),
      router.useOracle().catch(() => false),
      router.rateMusdcPerAvax(),
      provider.getBalance(env.ROUTER_ADDRESS),
    ]),
    "Fetch policy & router rules"
  );

  return {
    maxAmountPerTxMusdc: ethers.formatUnits(maxAmountRaw, 6),
    maxSlippageBps: Number(maxSlippageRaw),
    paused: Boolean(paused),
    musdcAllowed: Boolean(musdcAllowed),
    nativeAvaxAllowed: Boolean(nativeAvaxAllowed),
    routerAllowed: Boolean(routerAllowed),
    oracleEnabled: Boolean(oracleEnabled),
    activeRateMusdcPerAvax: Number(ethers.formatUnits(rateRaw, 6)).toFixed(4),
    routerLiquidityAvax: Number(ethers.formatEther(routerLiqWei)).toFixed(4),
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
    return {
      allowed: false,
      reason: decodeSimulationError(err),
    };
  }
}
