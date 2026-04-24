---
description: How to deploy smart contracts to 0G testnet
---

# Deploy Contracts

1. Make sure Hardhat is set up in packages/contracts:

```bash
cd /home/hyprayush/Documents/Projects/openagents/strategyforge/packages/contracts
pnpm add -D hardhat @nomicfoundation/hardhat-toolbox @openzeppelin/contracts
npx hardhat init  # choose TypeScript project
```

1. Configure 0G testnet in hardhat.config.ts:

```typescript
const config: HardhatUserConfig = {
  solidity: "0.8.24",
  networks: {
    og_testnet: {
      url: "https://evmrpc-testnet.0g.ai",
      chainId: 16601,
      accounts: [process.env.PRIVATE_KEY!],
    }
  }
};
```

1. Get testnet tokens from faucet:

```
Visit https://faucet.0g.ai and submit your wallet address
```

1. Compile contracts:

```bash
npx hardhat compile
```

1. Deploy:

```bash
npx hardhat run scripts/deploy.ts --network og_testnet
```

1. Save deployed addresses to `.env` and `docs/deployed-addresses.md`

2. Verify contracts work by running test transactions:

```bash
npx hardhat test --network og_testnet
```
