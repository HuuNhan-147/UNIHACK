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

export const SPEND_GUARD_VAULT_ABI = [
  "function owner() view returns (address)",
  "function token() view returns (address)",
  "function paused() view returns (bool)",
  "function vaultBalance() view returns (uint256)",
  "function allowedVendors(address vendor) view returns (bool)",
  "function agentPolicies(address agent) view returns (uint256 perCallCap, uint256 dailyCap, bool active, bool revoked)",
  "function getAgentDailyUsage(address agent) view returns (uint256 spentToday, uint256 txCountToday, uint256 dayIndex)",
  "function deposit(uint256 amount)",
  "function withdraw(uint256 amount)",
  "function configureAgent(address agent, uint256 perCallCap, uint256 dailyCap, bool active)",
  "function revokeAgent(address agent)",
  "function setAllowedVendor(address vendor, bool allowed)",
  "function payVendor(address vendor, uint256 amount, string requestId)",
  "event VendorPaid(address indexed agent, address indexed vendor, uint256 amount, string requestId, uint256 timestamp)",
  "event AgentConfigured(address indexed agent, uint256 perCallCap, uint256 dailyCap, bool active)",
  "event AgentRevokedEvent(address indexed agent)",
  "error AgentNotActive(address agent)",
  "error AgentRevoked(address agent)",
  "error VendorNotAllowed(address vendor)",
  "error ExceedsPerCallCap(uint256 requested, uint256 perCallCap)",
  "error ExceedsDailyCap(uint256 projected, uint256 dailyCap)",
  "error InsufficientVaultBalance(uint256 available, uint256 required)",
  "error EnforcedPause()",
] as const;
