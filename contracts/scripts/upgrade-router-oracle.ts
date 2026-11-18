import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const CHAINLINK_AVAX_USD_FUJI = "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY in contracts/.env");
  }

  const fujiPath = path.join(__dirname, "../deployments/fuji.json");
  const fuji = JSON.parse(fs.readFileSync(fujiPath, "utf8"));
  const musdcAddr: string = fuji.contracts.MockERC20;
  const policyAddr: string = fuji.contracts.AgentVaultPolicy;
  const oldRouterAddr: string = fuji.contracts.MockDEXRouter;
  const oldExecutorAddr: string = fuji.contracts.AgentVaultExecutor;

  console.log("=== P0-1 Upgrade: Chainlink Router & Executor on Fuji ===");
  console.log("Deployer:", deployer.address);
  console.log("Preserving MockERC20:", musdcAddr);
  console.log("Preserving AgentVaultPolicy:", policyAddr);

  const txHashes: Record<string, string> = {};

  // 1. Reclaim 0.2 AVAX liquidity from old MockDEXRouter if available
  const oldRouterBal = await ethers.provider.getBalance(oldRouterAddr);
  if (oldRouterBal > 0n) {
    const oldRouter = await ethers.getContractAt(
      ["function withdrawNative(uint256 amount) external"],
      oldRouterAddr,
      deployer
    );
    const reclaimTx = await oldRouter.withdrawNative(oldRouterBal);
    await reclaimTx.wait();
    txHashes.reclaimOldRouterLiquidity = reclaimTx.hash;
    console.log(
      `Reclaimed ${ethers.formatEther(oldRouterBal)} AVAX from old router (${reclaimTx.hash})`
    );
  }

  // 2. Deploy new Chainlink-backed MockDEXRouter (fallback $25 = 25e6)
  const RouterFactory = await ethers.getContractFactory("MockDEXRouter");
  const newRouter = await RouterFactory.deploy(
    deployer.address,
    ethers.parseUnits("25", 6)
  );
  await newRouter.waitForDeployment();
  const newRouterAddr = await newRouter.getAddress();
  txHashes.deployRouter = newRouter.deploymentTransaction()?.hash || "";
  console.log("New MockDEXRouter deployed at:", newRouterAddr);

  // 3. Deploy new AgentVaultExecutor pointing to existing Policy & new Router
  const ExecutorFactory = await ethers.getContractFactory("AgentVaultExecutor");
  const newExecutor = await ExecutorFactory.deploy(
    deployer.address,
    policyAddr,
    newRouterAddr
  );
  await newExecutor.waitForDeployment();
  const newExecutorAddr = await newExecutor.getAddress();
  txHashes.deployExecutor = newExecutor.deploymentTransaction()?.hash || "";
  console.log("New AgentVaultExecutor deployed at:", newExecutorAddr);

  // 4. Configure new Router (lock executor + enable Chainlink AVAX/USD Fuji feed)
  const setExecTx = await newRouter.setExecutor(newExecutorAddr);
  await setExecTx.wait();
  txHashes.setExecutor = setExecTx.hash;

  const setFeedTx = await newRouter.setPriceFeed(CHAINLINK_AVAX_USD_FUJI, true);
  await setFeedTx.wait();
  txHashes.setPriceFeed = setFeedTx.hash;
  console.log("Configured new Router executor & Chainlink AVAX/USD feed.");

  // 5. Update AgentVaultPolicy router whitelist (enable newRouter, disable oldRouter)
  const policy = await ethers.getContractAt(
    "AgentVaultPolicy",
    policyAddr,
    deployer
  );
  const allowNewTx = await policy.setAllowedRouter(newRouterAddr, true);
  await allowNewTx.wait();
  txHashes.whitelistNewRouter = allowNewTx.hash;

  const revokeOldTx = await policy.setAllowedRouter(oldRouterAddr, false);
  await revokeOldTx.wait();
  txHashes.delistOldRouter = revokeOldTx.hash;
  console.log("Updated AgentVaultPolicy router whitelist.");

  // 6. Seed new Router with 0.6 AVAX liquidity
  const seedAmount = ethers.parseEther("0.6");
  const seedTx = await deployer.sendTransaction({
    to: newRouterAddr,
    value: seedAmount,
  });
  await seedTx.wait();
  txHashes.seedLiquidity = seedTx.hash;
  console.log("Seeded new MockDEXRouter with 0.6 AVAX liquidity.");

  // 7. On-chain verification readback
  const useOracle = await newRouter.useOracle();
  const activeRate = await newRouter.rateMusdcPerAvax();
  const quote1Musdc = await newRouter.getAmountOut(ethers.parseUnits("1", 6));
  console.log("Verification:", {
    useOracle,
    rateMusdcPerAvax: ethers.formatUnits(activeRate, 6),
    quoteFor1MusdcInAvax: ethers.formatEther(quote1Musdc),
  });

  // 8. Persist updated deployment with rollback history
  const updatedDeployment = {
    network: "fuji",
    chainId: 43113,
    deployer: deployer.address,
    chainlinkAvaxUsdFeed: CHAINLINK_AVAX_USD_FUJI,
    contracts: {
      MockERC20: musdcAddr,
      AgentVaultPolicy: policyAddr,
      MockDEXRouter: newRouterAddr,
      AgentVaultExecutor: newExecutorAddr,
    },
    previousContracts: {
      MockDEXRouter: oldRouterAddr,
      AgentVaultExecutor: oldExecutorAddr,
    },
    upgradeTxHashes: txHashes,
    deployedAt: fuji.deployedAt,
    upgradedAt: new Date().toISOString(),
  };

  fs.writeFileSync(fujiPath, JSON.stringify(updatedDeployment, null, 2));
  console.log("Saved updated deployment info to contracts/deployments/fuji.json");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
