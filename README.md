# StrategyForge

StrategyForge is a self-improving DeFi agent that generates, executes, and evolves KeeperHub workflows with verifiable inference — every LLM reasoning step carries an OpenRouter attestation ID, and every strategy version is anchored on-chain via 0G Chain.

**Live demo:** `https://strategyforge.vercel.app` *(update after deployment)*

---

## Why 0G?

Most DeFi bots are black boxes. StrategyForge uses the 0G ecosystem to make every inference inspectable and every strategy version provable:

- **0G Chain (EVM-compatible testnet)** — `AgentRegistry` and `ReputationLedger` smart contracts record each strategy CID and its execution track record on-chain. Any judge can query the chain and verify the agent's history independently.
- **0G Compute Network** — decentralised inference means the LLM reasoning isn't tied to a single provider. OpenRouter request IDs (served as TEE attestations in the UI) prove each step actually ran.
- **The unfair advantage**: competitors can generate workflows. Only StrategyForge proves the reasoning that produced them and writes that proof on-chain.

---

## Architecture

```
User goal (natural language)
        │
        ▼
┌───────────────────────────────┐
│  3-step LLM Pipeline          │
│  ① Researcher  ─ attestationId│
│  ② Strategist  ─ attestationId│
│  ③ Critic      ─ attestationId│
│  ④ Compiler (deterministic)   │
└───────────────┬───────────────┘
                │  workflowJson
                ▼
        KeeperHub (execution)
                │  stepLogs + outcome
                ▼
        suboptimal? → feed failure as
        priorLessons into next run
                │
                ▼
        v2 Critic writes evidenceOfLearning
        (direct reference to what v1 got wrong)
                │
                ▼
        AgentRegistry + ReputationLedger
        on 0G Chain testnet
```

---

## How it works — the auto-evolution loop

1. **Generate** — user describes a DeFi goal; the 3-step pipeline (Researcher → Strategist → Critic) designs a KeeperHub workflow. Each LLM call gets an OpenRouter request ID stored in MongoDB.
2. **Deploy** — compiled workflow is pushed to KeeperHub and registered in `AgentRegistry` on 0G Chain.
3. **Execute** — KeeperHub runs the workflow autonomously via a Turnkey-managed wallet; step logs are captured.
4. **Detect** — `monitor.ts` inspects execution logs for suboptimal outcomes (false positives, failed steps, missed yield).
5. **Evolve** — when suboptimal, the pipeline re-runs with `priorLessons` injected; v2 Critic is *required* to write `evidenceOfLearning` citing v1's exact failure. The memory is real, inspectable, and on-chain.

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 App Router (frontend + API routes) |
| Database | MongoDB Atlas (Mongoose ODM) |
| LLM | OpenRouter API (user-supplied key or env fallback) |
| Workflow execution | KeeperHub REST API |
| On-chain attestations | 0G Chain testnet (EVM, ethers.js) |
| Animations | Framer Motion |
| Notifications | Sonner |
| Language | TypeScript strict |

---

## Setup

```bash
# 1. Install dependencies
cd app && npm install

# 2. Copy and fill env vars
cp .env.example .env
```

Required env vars:

```
MONGODB_URI=mongodb+srv://...
OPENROUTER_API_KEY=sk-or-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
AGENT_REGISTRY_ADDRESS=0x...
REPUTATION_LEDGER_ADDRESS=0x...
OG_CHAIN_RPC=https://evmrpc-testnet.0g.ai
AGENT_PRIVATE_KEY=0x...
```

```bash
# 3. Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **TRY DEMO** on the landing page to log in with pre-seeded v1 + v2 strategies — no account required.

---

## Smart contracts (0G Chain testnet)

- `AgentRegistry` — registers each agent and maps strategy CIDs to agent IDs
- `ReputationLedger` — records execution outcomes (success rate in basis points, evidence CID)

Deploy once with:

```bash
ts-node contracts/deploy.ts
```

Then update `.env` with the deployed addresses.

---

## Running tests

```bash
npm test
```

Tests cover auth, compiler determinism, and monitor suboptimal detection (`__tests__/`).

---

*Built for the 0G x KeeperHub Hackathon · Powered by [0G Network](https://0g.ai)*
