import fs from "fs";
import path from "path";
import { ethers } from "ethers";
import { env } from "../config/env";
import { SPEND_GUARD_VAULT_ABI } from "../abi";
import { provider, withRpcTimeout } from "./blockchain.service";

const DATA_DIR = path.resolve(__dirname, "../../data");
const AGENT_WALLET_PATH = path.join(DATA_DIR, "agent-wallet.json");

function loadOrCreateAgentWallet(): ethers.Wallet {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (fs.existsSync(AGENT_WALLET_PATH)) {
    const saved = JSON.parse(fs.readFileSync(AGENT_WALLET_PATH, "utf8"));
    if (saved?.privateKey) {
      return new ethers.Wallet(saved.privateKey, provider);
    }
  }
  const fresh = ethers.Wallet.createRandom();
  fs.writeFileSync(
    AGENT_WALLET_PATH,
    JSON.stringify(
      {
        address: fresh.address,
        privateKey: fresh.privateKey,
        note: "Dedicated Testnet-only AI Agent Execution Wallet (holds gas only, zero user funds).",
      },
      null,
      2
    )
  );
  return new ethers.Wallet(fresh.privateKey, provider);
}

const agentWallet = loadOrCreateAgentWallet();

export function getAgentWalletAddress(): string {
  return agentWallet.address;
}

export async function getAgentGasBalance(): Promise<string> {
  const bal = await withRpcTimeout(
    provider.getBalance(agentWallet.address),
    "Fetch Agent gas balance"
  );
  return Number(ethers.formatEther(bal)).toFixed(4);
}

export async function payVendorFromVault(params: {
  vendorAddress: string;
  amountMusdc: number;
  requestId: string;
}): Promise<{ txHash: string; blockNumber: number }> {
  if (!env.SPEND_GUARD_VAULT_ADDRESS) {
    throw new Error("SPEND_GUARD_VAULT_ADDRESS is not configured.");
  }

  const vault = new ethers.Contract(
    env.SPEND_GUARD_VAULT_ADDRESS,
    SPEND_GUARD_VAULT_ABI,
    agentWallet
  );

  const amountRaw = ethers.parseUnits(params.amountMusdc.toString(), 6);
  const tx = await vault.payVendor(
    params.vendorAddress,
    amountRaw,
    params.requestId
  );
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error("SpendGuardVault.payVendor transaction reverted on-chain.");
  }
  return {
    txHash: receipt.hash,
    blockNumber: receipt.blockNumber,
  };
}
