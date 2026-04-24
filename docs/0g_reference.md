# 0G — Structured Reference Guide

> Distilled from [0g_deep_dive.md](../references/0g_deep_dive.md). Purpose-built for quick lookups during implementation.

---

## 1. 0G Overview

**What:** An **AI-first modular L1 stack** — not just a single chain, but a full infrastructure layer for decentralized AI.

**Core builder surfaces:**

| Surface | Description |
|---------|-------------|
| **0G Compute** | Decentralized inference & model-serving marketplace with TEE-sealed execution |
| **0G Storage** | Decentralized storage with Merkle-root addressing and proof-aware retrieval |
| **0G Chain** | EVM-compatible chain tuned for AI workloads |
| **Agentic ID** | ERC-7857-driven identity narratives for agents |
| **0G DA** | Data-availability layer in the broader stack framing |

### Key Links

| Resource | URL |
|----------|-----|
| Builder Hub | <https://build.0g.ai> |
| Docs Home | <https://docs.0g.ai> |
| Getting Started | <https://docs.0g.ai/developer-hub/getting-started> |
| Compute Inference Docs | <https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference> |
| Storage SDK Docs | <https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk> |
| Chain Concepts | <https://docs.0g.ai/concepts/chain> |
| Chain Explorer | <https://chainscan.0g.ai> |
| Storage Explorer | <https://storagescan.0g.ai> |
| Testnet Faucet | <https://faucet.0g.ai> |
| Build Showcase | <https://build.0g.ai/showcase/> |

---

## 2. 0G Compute — Sealed Inference

### 2.1 What Sealed Inference Is (Launched March 2026)

0G's flagship capability. Every inference call executes inside a hardware-isolated **Trusted Execution Environment (TEE)** and is cryptographically signed before the response returns.

### Three-Layer Proof Chain

| Layer | What Happens |
|-------|-------------|
| **Confidential Execution** | Providers run Confidential VMs on Intel TDX + NVIDIA H100/H200 GPUs in TEE mode. Prompts arrive encrypted, process in complete isolation. Hardware operators cannot inspect/copy/modify data. |
| **Enclave-Born Keys** | Key pair generates **inside** the TEE at initialization. Private key never leaves. CPU + GPU attestation reports bind public key to genuine secure hardware. |
| **Per-Call Signing** | Every AI response is signed with the enclave-born key before reaching the caller. Creates auditable proof: real TEE, no tampering, authentic response. |

### 2.2 Live Models

| Model | Type |
|-------|------|
| GLM-5 | Open-source reasoning |
| Vision-language models | Multimodal |
| Speech-to-text | Audio |
| Image generation | Text-to-image |

### 2.3 Access Modes

| Mode | Description |
|------|-------------|
| **Hosted Marketplace UI** | `compute-marketplace.0g.ai/inference` for quick testing |
| **Local CLI** | `0g-compute-cli ui start-web` |
| **TypeScript SDK** | `@0glabs/0g-serving-broker` for application integration |

### 2.4 Full SDK Code Reference (`@0glabs/0g-serving-broker`)

```typescript
import { ethers } from 'ethers';
import { createZGComputeNetworkBroker } from '@0glabs/0g-serving-broker';

// Setup
const provider = new ethers.JsonRpcProvider('https://evmrpc-testnet.0g.ai');
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const broker = await createZGComputeNetworkBroker(wallet);

// 1. Fund your account (one-time or top-up)
await broker.ledger.depositFund(10); // deposit 10 OG tokens

// 2. List available inference providers
const services = await broker.inference.listService();
const providerAddress = services[0].provider;

// 3. Acknowledge provider (required before first use)
await broker.inference.acknowledgeProviderSigner(providerAddress);

// 4. Get endpoint and model name
const { endpoint, model } = await broker.inference.getServiceMetadata(providerAddress);

// 5. Generate per-request auth headers (includes payment proof)
const headers = await broker.inference.getRequestHeaders(providerAddress);

// 6. Call inference (OpenAI-compatible endpoint)
const response = await fetch(`${endpoint}/chat/completions`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Analyze this DeFi signal...' }],
  }),
});
const result = await response.json();

// 7. Verify attestation (download and verify TEE proof)
await broker.inference.verifyService(
  providerAddress,
  './attestation-reports',
  (step) => console.log(step.message)
);
```

### 2.5 Broker Namespaces

| Namespace | Purpose |
|-----------|---------|
| `broker.inference` | Inference calls, provider management, attestation verification |
| `broker.ledger` | Account funding, balance management |
| `broker.fine-tuning` | Model fine-tuning operations |

### 2.6 Operational Behavior to Design For

**WARNING: These will cause runtime failures if ignored.**

- **Delayed fee settlement** — usage costs appear as periodic batch deductions, not per-call
- **Provider-side rate limits** — 30 req/min sustained baseline, burst varies by provider
- Always **check balance** before expensive fan-out jobs
- **Retry with backoff** on `429` and provider-unavailable errors

---

## 3. 0G Storage — Practical SDK Model

### 3.1 Available SDKs

| SDK | Package | Use Case |
|-----|---------|----------|
| TypeScript | `@0gfoundation/0g-ts-sdk` | Node.js/browser apps |
| Go | `github.com/0gfoundation/0g-storage-client` | Backend/server |
| Python | `0g-storage-sdk` on PyPI | Python agents |

### 3.2 Core Storage Flow

1. Select nodes/replica strategy
2. Upload content (SDK handles chunking)
3. Compute **Merkle root hash** — this is your file's **permanent address**
4. Download by root hash
5. Optionally verify with Merkle proof on retrieval

### 3.3 Full SDK Code Reference (`@0gfoundation/0g-ts-sdk`)

```bash
npm install @0gfoundation/0g-ts-sdk ethers
```

```typescript
import { ZgFile, Indexer, MemData } from '@0gfoundation/0g-ts-sdk';
import { ethers } from 'ethers';

// Environment
const EVM_RPC   = 'https://evmrpc-testnet.0g.ai';
const INDEXER   = 'https://indexer-storage-testnet-turbo.0g.ai';

const provider = new ethers.JsonRpcProvider(EVM_RPC);
const signer   = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
const indexer  = new Indexer(INDEXER);

// ── UPLOAD ──────────────────────────────────────────────
const file = await ZgFile.fromFilePath('./cycle-record.json');
const [tree, treeErr] = await file.merkleTree();
if (treeErr) throw treeErr;
const rootHash = tree.rootHash();  // persist this — it's your CID

const [tx, uploadErr] = await indexer.upload(file, EVM_RPC, signer);
await file.close();
console.log('Stored. Root hash:', rootHash);

// ── DOWNLOAD ────────────────────────────────────────────
const downloadErr = await indexer.download(rootHash, './output.json', true);
// withProof=true: validates Merkle proofs during retrieval (recommended)

// ── IN-MEMORY DATA (no file system) ─────────────────────
const data = new MemData(Buffer.from(JSON.stringify({ cycles: [] })));
const [memTree] = await data.merkleTree();
const memRoot = memTree.rootHash();
await indexer.upload(data, EVM_RPC, signer);

// ── KEY-VALUE STORE ─────────────────────────────────────
import { Batcher, KvClient } from '@0gfoundation/0g-ts-sdk';
const batcher = new Batcher(1, [kvNodeRpc], EVM_RPC, signer);
const STREAM_ID = '0x...';  // your app's stream ID (bytes32)
batcher.streamDataBuilder.set(STREAM_ID,
  Buffer.from('agent-state-v1'),      // key
  Buffer.from(JSON.stringify(state))  // value
);
await batcher.exec();

// KvClient: read KV data
const kvClient = new KvClient(kvNodeRpc);
const val = await kvClient.getValue(STREAM_ID, Buffer.from('agent-state-v1'));
```

### 3.4 Two Storage Networks

| Network | Speed | Cost | Indexer URL |
|---------|-------|------|-------------|
| **Turbo** | Fast | Higher fees | `indexer-storage-testnet-turbo.0g.ai` |
| **Standard** | Slower | Lower fees | `indexer-storage-testnet-standard.0g.ai` |

### 3.5 Package Hygiene (Critical!)

**CAUTION: Do NOT swap these namespaces. Wrong namespace = wrong package = runtime failure.**

```
Storage SDK:  @0gfoundation/0g-ts-sdk      ← 0gfoundation namespace
Compute SDK:  @0glabs/0g-serving-broker     ← 0glabs namespace
```

---

## 4. The priorCids RAG DAG Pattern (AlphaDawg)

**This is the pattern 0G judges want to see for Track 2 persistent memory.** It creates a **verifiable DAG of reasoning**, not a flat log.

```typescript
interface CycleRecord {
  timestamp: number;
  decision: string;
  reasoning: string;
  priorCids: string[];  // root hashes of the N records this cycle loaded
  outcome?: string;
}

async function writeCycle(record: CycleRecord): Promise<string> {
  const data = new MemData(Buffer.from(JSON.stringify(record)));
  const [tree] = await data.merkleTree();
  await indexer.upload(data, EVM_RPC, signer);
  return tree.rootHash(); // save as the next cycle's priorCid
}

async function loadPriorContext(priorCids: string[]): Promise<string> {
  const records = await Promise.all(
    priorCids.map(cid => indexer.download(cid, `/tmp/${cid}.json`, false))
  );
  return records.map(r => `[Prior cycle ${r.timestamp}]: ${r.reasoning}`).join('\n');
}
```

**How it works:** Each new cycle loads the last N records, includes their root hashes in `priorCids`, writes a new record referencing them → creates a verifiable DAG of reasoning.

---

## 5. 0G Chain — Network Details

### 5.1 Chain IDs and RPCs

| Network | Chain ID | EVM RPC | Explorer |
|---------|----------|---------|----------|
| 0G Mainnet | 16600 | `https://evmrpc.0g.ai` | <https://chainscan.0g.ai> |
| 0G Testnet | 16601 | `https://evmrpc-testnet.0g.ai` | <https://chainscan-galileo.0g.ai> |

### 5.2 Storage Indexer URLs

| Network | Indexer URL |
|---------|-------------|
| Testnet Turbo | `https://indexer-storage-testnet-turbo.0g.ai` |
| Testnet Standard | `https://indexer-storage-testnet-standard.0g.ai` |

### 5.3 Architecture Notes

- **EVM compatible** — standard Solidity/Foundry/Hardhat tooling works
- Modular separation of consensus and execution (tuned CometBFT)
- **Near-instant finality** for AI workload throughput

### 5.4 Getting Testnet Tokens

Faucet at <https://faucet.0g.ai> — send your wallet address to receive testnet OG for gas.

**Builder-level takeaway:** Deploy standard EVM contracts, anchor AI state to 0G Storage + Compute as the differentiator. The chain is commodity; the storage+compute integration is the prize-winning part.

---

## 6. OpenAgents Prize Tracks ($15,000 Total)

### Track 1: Agent Framework, Tooling, Core Extensions ($7,500)

**Framework-level work only.**

| What They Want | Examples |
|----------------|----------|
| Extensions/forks/new framework primitives | OpenClaw-style systems |
| Developer tooling | Architecture primitives |
| Things other builders can build on | Reusable modules, SDKs |

**Strong signals:**

- Hierarchical planning and reflection loop modules
- Multi-modal reasoning modules integrating 0G Compute
- Modular memory backends (0G Storage KV/Log style)
- Visual/no-code builder patterns with one-click deployment to 0G

### Track 2: Autonomous Agents, Swarms, and iNFT Innovations ($7,500)

**Agent-level product/system work.**

| What They Want | Examples |
|----------------|----------|
| Autonomous single agents | Self-directed decision loops |
| Multi-agent swarms | Coordinated agent teams |
| iNFT-native products | ERC-7857 |

**Strong signals:**

- Persistent memory on 0G Storage
- Verifiable/self-checking inference via 0G Compute
- Planner/researcher/critic/executor swarm patterns
- iNFT with embedded intelligence/memory proofs and monetization logic

### Submission Requirements (Both Tracks)

- Project description and deployment details
- Public repo with setup instructions
- Demo video and live demo
- Explicit explanation of protocol features used
- Team/contact info

**Extra for swarms:** Clearly explain communication/coordination model

**Extra for iNFT:** Link minted iNFT and prove embedded intelligence/memory

---

## 7. Integration Depth — What Judges Want

### Shallow (Won't Place)

- Only one generic inference call, no persistent memory design
- Claims of decentralization with no proofs/explorer links
- 0G used as optional add-on rather than core dependency

### Deep (Wins)

- **Compute is central** to runtime behavior (not decorative)
- **Storage is used for persistent graph/history**, not flat blob dump
- Execution flow **emits verifiable artifacts** (roots, txs, attestations, explorer links)
- Architecture **breaks without 0G services** (hard dependency)
- iNFT/identity evolution tied to **real state transitions** (Track 2)

---

## 8. Winning Patterns from Prior References

### Pattern 1: RAG Memory DAG over 0G Storage

- Each cycle writes rich record to storage
- Next cycle loads previous records
- Record stores parent references (`priorCids`)
- Memory evolves as a **graph**, not a flat timeline

### Pattern 2: Sealed/Verifiable Inference in Multi-Agent Debate Loops

- Specialized agents produce structured outputs
- Critic/risk/executor chain refines outcome
- Proof or attestation hash associated with inference path

### Pattern 3: Multi-Chain Split with 0G as "Brain"

- Money/settlement on one chain
- Truth/audit on another
- Reasoning + memory + identity anchored via 0G components

### Pattern 4: iNFT Identity That Evolves with Memory Root

- Token metadata points to latest memory root
- Each cycle updates root pointer
- Identity evolution becomes inspectable and auditable

### Pattern 5: Different Demos for Different Tracks

- **Track 1 demo:** Show other builders using your primitives
- **Track 2 demo:** Show autonomous behavior and long-running memory dynamics

---

## 9. Architecture Blueprints

### Blueprint A: Track 1 (Framework Tooling)

```
Builder UI / CLI
      |
      v
Framework Runtime
  - planner module
  - reflection module
  - tool router
  - memory adapter interface
      |
      +--> 0G Compute adapter (inference)
      +--> 0G Storage adapter (state/history)
      +--> optional chain adapter (settlement/proofs)
      |
      v
Example Agent Pack (reference implementation)
```

**Key winning signal:** Another developer can install your framework and ship an agent quickly.

### Blueprint B: Track 2 (Autonomous Swarm + iNFT)

```
Intent / Goal Ingress
      |
      v
Swarm Orchestrator
  planner -> researcher -> critic -> executor
      |
      +--> shared memory bus on 0G Storage
      +--> inference calls on 0G Compute
      +--> optional payment/execution rails
      |
      v
Result + Proof Layer
  - storage roots
  - tx hashes
  - iNFT metadata update
```

**Key winning signal:** Persistent autonomous loop with visible memory and identity evolution.

---

## 10. Implementation Guardrails

- **Build storage schema before writing agent logic** (cycles, summaries, references, provenance)
- Store **compact + rich records separately** (fast UI vs full forensic replay)
- Keep **deterministic fallbacks** for model uncertainty in critical actions
- Add **concurrency controls** for swarm fan-out (avoid burst-limit failures)
- Include **explorer links** in UI for every "proof-worthy" action

---

## 11. Anti-Patterns to Avoid

| Anti-Pattern | Why It Hurts |
|-------------|-------------|
| Calling compute once and claiming "AI-native stack" | Judges see through it immediately |
| Using centralized DB as primary memory, only mirroring to 0G at end | 0G must be the core storage, not a mirror |
| No explanation of agent coordination in swarm submissions | Required for swarm track |
| iNFT claim without actual onchain token, metadata, or memory linkage | Must have real minted iNFT with proofs |
| No runnable example agent for framework track | Track 1 explicitly requires reusable primitives |

---

## 12. Minimal Submission Checklist

- [ ] Architecture diagram with explicit 0G service boundaries
- [ ] End-to-end demo where 0G services are required for success
- [ ] Storage persistence and retrieval shown live
- [ ] Compute calls instrumented with cost/latency/error metrics
- [ ] Swarm coordination explanation (if swarm submission)
- [ ] Minted iNFT + proof of embedded intelligence/memory (if iNFT submission)
- [ ] Public repo with setup, demo script, and protocol usage notes

---

## 13. Environment Setup

### Environment Variables

```bash
PRIVATE_KEY=0x...                   # wallet private key
OG_EVM_RPC=https://evmrpc-testnet.0g.ai
OG_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
```

### Useful Commands

```bash
# Compute local UI
0g-compute-cli ui start-web

# Storage TS SDK install
npm install @0gfoundation/0g-ts-sdk ethers

# Compute TS SDK install
npm install @0glabs/0g-serving-broker ethers
```

### Starter Kits

| Language | Repository |
|----------|-----------|
| TypeScript | <https://github.com/0gfoundation/0g-storage-ts-starter-kit> |
| Go | <https://github.com/0gfoundation/0g-storage-go-starter-kit> |

### Support

| Channel | Link |
|---------|------|
| Builder Hub | <https://build.0g.ai> |
| Docs | <https://docs.0g.ai> |
| Telegram | <https://t.me/+mQmldXXVBGpkODU1> |

---

## 14. Sources

- <https://build.0g.ai>
- <https://docs.0g.ai>
- <https://docs.0g.ai/developer-hub/building-on-0g/compute-network/inference>
- <https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk>
- <https://docs.0g.ai/concepts/chain>
- OpenAgents source notes: tracks_and_prizes.md, winner_projects_0g.md, patterns.md
