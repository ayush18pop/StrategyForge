---
description: How to set up and run local 0G storage + KV nodes for StrategyForge development
---

# Local 0G Storage + KV Node Setup

StrategyForge needs TWO local 0G services:

- **Storage Node** (`zgs_node`) — port `5678`, handles data storage, uploads, and log syncing
- **KV Node** (`zgs_kv`) — port `6789`, provides key-value API on top of storage nodes

The KV node depends on the storage node. Both must be running.

## Prerequisites

```bash
# System deps (Ubuntu/Debian)
sudo apt-get update
sudo apt-get install clang cmake build-essential pkg-config libssl-dev protobuf-compiler

# Rust toolchain
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

## 1. Build the Storage Node

```bash
# Check latest tag at https://github.com/0gfoundation/0g-storage-node/tags
cd ~/Documents/Projects
git clone -b <latest_tag> https://github.com/0gfoundation/0g-storage-node.git
cd 0g-storage-node
cargo build --release
```

## 2. Configure the Storage Node

```bash
cd run
cp config-testnet-turbo.toml config.toml
```

Edit `config.toml` — update these fields:

```toml
# Flow contract address (testnet)
log_contract_address = "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296"

# Testnet RPC
blockchain_rpc_endpoint = "https://evmrpc-testnet.0g.ai"

# Start sync block (use 1 for testnet)
log_sync_start_block_number = 1

# Your private key (64 chars, NO 0x prefix)
miner_key = "<your_private_key_without_0x>"
```

## 3. Run the Storage Node

```bash
cd run
../target/release/zgs_node --config config.toml
```

Wait for it to sync logs before proceeding. Use `tmux` or a separate terminal.

## 4. Build the KV Node

```bash
cd ~/Documents/Projects
git clone -b <latest_tag> https://github.com/0gfoundation/0g-storage-kv.git
cd 0g-storage-kv
cargo build --release
```

## 5. Configure the KV Node

```bash
cd run
cp config_example.toml config.toml
```

Edit `config.toml`:

```toml
# Your stream ID(s) to monitor
stream_ids = ["404ab2f76e0f61e1a51030466b17980b9e701e7f53f5d395f89e16d9e0f10aa8"]

# Storage paths
db_dir = "db"
kv_db_dir = "kv.DB"

# Log sync (same flow contract as storage node)
blockchain_rpc_endpoint = "https://evmrpc-testnet.0g.ai"
log_contract_address = "0x22E03a6A89B950F1c82ec5e74F8eCa321a105296"
log_sync_start_block_number = 0

# RPC
rpc_enabled = true
rpc_listen_address = "0.0.0.0:6789"

# Point to your local storage node
zgs_node_urls = "http://127.0.0.1:5678"
```

> **Note:** The `stream_ids` entry should NOT have the `0x` prefix.

## 6. Run the KV Node

```bash
cd run
../target/release/zgs_kv --config config.toml
```

## 7. Update StrategyForge .env

Add to `packages/server/.env`:

```
OG_FLOW_CONTRACT_ADDRESS=0x22E03a6A89B950F1c82ec5e74F8eCa321a105296
```

## Verification

Run the smoke test:

```bash
cd strategyforge/packages/storage
OG_FLOW_CONTRACT_ADDRESS=0x22E03a6A89B950F1c82ec5e74F8eCa321a105296 bun run src/smoke-kv.ts
```
