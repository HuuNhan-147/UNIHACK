import { expect } from "chai";
import { ethers } from "hardhat";
import { MockERC20, SpendGuardVault } from "../typechain-types";

describe("SpendGuardVault (x402 AI Spend Control)", function () {
  const PER_CALL_CAP = ethers.parseUnits("10", 6); // 10 mUSDC
  const DAILY_CAP = ethers.parseUnits("25", 6); // 25 mUSDC

  async function deployFixture() {
    const [owner, agent, vendor, attacker] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const musdc = (await MockERC20Factory.deploy(
      "Mock USDC",
      "mUSDC",
      owner.address
    )) as unknown as MockERC20;

    const VaultFactory = await ethers.getContractFactory("SpendGuardVault");
    const vault = (await VaultFactory.deploy(
      owner.address,
      await musdc.getAddress()
    )) as unknown as SpendGuardVault;

    // Owner mints 500 mUSDC and deposits 100 mUSDC into SpendGuardVault
    await musdc.connect(owner).faucet(ethers.parseUnits("500", 6));
    await musdc
      .connect(owner)
      .approve(await vault.getAddress(), ethers.parseUnits("100", 6));
    await vault.connect(owner).deposit(ethers.parseUnits("100", 6));

    // Configure agent and vendor whitelist
    await vault
      .connect(owner)
      .configureAgent(agent.address, PER_CALL_CAP, DAILY_CAP, true);
    await vault.connect(owner).setAllowedVendor(vendor.address, true);

    return { owner, agent, vendor, attacker, musdc, vault };
  }

  it("Allows AI Agent to pay whitelisted vendor within perCallCap & dailyCap", async function () {
    const { agent, vendor, musdc, vault } = await deployFixture();
    const amount = ethers.parseUnits("5", 6);

    await expect(
      vault.connect(agent).payVendor(vendor.address, amount, "x402_req_1")
    )
      .to.emit(vault, "VendorPaid")
      .withArgs(
        agent.address,
        vendor.address,
        amount,
        "x402_req_1",
        (val: any) => val > 0n
      );

    expect(await musdc.balanceOf(vendor.address)).to.equal(amount);
    expect(await vault.vaultBalance()).to.equal(ethers.parseUnits("95", 6));
  });

  it("Reverts when payment exceeds perCallCap (25 > 10 mUSDC)", async function () {
    const { agent, vendor, vault } = await deployFixture();
    const tooMuch = ethers.parseUnits("25", 6);

    await expect(
      vault.connect(agent).payVendor(vendor.address, tooMuch, "x402_req_2")
    )
      .to.be.revertedWithCustomError(vault, "ExceedsPerCallCap")
      .withArgs(tooMuch, PER_CALL_CAP);
  });

  it("Reverts when cumulative payments exceed dailyCap (10+10+10 > 25)", async function () {
    const { agent, vendor, vault } = await deployFixture();
    const ten = ethers.parseUnits("10", 6);

    await vault.connect(agent).payVendor(vendor.address, ten, "req_1");
    await vault.connect(agent).payVendor(vendor.address, ten, "req_2");

    await expect(
      vault.connect(agent).payVendor(vendor.address, ten, "req_3")
    )
      .to.be.revertedWithCustomError(vault, "ExceedsDailyCap")
      .withArgs(ethers.parseUnits("30", 6), DAILY_CAP);
  });

  it("Reverts when vendor is not whitelisted", async function () {
    const { agent, attacker, vault } = await deployFixture();
    const five = ethers.parseUnits("5", 6);

    await expect(
      vault.connect(agent).payVendor(attacker.address, five, "req_bad")
    )
      .to.be.revertedWithCustomError(vault, "VendorNotAllowed")
      .withArgs(attacker.address);
  });

  it("Blocks Agent immediately after Owner revokes permission", async function () {
    const { owner, agent, vendor, vault } = await deployFixture();
    await vault.connect(owner).revokeAgent(agent.address);

    await expect(
      vault
        .connect(agent)
        .payVendor(vendor.address, ethers.parseUnits("5", 6), "req_revoked")
    )
      .to.be.revertedWithCustomError(vault, "AgentRevoked")
      .withArgs(agent.address);
  });

  it("Prevents non-owner from configuring agent, whitelisting vendor, or withdrawing", async function () {
    const { attacker, vendor, vault } = await deployFixture();

    await expect(
      vault
        .connect(attacker)
        .configureAgent(attacker.address, PER_CALL_CAP, DAILY_CAP, true)
    ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

    await expect(
      vault.connect(attacker).setAllowedVendor(attacker.address, true)
    ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

    await expect(
      vault.connect(attacker).withdraw(ethers.parseUnits("10", 6))
    ).to.be.revertedWithCustomError(vault, "OwnableUnauthorizedAccount");

    await expect(
      vault.connect(attacker).payVendor(vendor.address, ethers.parseUnits("5", 6), "x")
    ).to.be.revertedWithCustomError(vault, "AgentNotActive");
  });
});
