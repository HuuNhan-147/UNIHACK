// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./AgentVaultPolicy.sol";
import "./interfaces/ISwapRouter.sol";

/**
 * @title AgentVaultExecutor
 * @notice Entrypoint for user-signed swaps, strictly governed by AgentVaultPolicy on-chain.
 */
contract AgentVaultExecutor is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS_DENOMINATOR = 10_000;

    AgentVaultPolicy public immutable policy;
    ISwapRouter public immutable router;

    error ZeroAddress();
    error UnsupportedOutputToken(address tokenOut);
    error InvalidMinAmountOut(uint256 provided, uint256 minAllowed);

    event SwapExecuted(
        address indexed user,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut,
        uint256 timestamp
    );

    constructor(
        address initialOwner,
        address policyAddress,
        address routerAddress
    ) Ownable(initialOwner) {
        if (policyAddress == address(0) || routerAddress == address(0)) {
            revert ZeroAddress();
        }
        policy = AgentVaultPolicy(policyAddress);
        router = ISwapRouter(routerAddress);
    }

    /**
     * @notice Executes a policy-governed swap from mUSDC (6 decimals) to native AVAX (18 decimals).
     * @dev Enforces slippage on-chain against MockDEXRouter.getAmountOut(amountIn) with floor rounding.
     */
    function executeSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 slippageBps
    ) external nonReentrant whenNotPaused returns (uint256 amountOut) {
        if (tokenOut != address(0)) revert UnsupportedOutputToken(tokenOut);

        policy.validateSwap(
            tokenIn,
            tokenOut,
            amountIn,
            slippageBps,
            address(router)
        );

        uint256 expectedOut = router.getAmountOut(amountIn);
        uint256 minAllowedOut = (expectedOut * (BPS_DENOMINATOR - slippageBps)) /
            BPS_DENOMINATOR;

        if (minAmountOut == 0 || minAmountOut < minAllowedOut) {
            revert InvalidMinAmountOut(minAmountOut, minAllowedOut);
        }

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).forceApprove(address(router), amountIn);

        amountOut = router.swapExactTokensForNative(
            tokenIn,
            amountIn,
            minAmountOut,
            msg.sender
        );

        emit SwapExecuted(
            msg.sender,
            tokenIn,
            tokenOut,
            amountIn,
            amountOut,
            block.timestamp
        );
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
