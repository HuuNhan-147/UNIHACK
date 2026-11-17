import { ethers } from "ethers";
import { env, areContractsConfigured } from "../config/env";
import {
  EXECUTOR_ABI,
  MOCK_ERC20_ABI,
  POLICY_ABI,
  ROUTER_ABI,
} from "../abi";

const RPC_TIMEOUT_MS = 10_000;

export const provider = new ethers.JsonRpcProvider(env.FUJI_RPC_URL, {
  name: "avalanche-fuji",
  chainId: env.CHAIN_ID,
});

export async function withRpcTimeout<T>(
  promise: Promise<T>,
  label = "RPC call"
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${RPC_TIMEOUT_MS}ms`)),
          RPC_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getContracts() {
  if (!areContractsConfigured()) {
    throw new Error(
      "Contract addresses are not configured in backend/.env. Deploy contracts first."
    );
  }

  return {
    musdc: new ethers.Contract(env.MUSDC_ADDRESS, MOCK_ERC20_ABI, provider),
    policy: new ethers.Contract(env.POLICY_ADDRESS, POLICY_ABI, provider),
    router: new ethers.Contract(env.ROUTER_ADDRESS, ROUTER_ABI, provider),
    executor: new ethers.Contract(env.EXECUTOR_ADDRESS, EXECUTOR_ABI, provider),
  };
}
