import type { ParsedGoal, SearchChip, StrategyRiskLevel } from '../features/search/types';

const MONEY_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const KNOWN_ASSETS = ['USDC', 'USDT', 'DAI', 'ETH', 'WETH'] as const;
const KNOWN_CHAINS = ['ethereum', 'base', 'arbitrum', 'optimism', 'polygon', 'avalanche'] as const;

export function parseGoalInput(raw: string): ParsedGoal {
  const trimmed = raw.trim();
  const chips: SearchChip[] = [];

  if (!trimmed) {
    return {
      raw,
      chips,
      confidence: 0,
      missing: ['amount', 'asset', 'risk', 'horizon', 'chain'],
      note: 'Try a sentence like “$50K USDC, medium risk, 6 months, Ethereum.”',
    };
  }

  const amountMatch = trimmed.match(/\$?\s?(\d+(?:\.\d+)?)\s*(k|m)?/i);
  const amountUsd = amountMatch ? normalizeAmount(Number(amountMatch[1]), amountMatch[2]) : undefined;
  if (amountUsd) {
    chips.push({ kind: 'amount', label: MONEY_FORMATTER.format(amountUsd) });
  }

  const asset = KNOWN_ASSETS.find((candidate) => new RegExp(`\\b${candidate}\\b`, 'i').test(trimmed));
  if (asset) {
    chips.push({ kind: 'asset', label: asset });
  }

  const riskLevel = parseRisk(trimmed);
  if (riskLevel) {
    chips.push({ kind: 'risk', label: riskLevel === 'balanced' ? 'Medium risk' : 'Conservative' });
  }

  const horizonMatch = trimmed.match(/\b(\d+)\s*(day|days|month|months|year|years)\b/i);
  const horizon = horizonMatch ? `${horizonMatch[1]} ${horizonMatch[2]}` : undefined;
  if (horizon) {
    chips.push({ kind: 'horizon', label: horizon });
  }

  const chain = KNOWN_CHAINS.find((candidate) => new RegExp(`\\b${candidate}\\b`, 'i').test(trimmed));
  if (chain) {
    chips.push({ kind: 'chain', label: capitalize(chain) });
  }

  const targetMatch = trimmed.match(/(\d+(?:\.\d+)?)\s*%/);
  const targetYieldBps = targetMatch ? Math.round(Number(targetMatch[1]) * 100) : undefined;
  if (targetYieldBps) {
    chips.push({ kind: 'target', label: `${(targetYieldBps / 100).toFixed(1)}% target` });
  }

  const extractedFields = [amountUsd, asset, riskLevel, horizon, chain].filter(Boolean).length;
  const missing = [
    !amountUsd ? 'amount' : null,
    !asset ? 'asset' : null,
    !riskLevel ? 'risk' : null,
    !horizon ? 'horizon' : null,
    !chain ? 'chain' : null,
  ].filter(Boolean) as string[];

  let confidence = Math.min(1, extractedFields / 5);
  if (targetYieldBps) {
    confidence = Math.min(1, confidence + 0.08);
  }

  return {
    raw,
    amountUsd,
    asset,
    riskLevel,
    horizon,
    chain: chain ? capitalize(chain) : undefined,
    targetYieldBps,
    chips,
    confidence,
    missing,
    note: confidence > 0 && confidence < 0.75 ? buildGuidanceNote(missing) : undefined,
  };
}

function normalizeAmount(amount: number, unit?: string): number {
  if (unit?.toLowerCase() === 'm') {
    return amount * 1_000_000;
  }

  if (unit?.toLowerCase() === 'k') {
    return amount * 1_000;
  }

  return amount;
}

function parseRisk(input: string): StrategyRiskLevel | undefined {
  if (/\b(medium|balanced)\b/i.test(input)) {
    return 'balanced';
  }

  if (/\b(low|safe|conservative)\b/i.test(input)) {
    return 'conservative';
  }

  return undefined;
}

function buildGuidanceNote(missing: string[]): string {
  if (missing.length === 0) {
    return 'Parsed confidently. Refine the sentence any time; results update live.';
  }

  return `Add ${missing.join(', ')} to improve the search match.`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
