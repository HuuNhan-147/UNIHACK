// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./interfaces/IAggregatorV3.sol";

/**
 * @title MockChainlinkAggregator
 * @notice Local Hardhat test mock for Chainlink AVAX/USD AggregatorV3Interface.
 */
contract MockChainlinkAggregator is IAggregatorV3 {
    uint8 private immutable _decimals;
    int256 private _answer;
    uint256 private _updatedAt;
    uint80 private _roundId;
    uint80 private _answeredInRound;

    constructor(uint8 decimals_, int256 initialAnswer) {
        _decimals = decimals_;
        _answer = initialAnswer;
        _updatedAt = block.timestamp;
        _roundId = 1;
        _answeredInRound = 1;
    }

    function decimals() external view override returns (uint8) {
        return _decimals;
    }

    function latestRoundData()
        external
        view
        override
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (_roundId, _answer, _updatedAt, _updatedAt, _answeredInRound);
    }

    function setAnswer(int256 newAnswer) external {
        _roundId += 1;
        _answeredInRound = _roundId;
        _answer = newAnswer;
        _updatedAt = block.timestamp;
    }

    function setUpdatedAt(uint256 newUpdatedAt) external {
        _updatedAt = newUpdatedAt;
    }

    function setRoundData(
        uint80 roundId_,
        int256 answer_,
        uint256 updatedAt_,
        uint80 answeredInRound_
    ) external {
        _roundId = roundId_;
        _answer = answer_;
        _updatedAt = updatedAt_;
        _answeredInRound = answeredInRound_;
    }
}
