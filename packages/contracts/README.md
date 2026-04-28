# StrategyForge Smart Contracts

Solidity contracts for the StrategyForge agent's on-chain reputation and identity system.

## Contracts

### Full ERC-8004-style Registry Stack

These contracts now coexist with the lighter StrategyForge MVP contracts:

- `src/IdentityRegistryUpgradeable.sol`
- `src/ReputationRegistryUpgradeable.sol`
- `src/ValidationRegistryUpgradeable.sol`
- `src/ERC1967Proxy.sol`

The identity registry is the closest replacement for the old `AgentRegistry` because it also exposes:

- `register(string agentURI)`
- `getAgent(uint256 agentId)`
- `updateAgent(uint256 agentId, string agentURI)`

That means the existing StrategyForge server can point at the identity proxy address and continue treating `agentURI` as the metadata URI/CID for the agent.

### 1. StrategyForgeINFT (`src/StrategyForgeINFT.sol`)

ERC-721 token representing the StrategyForge agent (intelligent NFT).

**Features:**
- Mutable `brainCid` field pointing to 0G Storage (agent's knowledge)
- Owner-only mint
- Token holder can update brain CID after pipeline runs
- Emits `BrainUpdated` event on mint/update

**Usage:**
```solidity
// Mint agent iNFT
uint256 tokenId = inft.mint(operatorAddress, "QmInitialBrainCid");

// Update brain after pipeline completes
inft.updateBrain(tokenId, "QmNewBrainCid");

// Query current brain
string memory cid = inft.brainCid(tokenId);
```

### 2. AgentRegistry (`src/AgentRegistry.sol`)

Registry mapping agent IDs to metadata CIDs on 0G Storage.

**Features:**
- Sequential agent ID assignment (0, 1, 2, ...)
- Public registration (anyone can register)
- Each agent maps to a metadata CID (JSON: `{name, mcpEndpoint, x402Wallet}`)

**Usage:**
```solidity
// Register new agent
uint256 agentId = registry.register("QmAgentMetadata");

// Query agent metadata CID
string memory cid = registry.getAgent(agentId);
```

### 3. ReputationLedger (`src/ReputationLedger.sol`)

On-chain reputation ledger for strategy execution outcomes.

**Features:**
- Record strategy performance (yield in basis points)
- Support negative yields
- Operator-only recording (prevents reputation inflation)
- Query average yield and run count per strategy
- Evidence CID stored per record

**Usage:**
```solidity
// Record execution outcome (called by server after KeeperHub run)
reputationLedger.record(
  1,                                    // agentId
  "conservative-yield-v3",              // strategyTag
  820,                                  // 8.2% yield in bps
  keccak256(abi.encodePacked(cidHash))  // evidence CID
);

// Query strategy performance
(uint256 runCount, int256 avgYield) = reputationLedger.getSummary(
  1,
  "conservative-yield-v3"
);
```

## Deployment

### Prerequisites

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Install dependencies
pnpm install
cd packages/contracts
forge install OpenZeppelin/openzeppelin-contracts
```

### Deploy MVP Contracts to 0G Testnet

```bash
# Set environment variables
export PRIVATE_KEY=0x...
export RPC_URL=https://evmrpc-testnet.0g.ai

# Deploy
bun scripts/deploy.ts
```

Deployment info saved to `scripts/deployments.json`.

### Deploy Full ERC-8004 Stack

Copy the env template first:

```bash
cp .env.example .env
```

Then fill in at least:

```bash
PRIVATE_KEY=0x...
RPC_URL=https://evmrpc-testnet.0g.ai
ERC8004_OWNER=0x...
ERC8004_NAME=AgentIdentity
ERC8004_SYMBOL=AGENT
INITIAL_AGENT_URI=0g://your-agent-metadata-cid
```

`INITIAL_AGENT_URI` should be the URI or CID for the agent metadata JSON stored on 0G Storage. It should not be the raw URL of your server. If your agent needs to advertise an API or MCP endpoint, put that endpoint inside the metadata JSON.

Run the Foundry deployment script:

```bash
set -a
source .env
set +a

forge script script/DeployERC8004.s.sol:DeployERC8004 \
  --rpc-url $RPC_URL \
  --broadcast \
  -vvv
```

What the script does:

1. Deploys `IdentityRegistryUpgradeable` implementation
2. Deploys an `ERC1967Proxy` for it and calls `initialize(owner, name, symbol)`
3. Deploys `ReputationRegistryUpgradeable` implementation + proxy, initialized with the identity proxy address
4. Deploys `ValidationRegistryUpgradeable` implementation + proxy, initialized with the identity proxy address
5. Optionally registers one initial agent if `INITIAL_AGENT_URI` is non-empty
6. Writes deployment output to `script/erc8004-deployment.json`

After deployment:

1. Point `AGENT_REGISTRY_ADDRESS` in the server env to the deployed identity proxy address
2. Set `AGENT_ID` to the registered agent ID from `script/erc8004-deployment.json`
3. Keep using 0G Storage for the agent metadata document that `getAgent()` returns

### Important Addresses (Latest Deployment)

Network: 0G Testnet (Chain ID `16602`)

- Deployer: `0x7975E591c26e6c6D9B0CFd9A81f6d61A921C080c`
- IdentityRegistryUpgradeable: `0xF0Be1A141A3340262197f3e519FafB1a71Ee432a`
- ReputationRegistryUpgradeable: `0xCd2FD868b7eaB529075c5a7716dDfE395be33656`
- StrategyForgeINFT: `0xEAd14B860fa11e81a2B8348AC3Ea1b401b7C4135`

Additional deployed addresses from this run:

- `0x430e2F332fFe1BC5eFa3C54360fE9aC704EEaff7`
- `0x05A74dc13A6E4B2E166393558357485bD76bBf3c`

Deployment transaction hashes:

- `0xf69849f6d5f2831db521a8d9935286b65ea4de024dc7a6b01c7777004409dd00`
- `0x86f93eb015a17bc2a2d307de3d3c14124de5a8aa91b243f5c10fe5ae7c5dbb83`
- `0xf4bdd34315650fb76015bdc8630c9093b8612b4367bc2da1c1c4de8cf62836cd`
- `0xa0144a9b5305614dda43891dca76618efbfc00ce364ae6edfa1280264c747cd8`
- `0x7ff64d24447ccc89917d8b32f2f658e94b543bea21c90b156f34d6d973796e8d`

Current integration note:

- The full identity, reputation, and validation registries are deployed and tested here.
- The existing server currently consumes the identity registry compatibility surface, via `getAgent()` and `updateAgent()`.
- The server does not yet call the new reputation or validation registries directly.

## Testing

### Run All Tests

```bash
forge test -v
```

### Run Specific Test Suite

```bash
forge test --match StrategyForgeINFTTest
forge test --match AgentRegistryTest
forge test --match ReputationLedgerTest
```

### Coverage

```bash
forge coverage --report lcov
```

## Integration Flow

1. **Deployment Phase:**
   - Deploy StrategyForgeINFT → mint tokenId=1 with initialBrainCid
   - Deploy AgentRegistry → register(metadataCid) → agentId=1
   - Deploy ReputationLedger
   - (Optional) Create ERC-6551 TBA for tokenId=1

2. **Pipeline Execution:**
   - LLM pipeline creates strategy, stores evidence on 0G Storage
   - Server calls `inft.updateBrain(1, newBrainCid)` → agent learns
   - Server calls `reputationLedger.record(1, strategyTag, yieldBps, evidenceCid)`

3. **Monitoring & Updates:**
   - Monitor cron detects drift → triggers UpdateOrchestrator
   - UpdateOrchestrator loads priorCids → loads prior versions
   - Critic learns from `reputationLedger.getSummary()` failures
   - Strategist designs v(n+1) → compiler outputs new WorkflowSpec
   - On success: `inft.updateBrain(1, v2BrainCid)` → repeat

## Architecture Constraints

- **No on-chain TEE verification:** TEE attestation handled off-chain by 0G Compute broker
- **Self-reported yield:** Server operator records outcomes; no oracle required for MVP
- **Immutable evidence hashes:** Evidence CID stored as keccak256 hash, not full CID string
- **No version control on-chain:** Strategy versions tracked in 0G Storage KV, not contracts

## Gas Estimates (Mainnet-like)

| Operation | Gas | Note |
|---|---|---|
| `mint()` | ~85,000 | ERC-721 + storage |
| `updateBrain()` | ~25,000 | String storage |
| `register()` | ~45,000 | Simple mapping + emit |
| `record()` | ~35,000 | Mapping + push + emit |
| `getSummary()` (10 runs) | ~2,000 | View, loop overhead |

## Security Considerations

### Audit Checklist

- [x] No reentrancy risks (no external calls)
- [x] No integer overflow (Solidity 0.8.24 has overflow checks)
- [x] Access control: `onlyOwner` on sensitive operations
- [x] Events emitted for state changes
- [x] No hidden fallback functions
- [x] Simple, auditable logic (no complex math)

### For Mainnet

1. Formal audit recommended before mainnet deployment
2. Consider upgradeability (proxy pattern) for ReputationLedger
3. Add Pausable pattern in case of emergency
4. Consider time-weighted average yield instead of simple average

## Development

### Format Code

```bash
forge fmt
```

### View Gas Report

```bash
forge test --gas-report
```

### Build ABI for Frontend

```bash
forge build
# ABIs in `out/` directory
```

## Deployment Addresses

### 0G Testnet (Chain ID: 16601)

After deployment, addresses saved in `scripts/deployments.json`:

```json
{
  "strategyForgeINFT": "0x...",
  "agentRegistry": "0x...",
  "reputationLedger": "0x...",
  "erc6551Registry": "0x..."
}
```

## Roadmap

- [ ] Formal Foundry security audit
- [ ] Mainnet deployment preparation
- [ ] Upgrade proxy pattern for ReputationLedger
- [ ] Pausable guards for emergency situations
- [ ] Governance token integration (future)
- [ ] Validator staking for reputation validation (future)
