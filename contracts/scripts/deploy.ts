import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "Missing DEPLOYER_PRIVATE_KEY in contracts/.env. Please configure it first."
    );
  }

  console.log("Deploying AgentVault contracts with:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "AVAX");

  const MAX_AMOUNT_PER_TX = ethers.parseUnits("300", 6); // 300 mUSDC
  const MAX_SLIPPAGE_BPS = 200; // 2%
  const RATE_MUSDC_PER_AVAX = ethers.parseUnits("2000", 6); // 2000 mUSDC = 1 AVAX (100 mUSDC = 0.05 AVAX)

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const musdc = await MockERC20.deploy("Mock USDC", "mUSDC", deployer.address);
  await musdc.waitForDeployment();
  const musdcAddr = await musdc.getAddress();
  console.log("MockERC20 (mUSDC) deployed at:", musdcAddr);

  const AgentVaultPolicy = await ethers.getContractFactory("AgentVaultPolicy");
  const policy = await AgentVaultPolicy.deploy(
    deployer.address,
    MAX_AMOUNT_PER_TX,
    MAX_SLIPPAGE_BPS
  );
  await policy.waitForDeployment();
  const policyAddr = await policy.getAddress();
  console.log("AgentVaultPolicy deployed at:", policyAddr);

  const MockDEXRouter = await ethers.getContractFactory("MockDEXRouter");
  const router = await MockDEXRouter.deploy(
    deployer.address,
    RATE_MUSDC_PER_AVAX
  );
  await router.waitForDeployment();
  const routerAddr = await router.getAddress();
  console.log("MockDEXRouter deployed at:", routerAddr);

  const AgentVaultExecutor =
    await ethers.getContractFactory("AgentVaultExecutor");
  const executor = await AgentVaultExecutor.deploy(
    deployer.address,
    policyAddr,
    routerAddr
  );
  await executor.waitForDeployment();
  const executorAddr = await executor.getAddress();
  console.log("AgentVaultExecutor deployed at:", executorAddr);

  // Restrict MockDEXRouter to only accept swaps from AgentVaultExecutor
  await (await router.setExecutor(executorAddr)).wait();
  const CHAINLINK_AVAX_USD_FUJI = "0x5498BB86BC934c8D34FDA08E81D444153d0D06aD";
  await (await router.setPriceFeed(CHAINLINK_AVAX_USD_FUJI, true)).wait();
  console.log("MockDEXRouter executor and Chainlink AVAX/USD feed configured.");

  // Configure Policy whitelists
  await (await policy.setAllowedToken(musdcAddr, true)).wait();
  await (await policy.setAllowedToken(ethers.ZeroAddress, true)).wait();
  await (await policy.setAllowedRouter(routerAddr, true)).wait();
  console.log("Policy whitelists configured.");

  // Seed MockDEXRouter with 0.2 AVAX liquidity
  const seedTx = await deployer.sendTransaction({
    to: routerAddr,
    value: ethers.parseEther("0.2"),
  });
  await seedTx.wait();
  console.log("Seeded MockDEXRouter with 0.2 AVAX.");

  const deploymentInfo = {
    network: "fuji",
    chainId: 43113,
    deployer: deployer.address,
    contracts: {
      MockERC20: musdcAddr,
      AgentVaultPolicy: policyAddr,
      MockDEXRouter: routerAddr,
      AgentVaultExecutor: executorAddr,
    },
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "../deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "fuji.json"),
    JSON.stringify(deploymentInfo, null, 2)
  );
  console.log("Saved deployment info to contracts/deployments/fuji.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
