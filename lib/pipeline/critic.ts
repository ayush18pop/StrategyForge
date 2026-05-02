import { llmCall } from '../openrouter';

const SYSTEM_PROMPT = `You are an adversarial DeFi strategy critic. Evaluate the provided candidate workflow.
Return JSON only.

If this is v2+, you MUST reference prior version failures explicitly in your rationale.
The "evidenceOfLearning" field must contain a direct quote explaining what v1 got wrong
and how this version fixes it. This field cannot be empty for v2+.

Return exactly this JSON:
{
  "selected": "<id of the candidate>",
  "rationale": "Why this candidate is sound",
  "attacksOnRejected": "Potential attack vectors or weaknesses in this candidate",
  "priorLessonsApplied": string[],
  "evidenceOfLearning": string,
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
