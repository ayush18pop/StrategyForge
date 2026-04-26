import { describe, it, expect, mock, beforeAll } from 'bun:test';
import type { StrategyGoal, CandidateWorkflow, SealedInferenceResult, Result, MarketSnapshot, BoundsResult, EvidenceBundle, StepEvidence } from '@strategyforge/core';
import { ok, err } from '@strategyforge/core';
import { Researcher, type InferenceClient } from './researcher.js';
import { Strategist } from './strategist.js';
import { Critic } from './critic.js';
import { Compiler } from './compiler.js';
import { RiskValidator } from './risk-validator.js';

// ─── Fixtures ───────────────────────────────────────────────

const GOAL: StrategyGoal = { asset: 'USDC', amount: 50_000, riskLevel: 'balanced', horizon: '12 months', chains: ['ethereum'] };

function mockInference(jsonResp: object): InferenceClient {
  return {
    infer: mock(async (): Promise<Result<SealedInferenceResult>> => ok({
      response: JSON.stringify(jsonResp),
      attestationHash: '0xmork',
      model: 'test',
      provider: 'test'
    }))
  };
}

function mockSequenceInference(responses: string[]): InferenceClient {
  let index = 0;
  return {
    infer: mock(async (): Promise<Result<SealedInferenceResult>> => {
      const response = responses[Math.min(index, responses.length - 1)] ?? '';
      index += 1;
      return ok({
        response,
        attestationHash: `0xmork${index}`,
        model: 'test',
        provider: 'test',
      });
    }),
  };
}

// ─── Tests ──────────────────────────────────────────────────

describe('Pipeline Pipeline Components', () => {

  it('Researcher generates LogicNodeConfigs', async () => {
    const llama = {
      getYieldPools: async () => ok([{ project: 'aave-v3', chain: 'ethereum', pool: 'p1', apy: 5, tvlUsd: 1e8, stablecoin: true }]),
      getHistoricalAPY: async () => ok([]),
      getProtocolTVL: async () => ok({ tvl: 1e8, change7d: 0 })
    };
    const researcher = new Researcher(llama as any, mockInference({ contextType: 'yield', suitableActions: ['action.mock'], signals: [], regime: 'stable' }));
    const result = await researcher.run({ goal: GOAL, priorVersions: [], actualOutcomes: null, triggerReason: 'user_request', actionSchemas: [{ type: 'action.mock' } as any] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.suitableActions.length).toBeGreaterThan(0);
    expect(result.value.suitableActions[0]).toBe('action.mock');
  });

  it('Strategist generates CandidateWorkflows', async () => {
    const candidates: CandidateWorkflow[] = [{
      id: 'A',
      nodes: [{ id: 'aave-v3', type: 'action', config: {} }],
      edges: [],
      hypothesis: 'test',
      confidence: 0.9
    }];
    const strategist = new Strategist(mockInference({ candidates }));
    const resOutput = {
      snapshot: { protocols: [], fetchedAt: 0 },
      contextType: 'yield',
      suitableActions: [], signals: [], regime: 'stable' as const, filteredOut: [],
      evidence: {} as any
    };
    const result = await strategist.run({ goal: GOAL, researcherOutput: resOutput, priorVersions: [], actionSchemas: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.candidates.length).toBe(1);
    expect(result.value.candidates[0]?.id).toBe('A');
  });

  it('Strategist salvages JS-style stringified workflow parts', async () => {
    const strategist = new Strategist(mockInference({
      candidates: [
        {
          id: 'A',
          trigger: '{ type: "schedule", config: { cron: "0 0 * * *" } }',
          nodes: '[{ id: "check-balance", type: "web3/check-balance", label: "Check Balance", config: { network: "1", address: "0xYOUR_WALLET_ADDRESS" } }, { id: "notify", type: "discord/send-message", label: "Notify", config: { discordMessage: "ready" } }]',
          edges: '[{ source: "trigger", target: "check-balance" }, { source: "check-balance", target: "notify" }]',
          hypothesis: 'Recovered from JSON-ish strings',
          confidence: 0.84,
        },
      ],
    }));
    const resOutput = {
      snapshot: { protocols: [], fetchedAt: 0 },
      contextType: 'yield',
      suitableActions: ['web3/check-balance', 'discord/send-message'],
      signals: [],
      regime: 'stable' as const,
      filteredOut: [],
      evidence: {} as any,
    };

    const result = await strategist.run({ goal: GOAL, researcherOutput: resOutput, priorVersions: [], actionSchemas: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.candidates.length).toBe(1);
    expect(result.value.candidates[0]?.trigger?.type).toBe('schedule');
    expect(result.value.candidates[0]?.nodes.map(node => node.id)).toEqual(['check-balance', 'notify']);
    expect(result.value.candidates[0]?.edges.length).toBe(2);
    expect((result.value.evidence.output as any).usedFallback).toBe(false);
  });

  it('Strategist retries with a repair pass before placeholder fallback', async () => {
    const inference = mockSequenceInference([
      'not valid json at all',
      JSON.stringify({
        candidates: [
          {
            id: 'A',
            trigger: { type: 'schedule', config: { cron: '0 */6 * * *' } },
            nodes: [
              {
                id: 'check-balance',
                type: 'web3/check-balance',
                config: { network: '1', address: '0xYOUR_WALLET_ADDRESS' },
              },
            ],
            edges: [{ source: 'trigger', target: 'check-balance' }],
            hypothesis: 'Repair pass recovered a valid workflow',
            confidence: 0.72,
          },
        ],
      }),
    ]);
    const strategist = new Strategist(inference);
    const resOutput = {
      snapshot: { protocols: [], fetchedAt: 0 },
      contextType: 'yield',
      suitableActions: ['web3/check-balance'],
      signals: [],
      regime: 'stable' as const,
      filteredOut: [],
      evidence: {} as any,
    };

    const result = await strategist.run({ goal: GOAL, researcherOutput: resOutput, priorVersions: [], actionSchemas: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.candidates.length).toBe(1);
    expect(result.value.candidates[0]?.id).toBe('A');
    expect((inference.infer as any).mock.calls.length).toBe(2);
    expect((result.value.evidence.output as any).recoveryStagesUsed).toEqual(['repair']);
    expect((result.value.evidence.output as any).usedFallback).toBe(false);
  });

  it('Critic validates BoundsResults instead of VaR', async () => {
    const critic = new Critic(mockInference({ verdicts: [], selectedCandidateId: 'A', mandatoryConstraints: [], updatedLogicNodes: [] }));
    const candidate: CandidateWorkflow = { id: 'A', nodes: [], edges: [], hypothesis: '', confidence: 1 };

    const result = await critic.run({ goal: GOAL, candidates: [candidate], priorFailures: [], snapshot: { protocols: [], fetchedAt: 0 } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.selectedCandidate.id).toBe('A');
    expect(result.value.boundsResults.length).toBe(1);
  });

  it('Compiler generates WorkflowSpecs', async () => {
    const hub = { listActionSchemas: async () => ok([{ type: 'aave-v3/supply', label: 'test' }]) };
    const compiler = new Compiler(hub as any);
    await compiler.init();
    const candidate: CandidateWorkflow = { id: 'A', nodes: [{ id: 'aave-v3', type: 'action', config: {} }], edges: [{ source: 'trigger', target: 'aave-v3' }], hypothesis: '', confidence: 0.9 };
    const result = compiler.compile({ goal: GOAL, selectedCandidate: candidate, constraints: [] });
    expect(result.workflowSpec.nodes.length).toBe(1);
    expect(result.workflowSpec.edges.length).toBe(1);
  });

  it('RiskValidator passes valid node-edge setups', () => {
    const valid = new RiskValidator();
    const spec = { nodes: [{ id: 'node1', type: 'aave-v3/supply', config: {} }], edges: [{ source: 'trigger', target: 'node1' }], name: 'test', description: 'test', trigger: { type: 'schedule' as const, config: {} } };
    const candidate: CandidateWorkflow = { id: 'A', nodes: [{ id: 'aave-v3', type: 'action', config: { maxSlippage: '0.1%' } }], edges: [], hypothesis: '', confidence: 1 };
    const result = valid.validate(spec, candidate, 50000);
    expect(result.passed).toBe(true);
  });

});
