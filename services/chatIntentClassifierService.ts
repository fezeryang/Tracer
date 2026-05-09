import { Language } from '../i18n';
import { ChatGoal, ChatGoalIntent } from './chatGoalCompiler';

export type DeepSeekIntent =
  | ChatGoalIntent
  | 'none';

export interface DeepSeekIntentResult {
  intent: DeepSeekIntent;
  ticker: string | null;
  confidence: number;
  shouldExecute: boolean;
  command: string | null;
  needsClarification: boolean;
  clarifyingQuestion: string | null;
  reason: string;
}

interface ClassifyChatIntentInput {
  text: string;
  selectedTicker?: string;
  language: Language;
  localGoal?: ChatGoal;
}

const VALID_INTENTS = new Set([
  'quote', 'news', 'fundamentals', 'history', 'chart', 'verified_news',
  'sec', 'official', 'trust', 'evidence', 'report', 'chain', 'backtest',
  'impact', 'macro', 'insiders', 'earnings', 'dividends', 'help', 'clear',
  'general_analysis', 'none', 'unknown',
]);

const normalizeResult = (value: any): DeepSeekIntentResult | null => {
  if (!value || typeof value !== 'object') return null;
  const intent = VALID_INTENTS.has(value.intent) ? value.intent as DeepSeekIntent : 'unknown';
  const confidence = Number(value.confidence);
  if (!Number.isFinite(confidence)) return null;

  return {
    intent,
    ticker: typeof value.ticker === 'string' ? value.ticker.trim().toUpperCase() : null,
    confidence: Math.max(0, Math.min(1, confidence)),
    shouldExecute: Boolean(value.shouldExecute),
    command: typeof value.command === 'string' && value.command.trim() ? value.command.trim() : null,
    needsClarification: Boolean(value.needsClarification),
    clarifyingQuestion: typeof value.clarifyingQuestion === 'string' && value.clarifyingQuestion.trim()
      ? value.clarifyingQuestion.trim()
      : null,
    reason: typeof value.reason === 'string' ? value.reason : '',
  };
};

export async function classifyChatIntentWithDeepSeek(input: ClassifyChatIntentInput): Promise<DeepSeekIntentResult | null> {
  try {
    const response = await fetch('/api/chat/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        input: input.text,
        selectedTicker: input.selectedTicker || undefined,
        language: input.language,
        localGoal: input.localGoal ? {
          intent: input.localGoal.intent,
          ticker: input.localGoal.ticker,
          confidence: input.localGoal.confidence,
          reason: input.localGoal.reason,
        } : undefined,
      }),
    });

    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload?.ok || !payload?.available || !payload?.result) return null;
    return normalizeResult(payload.result);
  } catch (error) {
    console.warn('[Chat Intent Classifier] unavailable', error);
    return null;
  }
}
