import type { WorkflowSpec, CandidateWorkflow } from '@strategyforge/core';

// ─── Types ───────────────────────────────────────────────────────

export interface ValidationResult {
  passed: boolean;
  warnings: string[];
  violations: string[];
}

// ─── RiskValidator ───────────────────────────────────────────────

export class RiskValidator {
  validate(
    spec: WorkflowSpec,
    candidate: CandidateWorkflow,
    amountUSD: number,
  ): ValidationResult {
    const violations: string[] = [];
    const warnings: string[] = [];

    // Workflow must have at least one node
    if (spec.nodes.length === 0) {
      violations.push('WorkflowSpec has no nodes');
    }

    // Node bounds checks
    const { nodes } = candidate;
    for (const node of nodes) {
      // Node type validation happens during workflow compilation
      if (!node.type) {
        warnings.push(`Node ${node.id} is missing a type`);
      }
    }

    // Warn if any node uses the code/run-code fallback (needs manual review)
    const fallbackNodes = spec.nodes.filter(n => n.type === 'code/run-code');
    if (fallbackNodes.length > 0) {
      warnings.push(
        `${fallbackNodes.length} node(s) use code/run-code fallback and require manual configuration: ${fallbackNodes.map(n => n.id).join(', ')}`,
      );
    }

    // All edges must reference existing nodes
    const nodeIds = new Set(spec.nodes.map(n => n.id));
    nodeIds.add('trigger');
    for (const edge of spec.edges) {
      if (!nodeIds.has(edge.source)) {
        violations.push(`Edge references unknown source node: ${edge.source}`);
      }
      if (!nodeIds.has(edge.target)) {
        violations.push(`Edge references unknown target node: ${edge.target}`);
      }
    }

    return {
      passed: violations.length === 0,
      warnings,
      violations,
    };
  }
}
