import { JsonRpcProvider, Wallet } from "ethers";
import { resolve } from "node:path";
import { DefiLlamaClient } from "@strategyforge/data";
import { ProxyInference, SealedInference } from "@strategyforge/compute";
import { HttpKeeperHubClient } from "@strategyforge/keeperhub";
import {
  Compiler,
  CreateOrchestrator,
  Critic,
  PipelineOrchestrator,
  Researcher,
  RiskValidator,
  Strategist,
  UpdateOrchestrator,
} from "@strategyforge/pipeline";
import { EvidenceStore, KVStore } from "@strategyforge/storage";
import type { KeeperHubClientApi } from "@strategyforge/keeperhub";
import { createLocalStore } from "./lib/local-store.js";
import type { LocalDB } from "./lib/local-store.js";
import { StrategyTelemetryService } from "./lib/strategy-telemetry.js";

export interface AppDeps {
  keeperhub: KeeperHubClientApi;
  evidenceStore: EvidenceStore;
  kvStore: KVStore;
  localDb: LocalDB;
  strategyTelemetryService: StrategyTelemetryService;
  createOrchestrator: CreateOrchestrator;
  updateOrchestrator: UpdateOrchestrator;
  signer: Wallet;
  agentRegistryAddress: string;
  reputationLedgerAddress: string | null;
  inftAddress: string | null;
  agentId: number;
  keeperhubPricePerRun: string;
  keeperhubPaymentNetwork: string;
  keeperhubPublishOnDeploy: boolean;
  turnkeyWallet: string;
  accessFeeRecipient: string;
  accessFeeAmount: string;
}

export async function createDeps(): Promise<AppDeps> {
  const privateKey = requireEnv("PRIVATE_KEY");
  const evmRpc = requireEnv("OG_EVM_RPC");
  const indexerUrl = requireEnv("OG_INDEXER");
  const streamId = process.env.OG_STREAM_ID || "0x0000000000000000000000000000000000000000000000000000000000000000";
  const kvNodeRpc = process.env.OG_KV_NODE_RPC;
  const keeperhubApiKey = requireEnv("KEEPERHUB_API_KEY");
  const keeperhubApiUrl = requireEnv("KEEPERHUB_API_URL");
  const agentRegistryAddress = requireEnv("AGENT_REGISTRY_ADDRESS");
  const agentId = parseAgentId(process.env.AGENT_ID ?? "1");
  const keeperhubPricePerRun = process.env.KEEPERHUB_PRICE_PER_RUN ?? "0.01";
  const keeperhubPaymentNetwork =
    process.env.KEEPERHUB_PAYMENT_NETWORK ?? "base";
  const keeperhubPublishOnDeploy = process.env.KEEPERHUB_PUBLISH_ON_DEPLOY === "1";
  const turnkeyWallet = process.env.TURNKEY_WALLET_ADDRESS ?? '';
  const accessFeeRecipient = process.env.ACCESS_FEE_RECIPIENT ?? '';
  const accessFeeAmount = process.env.ACCESS_FEE_AMOUNT ?? '1';

  const keeperhub = new HttpKeeperHubClient({
    apiKey: keeperhubApiKey,
    apiUrl: keeperhubApiUrl,
  });
  const evidenceStore = new EvidenceStore({
    privateKey,
    evmRpc,
    indexerUrl,
  });
  const localDbPath = resolve(
    process.env.LOCAL_DB_PATH ?? "./data/strategyforge.db",
  );
  const localStore = createLocalStore(localDbPath);
  console.log(`[Factory] Local SQLite store: ${localDbPath}`);

  const kvStore = new KVStore({
    privateKey,
    evmRpc,
    kvNodeRpc,
    streamId,
    indexerUrl,
    flowContractAddress: process.env.OG_FLOW_CONTRACT_ADDRESS,
    storageUrl: process.env.OG_STORAGE_URL,
    localStore,
  });

  const inference = await createInferenceClient({ privateKey, evmRpc });
  const llama = new DefiLlamaClient();
  const researcher = new Researcher(llama, inference);
  const strategist = new Strategist(inference);
  const critic = new Critic(inference);
  const compiler = new Compiler(keeperhub);
  const compilerInit = await compiler.init();
  if (!compilerInit.ok) {
    throw compilerInit.error;
  }

  const pipeline = new PipelineOrchestrator({
    researcher,
    strategist,
    critic,
    compiler,
    riskValidator: new RiskValidator(),
    evidenceStore,
    keeperhub,
  });

  const updateOrchestrator = new UpdateOrchestrator(
    pipeline,
    evidenceStore,
    kvStore,
    {
      keeperhubApiUrl,
      keeperhubApiKey,
    },
  );

  const strategyTelemetryService = new StrategyTelemetryService({
    kvStore,
    localDb: localStore,
    llama,
  });

  return {
    keeperhub,
    evidenceStore,
    kvStore,
    localDb: localStore,
    strategyTelemetryService,
    createOrchestrator: new CreateOrchestrator(pipeline),
    updateOrchestrator,
    signer: new Wallet(privateKey, new JsonRpcProvider(evmRpc)),
    agentRegistryAddress,
    reputationLedgerAddress: process.env.REPUTATION_LEDGER_ADDRESS ?? null,
    inftAddress: process.env.INFT_ADDRESS ?? null,
    agentId,
    keeperhubPricePerRun,
    keeperhubPaymentNetwork,
    keeperhubPublishOnDeploy,
    turnkeyWallet,
    accessFeeRecipient,
    accessFeeAmount,
  };
}

async function createInferenceClient(params: {
  privateKey: string;
  evmRpc: string;
}): Promise<ProxyInference | SealedInference> {
  const proxyApiKey = process.env.OG_COMPUTE_API_KEY;

  if (proxyApiKey) {
    const proxy = new ProxyInference({
      apiKey: proxyApiKey,
      baseURL: process.env.OG_COMPUTE_URL,
      model: process.env.OG_COMPUTE_MODEL,
      fallbackModels: splitCsv(process.env.OG_COMPUTE_FALLBACK_MODELS),
    });
    const initResult = await proxy.init();
    if (!initResult.ok) {
      throw initResult.error;
    }
    return proxy;
  }

  const sealed = new SealedInference(params);
  const initResult = await sealed.init();
  if (!initResult.ok) {
    throw initResult.error;
  }
  return sealed;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseAgentId(raw: string): number {
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid AGENT_ID: ${raw}`);
  }
  return parsed;
}

function splitCsv(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}
