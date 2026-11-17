// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title AgentVaultPolicy
 * @notice On-chain policy engine enforcing transaction limits, token/router whitelists, and slippage caps.
 */
contract AgentVaultPolicy is Ownable, Pausable {
    uint256 public maxAmountPerTx;
    uint256 public maxSlippageBps;

    mapping(address => bool) public allowedTokens;
    mapping(address => bool) public allowedRouters;

    error ZeroAmount();
    error ZeroAddress();
    error SameTokenSwap();
    error ExceedsMaxTxAmount(uint256 requested, uint256 maxAllowed);
    error TokenNotAllowed(address token);
    error RouterNotAllowed(address router);
    error SlippageTooHigh(uint256 requestedBps, uint256 maxBps);

    event MaxAmountPerTxUpdated(uint256 newLimit);
    event MaxSlippageBpsUpdated(uint256 newMaxSlippageBps);
    event AllowedTokenUpdated(address indexed token, bool allowed);
    event AllowedRouterUpdated(address indexed router, bool allowed);

    constructor(
        address initialOwner,
        uint256 initialMaxAmountPerTx,
        uint256 initialMaxSlippageBps
    ) Ownable(initialOwner) {
        maxAmountPerTx = initialMaxAmountPerTx;
        maxSlippageBps = initialMaxSlippageBps;
    }

    function validateSwap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 slippageBps,
        address router
    ) external view whenNotPaused {
        if (tokenIn == address(0)) revert TokenNotAllowed(tokenIn);
        if (tokenIn == tokenOut) revert SameTokenSwap();
        if (amountIn == 0) revert ZeroAmount();
        if (!allowedTokens[tokenIn]) revert TokenNotAllowed(tokenIn);
        if (!allowedTokens[tokenOut]) revert TokenNotAllowed(tokenOut);
        if (!allowedRouters[router]) revert RouterNotAllowed(router);
        if (amountIn > maxAmountPerTx) {
            revert ExceedsMaxTxAmount(amountIn, maxAmountPerTx);
        }
        if (slippageBps > maxSlippageBps) {
            revert SlippageTooHigh(slippageBps, maxSlippageBps);
        }
    }

    function setMaxAmountPerTx(uint256 newLimit) external onlyOwner {
        maxAmountPerTx = newLimit;
        emit MaxAmountPerTxUpdated(newLimit);
    }

    function setMaxSlippageBps(uint256 newMaxSlippageBps) external onlyOwner {
        maxSlippageBps = newMaxSlippageBps;
        emit MaxSlippageBpsUpdated(newMaxSlippageBps);
    }

    function setAllowedToken(address token, bool allowed) external onlyOwner {
        allowedTokens[token] = allowed;
        emit AllowedTokenUpdated(token, allowed);
    }

    function setAllowedRouter(address router, bool allowed) external onlyOwner {
        if (router == address(0)) revert ZeroAddress();
        allowedRouters[router] = allowed;
        emit AllowedRouterUpdated(router, allowed);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
