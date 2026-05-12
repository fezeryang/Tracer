/**
 * Chat Phase C-7: Prompt Suggestion Service
 *
 * Pure functions for generating contextual prompt suggestions.
 * No React state — just data transformation.
 */

import { Language, t as i18nT } from '../i18n';
import { ShellViewMode } from '../types';

// ============================================================================
// Types
// ============================================================================

export type ChatSuggestionKind = 'prompt' | 'command' | 'navigation' | 'follow_up';

export interface ChatSuggestion {
  id: string;
  label: string;
  prompt: string;
  kind: ChatSuggestionKind;
  command?: string;
  view?: ShellViewMode;
  requiresTicker?: boolean;
  category?: 'market' | 'evidence' | 'report' | 'risk' | 'options' | 'macro' | 'learning' | 'general';
}

// ============================================================================
// Safety Filter
// ============================================================================

const UNSAFE_PATTERNS = [
  /buy|买入|做多|买入价|买进/i,
  /sell|卖出|做空|止损|止盈/i,
  /target.?price|目标价|入场|抄底|逃顶/i,
  /long|short|position|持仓/i,
  /bullish|bearish|做多|做空/i,
];

function isSafeSuggestion(suggestion: ChatSuggestion): boolean {
  const text = `${suggestion.label} ${suggestion.prompt}`.toLowerCase();
  return !UNSAFE_PATTERNS.some((p) => p.test(text));
}

// ============================================================================
// Helper
// ============================================================================

function makeId(prefix: string, suffix: string): string {
  return `${prefix}-${suffix}`;
}

// ============================================================================
// getStarterSuggestions
// ============================================================================

export interface GetStarterSuggestionsOptions {
  language: Language;
  selectedTicker?: string;
  contextTicker?: string;
}

/**
 * Returns 5 starter suggestions.
 * Without a ticker: general /help, /quote, /news, /fundamentals, /report
 * With a ticker: ticker-specific prompts
 */
export function getStarterSuggestions({
  language,
  selectedTicker,
  contextTicker,
}: GetStarterSuggestionsOptions): ChatSuggestion[] {
  const ticker = contextTicker || selectedTicker;

  if (!ticker) {
    // No ticker — general exploration commands
    return filterSafe([
      {
        id: makeId('starter', 'help'),
        label: i18nT(language, 'chat.suggestions.starter.help.label'),
        prompt: '/help',
        kind: 'command' as const,
        command: 'help',
        category: 'general' as const,
      },
      {
        id: makeId('starter', 'quote'),
        label: i18nT(language, 'chat.suggestions.starter.quote.label'),
        prompt: i18nT(language, 'chat.suggestions.starter.quote.prompt'),
        kind: 'command' as const,
        command: 'quote',
        requiresTicker: true,
        category: 'market' as const,
      },
      {
        id: makeId('starter', 'news'),
        label: i18nT(language, 'chat.suggestions.starter.news.label'),
        prompt: i18nT(language, 'chat.suggestions.starter.news.prompt'),
        kind: 'command' as const,
        command: 'news',
        requiresTicker: true,
        category: 'evidence' as const,
      },
      {
        id: makeId('starter', 'fundamentals'),
        label: i18nT(language, 'chat.suggestions.starter.fundamentals.label'),
        prompt: i18nT(language, 'chat.suggestions.starter.fundamentals.prompt'),
        kind: 'command' as const,
        command: 'fundamentals',
        requiresTicker: true,
        category: 'report' as const,
      },
      {
        id: makeId('starter', 'report'),
        label: i18nT(language, 'chat.suggestions.starter.report.label'),
        prompt: i18nT(language, 'chat.suggestions.starter.report.prompt'),
        kind: 'command' as const,
        command: 'report',
        requiresTicker: true,
        category: 'report' as const,
      },
    ]);
  }

  // With ticker — specific research prompts
  return filterSafe([
    {
      id: makeId('starter', 'quote-ticker'),
      label: i18nT(language, 'chat.suggestions.withTicker.quote.label', { ticker }),
      prompt: `/quote ${ticker}`,
      kind: 'command' as const,
      command: 'quote',
      requiresTicker: true,
      category: 'market' as const,
    },
    {
      id: makeId('starter', 'news-ticker'),
      label: i18nT(language, 'chat.suggestions.withTicker.news.label', { ticker }),
      prompt: `/news ${ticker}`,
      kind: 'command' as const,
      command: 'news',
      requiresTicker: true,
      category: 'evidence' as const,
    },
    {
      id: makeId('starter', 'trust-ticker'),
      label: i18nT(language, 'chat.suggestions.withTicker.trust.label', { ticker }),
      prompt: `/trust ${ticker}`,
      kind: 'command' as const,
      command: 'trust',
      requiresTicker: true,
      category: 'evidence' as const,
    },
    {
      id: makeId('starter', 'report-ticker'),
      label: i18nT(language, 'chat.suggestions.withTicker.report.label', { ticker }),
      prompt: `/report ${ticker}`,
      kind: 'command' as const,
      command: 'report',
      requiresTicker: true,
      category: 'report' as const,
    },
    {
      id: makeId('starter', 'chain-ticker'),
      label: i18nT(language, 'chat.suggestions.withTicker.chain.label', { ticker }),
      prompt: `/chain ${ticker}`,
      kind: 'navigation' as const,
      command: 'chain',
      requiresTicker: true,
      view: 'chain' as const,
      category: 'options' as const,
    },
  ]);
}

// ============================================================================
// getContextualSuggestions
// ============================================================================

export interface GetContextualSuggestionsOptions {
  language: Language;
  context?: {
    currentTicker?: string;
    lastCommand?: string;
    lastIntent?: string;
  };
  lastCommand?: string;
  lastIntent?: string;
}

/**
 * Maps lastCommand to contextual follow-up suggestions.
 */
export function getContextualSuggestions({
  language,
  context,
  lastCommand,
  lastIntent,
}: GetContextualSuggestionsOptions): ChatSuggestion[] {
  const ticker = context?.currentTicker || lastCommand?.split(' ')[1]?.toUpperCase();
  const command = lastCommand?.split(' ')[0]?.replace('/', '') || lastIntent || '';

  if (!ticker) return [];

  const suggestions: ChatSuggestion[] = [];

  switch (command) {
    case 'quote':
      suggestions.push(
        {
          id: makeId('ctx', 'quote-news'),
          label: i18nT(language, 'chat.suggestions.contextual.afterQuote.news.label', { ticker }),
          prompt: `/news ${ticker}`,
          kind: 'follow_up' as const,
          command: 'news',
          requiresTicker: true,
          category: 'evidence' as const,
        },
        {
          id: makeId('ctx', 'quote-history'),
          label: i18nT(language, 'chat.suggestions.contextual.afterQuote.history.label', { ticker }),
          prompt: `/history ${ticker}`,
          kind: 'command' as const,
          command: 'history',
          requiresTicker: true,
          category: 'market' as const,
        },
        {
          id: makeId('ctx', 'quote-trust'),
          label: i18nT(language, 'chat.suggestions.contextual.afterQuote.trust.label', { ticker }),
          prompt: `/trust ${ticker}`,
          kind: 'command' as const,
          command: 'trust',
          requiresTicker: true,
          category: 'evidence' as const,
        },
        {
          id: makeId('ctx', 'quote-report'),
          label: i18nT(language, 'chat.suggestions.contextual.afterQuote.report.label', { ticker }),
          prompt: `/report ${ticker}`,
          kind: 'command' as const,
          command: 'report',
          requiresTicker: true,
          category: 'report' as const,
        },
      );
      break;

    case 'news':
      suggestions.push(
        {
          id: makeId('ctx', 'news-trust'),
          label: i18nT(language, 'chat.suggestions.contextual.afterNews.trust.label', { ticker }),
          prompt: `/trust ${ticker}`,
          kind: 'command' as const,
          command: 'trust',
          requiresTicker: true,
          category: 'evidence' as const,
        },
        {
          id: makeId('ctx', 'news-sec'),
          label: i18nT(language, 'chat.suggestions.contextual.afterNews.sec.label', { ticker }),
          prompt: `/sec ${ticker}`,
          kind: 'command' as const,
          command: 'sec',
          requiresTicker: true,
          category: 'evidence' as const,
        },
        {
          id: makeId('ctx', 'news-report'),
          label: i18nT(language, 'chat.suggestions.contextual.afterNews.report.label', { ticker }),
          prompt: `/report ${ticker}`,
          kind: 'command' as const,
          command: 'report',
          requiresTicker: true,
          category: 'report' as const,
        },
      );
      break;

    case 'fundamentals':
      suggestions.push(
        {
          id: makeId('ctx', 'fund-report'),
          label: i18nT(language, 'chat.suggestions.contextual.afterFundamentals.report.label', { ticker }),
          prompt: `/report ${ticker}`,
          kind: 'command' as const,
          command: 'report',
          requiresTicker: true,
          category: 'report' as const,
        },
        {
          id: makeId('ctx', 'fund-chain'),
          label: i18nT(language, 'chat.suggestions.contextual.afterFundamentals.chain.label', { ticker }),
          prompt: `/chain ${ticker}`,
          kind: 'navigation' as const,
          command: 'chain',
          requiresTicker: true,
          view: 'chain' as const,
          category: 'options' as const,
        },
        {
          id: makeId('ctx', 'fund-evidence'),
          label: i18nT(language, 'chat.suggestions.contextual.afterFundamentals.evidence.label', { ticker }),
          prompt: `/evidence ${ticker}`,
          kind: 'command' as const,
          command: 'evidence',
          requiresTicker: true,
          category: 'evidence' as const,
        },
      );
      break;

    case 'evidence':
      suggestions.push(
        {
          id: makeId('ctx', 'evidence-trust'),
          label: i18nT(language, 'chat.suggestions.contextual.afterEvidence.trust.label', { ticker }),
          prompt: `/trust ${ticker}`,
          kind: 'command' as const,
          command: 'trust',
          requiresTicker: true,
          category: 'evidence' as const,
        },
        {
          id: makeId('ctx', 'evidence-sec'),
          label: i18nT(language, 'chat.suggestions.contextual.afterEvidence.sec.label', { ticker }),
          prompt: `/sec ${ticker}`,
          kind: 'command' as const,
          command: 'sec',
          requiresTicker: true,
          category: 'evidence' as const,
        },
        {
          id: makeId('ctx', 'evidence-report'),
          label: i18nT(language, 'chat.suggestions.contextual.afterEvidence.report.label', { ticker }),
          prompt: `/report ${ticker}`,
          kind: 'command' as const,
          command: 'report',
          requiresTicker: true,
          category: 'report' as const,
        },
        {
          id: makeId('ctx', 'evidence-risk'),
          label: i18nT(language, 'chat.suggestions.contextual.afterEvidence.risk.label', { ticker }),
          prompt: i18nT(language, 'chat.suggestions.contextual.afterEvidence.risk.prompt', { ticker }),
          kind: 'prompt' as const,
          category: 'risk' as const,
        },
      );
      break;

    case 'trust':
      suggestions.push(
        {
          id: makeId('ctx', 'trust-sec'),
          label: i18nT(language, 'chat.suggestions.contextual.afterTrust.sec.label', { ticker }),
          prompt: `/sec ${ticker}`,
          kind: 'command' as const,
          command: 'sec',
          requiresTicker: true,
          category: 'evidence' as const,
        },
        {
          id: makeId('ctx', 'trust-report'),
          label: i18nT(language, 'chat.suggestions.contextual.afterTrust.report.label', { ticker }),
          prompt: `/report ${ticker}`,
          kind: 'command' as const,
          command: 'report',
          requiresTicker: true,
          category: 'report' as const,
        },
        {
          id: makeId('ctx', 'trust-evidence'),
          label: i18nT(language, 'chat.suggestions.contextual.afterTrust.evidence.label', { ticker }),
          prompt: `/evidence ${ticker}`,
          kind: 'command' as const,
          command: 'evidence',
          requiresTicker: true,
          category: 'evidence' as const,
        },
      );
      break;

    case 'sec':
      suggestions.push(
        {
          id: makeId('ctx', 'sec-trust'),
          label: i18nT(language, 'chat.suggestions.contextual.afterSec.trust.label', { ticker }),
          prompt: `/trust ${ticker}`,
          kind: 'command' as const,
          command: 'trust',
          requiresTicker: true,
          category: 'evidence' as const,
        },
        {
          id: makeId('ctx', 'sec-report'),
          label: i18nT(language, 'chat.suggestions.contextual.afterSec.report.label', { ticker }),
          prompt: `/report ${ticker}`,
          kind: 'command' as const,
          command: 'report',
          requiresTicker: true,
          category: 'report' as const,
        },
      );
      break;

    default:
      // No specific mapping — return empty
      break;
  }

  return filterSafe(suggestions);
}

// ============================================================================
// getSuggestionsForMessage
// ============================================================================

export interface GetSuggestionsForMessageOptions {
  language: Language;
  message?: string;
  context?: {
    currentTicker?: string;
    lastCommand?: string;
  };
}

/**
 * Adds suggestions based on message block types.
 * Currently a pass-through to contextual suggestions — can be extended later.
 */
export function getSuggestionsForMessage({
  language,
  message,
  context,
}: GetSuggestionsForMessageOptions): ChatSuggestion[] {
  if (message && /report|分析|analysis/i.test(message)) {
    const ticker = context?.currentTicker;
    if (ticker) {
      return filterSafe([
        {
          id: makeId('msg', 'report-chain'),
          label: i18nT(language, 'chat.suggestions.contextual.afterReport.chain.label', { ticker }),
          prompt: `/chain ${ticker}`,
          kind: 'navigation' as const,
          command: 'chain',
          requiresTicker: true,
          view: 'chain' as const,
          category: 'options' as const,
        },
        {
          id: makeId('msg', 'report-backtest'),
          label: i18nT(language, 'chat.suggestions.contextual.afterReport.backtest.label', { ticker }),
          prompt: `/backtest ${ticker}`,
          kind: 'navigation' as const,
          command: 'backtest',
          requiresTicker: true,
          view: 'backtest' as const,
          category: 'risk' as const,
        },
      ]);
    }
  }

  // Fall back to contextual suggestions
  return getContextualSuggestions({
    language,
    context,
    lastCommand: context?.lastCommand,
  });
}

// ============================================================================
// getDynamicPlaceholder
// ============================================================================

export interface GetDynamicPlaceholderOptions {
  language: Language;
  context?: {
    currentTicker?: string;
    lastCommand?: string;
  };
  selectedTicker?: string;
}

/**
 * Returns a context-aware input placeholder string.
 */
export function getDynamicPlaceholder({
  language,
  context,
  selectedTicker,
}: GetDynamicPlaceholderOptions): string {
  const ticker = context?.currentTicker || selectedTicker;

  if (ticker) {
    return i18nT(language, 'chat.placeholder.withTicker', { ticker });
  }

  return i18nT(language, 'chat.placeholder.default');
}

// ============================================================================
// Internal helpers
// ============================================================================

function filterSafe(suggestions: ChatSuggestion[]): ChatSuggestion[] {
  return suggestions.filter(isSafeSuggestion);
}