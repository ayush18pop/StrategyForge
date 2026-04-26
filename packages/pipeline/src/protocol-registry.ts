// Mapping between DefiLlama project names, normalized protocol IDs, and KeeperHub action types.
// All protocols here are confirmed to have supply/deposit actions in the KeeperHub schemas dump.

export interface ProtocolEntry {
  id: string;               // normalized ID used throughout the pipeline
  llamaProjects: string[];  // DefiLlama project name fragments (case-insensitive match)
  supplyAction: string;     // KeeperHub action type for supply/deposit
  withdrawAction: string;   // KeeperHub action type for withdraw/redeem
  defaultP: number;         // P(achieves stated APY) — prior for Kelly computation
  defaultL: number;         // expected loss magnitude if exploit
  category: 'lending' | 'vault' | 'lp';
}

export const PROTOCOL_REGISTRY: ProtocolEntry[] = [
  {
    id: 'aave-v3',
    llamaProjects: ['aave-v3', 'aave v3'],
    supplyAction: 'aave-v3/supply',
    withdrawAction: 'aave-v3/withdraw',
    defaultP: 0.95,
    defaultL: 0.01,
    category: 'lending',
  },
  {
    id: 'aave-v4',
    llamaProjects: ['aave-v4', 'aave v4'],
    supplyAction: 'aave-v4/supply',
    withdrawAction: 'aave-v4/withdraw',
    defaultP: 0.90,
    defaultL: 0.02,
    category: 'lending',
  },
  {
    id: 'morpho',
    llamaProjects: ['morpho', 'morpho-blue', 'morpho blue', 'morphovault'],
    supplyAction: 'morpho/vault-deposit',
    withdrawAction: 'morpho/vault-withdraw',
    defaultP: 0.88,
    defaultL: 0.05,
    category: 'vault',
  },
  {
    id: 'spark',
    llamaProjects: ['spark', 'sparkdex', 'spark protocol', 'spark-lend'],
    supplyAction: 'spark/supply',
    withdrawAction: 'spark/withdraw',
    defaultP: 0.93,
    defaultL: 0.02,
    category: 'lending',
  },
  {
    id: 'compound',
    llamaProjects: ['compound', 'compound-v3', 'compound v3', 'compoundv3'],
    supplyAction: 'compound/supply',
    withdrawAction: 'compound/withdraw',
    defaultP: 0.92,
    defaultL: 0.02,
    category: 'lending',
  },
  {
    id: 'sky',
    llamaProjects: ['sky', 'sky money', 'makerdao-sky', 'susds', 'sdai'],
    supplyAction: 'sky/vault-deposit',
    withdrawAction: 'sky/vault-withdraw',
    defaultP: 0.91,
    defaultL: 0.02,
    category: 'vault',
  },
  {
    id: 'ethena',
    llamaProjects: ['ethena', 'ethena labs', 'susde', 'usde'],
    supplyAction: 'ethena/vault-deposit',
    withdrawAction: 'ethena/vault-withdraw',
    defaultP: 0.80,
    defaultL: 0.08,
    category: 'vault',
  },
  {
    id: 'yearn',
    llamaProjects: ['yearn', 'yearn-finance', 'yearn finance', 'yv'],
    supplyAction: 'yearn/vault-deposit',
    withdrawAction: 'yearn/vault-withdraw',
    defaultP: 0.85,
    defaultL: 0.04,
    category: 'vault',
  },
];

// Build lookup maps for fast access
const byId = new Map(PROTOCOL_REGISTRY.map(p => [p.id, p]));

export function lookupById(id: string): ProtocolEntry | undefined {
  return byId.get(id);
}

export function matchLlamaProject(project: string): ProtocolEntry | undefined {
  const lower = project.toLowerCase();
  return PROTOCOL_REGISTRY.find(entry =>
    entry.llamaProjects.some(name => lower.includes(name) || name.includes(lower))
  );
}

export function supplyActionFor(protocolId: string): string | null {
  return byId.get(protocolId)?.supplyAction ?? null;
}

export function withdrawActionFor(protocolId: string): string | null {
  return byId.get(protocolId)?.withdrawAction ?? null;
}
