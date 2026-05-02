@AGENTS.md

# CLAUDE.md — StrategyForge Pivot

## What This Project Is

StrategyForge is a self-learning DeFi automation agent that generates, deploys, and improves KeeperHub workflows using LLM reasoning. It is the trust layer for KeeperHub's strategy marketplace.

**Core loop:**

1. User describes their DeFi goal in natural language
2. Agent runs a 3-step LLM pipeline (Researcher → Strategist → Critic) to design a KeeperHub workflow
3. Workflow is deployed to KeeperHub and executes autonomously
4. Agent monitors execution results
5. If suboptimal results detected, agent generates v2 that explicitly references v1's failures
6. The learning is provable: v2's reasoning document contains a direct reference to what v1 got wrong

**What makes this different from a template generator:**

- The agent reads ALL available KeeperHub action types at runtime (list_action_schemas) — it reasons over the full action universe, not hardcoded templates
- Three independent LLM calls with TEE-style attestation hashes stored in MongoDB
- v2 explicitly cites v1's failure evidence. The "memory" is real and inspectable.
- AgentRegistry + ReputationLedger contracts on 0G Chain prove the agent's identity and track record on-chain

---

## Tech Stack

- **Framework:** Next.js 14 App Router (frontend + API routes in one repo)
- **Database:** MongoDB Atlas (free tier) via Mongoose
- **LLM:** OpenRouter API (user provides key OR use env var for demo)
- **Execution:** KeeperHub REST API (user provides their API key)
- **Contracts:** Two Solidity contracts on 0G Chain testnet (AgentRegistry + ReputationLedger)
- **Styling:** Tailwind CSS + shadcn/ui
- **Language:** TypeScript strict

**What is NOT in this project:**

- No 0G Compute SDK
- No 0G Storage SDK  
- No AXL/Gensyn
- No complex wallet infrastructure
- No Hardhat beyond contract deployment scripts

---

## Environment Variables

```
MONGODB_URI=mongodb+srv://...
OPENROUTER_API_KEY=sk-or-...          # fallback for demo, user can override
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 0G Chain contract addresses (deployed once, hardcoded after)
AGENT_REGISTRY_ADDRESS=0x...
REPUTATION_LEDGER_ADDRESS=0x...
OG_CHAIN_RPC=https://evmrpc-testnet.0g.ai
AGENT_PRIVATE_KEY=0x...               # for writing to contracts (agent operator wallet)
```

User-provided (stored in MongoDB, never in env):

```
keeperhubApiKey     # from app.keeperhub.com/settings
openrouterApiKey    # optional override
walletAddress       # their Sepolia wallet for Aave reads
discordWebhookUrl   # for alert notifications (optional)
```

---

## MongoDB Schema

### Collection: `users`

```typescript
{
  _id: ObjectId,
  keeperhubApiKey: string,        // encrypted at rest
  openrouterApiKey: string,       // optional override
  walletAddress: string,          // Sepolia address
  discordWebhookUrl: string,      // optional
  createdAt: Date
}
```

### Collection: `strategies`

```typescript
{
  _id: ObjectId,
  userId: ObjectId,
  familyId: string,               // e.g. "aave-health-guardian" — same across versions
  version: number,                // 1, 2, 3...
  lifecycle: "draft" | "live" | "deprecated",
  goal: string,                   // user's original natural language goal
  
  // Pipeline evidence (the "memory")
  evidenceBundle: {
    step1_researcher: {
      input: object,              // what data was fed in
      output: object,             // market state, signals, priorLessons
      attestationId: string,      // OpenRouter request ID (proof LLM ran)
      timestamp: Date
    },
    step2_strategist: {
      input: object,
      output: {
        candidates: Candidate[],  // 2-3 candidate workflow designs
        reasoning: string
      },
      attestationId: string,
      timestamp: Date
    },
    step3_critic: {
      input: object,
      output: {
        selected: string,         // candidate ID
        rationale: string,
        priorLessonsApplied: string[], // explicit references to v(n-1) failures
        evidenceOfLearning: string    // "v1 fired false alerts at 1.5 because..."
      },
      attestationId: string,
      timestamp: Date
    }
  },
  
  priorVersionId: ObjectId | null,  // null for v1, points to v(n-1) for later versions
  keeperhubWorkflowId: string,      // KH workflow ID after deployment
  workflowJson: object,             // the exact JSON sent to KeeperHub
  
  // On-chain anchors
  agentRegistryCid: string,         // MongoDB _id used as "CID" in AgentRegistry
  reputationLedgerTxHash: string,   // tx hash of ReputationLedger.record() call
  
  createdAt: Date,
  deployedAt: Date | null
}
```

### Collection: `executions`

```typescript
{
  _id: ObjectId,
  strategyId: ObjectId,
  keeperhubExecutionId: string,
  status: "running" | "success" | "failed" | "partial",
  
  stepLogs: {
    stepId: string,
    actionType: string,
    status: "success" | "failed" | "skipped",
    output: object,
    txHash: string | null,
    error: string | null
  }[],
  
  // Outcome analysis (what the monitoring cron reads)
  outcome: {
    suboptimal: boolean,
    suboptimalReason: string | null,  // "Alert fired but health factor was 1.6 (false positive)"
    metrics: object                   // protocol-specific — healthFactor, yield, etc.
  },
  
  createdAt: Date,
  completedAt: Date | null
}
```

---

## Project Structure

```
strategyforge/
├── app/
│   ├── page.tsx                    # Landing / connect page
│   ├── dashboard/
│   │   └── page.tsx                # Main dashboard
│   ├── strategy/
│   │   ├── [id]/page.tsx           # Strategy detail + evidence bundle viewer
│   │   └── new/page.tsx            # Goal input + pipeline runner
│   └── api/
│       ├── user/
│       │   ├── connect/route.ts    # POST — save KH API key + wallet
│       │   └── me/route.ts         # GET — current user
│       ├── strategy/
│       │   ├── generate/route.ts   # POST — run 3-step pipeline
│       │   ├── deploy/route.ts     # POST — create KH workflow
│       │   ├── execute/route.ts    # POST — trigger workflow execution
│       │   ├── update/route.ts     # POST — detect suboptimal, generate v2
│       │   ├── [id]/route.ts       # GET — strategy detail
│       │   └── list/route.ts       # GET — all strategies for user
│       └── keeperhub/
│           ├── schemas/route.ts    # GET — proxy list_action_schemas
│           └── status/route.ts     # GET — check KH connection
├── lib/
│   ├── keeperhub.ts                # KeeperHub REST client
│   ├── openrouter.ts               # OpenRouter client
│   ├── pipeline/
│   │   ├── researcher.ts           # Step 1 LLM call
│   │   ├── strategist.ts           # Step 2 LLM call
│   │   ├── critic.ts               # Step 3 LLM call
│   │   └── compiler.ts             # Deterministic: JSON → KH workflow format
│   ├── contracts/
│   │   ├── agent-registry.ts       # Write to AgentRegistry on 0G Chain
│   │   └── reputation-ledger.ts    # Write to ReputationLedger on 0G Chain
│   ├── monitor.ts                  # Suboptimal detection logic
│   └── db/
│       ├── mongoose.ts             # Connection
│       ├── user.model.ts
│       ├── strategy.model.ts
│       └── execution.model.ts
├── components/
│   ├── PipelineRunner.tsx          # Live streaming 3-step pipeline UI
│   ├── StrategyCard.tsx            # Strategy version card
│   ├── EvidenceBundle.tsx          # Collapsible evidence viewer
│   ├── WorkflowJson.tsx            # Formatted workflow JSON display
│   └── VersionDiff.tsx             # v1 → v2 learning diff viewer
├── contracts/
│   ├── AgentRegistry.sol
│   ├── ReputationLedger.sol
│   └── deploy.ts                   # One-time deployment script
└── scripts/
    └── seed-demo.ts                # Pre-seed v1+v2 for demo recording
```

---

## KeeperHub Client (`lib/keeperhub.ts`)

```typescript
// All KeeperHub REST calls go through this client
// User's API key is passed per-request, never stored in env

export class KeeperHubClient {
  constructor(private apiKey: string) {}
  
  private async request(method: string, path: string, body?: object) {
    const res = await fetch(`https://api.keeperhub.com${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw new Error(`KeeperHub ${method} ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }
  
  async listActionSchemas() {
    return this.request('GET', '/api/mcp/schemas');
  }
  
  async createWorkflow(workflow: object) {
    return this.request('POST', '/api/workflows/create', workflow);
  }
  
  async executeWorkflow(workflowId: string) {
    // Note: singular /workflow/ not /workflows/
    return this.request('POST', `/api/workflow/${workflowId}/execute`, {});
  }
  
  async getExecutionStatus(executionId: string) {
    return this.request('GET', `/api/workflows/executions/${executionId}/status`);
  }
  
  async getExecutionLogs(executionId: string) {
    return this.request('GET', `/api/workflows/executions/${executionId}/logs`);
  }
  
  async listWorkflows() {
    return this.request('GET', '/api/workflows');
  }
  
  async getAnalyticsSummary(range = '7d') {
    return this.request('GET', `/api/analytics/summary?range=${range}`);
  }
  
  async getExecutionRuns(params: { status?: string; range?: string } = {}) {
    const q = new URLSearchParams(params as Record<string,string>).toString();
    return this.request('GET', `/api/analytics/runs?${q}`);
  }
  
  async validatePluginConfig(actionType: string, config: object) {
    return this.request('POST', '/api/mcp/validate', { actionType, config });
  }
}
```

---

## OpenRouter Client (`lib/openrouter.ts`)

```typescript
export async function llmCall(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
  model: string
): Promise<{ content: string; requestId: string }> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://strategyforge.dev',
      'X-Title': 'StrategyForge'
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' }  // force JSON output
    })
  });
  
  const data = await res.json();
  const requestId = res.headers.get('x-request-id') ?? data.id ?? 'unknown';
  const content = data.choices[0].message.content;
  
  return { content, requestId };
}
```

---

## The Pipeline

### Step 1: Researcher (`lib/pipeline/researcher.ts`)

**System prompt:**

```
You are a DeFi research agent. Analyze the user's goal and current market conditions.
Return JSON only. No explanation outside the JSON.

You have access to these data inputs:
- User's goal (natural language)
- Current market data (APYs from DefiLlama)
- User's wallet state (from KeeperHub or on-chain)
- Prior version failures (if this is v2+)

Return this exact JSON structure:
{
  "goalClassification": "yield_optimization" | "risk_monitoring" | "savings_automation" | "rebalancing",
  "relevantProtocols": string[],     // protocol names from KH action schemas relevant to this goal
  "currentState": object,            // market snapshot relevant to goal
  "signals": { "subject": string, "signal": string, "severity": "low"|"medium"|"high" }[],
  "priorLessons": string[],          // empty for v1, populated from prior execution failures for v2+
  "recommendation": string           // one sentence: what the strategist should focus on
}
```

**Inputs to pass:**

- User goal
- DefiLlama APY data for relevant protocols (fetch from `https://yields.llama.fi/pools`)
- Available KH action types (filtered by relevance)
- Prior execution failures from MongoDB (empty for v1)

### Step 2: Strategist (`lib/pipeline/strategist.ts`)

**System prompt:**

```
You are a DeFi strategy designer. Design 2 candidate KeeperHub workflows for the user's goal.
Return JSON only.

You must use ONLY these KeeperHub action types (provided in the user message).
Each workflow must be a valid KeeperHub nodes+edges DAG.

Workflow node format:
{
  "id": "unique-id",
  "type": "action",  // always "action" for non-trigger nodes
  "data": {
    "type": "<actionType from schemas>",  // e.g. "aave-v3/get-user-account-data"
    "label": "Human readable label",
    "config": { ...required fields from schema },
    "status": "idle"
  },
  "position": { "x": 120, "y": 240 }  // increment y by 160 per node
}

Trigger node format:
{
  "id": "trigger",
  "type": "trigger",
  "data": {
    "type": "trigger",
    "label": "Schedule Trigger",
    "config": { "triggerType": "Schedule", "scheduleCron": "*/5 * * * *" },
    "status": "idle"
  },
  "position": { "x": 120, "y": 80 }
}

Edge format:
{ "id": "source->target", "source": "source-id", "target": "target-id" }
Condition edges need: "sourceHandle": "true" or "sourceHandle": "false"

Return:
{
  "candidates": [
    {
      "id": "A",
      "name": "Strategy name",
      "description": "What it does",
      "hypothesis": "Why this approach",
      "workflow": { "name": "...", "nodes": [...], "edges": [...] }
    },
    {
      "id": "B", 
      ...same structure...
    }
  ]
}
```

**Inputs to pass:**

- Researcher output
- Available KH action types (full list from list_action_schemas, filtered to relevant ones)
- User's wallet address (for config fields that need onBehalfOf)
- Prior version workflow (for v2+ so strategist sees what changed)

### Step 3: Critic (`lib/pipeline/critic.ts`)

**System prompt:**

```
You are an adversarial DeFi strategy critic. Attack both candidates and select the better one.
Return JSON only.

If this is v2+, you MUST reference prior version failures explicitly in your rationale.
The "evidenceOfLearning" field must contain a direct quote explaining what v1 got wrong
and how this version fixes it. This field cannot be empty for v2+.

Return:
{
  "selected": "A" | "B",
  "rationale": "Why selected candidate is better",
  "attacksOnRejected": "What is wrong with the other candidate",
  "priorLessonsApplied": string[],   // empty for v1
  "evidenceOfLearning": string,      // empty for v1, REQUIRED for v2+
  "riskWarnings": string[]           // any concerns about the selected candidate
}
```

**Inputs to pass:**

- Both candidates from Strategist
- Prior version critic output (what was selected and why, for v2+)
- Prior execution failures (the suboptimalReason from executions collection)

---

## Compiler (`lib/pipeline/compiler.ts`)

Takes the Critic's selected candidate (already a valid KH workflow JSON from the Strategist) and:

1. Validates required fields are populated
2. Replaces placeholder values (USER_WALLET → actual address)
3. Adds position coordinates if missing
4. Returns the final workflow JSON ready for KeeperHub

This step is DETERMINISTIC — no LLM. Just validation and substitution.

```typescript
export function compileWorkflow(
  selectedCandidate: Candidate,
  userWallet: string,
  chainId: string = '11155111'  // Sepolia default
): KeeperHubWorkflow {
  const workflow = selectedCandidate.workflow;
  
  // Replace placeholders
  const workflowStr = JSON.stringify(workflow)
    .replace(/USER_WALLET/g, userWallet)
    .replace(/CHAIN_ID/g, chainId);
  
  return JSON.parse(workflowStr);
}
```

---

## Suboptimal Detection (`lib/monitor.ts`)

After workflow execution, analyze logs to detect if the strategy underperformed.

```typescript
export function detectSuboptimal(
  execution: ExecutionDocument,
  strategyGoal: string
): { suboptimal: boolean; reason: string | null } {
  
  // Pattern 1: Alert fired but condition was borderline (false positive)
  const alertFired = execution.stepLogs.some(l => 
    l.actionType.includes('discord') || l.actionType.includes('telegram') || l.actionType.includes('slack')
  );
  const healthFactor = execution.outcome?.metrics?.healthFactor;
  if (alertFired && healthFactor && healthFactor > 1.4) {
    return { 
      suboptimal: true, 
      reason: `Alert fired but health factor was ${healthFactor} (above 1.4) — threshold too sensitive, causing false positive` 
    };
  }
  
  // Pattern 2: Workflow step failed
  const failedStep = execution.stepLogs.find(l => l.status === 'failed');
  if (failedStep) {
    return { 
      suboptimal: true, 
      reason: `Step "${failedStep.actionType}" failed: ${failedStep.error}` 
    };
  }
  
  // Pattern 3: Better yield available but not taken (yield optimization strategies)
  // Add protocol-specific checks here
  
  return { suboptimal: false, reason: null };
}
```

---

## Contracts (`contracts/`)

### AgentRegistry.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract AgentRegistry {
    mapping(uint256 => string) public agents;
    uint256 public nextId = 1;
    address public owner;
    
    event AgentRegistered(uint256 indexed agentId, string metadataCid);
    event AgentUpdated(uint256 indexed agentId, string newMetadataCid);
    
    constructor() { owner = msg.sender; }
    
    function register(string calldata metadataCid) external returns (uint256) {
        uint256 agentId = nextId++;
        agents[agentId] = metadataCid;
        emit AgentRegistered(agentId, metadataCid);
        return agentId;
    }
    
    function update(uint256 agentId, string calldata newMetadataCid) external {
        require(msg.sender == owner, "Not owner");
        agents[agentId] = newMetadataCid;
        emit AgentUpdated(agentId, newMetadataCid);
    }
    
    function getAgent(uint256 agentId) external view returns (string memory) {
        return agents[agentId];
    }
}
```

### ReputationLedger.sol

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ReputationLedger {
    struct Record {
        string strategyTag;
        uint256 successRateBps;  // basis points: 10000 = 100%
        string evidenceCid;       // MongoDB strategy _id
        uint256 timestamp;
    }
    
    mapping(uint256 => Record[]) public records;
    address public owner;
    
    event RecordAdded(uint256 indexed agentId, string strategyTag, uint256 successRate);
    
    constructor() { owner = msg.sender; }
    
    function record(
        uint256 agentId,
        string calldata strategyTag,
        uint256 successRateBps,
        string calldata evidenceCid
    ) external {
        require(msg.sender == owner, "Not owner");
        records[agentId].push(Record(strategyTag, successRateBps, evidenceCid, block.timestamp));
        emit RecordAdded(agentId, strategyTag, successRateBps);
    }
    
    function getRecords(uint256 agentId) external view returns (Record[] memory) {
        return records[agentId];
    }
    
    function getLatest(uint256 agentId) external view returns (Record memory) {
        Record[] memory r = records[agentId];
        require(r.length > 0, "No records");
        return r[r.length - 1];
    }
}
```

### Deploy Script (`contracts/deploy.ts`)

```typescript
import { ethers } from 'ethers';

const OG_RPC = 'https://evmrpc-testnet.0g.ai';
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY!;

async function deploy() {
  const provider = new ethers.JsonRpcProvider(OG_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  // Deploy AgentRegistry
  const registryFactory = new ethers.ContractFactory(REGISTRY_ABI, REGISTRY_BYTECODE, wallet);
  const registry = await registryFactory.deploy();
  await registry.waitForDeployment();
  console.log('AgentRegistry:', await registry.getAddress());
  
  // Deploy ReputationLedger
  const ledgerFactory = new ethers.ContractFactory(LEDGER_ABI, LEDGER_BYTECODE, wallet);
  const ledger = await ledgerFactory.deploy();
  await ledger.waitForDeployment();
  console.log('ReputationLedger:', await ledger.getAddress());
  
  // Register StrategyForge agent (agentId = 1)
  const registryContract = new ethers.Contract(await registry.getAddress(), REGISTRY_ABI, wallet);
  await registryContract.register('strategyforge-agent-v1');
  console.log('Agent registered with ID: 1');
}

deploy().catch(console.error);
```

---

## Authentication

StrategyForge uses **userId-as-token** auth — simple, stateless, no JWT complexity.

### How it works

1. `POST /api/auth/register` — creates/updates user, returns `{ userId, token }` where `token === userId`
2. Client stores token in localStorage
3. All API requests include `Authorization: Bearer <userId>` header
4. Server extracts userId via `getUserIdFromRequest(req)` in `lib/auth.ts`

### No passwords, no sessions

Users authenticate with their KeeperHub API key (proves they have a real KH account). The MongoDB `_id` is the token. This is honest for a hackathon demo — the security model is "if you know the userId, you're the user." Production would add JWT + refresh tokens.

### Routes that require auth

All routes except `POST /api/auth/register` require `Authorization: Bearer <userId>`.

```typescript
// lib/auth.ts
export function getUserIdFromRequest(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}
```

---

## API Routes

### POST `/api/auth/register`

```typescript
// Body: { keeperhubApiKey, walletAddress, openrouterApiKey?, discordWebhookUrl? }
// 1. Validate KH API key by calling /api/mcp/schemas
// 2. Create/upsert user in MongoDB
// 3. Return { userId, walletAddress, token }
// Note: token === userId — store in localStorage and send as Bearer
```

### POST `/api/user/connect`

```typescript
// Body: { keeperhubApiKey, walletAddress, openrouterApiKey?, discordWebhookUrl? }
// 1. Validate KH API key by calling /api/mcp/schemas
// 2. Save user to MongoDB
// 3. Return { userId, walletAddress }
```

### POST `/api/strategy/generate`

```typescript
// Body: { userId, goal }
// 1. Load user from MongoDB (get KH API key, wallet)
// 2. Fetch list_action_schemas from KeeperHub
// 3. Fetch relevant market data from DefiLlama
// 4. Load prior version if exists (for v2+)
// 5. Run Researcher LLM call → store in evidenceBundle
// 6. Run Strategist LLM call → store in evidenceBundle  
// 7. Run Critic LLM call → store in evidenceBundle
// 8. Run Compiler (deterministic)
// 9. Save strategy to MongoDB with lifecycle: "draft"
// 10. Return { strategyId, workflowJson, evidenceBundle }
```

### POST `/api/strategy/deploy`

```typescript
// Body: { strategyId }
// 1. Load strategy from MongoDB
// 2. Call KeeperHub POST /api/workflows/create with workflowJson
// 3. Update strategy: keeperhubWorkflowId, lifecycle: "live"
// 4. Call AgentRegistry.update(1, strategyId) on 0G Chain
// 5. Return { workflowId, keeperhubUrl }
```

### POST `/api/strategy/execute`

```typescript
// Body: { strategyId }
// 1. Load strategy, get keeperhubWorkflowId
// 2. Call KeeperHub POST /api/workflow/:id/execute
// 3. Poll execution status every 2s for up to 60s
// 4. Fetch execution logs
// 5. Run detectSuboptimal()
// 6. Save execution to MongoDB
// 7. Call ReputationLedger.record() on 0G Chain
// 8. Return { executionId, status, logs, suboptimal, suboptimalReason }
```

### POST `/api/strategy/update`

```typescript
// Body: { strategyId }
// 1. Load strategy + most recent execution
// 2. Verify execution.outcome.suboptimal === true
// 3. Run full pipeline again with priorVersion data injected
//    - Researcher gets: priorLessons = [execution.outcome.suboptimalReason]
//    - Critic gets: evidenceOfLearning is REQUIRED
// 4. Deploy new workflow to KeeperHub
// 5. Mark old strategy as deprecated
// 6. Return { newStrategyId, evidenceOfLearning }
```

---

## Frontend Components

### PipelineRunner.tsx

Shows the 3-step pipeline running in real time. Each step shows:

- Status indicator (pending / running / done)
- Step name
- When done: collapsible output JSON
- attestationId (proof the LLM ran)

Use Server-Sent Events or polling every 500ms against a job status endpoint.

### VersionDiff.tsx

Shows v1 → v2 transition. Key elements:

- Side by side cards for each version
- "What changed" section highlighting the Critic's evidenceOfLearning
- Arrow/connector between cards labeled "learned from execution #N"
- The suboptimalReason from v1's execution shown in red
- The fix in v2's workflow highlighted in green

This is the money shot of the demo. Make it visually clear.

### EvidenceBundle.tsx

Collapsible sections for each pipeline step:

- Researcher output (market state, signals, priorLessons)
- Strategist candidates (two workflow designs with hypotheses)
- Critic selection (rationale, evidenceOfLearning)
- Workflow JSON (the actual KH workflow)

---

## Demo Flow (for recording)

**Pre-demo setup (run `scripts/seed-demo.ts`):**

1. Create v1 strategy for "Monitor my Aave position on Sepolia and alert me if health factor drops below 1.5"
2. Deploy to KeeperHub (real workflow created)
3. Execute once — force suboptimal by setting health factor mock to 1.6 (above threshold, alert fires anyway = false positive)
4. Record suboptimal execution in MongoDB
5. Generate v2 — Critic explicitly says "v1 threshold of 1.5 caused false positive at 1.6, changing to 1.3"
6. Deploy v2 to KeeperHub

**Live demo recording:**

- Scene 1: Show dashboard with v1 and v2 cards
- Scene 2: Click into v1 evidence bundle — show the reasoning
- Scene 3: Show execution log — "alert fired, health factor was 1.6, suboptimal"
- Scene 4: Show v2 evidence bundle — highlight evidenceOfLearning field
- Scene 5: Show both KeeperHub workflow IDs (click through to KH dashboard)
- Scene 6: Show AgentRegistry + ReputationLedger on 0G Chain explorer

---

## Build Order (for today)

### Phase 1 — Core infrastructure (2 hours)

1. `npx create-next-app strategyforge --typescript --tailwind --app`
2. Set up MongoDB connection (`lib/db/mongoose.ts`)
3. Create all three Mongoose models
4. Build KeeperHubClient (`lib/keeperhub.ts`)
5. Build OpenRouter client (`lib/openrouter.ts`)
6. Test: `POST /api/user/connect` works with real KH API key

### Phase 2 — Pipeline (3 hours)

1. Write researcher.ts with system prompt
2. Write strategist.ts with system prompt
3. Write critic.ts with system prompt
4. Write compiler.ts
5. Wire all four into `POST /api/strategy/generate`
6. Test: full pipeline returns valid workflowJson

### Phase 3 — KeeperHub integration (2 hours)

1. `POST /api/strategy/deploy` → creates real KH workflow
2. `POST /api/strategy/execute` → triggers execution, polls status
3. `POST /api/strategy/update` → generates v2 with prior context
4. Test: full v1 → execute → detect suboptimal → v2 cycle works

### Phase 4 — Contracts (1 hour)

1. Deploy AgentRegistry + ReputationLedger to 0G Chain testnet
2. Wire contract calls into deploy and execute routes
3. Verify tx hashes on 0G Chain explorer

### Phase 5 — Frontend (2 hours)

1. Connect page (enter API keys)
2. Dashboard (list strategies, create new)
3. Strategy detail (evidence bundle, version diff)
4. PipelineRunner component (streaming steps)

### Phase 6 — Demo prep (1 hour)

1. Run seed script
2. Record demo video
3. Write FEEDBACK.md
4. Write README

---

## Critical Rules for Claude Code

1. **Never hardcode KeeperHub action type strings.** Always call `list_action_schemas` first and use the returned types.

2. **The workflow JSON structure.** Nodes use outer `type: "action"` and `data.type: "<actionType>"`. Trigger nodes use outer `type: "trigger"` and `data.type: "trigger"`. This is different from how it looks in docs.

3. **KeeperHub API endpoints.** Use `/api/workflow/:id/execute` (singular) for execution, not `/api/workflows/:id/execute` (plural). Both paths appear in docs, only singular works.

4. **The evidenceOfLearning field is the whole point.** For v2+ generations, the Critic's evidenceOfLearning must contain a direct reference to what v1 got wrong. If it's empty, the self-learning claim is hollow.

5. **MongoDB _id as "CID".** We don't use 0G Storage. The MongoDB strategy document _id serves as the content identifier stored in AgentRegistry. This is honest — judges can query MongoDB to verify the content.

6. **0G Chain is EVM-compatible.** Use ethers.js with the 0G Chain RPC URL. Same code as any EVM chain.

7. **OpenRouter forces JSON.** Use `response_format: { type: 'json_object' }` in every LLM call. Parse with try/catch. If parsing fails, retry once with a stricter prompt.

8. **Don't over-engineer the frontend.** Three pages, shadcn/ui components, Tailwind. The VersionDiff component is the most important UI element — invest time there.

9. **Sepolia for execution, mainnet data for reasoning.** DefiLlama has Sepolia pool data for Aave but it's sparse. Use mainnet APY data for the Researcher's market analysis, execute on Sepolia (chainId: "11155111").

10. **The demo works without real funds.** Aave health factor reads (`aave-v3/get-user-account-data`) are read-only. The workflow executes, reads on-chain data, evaluates conditions, sends alerts. No funds move. This is fine for the demo.
