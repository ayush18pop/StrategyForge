import { llmCall } from '../openrouter';

const SYSTEM_PROMPT = `You are a DeFi research agent. Analyze the user's goal and current market conditions.
Return JSON only. No explanation outside the JSON.

You have access to these data inputs:
- User's goal (natural language)
- Current market data (APYs from DefiLlama)
- User's wallet state (from KeeperHub or on-chain)
- Prior version failures (if this is v2+)

Return this exact JSON structure:
{
  "goalClassification": "yield_optimization" | "risk_monitoring" | "savings_automation" | "rebalancing",
  "targetNetwork": "mainnet" | "polygon" | "arbitrum" | "optimism" | "base" | "sepolia" | "bsc",
  "relevantProtocols": string[],
  "currentState": object,
  "signals": { "subject": string, "signal": string, "severity": "low"|"medium"|"high" }[],
  "priorLessons": string[],
  "recommendation": string
}

IMPORTANT: Extract targetNetwork from the user's goal. If the user says "polygon", "matic", "on polygon" → "polygon". "arbitrum", "arb" → "arbitrum". "optimism", "op" → "optimism". "base" → "base". Default to "mainnet" only if no network is mentioned.

CRITICAL — PRIOR FAILURES: If priorLessons is non-empty, treat each lesson as a HARD CONSTRAINT. These are real execution failures from the previous version. You MUST recommend alternative protocols that avoid the exact failure described. Never suggest a protocol/network combination that appears in priorLessons.`;

export async function runResearcher({
  openrouterApiKey,
  model,
  goal,
  marketData,
  walletState,
  actionSchemas,
  priorLessons
}: {
  openrouterApiKey: string;
  model: string;
  goal: string;
  marketData: any;
  walletState: any;
  actionSchemas: any;
  priorLessons: string[];
}) {
  const userPrompt = JSON.stringify({ goal, marketData, walletState, actionSchemas, priorLessons });
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
