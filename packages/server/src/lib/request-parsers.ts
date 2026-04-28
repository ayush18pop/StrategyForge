import type {
  StrategyGoal,
  UpdateTrigger,
  WorkflowEdge,
  WorkflowNode,
  WorkflowSpec,
} from '@strategyforge/core';
import { normalizeWalletAddress } from './wallet-address.js';

type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown): UnknownRecord | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

export function parseGoal(input: unknown): StrategyGoal | null {
  const record = asRecord(input);
  if (!record) {
    return null;
  }

  const asset = record.asset;
  const amount = record.amount;
  const riskLevel = record.riskLevel;
  const horizon = record.horizon;
  const chains = record.chains;
  const targetYield = record.targetYield;

  if (
    typeof asset !== 'string' ||
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    !isRiskLevel(riskLevel) ||
    typeof horizon !== 'string' ||
    !Array.isArray(chains) ||
    !chains.every((chain): chain is string => typeof chain === 'string') ||
    typeof targetYield !== 'number' ||
    !Number.isFinite(targetYield)
  ) {
    return null;
  }

  return {
    asset,
    amount,
    riskLevel,
    horizon,
    chains,
    targetYield,
  };
}

export function parseCreateBody(input: unknown): {
  goal: StrategyGoal;
  userWalletAddress: string;
} | null {
  const record = asRecord(input);
  if (!record) {
    return null;
  }

  const goal = parseGoal(record.goal ?? input);
  const rawWalletAddress = record.userWalletAddress;
  const userWalletAddress =
    typeof rawWalletAddress === 'string'
      ? normalizeWalletAddress(rawWalletAddress)
      : null;

  if (!goal || !userWalletAddress) {
    return null;
  }

  return { goal, userWalletAddress };
}

export function parseUpdateTrigger(input: unknown): UpdateTrigger | null {
  const record = asRecord(input);
  if (!record) {
    return null;
  }

  const nestedTrigger = 'trigger' in record ? parseUpdateTrigger(record.trigger) : null;
  if (nestedTrigger) {
    return nestedTrigger;
  }

  const reason = record.reason;
  if (reason === 'scheduled_review') {
    return { reason };
  }

  if (reason === 'apy_drift' && typeof record.delta === 'number' && Number.isFinite(record.delta)) {
    return { reason, delta: record.delta };
  }

  if (
    reason === 'underperformance' &&
    typeof record.actualVsPredicted === 'number' &&
    Number.isFinite(record.actualVsPredicted)
  ) {
    return { reason, actualVsPredicted: record.actualVsPredicted };
  }

  if (
    reason === 'protocol_incident' &&
    typeof record.protocol === 'string' &&
    typeof record.description === 'string'
  ) {
    return {
      reason,
      protocol: record.protocol,
      description: record.description,
    };
  }

  return null;
}

export function parseWorkflowSpec(input: unknown): WorkflowSpec | null {
  const record = asRecord(input);
  if (!record) {
    return null;
  }

  const name = record.name;
  const description = record.description;
  const trigger = parseTrigger(record.trigger);
  const nodes = parseNodes(record.nodes);
  const edges = parseEdges(record.edges);

  if (
    typeof name !== 'string' ||
    typeof description !== 'string' ||
    !trigger ||
    !nodes ||
    !edges
  ) {
    return null;
  }

  return {
    name,
    description,
    trigger,
    nodes,
    edges,
  };
}

function isRiskLevel(value: unknown): value is StrategyGoal['riskLevel'] {
  return value === 'conservative' || value === 'balanced';
}

function parseTrigger(input: unknown): WorkflowSpec['trigger'] | null {
  const record = asRecord(input);
  if (!record) {
    return null;
  }

  const type = record.type;
  const config = asRecord(record.config);

  if (
    (type === 'schedule' || type === 'manual' || type === 'webhook' || type === 'event') &&
    config
  ) {
    return {
      type,
      config,
    };
  }

  return null;
}

function parseNodes(input: unknown): WorkflowNode[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const nodes: WorkflowNode[] = [];
  for (const entry of input) {
    const record = asRecord(entry);
    if (!record) {
      return null;
    }

    const id = record.id;
    const type = record.type;
    const config = asRecord(record.config);
    const label = record.label;

    if (
      typeof id !== 'string' ||
      typeof type !== 'string' ||
      !config ||
      (label !== undefined && typeof label !== 'string')
    ) {
      return null;
    }

    nodes.push({
      id,
      type,
      config,
      ...(typeof label === 'string' ? { label } : {}),
    });
  }

  return nodes;
}

function parseEdges(input: unknown): WorkflowEdge[] | null {
  if (!Array.isArray(input)) {
    return null;
  }

  const edges: WorkflowEdge[] = [];
  for (const entry of input) {
    const record = asRecord(entry);
    if (!record) {
      return null;
    }

    const source = record.source;
    const target = record.target;
    const sourceHandle = record.sourceHandle;

    if (
      typeof source !== 'string' ||
      typeof target !== 'string' ||
      (sourceHandle !== undefined && typeof sourceHandle !== 'string')
    ) {
      return null;
    }

    edges.push({
      source,
      target,
      ...(typeof sourceHandle === 'string' ? { sourceHandle } : {}),
    });
  }

  return edges;
}
