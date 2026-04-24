# KeeperHub — Structured Reference Guide

> [!NOTE]
> Distilled from [keeperhub_deep_dive.md](file:///home/hyprayush/Documents/Projects/openagents/references/keeperhub_deep_dive.md). Purpose-built for quick lookups during implementation.

---

## 1. KeeperHub Overview

**What:** The **reliable execution layer for onchain agents**. Your agent decides; KeeperHub guarantees the transaction actually lands on-chain.

**Core thesis:** The gap in most agent stacks isn't reasoning, communication, or wallets — it's that **network congestion kills your agent** (gas spikes, stuck txns, silent failures). KeeperHub replaces that fragile layer.

**Team:** Ex-MakerDAO / Sky Protocol DevOps engineers. 7 years running production keepers — before "agent infrastructure" was even a category. Globally distributed (covers all time zones during hackathon).

**Trusted by:** Sky (formerly MakerDAO), Ajna

### Key Links

| Resource | URL |
|----------|-----|
| Platform | <https://app.keeperhub.com> |
| MCP Docs | <https://docs.keeperhub.com/ai-tools> |
| API Docs | <https://docs.keeperhub.com/api> |
| CLI Docs | <https://docs.keeperhub.com/cli> |
| Blog / OpenAgents Announcement | <https://keeperhub.com/blog/008-first-hackathon-openagents> |
| Link Tree | <https://keeperhub.com/links> |

---

## 2. What KeeperHub Handles

| Capability | Description |
|------------|-------------|
| **Reliable tx submission** | Retries, nonce management, RPC failover |
| **Workflow orchestration** | Conditional logic, cron scheduling, step chaining |
| **Non-custodial key mgmt** | Turnkey secure enclaves — keys never touch KeeperHub servers |
| **MCP server** | Any Claude/MCP-compatible agent discovers and calls it natively |
| **x402 + MPP payments** | Agents pay per execution; publish workflows that earn |
| **Gas optimization** | ~30% savings via network-average pricing |
| **Audit trail** | Every attempt, every revert reason, every gas price — logged |
| **Transaction simulation** | Pre-simulate before submission |

---

## 3. Where KeeperHub Fits in the Agent Stack

```
┌─────────────────────────────────────────────────┐
│  Agent Frameworks (reasoning layer)              │
│  LangChain / ElizaOS / OpenClaw / CrewAI         │
├─────────────────────────────────────────────────┤
│  Communication                                   │
│  MCP (Anthropic) / A2A (Google)                  │
├─────────────────────────────────────────────────┤
│  Identity & Wallets                              │
│  ERC-8004 / x402 / MPP                           │
├─────────────────────────────────────────────────┤
│  ★ Reliable Execution Layer ← KEEPERHUB ★        │
│  Retries, gas, simulation, SLAs, audit trail     │
├─────────────────────────────────────────────────┤
│  Onchain Settlement                              │
│  12 EVM Chains + 20+ DeFi Protocols              │
└─────────────────────────────────────────────────┘
```

---

## 4. Core Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Your Agent                        │
│   (ElizaOS / LangChain / OpenClaw / custom)         │
└────────────────────┬────────────────────────────────┘
                     │  MCP tools  OR  REST API  OR  CLI
                     ▼
┌─────────────────────────────────────────────────────┐
│                  KeeperHub                          │
│                                                     │
│  Workflow Engine   →  Execution Engine              │
│  - cron triggers       - exponential backoff        │
│  - conditional logic   - nonce management           │
│  - step chaining       - multi-RPC failover         │
│                        - gas optimization (~30%)    │
│                                                     │
│  Wallet Layer (Turnkey)                             │
│  - keys in secure enclaves                          │
│  - never touches KeeperHub servers                  │
│                                                     │
│  Payment Layer                                      │
│  - x402 (pay-per-call from agents)                  │
│  - MPP (Machine Payments Protocol)                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ▼
        12 EVM Chains  +  20+ DeFi Protocols
```

### Two Types of Interactions

| Type | Description | Use Case |
|------|-------------|----------|
| **Direct Execution** | Agent calls `execute_protocol_action` or `execute_contract_call` — KeeperHub lands the tx (retries, gas, sim handled) | Reactive flows |
| **Workflows** | Agent calls `create_workflow` or `ai_generate_workflow` with trigger conditions + actions — KeeperHub runs it continuously | Recurring strategies, monitoring, runs when agent is asleep |

---

## 5. Workflow Model (Core Concept)

Everything in KeeperHub is a **workflow**. A workflow has:

1. A **trigger** — when to run (cron schedule, webhook, onchain event, or manual)
2. **Steps** — sequential actions with optional conditional logic
3. A **wallet** — the Turnkey-managed key that signs transactions

### Workflow Primitives

| Category | Examples |
|----------|----------|
| **Triggers** | Cron schedule, webhook, onchain events |
| **Condition nodes** | Check APY, vault utilization, gas price, balance thresholds |
| **Action nodes** | ERC-20 transfers, protocol-specific calls (Aave, Spark, etc.), `execute_contract_call` for arbitrary contracts |
| **Notification nodes** | Discord, webhook callbacks |

### Workflow Definition Example (MCP)

```javascript
await keeperhub.create_workflow({
  name: "Spark auto-compound",
  trigger: "cron: */5 * * * *", // every 5 minutes
  steps: [
    { action: "spark.check_rewards" },
    { action: "spark.claim_rewards", if: "rewards.usd > 50" },
    { action: "spark.supply" },
  ],
});
```

### Two Usage Patterns

| Pattern | Description |
|---------|-------------|
| **Agent calls workflows** | Agent uses MCP/REST to trigger pre-built workflows |
| **Publish and earn** | Build a workflow, publish it, other agents pay per execution via x402/MPP |

---

## 6. Supported Chains (12 EVM)

| Chain | Notes |
|-------|-------|
| Ethereum Mainnet | Primary DeFi protocols |
| Base | Coinbase L2, growing DeFi |
| Arbitrum | Largest L2 TVL |
| Optimism | OP Stack |
| Polygon | Mature ecosystem |
| BNB Chain | High volume |
| Avalanche | C-Chain |
| + 5 more | See platform for full list |

> [!IMPORTANT]
> **Cross-chain workflow execution is a judging differentiator.** Show the same workflow running across multiple chains.

---

## 7. Supported DeFi Protocols (20+)

| Protocol | Category |
|----------|----------|
| Aave | Lending/borrowing |
| Spark | MakerDAO lending arm |
| Lido | Liquid staking (stETH) |
| Morpho | Lending optimization |
| Pendle | Yield tokenization |
| Compound | Lending |
| Yearn | Yield vaults |
| Curve | Stable AMM |
| Uniswap | AMM swap/LP |
| CowSwap | Intent-based swap |
| Safe | Multisig |
| Ajna | Permissionless lending |
| + 10 more | Full list at app.keeperhub.com |

> [!TIP]
> Sky (formerly MakerDAO) is a trust partner — **Spark protocol automation** is well-tested and the safest integration target for demos.

---

## 8. MCP Integration (Primary Agent Interface)

KeeperHub exposes an MCP server. Any Claude Code, Cursor, or agent runtime that supports MCP can discover and call KeeperHub workflows natively.

### Connection Setup

```json
{
  "mcpServers": {
    "keeperhub": {
      "url": "https://mcp.keeperhub.com",
      "headers": {
        "Authorization": "Bearer YOUR_API_KEY"
      }
    }
  }
}
```

### Core MCP Tools

| Tool | What It Does |
|------|-------------|
| `keeperhub.list_workflows` | List all your published workflows |
| `keeperhub.create_workflow` | Define a new workflow with triggers + steps |
| `keeperhub.run_workflow` | Execute a workflow immediately (manual trigger) |
| `keeperhub.get_workflow_status` | Check execution status and logs |
| `keeperhub.list_protocols` | List available DeFi protocol integrations |
| `keeperhub.get_execution_logs` | Retrieve past execution logs with tx hashes |
| `keeperhub.get_wallet_balance` | Check agent wallet balance |
| `keeperhub.publish_workflow` | Publish workflow to marketplace (earns per call) |

---

## 9. REST API

All MCP tools are available as REST endpoints for non-MCP runtimes.

### Authentication

```
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

Get API key from: <https://app.keeperhub.com/settings>

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/v1/workflows` | Create workflow |
| `GET` | `/api/v1/workflows` | List workflows |
| `GET` | `/api/v1/workflows/:id` | Get specific workflow |
| `POST` | `/api/v1/workflows/:id/run` | Run workflow manually |
| `GET` | `/api/v1/workflows/:id/executions` | List executions |
| `GET` | `/api/v1/executions/:id/logs` | Get execution logs |
| `GET` | `/api/v1/wallet/balance` | Check wallet balance |
| `POST` | `/api/v1/workflows/:id/publish` | Publish to marketplace |

### Create Workflow (REST)

```bash
curl -X POST https://api.keeperhub.com/api/v1/workflows \
  -H "Authorization: Bearer $KEEPERHUB_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Aave yield monitor",
    "trigger": { "type": "cron", "schedule": "0 * * * *" },
    "steps": [
      { "action": "aave.get_borrow_rate", "params": { "asset": "USDC", "chain": "mainnet" } },
      { "action": "keeperhub.notify", "if": "borrow_rate > 0.08" }
    ]
  }'
```

### Trigger Workflow Manually (REST)

```bash
curl -X POST https://api.keeperhub.com/api/v1/workflows/wf_abc123/run \
  -H "Authorization: Bearer $KEEPERHUB_API_KEY"
```

---

## 10. CLI Reference

```bash
# Install
npm install -g @keeperhub/cli

# Auth
keeperhub auth login

# Workflow management
keeperhub workflow list
keeperhub workflow create ./workflow.json
keeperhub workflow run <workflow-id>
keeperhub workflow logs <workflow-id>

# Wallet
keeperhub wallet balance
keeperhub wallet address

# Protocol exploration
keeperhub protocols list
keeperhub protocols actions <protocol-name>
```

---

## 11. Wallet & Key Management (Turnkey)

Every KeeperHub account gets a **non-custodial wallet secured by Turnkey**.

| Property | Detail |
|----------|--------|
| Key storage | **Turnkey's secure enclaves** — never on KeeperHub servers |
| Autonomy | Workflows sign transactions **autonomously and unattended** |
| Funding | Fund with USDC/ETH to pay gas |
| Scope | One wallet per KeeperHub org |

### Security Model

```
Your Agent  →  KeeperHub Workflow Engine  →  Turnkey Enclave
                                              (signs tx here)
                                              ↓
                                          Onchain submission
```

> [!IMPORTANT]
> No private key ever leaves the Turnkey enclave. Even KeeperHub's own servers cannot extract it.

### Testing Tip

If your agent needs a wallet for testing, use **AgentC** to give your agent a wallet quickly. Testing purposes only.

---

## 12. Payment Model: x402 + MPP

### Agents Paying KeeperHub (x402)

Published workflows can require payment per execution:

- **x402**: HTTP 402 Payment Required headers — agent wallet auto-pays in USDC on Base
- **MPP**: Machine Payments Protocol (Stripe/Stellar) — fiat + on-chain path

```typescript
import { wrapFetchWithPayment } from "@x402/fetch";
const fetch402 = wrapFetchWithPayment(fetch, wallet);

// Automatically handles 402 challenges
const result = await fetch402(
  "https://api.keeperhub.com/api/v1/workflows/wf_xyz/run",
);
```

### Publishing Workflows to Earn

```javascript
await keeperhub.publish_workflow({
  workflow_id: "wf_abc123",
  price_per_execution: "$0.01", // paid in USDC via x402
  payment_network: "base",
});
```

Other agents call your workflow and pay per execution = **agent marketplace pattern**.

---

## 13. Execution Reliability Details

| Problem | KeeperHub's Solution |
|---------|---------------------|
| RPC node down | Multi-RPC failover across 3+ nodes |
| Transaction reverts | Exponential backoff + retry with fresh quote |
| Nonce collision | Centralized nonce management per wallet |
| Gas price spikes | Price off network averages (~30% savings baseline) |
| Stuck transactions | Speed-up and replacement tx logic |

> [!TIP]
> **Why this matters for hackathon:** Judges want working live demos. Without this layer, onchain demos fail unpredictably under load. KeeperHub is the reliability layer that makes demos not die.

---

## 14. The Hub — Workflow Library & Marketplace

### Hub (Public Library)

- Users can **share workflows publicly** as templates
- Other users can **copy templates** into their private environment
- Browse and search existing templates for inspiration

### Marketplace (Paid Strategies)

- Authors can **publish workflows as strategies** with a price
- Steps remain **private** (no one can copy the strategy)
- Other agents **discover and pay to run** the strategy
- Earnings tracked in the KeeperHub earnings window

> [!IMPORTANT]
> **Key distinction:** Hub = free sharing. Marketplace = monetized strategies. KeeperHub is the execution layer for both.

---

## 15. OpenAgents Prize Track

### Prize Structure

| Place | Prize |
|-------|-------|
| 1st | $2,500 |
| 2nd | $1,500 |
| 3rd | $1,000 |
| **Feedback bounty** | **$500** (separate — paid for quality platform feedback) |
| **Total** | **$5,500** |

### Judging Criteria (in priority order)

1. **Does it work?** — Working demo with real onchain transactions. Not a mock.
2. **Would someone actually use it?** — Practical utility. Solves a real DeFi problem an agent faces.
3. **"Mergeable quality"** — Clean code, clear docs. They explicitly want to integrate winning projects into their codebase.
4. **Agent framework integration** — Show integration with ElizaOS, OpenClaw, LangChain, or CrewAI (not just bare REST calls).

### What They Explicitly Want

> [!CAUTION]
> They are **not** looking for agents that use KeeperHub as a black box. They want **contributions to KeeperHub itself** — things they can merge, adopt, or ship to every KeeperHub user.

### Three Contribution Directions

| Direction | Description |
|-----------|-------------|
| **New Protocol/Chain Integration** | Build plugins or workflow nodes for protocols not yet first-class (lending markets, perp venues, liquid staking, bridges, restaking primitives) |
| **Framework Integration Wrappers** | Clean tool wrappers for ElizaOS, OpenClaw, LangChain, CrewAI → access KeeperHub natively without glue code |
| **New Features / Dev Tooling** | New workflow nodes, better simulation/debugging, observability, testing harnesses, MCP server improvements, onboarding UX |

### Bonus Contribution Idea

Wire published strategies to the broader agent economy:

- Wrap a published workflow in **ERC-8004** registration
- Expose via **x402 / MPP** payment rail
- Post **reputation back on-chain** after each run
- Result: KeeperHub becomes an evidence layer; agent can be called from anywhere

### Hard Requirements

- [ ] Working demo with real onchain tx hashes
- [ ] Agent framework integration (not bare REST)
- [ ] Clean code + documentation
- [ ] Feedback on platform included (to qualify for $500 feedback bounty)

---

## 16. Integration Depth — What Judges Want

### Shallow (Won't Place)

- One hardcoded workflow call in the demo
- No conditional logic in workflows
- REST-only, no MCP integration
- Single chain, single protocol

### Deep (Competitive)

- Agent **dynamically creates and updates workflows** based on market conditions
- Multi-step **conditional workflows across multiple protocols**
- Full **MCP integration** (agent discovers and calls KeeperHub natively)
- **Cross-chain execution** across 2+ chains
- **Workflow marketplace** — agent publishes workflows, others pay via x402
- **On-chain proof links** for every execution

---

## 17. Build Patterns for OpenAgents

### Pattern A: Autonomous DeFi Rebalancer

```
Market Signal Agent (Uniswap price oracle + sentiment)
    ↓
Decision Agent (should I rebalance?)
    ↓
KeeperHub Workflow (guaranteed execution)
    - check_slippage → quote_route → swap if acceptable
    - retry with backoff if slippage too high
    ↓
Accounting Agent (log tx hash, P&L, 0G Storage)
```

### Pattern B: Yield Optimizer with Keeper Automation

```
Yield Scout Agent (scan Aave, Spark, Morpho APYs via KeeperHub MCP)
    ↓
Allocator Agent (decide optimal allocation)
    ↓
KeeperHub Workflows (parallel execution across chains):
    - Ethereum: Aave supply/withdraw
    - Base: Spark supply
    - Arbitrum: Morpho deposit
    ↓
Monitor Agent (KeeperHub execution logs → alert if any step fails)
```

### Pattern C: Workflow Marketplace Agent

```
Builder Agent (reads market, designs optimal workflow)
    ↓
KeeperHub: publishes workflow with x402 price ($0.005/run)
    ↓
Consumer Agents (pay per execution via x402)
    ↓
Revenue flows back to builder agent's wallet
```

> [!TIP]
> This is the "agents that **earn AND spend**" pattern applied to KeeperHub.

---

## 18. Integration with Other Tracks

KeeperHub is naturally combinable:

| Combination | Target Prize Ceiling |
|-------------|---------------------|
| KeeperHub + Uniswap (swap execution) | ~$7,500 |
| KeeperHub + 0G (verified execution + stored logs) | ~$10K |
| KeeperHub + AXL (agents discover workflows P2P) | ~$9,500 |
| All four sponsors | ~$15K+ (high complexity) |

> [!TIP]
> The **AgentMesh** fusion (AXL + KeeperHub + Uniswap) has the highest upside at ~$14.5K.

---

## 19. Anti-Patterns to Avoid

| Anti-Pattern | Why It Hurts |
|-------------|-------------|
| Manual workflow triggering only | Judges want autonomous, scheduled execution |
| Single chain, single protocol | Signals lack of ambition |
| No conditional logic | A workflow with no branching is just a cron job |
| Skipping MCP integration | REST-only misses the "agent framework integration" criterion |
| No revenue loop | Not showing agents earning from KeeperHub = leaving points on the table |

---

## 20. Minimal Checklist

- [ ] KeeperHub MCP server wired into your agent framework
- [ ] At least one cron-triggered workflow running autonomously
- [ ] At least one conditional step (not just "always execute")
- [ ] Cross-chain execution on 2+ chains
- [ ] Real tx hashes in your demo (testnet OK)
- [ ] Workflow published with x402 pricing (earn pattern)
- [ ] Feedback doc submitted for $500 bounty

---

## 21. Environment Variables

```bash
KEEPERHUB_API_KEY=kh_live_xxxx          # from app.keeperhub.com/settings
KEEPERHUB_WALLET_ADDRESS=0x...          # auto-provisioned Turnkey wallet
KEEPERHUB_API_BASE=https://api.keeperhub.com
KEEPERHUB_MCP_URL=https://mcp.keeperhub.com
```

---

## 22. Luca's Workshop Takeaways (Video Transcript Summary)

Key points from KeeperHub's head of growth (Luca):

1. **KeeperHub = marketplace for onchain strategies** — Hub for free sharing, Marketplace for paid strategies
2. **The "pluggable" surface:** Protocols not yet first-class = plugin opportunity. Frameworks without clean integration = wrapper opportunity. Missing dev primitives = contribution opportunity.
3. **"Workflow" means KeeperHub's artifact, not your hackathon project.** You hand integrations/features; KeeperHub runs the workflows.
4. **40 seconds from intent to live workflow** — via MCP + Claude, natural language → working cron workflow with condition nodes
5. **They want contributions, not black-box usage** — things they can merge, adopt, or ship to all users post-hackathon
6. **First hackathon ever** — they're extra motivated and available 24/7 across all time zones

---

## 23. Sources

- <https://keeperhub.com>
- <https://keeperhub.com/blog/008-first-hackathon-openagents>
- <https://docs.keeperhub.com/ai-tools>
- <https://docs.keeperhub.com/api>
- <https://docs.keeperhub.com/cli>
- <https://app.keeperhub.com>
- OpenAgents source notes: tracks_and_prizes.md, problem_statements.md
