import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY in contracts/.env.");
  }

  // Reuse already-deployed MockERC20 (mUSDC) on Fuji
  const fujiPath = path.join(__dirname, "../deployments/fuji.json");
  const fuji = JSON.parse(fs.readFileSync(fujiPath, "utf8"));
  const musdcAddr = fuji.contracts.MockERC20;
  if (!musdcAddr) {
    throw new Error("MockERC20 address not found in deployments/fuji.json");
  }

  console.log("Deploying SpendGuardVault with:", deployer.address);
  console.log("Reusing MockERC20 (mUSDC):", musdcAddr);

  const VaultFactory = await ethers.getContractFactory("SpendGuardVault");
  const vault = await VaultFactory.deploy(deployer.address, musdcAddr);
  await vault.waitForDeployment();
  const vaultAddr = await vault.getAddress();
  console.log("SpendGuardVault deployed at:", vaultAddr);

  fuji.contracts.SpendGuardVault = vaultAddr;
  fuji.spendGuardDeployedAt = new Date().toISOString();
  fs.writeFileSync(fujiPath, JSON.stringify(fuji, null, 2));
  console.log("Updated contracts/deployments/fuji.json");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
