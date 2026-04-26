import { beforeAll, describe, expect, it, mock } from "bun:test";
import { config as loadDotEnv } from "dotenv";
import { appendFileSync, existsSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  EvidenceBundle,
  Result,
  SealedInferenceResult,
} from "@strategyforge/core";
import type { StrategyGoal } from "@strategyforge/core";
import type { WorkflowSpec } from "@strategyforge/core";
import { err, ok } from "@strategyforge/core";
import { ProxyInference, DEFAULT_PROXY_MODEL } from "@strategyforge/compute";
import { DefiLlamaClient } from "@strategyforge/data";
import { HttpKeeperHubClient } from "@strategyforge/keeperhub";
import { Compiler } from "./compiler.js";
import { CreateOrchestrator } from "./create-orchestrator.js";
import { Critic } from "./critic.js";
import { PipelineOrchestrator } from "./pipeline-orchestrator.js";
import { Researcher, type InferenceClient } from "./researcher.js";
import { RiskValidator } from "./risk-validator.js";
import { Strategist } from "./strategist.js";
import { UpdateOrchestrator } from "./update-orchestrator.js";

function loadEnvFromWorkspace(): void {
  let currentDir = process.cwd();
  while (true) {
    const envPath = join(currentDir, ".env");
    if (existsSync(envPath)) {
      loadDotEnv({ path: envPath });
      return;
    }
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) return;
    currentDir = parentDir;
  }
}

loadEnvFromWorkspace();

const LOG_PATH = join(import.meta.dir, "..", "out.log");

function initLog() {
  if (existsSync(LOG_PATH)) unlinkSync(LOG_PATH);
  writeFileSync(
    LOG_PATH,
    `StrategyForge Live End-to-End Trace\n${"=".repeat(60)}\nStarted: ${new Date().toISOString()}\n\n`,
  );
}

function log(msg: string) {
  console.log(msg);
  appendFileSync(LOG_PATH, `${msg}\n`);
}

function section(title: string) {
  const bar = "─".repeat(60);
  log(`\n${bar}`);
  log(`  ${title}`);
  log(bar);
}

function sub(title: string) {
  log(`\n  ┌─ ${title}`);
}

function row(label: string, value: unknown) {
  const rendered = typeof value === "string" ? value : JSON.stringify(value);
  log(`  │  ${label.padEnd(30)} ${rendered}`);
}

function json(label: string, value: unknown) {
  log(`  │  ${label}:`);
  const lines = JSON.stringify(value, null, 2).split("\n");
  for (const line of lines) log(`  │    ${line}`);
}

function rowEnd() {
  log("  └─────────────────────────────────────────");
}

beforeAll(() => initLog());

const LIVE_GOAL: StrategyGoal = {
  asset: "USDC",
  amount: 50_000,
  riskLevel: "balanced",
  horizon:
    "12 months | Complex request: Design a production-ready, capital-preserving, cross-chain USDC automation strategy with max 1.5% monthly drawdown, max 40% per protocol, minimum 15% instantly withdrawable liquidity, max 3 state-changing tx per rebalance, strict oracle/bridge fail-safe behavior, dynamic regime-based allocation, APY smoothing, gas/slippage guards, rollback checks, and deterministic fallback escalation.",
  chains: ["ethereum", "base"],
};

const LIVE_COMPLEX_USER_REQUEST = `Design a production-ready, capital-preserving, cross-chain USDC automation strategy for 50,000 USD over a 12-month horizon that runs on Ethereum and Base and can be deployed as a KeeperHub DAG, but with strict operational constraints: maximum 1.5% monthly drawdown tolerance, no single protocol allocation above 40%, minimum 15% instantly withdrawable liquidity at all times, no more than 3 on-chain state-changing transactions per rebalance cycle, and hard fail-safe behavior under oracle or bridge anomalies.

How would you architect the full workflow end-to-end, including trigger cadence, APY signal smoothing logic, protocol selection methodology (Aave, Morpho, Yearn, Spark, etc.), dynamic allocation rules under changing market regimes, explicit condition branching, approval and allowance hygiene, slippage and gas-aware execution guards, cross-chain transfer decision thresholds, staged degradation modes when data confidence falls, and rollback logic when post-trade health checks fail?

Also provide:
1. A formal DAG spec with nodes, edges, source handles, and templated data references.
2. A risk model with quantitative guardrails and rejection criteria for each candidate action.
3. A fallback policy stack that escalates from model-generated plans to deterministic hardcoded plans to monitor-only mode.
4. A monitoring and alerting matrix (Telegram/Discord/email) mapped to severity levels and recovery playbooks.
5. A test strategy covering simulation, chaos scenarios, malformed inference JSON, stale schema responses, and partial KeeperHub API outages.
6. A final recommendation comparing at least 3 materially different strategy variants, with confidence scoring and trade-off analysis.`;

interface LiveIntegrationConfig {
  computeApiKey: string;
  computeBaseURL?: string;
  computeModel?: string;
  keeperhubApiUrl: string;
  keeperhubApiKey: string;
  keeperhubIntegrationId?: string;
}

function liveIntegrationConfig(): LiveIntegrationConfig | null {
  if (process.env.RUN_LIVE_PROXY_INFERENCE_TESTS !== "1") return null;

  const computeApiKey = process.env["0G_COMPUTE_API_KEY"];
  const keeperhubApiUrl = process.env.KEEPERHUB_API_URL;
  const keeperhubApiKey = process.env.KEEPERHUB_API_KEY;

  if (!computeApiKey || !keeperhubApiUrl || !keeperhubApiKey) return null;

  return {
    computeApiKey,
    computeBaseURL: process.env["0G_COMPUTE_BASE_URL"],
    computeModel: process.env["0G_COMPUTE_MODEL"],
    keeperhubApiUrl,
    keeperhubApiKey,
    keeperhubIntegrationId: process.env.KEEPERHUB_INTEGRATION_ID,
  };
}

function mockEvidenceStore(seedBundles: Record<string, EvidenceBundle> = {}) {
  const bundles = new Map<string, EvidenceBundle>(Object.entries(seedBundles));
  let lastBundle: EvidenceBundle | null = null;

  return {
    writeBundle: mock(async (bundle: EvidenceBundle) => {
      section("STEP 6 — Mocked Storage Write");
      json("evidenceBundle", bundle);
      lastBundle = bundle;
      bundles.set("0xlive-proxy-test", bundle);
      row("mock cid", "0xlive-proxy-test");
      rowEnd();
      return ok({ cid: "0xlive-proxy-test" });
    }),
    readBundle: mock(async (cid: string) => {
      const bundle = bundles.get(cid);
      if (!bundle) return err(new Error(`not found: ${cid}`));
      return ok(bundle);
    }),
    getLastBundle: () => lastBundle,
  };
}

function mockKVStore(entries: Record<string, string>) {
  return {
    get: mock(async (key: string) => ok(entries[key] ?? null)),
    set: mock(async () => ok(undefined)),
  };
}

function withMockedAnalyticsFetch(workflowId: string): () => void {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = mock(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const rawUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input instanceof Request
              ? input.url
              : typeof input === "object" && input !== null && "url" in input
                ? String((input as { url: string }).url)
                : "";

      // Only mock analytics endpoints for update flow; keep all other network
      // dependencies (KeeperHub schema fetch, DefiLlama, etc.) untouched.
      if (!rawUrl.includes("/api/analytics/")) {
        return originalFetch(input, init);
      }

      if (rawUrl.includes("/api/analytics/summary?range=7d")) {
        return new Response(JSON.stringify({ successRate: 0.92 }), {
          status: 200,
        });
      }
      if (rawUrl.includes("/api/analytics/runs?status=error")) {
        return new Response(
          JSON.stringify({
            runs: [
              {
                executionId: `${workflowId}-exec-1`,
                failedAt: new Date().toISOString(),
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (rawUrl.includes(`/api/analytics/runs/${workflowId}-exec-1/steps`)) {
        return new Response(
          JSON.stringify({
            steps: [
              {
                nodeId: "supply",
                nodeName: "Supply USDC",
                errorMessage: "simulated underperformance trigger",
                protocol: "aave-v3",
                status: "failed",
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (rawUrl.includes("/api/analytics/networks")) {
        return new Response(
          JSON.stringify({
            networks: [
              { network: "ethereum", successRate: 0.93 },
              { network: "base", successRate: 0.9 },
            ],
          }),
          { status: 200 },
        );
      }

      return new Response(
        JSON.stringify({ error: `Unhandled analytics route: ${rawUrl}` }),
        {
          status: 404,
        },
      );
    },
  ) as typeof fetch;

  return () => {
    globalThis.fetch = originalFetch;
  };
}

class LoggedDefiLlamaClient {
  constructor(private readonly inner: DefiLlamaClient) {}

  async getYieldPools(
    params: {
      chains?: string[];
      stablecoinsOnly?: boolean;
      minTvl?: number;
    } = {},
  ) {
    section("Data Module — DefiLlama.getYieldPools");
    row("params", params);
    const result = await this.inner.getYieldPools(params);
    if (!result.ok) {
      row("error", result.error);
      rowEnd();
      return result;
    }

    row("pool count", result.value.length);
    json(
      "sample pools",
      result.value.slice(0, 12).map((pool) => ({
        project: pool.project,
        chain: pool.chain,
        apy: pool.apy,
        tvlUsd: pool.tvlUsd,
        stablecoin: pool.stablecoin,
        pool: pool.pool,
      })),
    );
    rowEnd();
    return result;
  }

  async getHistoricalAPY(poolId: string, days?: number) {
    sub(`DefiLlama.getHistoricalAPY ${poolId}`);
    row("days", days ?? null);
    const result = await this.inner.getHistoricalAPY(poolId, days);
    if (!result.ok) {
      row("error", result.error);
      rowEnd();
      return result;
    }

    row("history points", result.value.length);
    row("first apy", result.value[0]?.apy ?? null);
    row("last apy", result.value[result.value.length - 1]?.apy ?? null);
    rowEnd();
    return result;
  }

  async getProtocolTVL(protocol: string) {
    sub(`DefiLlama.getProtocolTVL ${protocol}`);
    const result = await this.inner.getProtocolTVL(protocol);
    if (!result.ok) {
      row("error", result.error);
      rowEnd();
      return result;
    }
    json("tvl", result.value);
    rowEnd();
    return result;
  }
}

class LoggedKeeperHubClient {
  constructor(private readonly inner: HttpKeeperHubClient) {}

  async listActionSchemas() {
    section("KeeperHub — listActionSchemas");
    const result = await this.inner.listActionSchemas();
    if (!result.ok) {
      row("error", result.error.message);
      rowEnd();
      return result;
    }

    row("schema count", result.value.length);
    json(
      "sample schema types",
      result.value.slice(0, 20).map((schema) => ({
        type: schema.type,
        label: schema.label,
        integration: schema.integration ?? null,
      })),
    );
    rowEnd();
    return result;
  }

  async createWorkflow(spec: WorkflowSpec) {
    section("STEP 7 — KeeperHub.createWorkflow");
    json("workflowSpec to upload", spec);
    const result = await this.inner.createWorkflow(spec);
    if (!result.ok) {
      row("error", result.error.message);
      rowEnd();
      return result;
    }

    row("workflowId", result.value.workflowId);
    rowEnd();
    return result;
  }

  async getWorkflow(workflowId: string) {
    sub(`KeeperHub.getWorkflow ${workflowId}`);
    const result = await this.inner.getWorkflow(workflowId);
    if (!result.ok) {
      row("error", result.error.message);
      rowEnd();
      return result;
    }
    json("workflow status", result.value);
    rowEnd();
    return result;
  }
}

class LoggedInferenceClient implements InferenceClient {
  constructor(
    private readonly inner: ProxyInference,
    private readonly stepNames = ["Researcher", "Strategist", "Critic"],
    private callIndex = 0,
  ) {}

  async infer(params: {
    systemPrompt: string;
    userPrompt: string;
    jsonMode?: boolean;
    maxRetries?: number;
  }): Promise<Result<SealedInferenceResult>> {
    const stepName =
      this.stepNames[this.callIndex] ?? `Inference #${this.callIndex + 1}`;
    this.callIndex += 1;

    section(`${stepName} — LLM Call`);
    sub("Prompts");
    row("jsonMode", params.jsonMode ?? false);
    row("systemPrompt chars", params.systemPrompt.length);
    row("userPrompt chars", params.userPrompt.length);
    rowEnd();

    sub("System prompt");
    log(params.systemPrompt);
    rowEnd();

    sub("User prompt");
    log(params.userPrompt);
    rowEnd();

    const result = await this.inner.infer(params);
    if (!result.ok) {
      sub("LLM error");
      row("message", result.error.message);
      rowEnd();
      return result;
    }

    sub("Raw LLM output");
    row("model", result.value.model);
    row("provider", result.value.provider);
    row("attestationHash", result.value.attestationHash);
    rowEnd();

    log(result.value.response);

    try {
      sub("Parsed JSON");
      json("parsed", JSON.parse(result.value.response));
      rowEnd();
    } catch {
      sub("Parsed JSON");
      row("parsed", "Response was not valid JSON");
      rowEnd();
    }

    return result;
  }
}

function wrapResearcher(researcher: Researcher): Researcher {
  const originalRun = researcher.run.bind(researcher);
  researcher.run = async (params) => {
    section("STEP 1 — Researcher");
    row("goal.asset", params.goal.asset);
    row("goal.amount", params.goal.amount);
    row("goal.riskLevel", params.goal.riskLevel);
    row("goal.chains", params.goal.chains.join(", "));
    rowEnd();

    const result = await originalRun(params);
    if (!result.ok) {
      row("error", result.error.message);
      rowEnd();
      return result;
    }

    sub("Researcher output");
    row("regime", result.value.regime);
    row("protocol count", result.value.snapshot.protocols.length);
    json("snapshot.protocols", result.value.snapshot.protocols);
    json("filteredOut", result.value.filteredOut);
    json("suitableActions", result.value.suitableActions);
    json("signals", result.value.signals);
    rowEnd();
    return result;
  };
  return researcher;
}

function wrapStrategist(strategist: Strategist): Strategist {
  const originalRun = strategist.run.bind(strategist);
  strategist.run = async (params) => {
    section("STEP 2 — Strategist");
    const result = await originalRun(params);
    if (!result.ok) {
      row("error", result.error.message);
      rowEnd();
      return result;
    }

    sub("Strategist output");
    json("candidates", result.value.candidates);
    row(
      "used fallback",
      result.value.candidates.some(
        (candidate) =>
          candidate.nodes.some(
            (node) =>
              node.id === "placeholder-notify" ||
              node.label?.includes("manual review needed") === true,
          ) || candidate.hypothesis.toLowerCase().includes("placeholder"),
      ),
    );
    rowEnd();
    return result;
  };
  return strategist;
}

function wrapCritic(critic: Critic): Critic {
  const originalRun = critic.run.bind(critic);
  critic.run = async (params) => {
    section("STEP 3 — Critic");
    const result = await originalRun(params);
    if (!result.ok) {
      row("error", result.error.message);
      rowEnd();
      return result;
    }

    sub("Critic output");
    json("boundsResults", result.value.boundsResults);
    json("verdicts", result.value.verdicts);
    json("selectedCandidate", result.value.selectedCandidate);
    json("constraints", result.value.constraints);
    rowEnd();
    return result;
  };
  return critic;
}

function wrapCompiler(compiler: Compiler): Compiler {
  const originalInit = compiler.init.bind(compiler);
  const originalCompile = compiler.compile.bind(compiler);

  compiler.init = async () => {
    section("STEP 4A — Compiler.init");
    const result = await originalInit();
    if (!result.ok) {
      row("error", result.error.message);
      rowEnd();
      return result;
    }
    row("initialized", true);
    rowEnd();
    return result;
  };

  compiler.compile = (params) => {
    section("STEP 4B — Compiler.compile");
    const output = originalCompile(params);
    sub("Compiler output");
    json("workflowSpec", output.workflowSpec);
    row("gasEstimate", output.gasEstimate);
    rowEnd();
    return output;
  };

  return compiler;
}

function wrapRiskValidator(riskValidator: RiskValidator): RiskValidator {
  const originalValidate = riskValidator.validate.bind(riskValidator);
  riskValidator.validate = (spec, allocation, amountUSD) => {
    section("STEP 5 — Risk Validator");
    const result = originalValidate(spec, allocation, amountUSD);
    sub("Validation result");
    json("validation", result);
    rowEnd();
    return result;
  };
  return riskValidator;
}

function withOptionalIntegrationId(
  workflowSpec: WorkflowSpec,
  integrationId: string | undefined,
): WorkflowSpec {
  if (!integrationId) return workflowSpec;
  return {
    ...workflowSpec,
    nodes: workflowSpec.nodes.map((node) => ({
      ...node,
      config: {
        ...node.config,
        integrationId:
          typeof (node.config as Record<string, unknown>).integrationId ===
          "string"
            ? (node.config as Record<string, unknown>).integrationId
            : integrationId,
      },
    })),
  };
}

async function buildLivePipelineHarness(
  config: LiveIntegrationConfig,
  evidenceStore: ReturnType<typeof mockEvidenceStore>,
): Promise<
  Result<{
    orchestrator: PipelineOrchestrator;
    keeperhub: LoggedKeeperHubClient;
  }>
> {
  const proxy = new ProxyInference({
    apiKey: config.computeApiKey,
    baseURL: config.computeBaseURL,
    model: config.computeModel,
  });
  const proxyInit = await proxy.init();
  if (!proxyInit.ok) return err(proxyInit.error);

  const llama = new LoggedDefiLlamaClient(new DefiLlamaClient());
  const inference = new LoggedInferenceClient(proxy);
  const keeperhub = new LoggedKeeperHubClient(
    new HttpKeeperHubClient({
      apiUrl: config.keeperhubApiUrl,
      apiKey: config.keeperhubApiKey,
    }),
  );

  const researcher = wrapResearcher(new Researcher(llama as any, inference));
  const strategist = wrapStrategist(new Strategist(inference));
  const critic = wrapCritic(new Critic(inference));
  const compiler = wrapCompiler(new Compiler(keeperhub as any));
  const riskValidator = wrapRiskValidator(new RiskValidator());

  const compilerInit = await compiler.init();
  if (!compilerInit.ok) return err(compilerInit.error);

  const orchestrator = new PipelineOrchestrator({
    researcher,
    strategist,
    critic,
    compiler,
    riskValidator,
    keeperhub: keeperhub as any,
    evidenceStore: evidenceStore as any,
  });

  return ok({ orchestrator, keeperhub });
}

describe("Live pipeline integration (opt-in)", () => {
  it("runs CreateOrchestrator end-to-end with real data, real LLM, real KeeperHub, and mocked storage", async () => {
    const config = liveIntegrationConfig();
    if (!config) {
      console.warn(
        "Skipping live pipeline test. Set RUN_LIVE_PROXY_INFERENCE_TESTS=1 plus 0G_COMPUTE_API_KEY, KEEPERHUB_API_URL, and KEEPERHUB_API_KEY.",
      );
      return;
    }

    section("Live Test Setup");
    row("goal.asset", LIVE_GOAL.asset);
    row("goal.amount", LIVE_GOAL.amount);
    row("goal.riskLevel", LIVE_GOAL.riskLevel);
    row("goal.chains", LIVE_GOAL.chains.join(", "));
    row("goal.horizon chars", LIVE_GOAL.horizon.length);
    row("goal.request chars", LIVE_COMPLEX_USER_REQUEST.length);
    row("proxy.model", config.computeModel ?? DEFAULT_PROXY_MODEL);
    row("proxy.baseURL", config.computeBaseURL ?? "default proxy endpoint");
    row("keeperhub.apiUrl", config.keeperhubApiUrl);
    row("keeperhub.integrationId", config.keeperhubIntegrationId ?? null);
    row("storage", "mocked only");
    rowEnd();

    const evidenceStore = mockEvidenceStore();

    const harness = await buildLivePipelineHarness(config, evidenceStore);
    expect(harness.ok).toBe(true);
    if (!harness.ok) return;

    const { orchestrator, keeperhub } = harness.value;
    const createOrchestrator = new CreateOrchestrator(orchestrator);

    section("STEP 0 — Full Pipeline Run");
    row("entrypoint", "CreateOrchestrator.create");
    sub("Complex user request injected into test context");
    log(LIVE_COMPLEX_USER_REQUEST);
    rowEnd();

    const result = await createOrchestrator.create(LIVE_GOAL);
    if (!result.ok) {
      section("FINAL ERROR");
      row("message", result.error.message);
      rowEnd();
    }
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const compiledSpec = result.value.evidenceBundle.pipeline.compiler
      .workflowSpec as unknown as WorkflowSpec;
    const uploadSpec = withOptionalIntegrationId(
      compiledSpec,
      config.keeperhubIntegrationId,
    );
    const createWorkflowResult = await keeperhub.createWorkflow(uploadSpec);
    expect(createWorkflowResult.ok).toBe(true);
    if (!createWorkflowResult.ok) return;

    const getWorkflowResult = await keeperhub.getWorkflow(
      createWorkflowResult.value.workflowId,
    );
    expect(getWorkflowResult.ok).toBe(true);
    if (!getWorkflowResult.ok) return;

    section("FINAL SUMMARY");
    row("familyId", result.value.strategy.familyId);
    row("version", result.value.strategy.version);
    row("lifecycle", result.value.strategy.lifecycle);
    row("cid", result.value.cid);
    row("keeperhub.workflowId", createWorkflowResult.value.workflowId);
    json("workflowSpec", result.value.strategy.workflowSpec);
    row(
      "stored strategyFamily",
      evidenceStore.getLastBundle()?.strategyFamily ?? null,
    );
    rowEnd();

    expect(
      (result.value.strategy.workflowSpec as any).nodes.length,
    ).toBeGreaterThan(0);
    expect(
      result.value.evidenceBundle.pipeline.researcher.attestationHash,
    ).toBeTruthy();
    expect(
      result.value.evidenceBundle.pipeline.strategist.attestationHash,
    ).toBeTruthy();
    expect(
      result.value.evidenceBundle.pipeline.critic.attestationHash,
    ).toBeTruthy();
    expect(result.value.evidenceBundle.pipeline.riskValidator.passed).toBe(
      true,
    );
    expect(result.value.cid).toBe("0xlive-proxy-test");
    expect(evidenceStore.getLastBundle()?.strategyFamily).toBe(
      result.value.strategy.familyId,
    );
  }, 240000);

  it("runs UpdateOrchestrator with real LLM/data and mocked KV + analytics + storage chain", async () => {
    const config = liveIntegrationConfig();
    if (!config) {
      console.warn(
        "Skipping live pipeline update test. Set RUN_LIVE_PROXY_INFERENCE_TESTS=1 plus 0G_COMPUTE_API_KEY, KEEPERHUB_API_URL, and KEEPERHUB_API_KEY.",
      );
      return;
    }

    const familyId = `family-live-update-${Date.now()}`;
    const priorCid = "0xprior-live-cid";
    const priorBundle: EvidenceBundle = {
      strategyFamily: familyId,
      version: 1,
      priorCids: [],
      pipeline: {
        researcher: {
          input: { goal: LIVE_GOAL as unknown as Record<string, unknown> },
          output: {
            regime: "stable",
            survivingProtocols: ["aave-v3"],
            logicNodes: [],
            signals: [
              { protocol: "aave-v3", signal: "stale-yield", severity: "low" },
            ],
          },
          attestationHash: "0xprior-researcher",
          timestamp: Date.now() - 40_000,
        },
        strategist: {
          input: {},
          output: { candidates: [] },
          attestationHash: "0xprior-strategist",
          timestamp: Date.now() - 35_000,
        },
        critic: {
          input: { candidates: [] },
          output: {
            verdicts: [],
            selectedCandidateId: "A",
            selectionRationale: "initial strategy",
            mandatoryConstraints: [],
            updatedLogicNodes: [],
          },
          attestationHash: "0xprior-critic",
          timestamp: Date.now() - 30_000,
        },
        compiler: {
          workflowSpec: {
            name: "Prior Strategy",
            description: "Baseline strategy",
            trigger: { type: "schedule", config: { cron: "0 * * * *" } },
            nodes: [],
            edges: [],
          },
          gasEstimate: 1000,
        },
        riskValidator: {
          passed: true,
          warnings: [],
        },
      },
      outcomes: {
        startedAt: Date.now() - 20_000,
        checkpoints: [],
        finalStatus: "underperformed",
      },
      createdAt: Date.now() - 10_000,
    };

    const evidenceStore = mockEvidenceStore({ [priorCid]: priorBundle });
    const harness = await buildLivePipelineHarness(config, evidenceStore);
    expect(harness.ok).toBe(true);
    if (!harness.ok) return;

    const { orchestrator, keeperhub } = harness.value;
    const keeperhubWorkflowId = `workflow-live-update-${Date.now()}`;
    const kvStore = mockKVStore({
      [`family:${familyId}:latest`]: JSON.stringify({
        priorCids: [priorCid],
        goal: LIVE_GOAL,
        keeperhubWorkflowId,
      }),
    });

    const restoreFetch = withMockedAnalyticsFetch(keeperhubWorkflowId);
    try {
      const updateOrchestrator = new UpdateOrchestrator(
        orchestrator,
        evidenceStore as any,
        kvStore as any,
        {
          keeperhubApiUrl: config.keeperhubApiUrl,
          keeperhubApiKey: config.keeperhubApiKey,
        },
      );

      section("STEP 0 — Update Pipeline Run");
      row("entrypoint", "UpdateOrchestrator.update");
      row("familyId", familyId);
      row("trigger.reason", "underperformance");
      rowEnd();

      const result = await updateOrchestrator.update({
        familyId,
        trigger: {
          reason: "underperformance",
          actualVsPredicted: -0.18,
        },
      });

      if (!result.ok) {
        section("FINAL ERROR (UPDATE)");
        row("message", result.error.message);
        rowEnd();
      }
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const compiledSpec = result.value.evidenceBundle.pipeline.compiler
        .workflowSpec as unknown as WorkflowSpec;
      const uploadSpec = withOptionalIntegrationId(
        compiledSpec,
        config.keeperhubIntegrationId,
      );
      const createWorkflowResult = await keeperhub.createWorkflow(uploadSpec);
      expect(createWorkflowResult.ok).toBe(true);
      if (!createWorkflowResult.ok) return;

      const getWorkflowResult = await keeperhub.getWorkflow(
        createWorkflowResult.value.workflowId,
      );
      expect(getWorkflowResult.ok).toBe(true);
      if (!getWorkflowResult.ok) return;

      section("FINAL SUMMARY (UPDATE)");
      row("familyId", result.value.strategy.familyId);
      row("version", result.value.strategy.version);
      row("lifecycle", result.value.strategy.lifecycle);
      row("cid", result.value.cid);
      row("keeperhub.workflowId", createWorkflowResult.value.workflowId);
      row("loaded prior cid", priorCid);
      rowEnd();

      expect(result.value.strategy.familyId).toBe(familyId);
      expect(result.value.strategy.version).toBe(2);
      expect(result.value.evidenceBundle.version).toBe(2);
      expect(result.value.evidenceBundle.priorCids).toEqual([priorCid]);
      expect(result.value.evidenceBundle.pipeline.riskValidator.passed).toBe(
        true,
      );
      expect(result.value.cid).toBe("0xlive-proxy-test");
      expect(evidenceStore.getLastBundle()?.strategyFamily).toBe(familyId);
    } finally {
      restoreFetch();
    }
  }, 240000);
});
