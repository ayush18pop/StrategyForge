import { llmCall } from '../openrouter';

const SYSTEM_PROMPT = `You are a DeFi strategy designer. Design 1 candidate KeeperHub workflow for the user's goal.
Return JSON only.

You must use ONLY these KeeperHub action types (provided in the user message).
The workflow must be a valid KeeperHub nodes+edges DAG.

CRITICAL — PRIOR FAILURES: The researcherOutput contains priorLessons — these are real execution failures. If priorLessons mentions a protocol that is not deployed on a network, you MUST NOT include any action using that protocol on that network. This is a hard constraint, not a suggestion. Pick a different protocol or different approach entirely.

Workflow node format:
{
  "id": "unique-id",
  "type": "action",
  "data": {
    "type": "action",
    "label": "Human readable label",
    "config": { 
      "actionType": "<actionType from schemas>",
      ...required fields 
    },
    "status": "idle"
  },
  "position": { "x": 120, "y": 240 }
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

Return exactly 1 candidate in this format:
{
  "candidates": [
    {
      "id": "A",
      "name": "Strategy name",
      "description": "What it does",
      "hypothesis": "Why this approach",
      "workflow": { "name": "...", "nodes": [], "edges": [] }
    }
  ]
}`;

export async function runStrategist({
  openrouterApiKey,
  model,
  researcherOutput,
  actionSchemas,
  walletAddress,
  priorVersionWorkflow
}: {
  openrouterApiKey: string;
  model: string;
  researcherOutput: any;
  actionSchemas: any;
  walletAddress: string;
  priorVersionWorkflow: any;
}) {
  const userPrompt = JSON.stringify({ researcherOutput, actionSchemas, walletAddress, priorVersionWorkflow });
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
