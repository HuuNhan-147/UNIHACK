// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SpendGuardVault
 * @notice On-chain treasury vault governing AI Agent micropayments (x402 / USDC) with per-call caps,
 *         UTC daily spending limits, vendor whitelisting, and instant owner revocation.
 */
contract SpendGuardVault is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct AgentPolicy {
        uint256 perCallCap;
        uint256 dailyCap;
        bool active;
        bool revoked;
    }

    IERC20 public immutable token;

    mapping(address => AgentPolicy) public agentPolicies;
    mapping(address => bool) public allowedVendors;
    mapping(address => mapping(uint256 => uint256)) public dailySpent;
    mapping(address => mapping(uint256 => uint256)) public dailyTxCount;

    error ZeroAddress();
    error ZeroAmount();
    error InvalidCaps();
    error AgentNotActive(address agent);
    error AgentRevoked(address agent);
    error VendorNotAllowed(address vendor);
    error ExceedsPerCallCap(uint256 requested, uint256 perCallCap);
    error ExceedsDailyCap(uint256 projected, uint256 dailyCap);
    error InsufficientVaultBalance(uint256 available, uint256 required);

    event Deposited(address indexed owner, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);
    event AgentConfigured(
        address indexed agent,
        uint256 perCallCap,
        uint256 dailyCap,
        bool active
    );
    event AgentRevokedEvent(address indexed agent);
    event VendorWhitelistUpdated(address indexed vendor, bool allowed);
    event VendorPaid(
        address indexed agent,
        address indexed vendor,
        uint256 amount,
        string requestId,
        uint256 timestamp
    );

    constructor(address initialOwner, address tokenAddress) Ownable(initialOwner) {
        if (tokenAddress == address(0)) revert ZeroAddress();
        token = IERC20(tokenAddress);
    }

    function deposit(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 bal = token.balanceOf(address(this));
        if (bal < amount) revert InsufficientVaultBalance(bal, amount);
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    function configureAgent(
        address agent,
        uint256 perCallCap,
        uint256 dailyCap,
        bool active
    ) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        if (perCallCap == 0 || dailyCap < perCallCap) revert InvalidCaps();
        agentPolicies[agent] = AgentPolicy({
            perCallCap: perCallCap,
            dailyCap: dailyCap,
            active: active,
            revoked: false
        });
        emit AgentConfigured(agent, perCallCap, dailyCap, active);
    }

    function revokeAgent(address agent) external onlyOwner {
        if (agent == address(0)) revert ZeroAddress();
        agentPolicies[agent].active = false;
        agentPolicies[agent].revoked = true;
        emit AgentRevokedEvent(agent);
    }

    function setAllowedVendor(address vendor, bool allowed) external onlyOwner {
        if (vendor == address(0)) revert ZeroAddress();
        allowedVendors[vendor] = allowed;
        emit VendorWhitelistUpdated(vendor, allowed);
    }

    function payVendor(
        address vendor,
        uint256 amount,
        string calldata requestId
    ) external nonReentrant whenNotPaused {
        AgentPolicy memory pol = agentPolicies[msg.sender];
        if (pol.revoked) revert AgentRevoked(msg.sender);
        if (!pol.active) revert AgentNotActive(msg.sender);
        if (!allowedVendors[vendor]) revert VendorNotAllowed(vendor);
        if (amount == 0) revert ZeroAmount();
        if (amount > pol.perCallCap) {
            revert ExceedsPerCallCap(amount, pol.perCallCap);
        }

        uint256 day = block.timestamp / 1 days;
        uint256 projected = dailySpent[msg.sender][day] + amount;
        if (projected > pol.dailyCap) {
            revert ExceedsDailyCap(projected, pol.dailyCap);
        }

        uint256 vaultBal = token.balanceOf(address(this));
        if (vaultBal < amount) {
            revert InsufficientVaultBalance(vaultBal, amount);
        }

        dailySpent[msg.sender][day] = projected;
        dailyTxCount[msg.sender][day] += 1;

        token.safeTransfer(vendor, amount);
        emit VendorPaid(msg.sender, vendor, amount, requestId, block.timestamp);
    }

    function getAgentDailyUsage(
        address agent
    ) external view returns (uint256 spentToday, uint256 txCountToday, uint256 dayIndex) {
        dayIndex = block.timestamp / 1 days;
        spentToday = dailySpent[agent][dayIndex];
        txCountToday = dailyTxCount[agent][dayIndex];
    }

    function vaultBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
