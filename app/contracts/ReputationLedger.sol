// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReputationLedger {
    struct Record {
        string strategyTag;
        uint256 successRateBps; // basis points: 10000 = 100%
        string evidenceCid;     // MongoDB strategy _id
        uint256 timestamp;
    }

    mapping(uint256 => Record[]) public records;
    address public owner;

    event RecordAdded(uint256 indexed agentId, string strategyTag, uint256 successRateBps);

    constructor() {
        owner = msg.sender;
    }

    function record(
        uint256 agentId,
        string calldata strategyTag,
        uint256 successRateBps,
        string calldata evidenceCid
    ) external {
        require(msg.sender == owner, "Not owner");
        records[agentId].push(Record(strategyTag, successRateBps, evidenceCid, block.timestamp));
        emit RecordAdded(agentId, strategyTag, successRateBps);
    }

    function getRecords(uint256 agentId) external view returns (Record[] memory) {
        return records[agentId];
    }

    function getLatest(uint256 agentId) external view returns (Record memory) {
        Record[] storage r = records[agentId];
        require(r.length > 0, "No records");
        return r[r.length - 1];
    }

    function getCount(uint256 agentId) external view returns (uint256) {
        return records[agentId].length;
    }
}
