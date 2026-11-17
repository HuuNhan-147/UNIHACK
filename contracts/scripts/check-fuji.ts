import { ethers } from "hardhat";

async function main() {
  const provider = ethers.provider;
  const network = await provider.getNetwork();
  const blockNumber = await provider.getBlockNumber();

  console.log("=== Avalanche Fuji Connection Check ===");
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Latest Block: ${blockNumber}`);

  const signers = await ethers.getSigners();
  if (signers.length > 0) {
    const balance = await provider.getBalance(signers[0].address);
    console.log(`Deployer Address: ${signers[0].address}`);
    console.log(`Deployer Balance: ${ethers.formatEther(balance)} AVAX`);
  } else {
    console.log("Deployer Private Key: NOT CONFIGURED (read-only mode)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
