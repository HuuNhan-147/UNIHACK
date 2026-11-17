// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IAggregatorV3.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title MockDEXRouter
 * @notice Deterministic / Chainlink-oracle-backed testnet router for mUSDC (6 decimals) -> native AVAX (18 decimals) swaps.
 * @dev Restricted to calls from the configured AgentVaultExecutor to prevent policy bypass.
 */
contract MockDEXRouter is ISwapRouter, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant EXPECTED_TOKEN_IN_DECIMALS = 6;

    // Fallback rate expressed in mUSDC (6 decimals) per 1 AVAX (18 decimals).
    // Used when Chainlink oracle is not configured.
    uint256 public fallbackRateMusdcPerAvax;
    address public executor;

    IAggregatorV3 public priceFeed;
    bool public useOracle;
    uint256 public maxOracleAge = 86_400; // 24 hours for Fuji testnet feeds

    error InvalidRate();
    error ZeroAddress();
    error UnauthorizedCaller(address caller);
    error UnsupportedTokenDecimals(uint8 actual, uint8 expected);
    error InsufficientOutputAmount(uint256 actual, uint256 minimum);
    error InsufficientRouterLiquidity(uint256 available, uint256 required);
    error NativeTransferFailed();
    error InvalidOraclePrice(int256 answer);
    error StaleOraclePrice(uint256 updatedAt, uint256 maxAge);

    event RateUpdated(uint256 newRate);
    event ExecutorUpdated(address indexed newExecutor);
    event PriceFeedUpdated(address indexed newPriceFeed, bool enabled);
    event MaxOracleAgeUpdated(uint256 newMaxAge);
    event MockSwapExecuted(
        address indexed recipient,
        address indexed tokenIn,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(
        address initialOwner,
        uint256 initialRateMusdcPerAvax
    ) Ownable(initialOwner) {
        if (initialRateMusdcPerAvax == 0) revert InvalidRate();
        fallbackRateMusdcPerAvax = initialRateMusdcPerAvax;
    }

    receive() external payable {}

    /**
     * @notice Returns active mUSDC (6 decimals) per 1 AVAX rate, reading Chainlink AVAX/USD when enabled.
     */
    function rateMusdcPerAvax() public view returns (uint256) {
        if (!useOracle || address(priceFeed) == address(0)) {
            return fallbackRateMusdcPerAvax;
        }

        (, int256 answer, , uint256 updatedAt, ) = priceFeed.latestRoundData();
        if (answer <= 0) revert InvalidOraclePrice(answer);
        if (updatedAt == 0 || block.timestamp - updatedAt > maxOracleAge) {
            revert StaleOraclePrice(updatedAt, maxOracleAge);
        }

        uint8 feedDecimals = priceFeed.decimals();
        uint256 rawPrice = uint256(answer);
        uint256 rate;
        if (feedDecimals > EXPECTED_TOKEN_IN_DECIMALS) {
            rate = rawPrice / (10 ** (feedDecimals - EXPECTED_TOKEN_IN_DECIMALS));
        } else if (feedDecimals < EXPECTED_TOKEN_IN_DECIMALS) {
            rate = rawPrice * (10 ** (EXPECTED_TOKEN_IN_DECIMALS - feedDecimals));
        } else {
            rate = rawPrice;
        }

        if (rate == 0) revert InvalidRate();
        return rate;
    }

    /**
     * @notice Computes expected native AVAX output (18 decimals) for a 6-decimal tokenIn amount.
     * @dev Uses integer division (rounds down / floor).
     */
    function getAmountOut(uint256 amountInMusdc) public view override returns (uint256) {
        return (amountInMusdc * 1e18) / rateMusdcPerAvax();
    }

    function swapExactTokensForNative(
        address tokenIn,
        uint256 amountIn,
        uint256 minAmountOut,
        address recipient
    ) external nonReentrant returns (uint256 amountOut) {
        if (msg.sender != executor) revert UnauthorizedCaller(msg.sender);
        if (recipient == address(0)) revert ZeroAddress();

        uint8 tokenDecimals = IERC20Metadata(tokenIn).decimals();
        if (tokenDecimals != EXPECTED_TOKEN_IN_DECIMALS) {
            revert UnsupportedTokenDecimals(
                tokenDecimals,
                EXPECTED_TOKEN_IN_DECIMALS
            );
        }

        amountOut = getAmountOut(amountIn);
        if (amountOut == 0 || amountOut < minAmountOut) {
            revert InsufficientOutputAmount(amountOut, minAmountOut);
        }
        if (address(this).balance < amountOut) {
            revert InsufficientRouterLiquidity(address(this).balance, amountOut);
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);

        (bool sent, ) = payable(recipient).call{value: amountOut}("");
        if (!sent) revert NativeTransferFailed();

        emit MockSwapExecuted(recipient, tokenIn, amountIn, amountOut);
    }

    function setExecutor(address newExecutor) external onlyOwner {
        if (newExecutor == address(0)) revert ZeroAddress();
        executor = newExecutor;
        emit ExecutorUpdated(newExecutor);
    }

    function setRate(uint256 newRateMusdcPerAvax) external onlyOwner {
        if (newRateMusdcPerAvax == 0) revert InvalidRate();
        fallbackRateMusdcPerAvax = newRateMusdcPerAvax;
        emit RateUpdated(newRateMusdcPerAvax);
    }

    function setPriceFeed(address newPriceFeed, bool enabled) external onlyOwner {
        if (enabled && newPriceFeed == address(0)) revert ZeroAddress();
        priceFeed = IAggregatorV3(newPriceFeed);
        useOracle = enabled;
        emit PriceFeedUpdated(newPriceFeed, enabled);
    }

    function setMaxOracleAge(uint256 newMaxAge) external onlyOwner {
        if (newMaxAge == 0) revert InvalidRate();
        maxOracleAge = newMaxAge;
        emit MaxOracleAgeUpdated(newMaxAge);
    }

    function withdrawNative(uint256 amount) external onlyOwner {
        (bool sent, ) = payable(owner()).call{value: amount}("");
        if (!sent) revert NativeTransferFailed();
    }
}
