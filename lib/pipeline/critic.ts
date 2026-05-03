import { llmCall } from '../openrouter';

const SYSTEM_PROMPT = `You are an adversarial DeFi strategy critic. Evaluate the provided candidate workflow.
Return JSON only.

If this is v2+, you MUST:
1. Check that the candidate does NOT use any protocol/network combination listed in priorExecutionFailures. If it does, you MUST flag this as a fatal flaw in attacksOnRejected and the evidenceOfLearning must specifically call out what the previous version got wrong.
2. The "evidenceOfLearning" field must name the SPECIFIC protocol that failed, the SPECIFIC network it failed on, and what alternative was chosen instead. Generic statements like "we improved the strategy" are NOT acceptable.
3. "priorLessonsApplied" must list each failure from priorExecutionFailures and how it was addressed.

Return exactly this JSON:
{
  "selected": "<id of the candidate>",
  "rationale": "Why this candidate is sound",
  "attacksOnRejected": "Potential attack vectors or weaknesses — MUST call out if candidate repeats prior failures",
  "priorLessonsApplied": string[],
  "evidenceOfLearning": "MUST name: what failed, on which network, and what alternative was chosen",
  "riskWarnings": string[]
}`;

export async function runCritic({
  openrouterApiKey,
  model,
  candidates,
  priorVersionCriticOutput,
  priorExecutionFailures
}: {
  openrouterApiKey: string;
  model: string;
  candidates: any[];
  priorVersionCriticOutput: any;
  priorExecutionFailures: string[];
}) {
  const userPrompt = JSON.stringify({ candidates, priorVersionCriticOutput, priorExecutionFailures });
  const { content, requestId } = await llmCall(openrouterApiKey, SYSTEM_PROMPT, userPrompt, model);

  try {
    return {
      output: JSON.parse(content),
      attestationId: requestId,
      timestamp: new Date()
    };
  } catch (e: any) {
    throw new Error(`Failed to parse LLM response as JSON: ${e.message}. Content: ${content.substring(0, 500)}...`);
  }
}
