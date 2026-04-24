---
description: How to scaffold and set up the monorepo from scratch
---

# Setup Monorepo

// turbo-all

1. Initialize the pnpm workspace:

```bash
cd /home/hyprayush/Documents/Projects/openagents/strategyforge
pnpm init
```

1. Create pnpm workspace config:

```bash
cat > pnpm-workspace.yaml << 'EOF'
packages:
  - "packages/*"
EOF
```

1. Install root devDependencies:

```bash
pnpm add -D typescript vitest @types/node tsx
```

1. Create tsconfig.base.json:

```bash
cat > tsconfig.base.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
EOF
```

1. Create each package directory with package.json:

```bash
for pkg in core compute storage data pipeline keeperhub contracts server dashboard; do
  mkdir -p packages/$pkg/src
  cat > packages/$pkg/package.json << EOF
{
  "name": "@strategyforge/$pkg",
  "version": "0.1.0",
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
EOF
  cat > packages/$pkg/tsconfig.json << EOF
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF
  touch packages/$pkg/src/index.ts
done
```

1. Create .env.example:

```bash
cat > .env.example << 'EOF'
PRIVATE_KEY=0x...
OG_EVM_RPC=https://evmrpc-testnet.0g.ai
OG_CHAIN_ID=16601
OG_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
KEEPERHUB_API_KEY=...
KEEPERHUB_API_URL=https://api.keeperhub.com
EOF
```

1. Create .gitignore:

```bash
cat > .gitignore << 'EOF'
node_modules/
dist/
.env
*.log
EOF
```

1. Verify setup:

```bash
pnpm install
pnpm -r exec -- echo "Package OK: \$(basename \$(pwd))"
```
