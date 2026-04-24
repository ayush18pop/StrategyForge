# Ticket: Smart Contracts

> **Package:** `packages/contracts`
> **Priority:** Day 6
> **Dependencies:** Solidity 0.8.24, Hardhat, OpenZeppelin
> **Read first:** `CLAUDE.md`, `docs/architecture.md` (Smart Contract Interfaces)

## What to Build

4 Solidity contracts deployed on 0G Chain testnet.

### Contract 1: `StrategyForgeINFT.sol` (ERC-7857)

The agent's iNFT. Extends ERC-721 with a mutable `brainCid` field.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract StrategyForgeINFT is ERC721, Ownable {
    mapping(uint256 => string) private _brainCids;
    uint256 private _nextTokenId;

    event BrainUpdated(uint256 indexed tokenId, string newCid);

    constructor() ERC721("StrategyForge Agent", "SFA") Ownable(msg.sender) {}

    function mint(address to, string calldata initialBrainCid) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _brainCids[tokenId] = initialBrainCid;
        emit BrainUpdated(tokenId, initialBrainCid);
        return tokenId;
    }

    function updateBrain(uint256 tokenId, string calldata newCid) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        _brainCids[tokenId] = newCid;
        emit BrainUpdated(tokenId, newCid);
    }

    function brainCid(uint256 tokenId) external view returns (string memory) {
        return _brainCids[tokenId];
    }
}
```

### Contract 2: `IdentityRegistry.sol` (ERC-8004)

On-chain strategy discovery.

```solidity
struct StrategyRegistration {
    address creator;
    string cid;                // 0G Storage CID
    uint256 pricePerRun;       // in wei
    uint256 registeredAt;
    bool active;
}

function registerStrategy(bytes32 strategyId, string calldata cid, uint256 pricePerRun) external;
function updateStrategy(bytes32 strategyId, string calldata newCid) external;
function deactivateStrategy(bytes32 strategyId) external;
function getStrategy(bytes32 strategyId) external view returns (StrategyRegistration memory);
function getStrategiesByCreator(address creator) external view returns (bytes32[] memory);
```

### Contract 3: `ReputationRegistry.sol` (ERC-8004)

Per-strategy track record.

```solidity
struct Reputation {
    uint256 totalRuns;
    uint256 successCount;
    uint256 totalYieldBps;     // sum of all yield basis points
    uint256 lastRunAt;
}

function postOutcome(bytes32 strategyId, uint256 yieldBps, bool success) external;
function getReputation(bytes32 strategyId) external view returns (uint256 avgYieldBps, uint256 totalRuns, uint256 successRate);
```

### Contract 4: `TBAFactory.sol` (ERC-6551 helper)

Uses the standard ERC-6551 registry to create a Token Bound Account for our iNFT.

```solidity
function createAccount(address nftContract, uint256 tokenId) external returns (address);
function getAccount(address nftContract, uint256 tokenId) external view returns (address);
```

## Deploy Script

`scripts/deploy.ts` — deploys all 4, logs addresses, verifies on explorer.

## Tests

Write Hardhat tests for:

1. Mint iNFT → verify brainCid stored → update brain → verify new CID
2. Register strategy → get strategy → verify fields
3. Post 3 outcomes → get reputation → verify average calculation
4. Create TBA → verify it can receive ETH

## Do NOT

- Do NOT implement ERC-8004 Validation Registry (on-chain TEE verification is out of scope)
- Do NOT add complex access control beyond ownerOf checks
- Keep contracts simple and auditable
