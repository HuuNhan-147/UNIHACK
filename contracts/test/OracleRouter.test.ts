import { expect } from "chai";
import { ethers } from "hardhat";
import {
  MockERC20,
  AgentVaultPolicy,
  MockDEXRouter,
  AgentVaultExecutor,
  MockChainlinkAggregator,
} from "../typechain-types";

describe("MockDEXRouter Chainlink Oracle Integration", function () {
  const MAX_AMOUNT_PER_TX = ethers.parseUnits("300", 6);
  const MAX_SLIPPAGE_BPS = 200n;
  const FALLBACK_RATE = ethers.parseUnits("200", 6); // 200 mUSDC = 1 AVAX

  async function deployOracleFixture() {
    const [owner, userA] = await ethers.getSigners();

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
      FALLBACK_RATE
    )) as unknown as MockDEXRouter;

    const ExecutorFactory = await ethers.getContractFactory(
      "AgentVaultExecutor"
    );
    const executor = (await ExecutorFactory.deploy(
      owner.address,
      await policy.getAddress(),
      await router.getAddress()
    )) as unknown as AgentVaultExecutor;

    // 8 decimals like Chainlink AVAX/USD: $25.00 = 25_00000000
    const FeedFactory = await ethers.getContractFactory(
      "MockChainlinkAggregator"
    );
    const feed = (await FeedFactory.deploy(
      8,
      25_00000000n
    )) as unknown as MockChainlinkAggregator;

    await router.setExecutor(await executor.getAddress());
    await router.setPriceFeed(await feed.getAddress(), true);
    await policy.setAllowedToken(await musdc.getAddress(), true);
    await policy.setAllowedToken(ethers.ZeroAddress, true);
    await policy.setAllowedRouter(await router.getAddress(), true);

    await owner.sendTransaction({
      to: await router.getAddress(),
      value: ethers.parseEther("5"),
    });

    await musdc.connect(userA).faucet(ethers.parseUnits("500", 6));

    return { owner, userA, musdc, policy, router, executor, feed };
  }

  it("Uses Chainlink 8-decimal feed scaled to 6-decimal mUSDC rate", async function () {
    const { router } = await deployOracleFixture();
    // $25.00 -> 25_000000 (25 mUSDC per AVAX)
    expect(await router.rateMusdcPerAvax()).to.equal(
      ethers.parseUnits("25", 6)
    );
    // 50 mUSDC at $25/AVAX = 2 AVAX
    expect(await router.getAmountOut(ethers.parseUnits("50", 6))).to.equal(
      ethers.parseEther("2")
    );
  });

  it("Executes swap via ISwapRouter using live Chainlink price", async function () {
    const { userA, musdc, executor, feed } = await deployOracleFixture();
    // Update Chainlink price to $50.00 -> 25 mUSDC = 0.5 AVAX
    await feed.setAnswer(50_00000000n);

    const amountIn = ethers.parseUnits("25", 6);
    const expectedOut = ethers.parseEther("0.5");
    const minOut = ethers.parseEther("0.495");

    await musdc.connect(userA).approve(await executor.getAddress(), amountIn);

    const avaxBefore = await ethers.provider.getBalance(userA.address);
    const tx = await executor
      .connect(userA)
      .executeSwap(
        await musdc.getAddress(),
        ethers.ZeroAddress,
        amountIn,
        minOut,
        100
      );
    const receipt = await tx.wait();
    const gasUsed = receipt!.gasUsed * receipt!.gasPrice;
    const avaxAfter = await ethers.provider.getBalance(userA.address);

    expect(avaxAfter + gasUsed - avaxBefore).to.equal(expectedOut);
  });

  it("Reverts when Chainlink price is invalid (<= 0) or stale", async function () {
    const { router, feed } = await deployOracleFixture();

    await feed.setAnswer(0n);
    await expect(router.rateMusdcPerAvax()).to.be.revertedWithCustomError(
      router,
      "InvalidOraclePrice"
    );

    await feed.setAnswer(25_00000000n);
    const latestBlock = await ethers.provider.getBlock("latest");
    await feed.setUpdatedAt(latestBlock!.timestamp - 90_000); // > 86400s
    await expect(router.rateMusdcPerAvax()).to.be.revertedWithCustomError(
      router,
      "StaleOraclePrice"
    );

    // Incomplete round: answeredInRound < roundId
    await feed.setRoundData(5, 25_00000000n, latestBlock!.timestamp, 4);
    await expect(router.rateMusdcPerAvax()).to.be.revertedWithCustomError(
      router,
      "IncompleteOracleRound"
    );
  });
});
