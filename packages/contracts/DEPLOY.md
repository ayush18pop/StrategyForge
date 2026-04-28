# Contract Deployment Guide

## Prerequisites

- `forge` installed (Foundry)
- `PRIVATE_KEY` environment variable set
- RPC URL for target network
- Sufficient ETH for gas fees

## Deploy to Testnet

### 0G Testnet (Recommended for Dev)

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://evmrpc-testnet.0g.ai

forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

### Ethereum Sepolia

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY

forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

### Base Sepolia

```bash
export PRIVATE_KEY=0x...
export RPC_URL=https://sepolia.base.org

forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  --verify
```

## Dry Run (No Broadcast)

Test the deployment without sending transactions:

```bash
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --verify
```

## Verification

After deployment, verify contracts on the block explorer:

```bash
# For networks with Etherscan API
forge verify-contract \
  <CONTRACT_ADDRESS> \
  src/IdentityRegistryUpgradeable.sol:IdentityRegistryUpgradeable \
  --chain-id 16601 \
  --constructor-args <ENCODED_ARGS>
```

## Environment Variables

Create a `.env` file in the contracts package:

```bash
PRIVATE_KEY=0x...
RPC_URL=https://evmrpc-testnet.0g.ai
ETHERSCAN_API_KEY=... # optional, for verification
```

Load with:

```bash
source .env
forge script script/Deploy.s.sol --rpc-url $RPC_URL --broadcast
```

## After Deployment

Update server config with deployed addresses:

```bash
# In packages/server/.env
AGENT_REGISTRY_ADDRESS=0x...  # IdentityRegistryUpgradeable address
```

Save deployment addresses in a file for reference:

```bash
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL \
  --broadcast \
  2>&1 | tee deployments/$(date +%Y%m%d_%H%M%S).log
```

## Upgrading Contracts

To upgrade an existing proxy:

1. Deploy new implementation:
   ```bash
   forge create src/IdentityRegistryUpgradeable.sol:IdentityRegistryUpgradeable \
     --private-key $PRIVATE_KEY --rpc-url $RPC_URL
   ```

2. Call `upgradeTo()` on proxy (owner only):
   ```bash
   cast send <PROXY_ADDRESS> \
     "upgradeTo(address)" <NEW_IMPLEMENTATION_ADDRESS> \
     --private-key $PRIVATE_KEY --rpc-url $RPC_URL
   ```

## Common Issues

**"Insufficient balance"** → ensure deployer address has ETH for gas

**"Nonce too high"** → reset local nonce tracking in Foundry cache, or wait for pending tx to settle

**Verification fails** → ensure constructor args are correctly ABI-encoded and API key is valid
