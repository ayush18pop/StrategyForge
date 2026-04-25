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

### Contract 2: `AgentRegistry.sol` — WE DEPLOY THIS

> ERC-8004 is not deployed on 0G Chain. We deploy our own purpose-built registry contracts. ~60 lines each.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentRegistry {
    uint256 private _nextId;
    mapping(uint256 => string) private _agentURIs;

    event AgentRegistered(uint256 indexed agentId, string agentURI);

    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextId++;
        _agentURIs[agentId] = agentURI;
        emit AgentRegistered(agentId, agentURI);
    }

    function getAgent(uint256 agentId) external view returns (string memory) {
        return _agentURIs[agentId];
    }
}
```

```typescript
// Register agent ONCE on deploy
const agentId = await agentRegistry.register(agentMetadataCid);
// agentMetadataCid → JSON on 0G Storage:
// { name: "StrategyForge", mcpEndpoint: "...", x402Wallet: "0xERC6551Wallet" }
// Save agentId (= 1) — used in all ReputationLedger calls
```

### Contract 3: `ReputationLedger.sol` — WE DEPLOY THIS

> **Yield is self-reported.** The server layer calls `record()` after KeeperHub execution. There is no on-chain proof that the yield number matches actual execution. This is acceptable for a hackathon. `onlyOwner` access control prevents arbitrary callers from inflating reputation.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

contract ReputationLedger is Ownable {
    struct Record {
        int256 yieldBps;
        bytes32 evidenceCid;
        uint256 timestamp;
    }

    mapping(uint256 => mapping(string => Record[])) private _records;

    event OutcomeRecorded(uint256 indexed agentId, string strategyTag, int256 yieldBps);

    constructor() Ownable(msg.sender) {}

    // onlyOwner: only the agent operator wallet (deployer) can record outcomes
    function record(
        uint256 agentId,
        string calldata strategyTag,
        int256 yieldBps,
        bytes32 evidenceCid
    ) external onlyOwner {
        _records[agentId][strategyTag].push(Record(yieldBps, evidenceCid, block.timestamp));
        emit OutcomeRecorded(agentId, strategyTag, yieldBps);
    }

    function getSummary(uint256 agentId, string calldata strategyTag)
        external view returns (uint256 runCount, int256 avgYieldBps)
    {
        Record[] storage records = _records[agentId][strategyTag];
        runCount = records.length;
        if (runCount == 0) return (0, 0);
        int256 sum;
        for (uint256 i = 0; i < runCount; i++) sum += records[i].yieldBps;
        avgYieldBps = sum / int256(runCount);
    }
}
```

```typescript
// Called in server layer after every KeeperHub execution completes
await reputationLedger.record(
  1,                             // agentId
  `${familyId}-v${version}`,     // e.g. "conservative-yield-v3"
  820,                           // 8.20% yield in bps
  keccak256(Buffer.from(evidenceBundleCid))
);
```

Uses the standard ERC-6551 registry to create a Token Bound Account for our iNFT.

```solidity
function createAccount(address nftContract, uint256 tokenId) external returns (address);
function getAccount(address nftContract, uint256 tokenId) external view returns (address);
```

## Deploy Script

`scripts/deploy.ts` — deploys all 4 contracts, logs addresses, verifies on explorer.

Deployment order:
1. `StrategyForgeINFT.sol` → mint tokenId=1 with initial brainCid
2. `AgentRegistry.sol` → register(metadataCid) → agentId=1
3. `ReputationLedger.sol` → no init needed
4. ERC-6551 TBA → createAccount(iNFTAddress, tokenId=1)

## Tests

Write Hardhat tests for:

1. Mint iNFT → verify brainCid stored → update brain → verify new CID
2. AgentRegistry: register → getAgent → verify CID returned
3. ReputationLedger: record 3 outcomes → getSummary → verify runCount=3 and avgYieldBps correct
4. Create TBA → verify it can receive ETH

## Do NOT

- Do NOT implement any Validation Registry (on-chain TEE verification is out of scope — handled off-chain via broker.inference.processResponse)
- Do NOT add complex access control beyond ownerOf checks
- Keep contracts simple and auditable
