export const MOCK_ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function faucet(uint256 amount)",
] as const;

export const POLICY_ABI = [
  "function maxAmountPerTx() view returns (uint256)",
  "function maxSlippageBps() view returns (uint256)",
  "function paused() view returns (bool)",
  "function allowedTokens(address token) view returns (bool)",
  "function allowedRouters(address router) view returns (bool)",
  "function validateSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 slippageBps, address router) view",
  "error ZeroAmount()",
  "error ZeroAddress()",
  "error SameTokenSwap()",
  "error ExceedsMaxTxAmount(uint256 requested, uint256 maxAllowed)",
  "error TokenNotAllowed(address token)",
  "error RouterNotAllowed(address router)",
  "error SlippageTooHigh(uint256 requestedBps, uint256 maxBps)",
  "error EnforcedPause()",
] as const;

export const ROUTER_ABI = [
  "function rateMusdcPerAvax() view returns (uint256)",
  "function executor() view returns (address)",
  "function getAmountOut(uint256 amountInMusdc) view returns (uint256)",
  "function useOracle() view returns (bool)",
  "function priceFeed() view returns (address)",
] as const;

export const CHAINLINK_AGGREGATOR_ABI = [
  "function decimals() view returns (uint8)",
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
] as const;

export const AAVE_V3_POOL_ABI = [
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
] as const;

export const EXECUTOR_ABI = [
  "function policy() view returns (address)",
  "function router() view returns (address)",
  "function paused() view returns (bool)",
  "function executeSwap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, uint256 slippageBps) returns (uint256 amountOut)",
  "event SwapExecuted(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut, uint256 timestamp)",
  "error InvalidMinAmountOut(uint256 provided, uint256 minAllowed)",
  "error UnsupportedOutputToken(address tokenOut)",
] as const;
