# Quick Start: Deploy Contracts

## TL;DR

Deploy to 0G testnet with one command:

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://evmrpc-testnet.0g.ai
./deploy.sh
```

## Step-by-Step

### 1. Set Environment Variables

```bash
export PRIVATE_KEY=0x<your_wallet_private_key>
export RPC_URL=https://evmrpc-testnet.0g.ai
export NETWORK="0G Testnet"
```

Or create a `.env` file:

```bash
cat > .env << 'EOF'
PRIVATE_KEY=0x...
RPC_URL=https://evmrpc-testnet.0g.ai
NETWORK=0G Testnet
EOF

source .env
```

### 2. Dry Run (Recommended First)

Test deployment without sending transactions:

```bash
export DRY_RUN=true
./deploy.sh
```

This simulates the deployment and shows gas estimates without spending ETH.

### 3. Deploy

```bash
unset DRY_RUN  # Clear dry-run flag
./deploy.sh
```

The script will:
- Deploy IdentityRegistryUpgradeable (UUPS proxy)
- Deploy ReputationRegistryUpgradeable (UUPS proxy)
- Deploy StrategyForgeINFT
- Initialize both registries
- Output contract addresses

### 4. Save Addresses

Copy the deployed addresses from the output. Update your server's `.env`:

```bash
# packages/server/.env
AGENT_REGISTRY_ADDRESS=0x... # from IdentityRegistryUpgradeable
```

Update `packages/contracts/deployments/latest.json` for future reference:

```json
{
  "network": "0G Testnet",
  "timestamp": "2026-04-27T...",
  "identityRegistry": "0x...",
  "reputationRegistry": "0x...",
  "strategyForgeINFT": "0x..."
}
```

## Other Networks

### Ethereum Sepolia

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
export NETWORK="Ethereum Sepolia"
./deploy.sh
```

### Base Sepolia

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://sepolia.base.org
export NETWORK="Base Sepolia"
./deploy.sh
```

## Troubleshooting

### "Error: insufficient funds for gas"
→ Ensure deployer wallet has ETH for gas fees (~0.5 ETH should be plenty)

### "Error: nonce too high"
→ If a previous deployment got stuck, wait a moment or use a different deployer address

### Contract not verifying
→ Add `ETHERSCAN_API_KEY` to `.env` and re-run with verification flags enabled in the script

## What Gets Deployed

| Contract | Purpose | Role |
|----------|---------|------|
| IdentityRegistryUpgradeable | Agent identity (ERC-721) | Owns workflow versions, stores metadata |
| ReputationRegistryUpgradeable | Agent reputation tracking | Stores feedback/execution outcomes |
| StrategyForgeINFT | Simplified iNFT | Holds agent's `brainCid` (knowledge) |

All three are **upgradeable** via UUPS pattern — only the owner (deployer) can upgrade implementations.

## Next Steps

1. Run tests to ensure deployed contracts work:
   ```bash
   cd ../contracts
   forge test
   ```

2. Start the server with deployed addresses:
   ```bash
   cd ../server
   AGENT_REGISTRY_ADDRESS=0x... npm run dev
   ```

3. For agents to use the workflow, they need:
   - Agentic wallet: `npx @keeperhub/wallet skill install && npx @keeperhub/wallet add`
   - Published workflows available via KeeperHub MCP `search_workflows` + `call_workflow`
