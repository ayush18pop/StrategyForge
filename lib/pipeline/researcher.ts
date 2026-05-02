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
  "relevantProtocols": string[],
  "currentState": object,
  "signals": { "subject": string, "signal": string, "severity": "low"|"medium"|"high" }[],
  "priorLessons": string[],
  "recommendation": string
}`;

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
