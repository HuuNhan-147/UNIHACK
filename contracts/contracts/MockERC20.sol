// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC20
 * @notice Mock USDC (6 decimals) for Avalanche Fuji Testnet demo with public faucet.
 */
contract MockERC20 is ERC20, Ownable {
    uint8 private constant _DECIMALS = 6;
    uint256 public constant MAX_FAUCET_AMOUNT = 1_000 * 10 ** _DECIMALS;

    error ExceedsFaucetLimit(uint256 requested, uint256 maxAllowed);

    constructor(
        string memory name_,
        string memory symbol_,
        address initialOwner
    ) ERC20(name_, symbol_) Ownable(initialOwner) {}

    function decimals() public pure override returns (uint8) {
        return _DECIMALS;
    }

    function faucet(uint256 amount) external {
        if (amount > MAX_FAUCET_AMOUNT) {
            revert ExceedsFaucetLimit(amount, MAX_FAUCET_AMOUNT);
        }
        _mint(msg.sender, amount);
    }

    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
