// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentRegistry {
    mapping(uint256 => string) public agents;
    uint256 public nextId = 1;
    address public owner;

    event AgentRegistered(uint256 indexed agentId, string metadataCid);
    event AgentUpdated(uint256 indexed agentId, string newMetadataCid);

    constructor() {
        owner = msg.sender;
    }

    function register(string calldata metadataCid) external returns (uint256) {
        uint256 agentId = nextId++;
        agents[agentId] = metadataCid;
        emit AgentRegistered(agentId, metadataCid);
        return agentId;
    }

    function update(uint256 agentId, string calldata newMetadataCid) external {
        require(msg.sender == owner, "Not owner");
        agents[agentId] = newMetadataCid;
        emit AgentUpdated(agentId, newMetadataCid);
    }

    function getAgent(uint256 agentId) external view returns (string memory) {
        return agents[agentId];
    }
}
