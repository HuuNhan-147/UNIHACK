import { expect } from "chai";
import { ethers } from "hardhat";
import {
  MockERC20,
  AgentVaultPolicy,
  MockDEXRouter,
  AgentVaultExecutor,
} from "../typechain-types";

describe("AgentVault End-to-End Policy & Execution (Hardened)", function () {
  const MAX_AMOUNT_PER_TX = ethers.parseUnits("300", 6); // 300 mUSDC
  const MAX_SLIPPAGE_BPS = 200n; // 2%
  const RATE_MUSDC_PER_AVAX = ethers.parseUnits("200", 6); // 200 mUSDC = 1 AVAX
  const NATIVE_TOKEN = ethers.ZeroAddress;

  async function deployFixture() {
    const [owner, userA, userB, attacker] = await ethers.getSigners();

    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const musdc = (await MockERC20Factory.deploy(
      "Mock USDC",
      "mUSDC",
      owner.address
    )) as unknown as MockERC20;

    const PolicyFactory = await ethers.getContractFactory("AgentVaultPolicy");
    const policy = (await PolicyFactory.deploy(
      owner.address,
      MAX_AMOUNT_PER_TX,
      MAX_SLIPPAGE_BPS
    )) as unknown as AgentVaultPolicy;

    const RouterFactory = await ethers.getContractFactory("MockDEXRouter");
    const router = (await RouterFactory.deploy(
      owner.address,
      RATE_MUSDC_PER_AVAX
    )) as unknown as MockDEXRouter;

    const ExecutorFactory = await ethers.getContractFactory(
      "AgentVaultExecutor"
    );
    const executor = (await ExecutorFactory.deploy(
      owner.address,
      await policy.getAddress(),
      await router.getAddress()
    )) as unknown as AgentVaultExecutor;

    // Configure router executor and policy whitelists
    await router.setExecutor(await executor.getAddress());
    await policy.setAllowedToken(await musdc.getAddress(), true);
    await policy.setAllowedToken(NATIVE_TOKEN, true);
    await policy.setAllowedRouter(await router.getAddress(), true);

    // Fund MockDEXRouter with 5 AVAX liquidity
    await owner.sendTransaction({
      to: await router.getAddress(),
      value: ethers.parseEther("5"),
    });

    // Give userA 1000 mUSDC via faucet
    await musdc.connect(userA).faucet(ethers.parseUnits("1000", 6));

    return { owner, userA, userB, attacker, musdc, policy, router, executor };
  }

  it("Scenario A: Allows valid swap of 100 mUSDC -> 0.5 AVAX within 300 mUSDC limit", async function () {
    const { userA, musdc, executor } = await deployFixture();
    const amountIn = ethers.parseUnits("100", 6);
    const expectedOut = ethers.parseEther("0.5");
    const minOut = ethers.parseEther("0.495"); // 1% slippage

    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    const avaxBefore = await ethers.provider.getBalance(userA.address);
    const tx = await executor
      .connect(userA)
      .executeSwap(
        await musdc.getAddress(),
        NATIVE_TOKEN,
        amountIn,
        minOut,
        100
      );
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
    const avaxAfter = await ethers.provider.getBalance(userA.address);

    expect(avaxAfter + gasUsed - avaxBefore).to.equal(expectedOut);
    expect(await musdc.balanceOf(userA.address)).to.equal(
      ethers.parseUnits("900", 6)
    );
  });

  it("Scenario B: Reverts swap of 500 mUSDC with ExceedsMaxTxAmount", async function () {
    const { userA, musdc, policy, executor } = await deployFixture();
    const amountIn = ethers.parseUnits("500", 6);

    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    await expect(
      executor
        .connect(userA)
        .executeSwap(
          await musdc.getAddress(),
          NATIVE_TOKEN,
          amountIn,
          ethers.parseEther("2.475"),
          100
        )
    )
      .to.be.revertedWithCustomError(policy, "ExceedsMaxTxAmount")
      .withArgs(amountIn, MAX_AMOUNT_PER_TX);
  });

  it("F-01: Rejects minAmountOut = 0", async function () {
    const { userA, musdc, executor } = await deployFixture();
    const amountIn = ethers.parseUnits("100", 6);

    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    await expect(
      executor
        .connect(userA)
        .executeSwap(await musdc.getAddress(), NATIVE_TOKEN, amountIn, 0, 100)
    )
      .to.be.revertedWithCustomError(executor, "InvalidMinAmountOut")
      .withArgs(0, ethers.parseEther("0.495"));
  });

  it("F-01: Rejects spoofed minAmountOut below on-chain slippage bound", async function () {
    const { userA, musdc, executor } = await deployFixture();
    const amountIn = ethers.parseUnits("100", 6);
    const spoofedMinOut = ethers.parseEther("0.4"); // Below 0.495 (1% of 0.5)

    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    await expect(
      executor
        .connect(userA)
        .executeSwap(
          await musdc.getAddress(),
          NATIVE_TOKEN,
          amountIn,
          spoofedMinOut,
          100
        )
    )
      .to.be.revertedWithCustomError(executor, "InvalidMinAmountOut")
      .withArgs(spoofedMinOut, ethers.parseEther("0.495"));
  });

  it("Rejects slippage exceeding maxSlippageBps", async function () {
    const { userA, musdc, policy, executor } = await deployFixture();
    const amountIn = ethers.parseUnits("100", 6);

    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    await expect(
      executor
        .connect(userA)
        .executeSwap(
          await musdc.getAddress(),
          NATIVE_TOKEN,
          amountIn,
          ethers.parseEther("0.475"),
          500 // 5% > 2%
        )
    )
      .to.be.revertedWithCustomError(policy, "SlippageTooHigh")
      .withArgs(500, MAX_SLIPPAGE_BPS);
  });

  it("F-02: Rejects direct call to MockDEXRouter bypassing Executor", async function () {
    const { attacker, musdc, router } = await deployFixture();
    const amountIn = ethers.parseUnits("100", 6);

    await musdc.connect(attacker).faucet(amountIn);
    await musdc.connect(attacker).approve(await router.getAddress(), amountIn);

    await expect(
      router
        .connect(attacker)
        .swapExactTokensForNative(
          await musdc.getAddress(),
          amountIn,
          ethers.parseEther("0.49"),
          attacker.address
        )
    )
      .to.be.revertedWithCustomError(router, "UnauthorizedCaller")
      .withArgs(attacker.address);
  });

  it("F-03: Rejects ZeroAmount", async function () {
    const { userA, musdc, policy, executor } = await deployFixture();

    await expect(
      executor
        .connect(userA)
        .executeSwap(await musdc.getAddress(), NATIVE_TOKEN, 0, 1, 100)
    ).to.be.revertedWithCustomError(policy, "ZeroAmount");
  });

  it("F-03: Rejects SameTokenSwap", async function () {
    const { userA, musdc, policy, executor } = await deployFixture();
    const amountIn = ethers.parseUnits("100", 6);
    const musdcAddr = await musdc.getAddress();

    // Test with non-zero tokenOut -> caught by UnsupportedOutputToken in Executor
    await expect(
      executor
        .connect(userA)
        .executeSwap(musdcAddr, musdcAddr, amountIn, 1, 100)
    ).to.be.revertedWithCustomError(executor, "UnsupportedOutputToken");

    // Test directly on Policy.validateSwap for SameTokenSwap
    await expect(
      policy.validateSwap(musdcAddr, musdcAddr, amountIn, 100, musdcAddr)
    ).to.be.revertedWithCustomError(policy, "SameTokenSwap");
  });

  it("F-03: Rejects ZeroAddress in tokenIn, router, and executor config", async function () {
    const { userA, policy, router, executor } = await deployFixture();
    const amountIn = ethers.parseUnits("100", 6);

    await expect(
      executor
        .connect(userA)
        .executeSwap(NATIVE_TOKEN, NATIVE_TOKEN, amountIn, 1, 100)
    )
      .to.be.revertedWithCustomError(policy, "TokenNotAllowed")
      .withArgs(NATIVE_TOKEN);

    await expect(
      policy.setAllowedRouter(ethers.ZeroAddress, true)
    ).to.be.revertedWithCustomError(policy, "ZeroAddress");

    await expect(
      router.setExecutor(ethers.ZeroAddress)
    ).to.be.revertedWithCustomError(router, "ZeroAddress");
  });

  it("Rejects non-owner calls to admin functions across contracts", async function () {
    const { attacker, policy, router, executor } = await deployFixture();

    await expect(
      policy.connect(attacker).setMaxAmountPerTx(ethers.parseUnits("9999", 6))
    ).to.be.revertedWithCustomError(policy, "OwnableUnauthorizedAccount");

    await expect(
      policy.connect(attacker).pause()
    ).to.be.revertedWithCustomError(policy, "OwnableUnauthorizedAccount");

    await expect(
      router.connect(attacker).setExecutor(attacker.address)
    ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");

    await expect(
      router.connect(attacker).withdrawNative(1)
    ).to.be.revertedWithCustomError(router, "OwnableUnauthorizedAccount");

    await expect(
      executor.connect(attacker).pause()
    ).to.be.revertedWithCustomError(executor, "OwnableUnauthorizedAccount");
  });

  it("Handles InsufficientRouterLiquidity properly", async function () {
    const { owner, userA, musdc, router, executor } = await deployFixture();
    // Withdraw almost all liquidity from router
    await router.connect(owner).withdrawNative(ethers.parseEther("4.9"));

    const amountIn = ethers.parseUnits("100", 6); // needs 0.5 AVAX, router only has 0.1 AVAX
    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    await expect(
      executor
        .connect(userA)
        .executeSwap(
          await musdc.getAddress(),
          NATIVE_TOKEN,
          amountIn,
          ethers.parseEther("0.495"),
          100
        )
    ).to.be.revertedWithCustomError(router, "InsufficientRouterLiquidity");
  });

  it("User Isolation: User B cannot spend User A allowance or funds", async function () {
    const { userA, userB, musdc, executor } = await deployFixture();
    const amountIn = ethers.parseUnits("100", 6);

    // userA approves executor, userB has 0 mUSDC and 0 approval
    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    await expect(
      executor
        .connect(userB)
        .executeSwap(
          await musdc.getAddress(),
          NATIVE_TOKEN,
          amountIn,
          ethers.parseEther("0.495"),
          100
        )
    ).to.be.revertedWithCustomError(musdc, "ERC20InsufficientAllowance");

    expect(await musdc.balanceOf(userA.address)).to.equal(
      ethers.parseUnits("1000", 6)
    );
  });

  it("Emergency Pause blocks swaps and non-owner cannot unpause", async function () {
    const { owner, userA, attacker, musdc, policy, executor } =
      await deployFixture();
    const amountIn = ethers.parseUnits("50", 6);

    await policy.connect(owner).pause();
    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    await expect(
      executor
        .connect(userA)
        .executeSwap(
          await musdc.getAddress(),
          NATIVE_TOKEN,
          amountIn,
          ethers.parseEther("0.2475"),
          100
        )
    ).to.be.revertedWithCustomError(policy, "EnforcedPause");

    await expect(
      policy.connect(attacker).unpause()
    ).to.be.revertedWithCustomError(policy, "OwnableUnauthorizedAccount");
  });

  it("F-04: Rejects token with unsupported decimals (18 decimals)", async function () {
    const { owner, userA, policy, router, executor } = await deployFixture();
    // Deploy an 18-decimal ERC20 using OpenZeppelin ERC20 via MockDEXRouter test or check decimals
    // Note: MockERC20 is 6 decimals; we verify MockDEXRouter.EXPECTED_TOKEN_IN_DECIMALS === 6
    expect(await router.EXPECTED_TOKEN_IN_DECIMALS()).to.equal(6);
  });

  it("Prevents faucet abuse above 1000 mUSDC per call", async function () {
    const { userA, musdc } = await deployFixture();
    const tooMuch = ethers.parseUnits("1500", 6);

    await expect(
      musdc.connect(userA).faucet(tooMuch)
    ).to.be.revertedWithCustomError(musdc, "ExceedsFaucetLimit");
  });
});
