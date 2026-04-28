import type { WorkflowSpec, WorkflowNode, WorkflowEdge } from '@strategyforge/core';
import { PROTOCOL_REGISTRY } from './protocol-registry.js';

// Maps a known supply action type to its corresponding withdraw action type.
// Returns null for nodes that are not protocol supply/deposit steps
// (e.g. trigger copies, logic nodes, transfer nodes).
function resolveWithdrawAction(supplyType: string): string | null {
  for (const entry of PROTOCOL_REGISTRY) {
    if (entry.supplyAction === supplyType) {
      return entry.withdrawAction;
    }
  }
  return null;
}

// Extract only the action nodes from a WorkflowSpec — i.e. not the trigger node,
// not logic/condition nodes. We identify action nodes by the presence of a
// withdraw counterpart in the registry.
function extractSupplyNodes(spec: WorkflowSpec): WorkflowNode[] {
  return spec.nodes.filter((node) => resolveWithdrawAction(node.type) !== null);
}

// Build a withdraw node from a v1 supply node.
// Config is inherited as-is. KeeperHub uses the same config shape for both
// supply and withdraw on all supported protocols (amount + asset).
function buildWithdrawNode(supplyNode: WorkflowNode, index: number): WorkflowNode {
  const withdrawType = resolveWithdrawAction(supplyNode.type);
  if (!withdrawType) {
    throw new Error(`No withdraw action found for supply type: ${supplyNode.type}`);
  }

  return {
    id: `migrate-withdraw-${index}`,
    type: withdrawType,
    // Carry over the original config so amount/asset/pool/market fields are preserved.
    config: { ...supplyNode.config },
    label: `Unwind ${supplyNode.label ?? supplyNode.id}`,
  };
}

// Build a fresh v2 deposit node, re-keyed to avoid ID collisions with v1 nodes.
function buildDepositNode(v2Node: WorkflowNode, index: number): WorkflowNode {
  return {
    ...v2Node,
    id: `migrate-deposit-${index}`,
    label: `Deploy ${v2Node.label ?? v2Node.id}`,
  };
}

// Build a sequential edge chain through a list of node IDs.
// trigger → node[0] → node[1] → ... → node[n-1]
function buildChain(nodeIds: string[]): WorkflowEdge[] {
  const edges: WorkflowEdge[] = [];
  let prev = 'trigger';
  for (const id of nodeIds) {
    edges.push({ source: prev, target: id });
    prev = id;
  }
  return edges;
}

export interface MigrationWorkflow {
  spec: WorkflowSpec;
  withdrawNodeCount: number;
  depositNodeCount: number;
}

/**
 * Build a one-shot migration workflow that:
 *   1. Withdraws from all v1 supply positions (unwind)
 *   2. Deposits into all v2 supply positions (re-deploy)
 *
 * The workflow uses a manual trigger so it runs exactly once when called.
 * Funds sit in the Turnkey agentic wallet between step 1 and step 2.
 *
 * Returns null if v1 has no recognizable supply positions to unwind.
 */
export function buildMigrationWorkflow(
  v1Spec: WorkflowSpec,
  v2Spec: WorkflowSpec,
  familyId: string,
  fromVersion: number,
  toVersion: number,
): MigrationWorkflow | null {
  const v1SupplyNodes = extractSupplyNodes(v1Spec);
  if (v1SupplyNodes.length === 0) {
    return null; // Nothing to unwind — nothing to do.
  }

  const v2SupplyNodes = extractSupplyNodes(v2Spec);

  const withdrawNodes = v1SupplyNodes.map((node, i) => buildWithdrawNode(node, i));
  const depositNodes = v2SupplyNodes.map((node, i) => buildDepositNode(node, i));

  const allNodes = [...withdrawNodes, ...depositNodes];
  const allNodeIds = allNodes.map((n) => n.id);
  const edges = buildChain(allNodeIds);

  const spec: WorkflowSpec = {
    name: `StrategyForge — migrate ${familyId} v${fromVersion}→v${toVersion}`,
    description:
      `One-shot migration: unwind v${fromVersion} positions then re-deploy into v${toVersion}. ` +
      `Funds transit through the Turnkey agentic wallet between steps.`,
    trigger: {
      type: 'manual',
      config: {},
    },
    nodes: allNodes,
    edges,
  };

  return {
    spec,
    withdrawNodeCount: withdrawNodes.length,
    depositNodeCount: depositNodes.length,
  };
}
