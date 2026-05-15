import { ChatContext, ContextUpdateInput, Language } from './types';

const MAX_ITEMS = 8;

const normalizeTicker = (ticker?: string): string | undefined => {
  const value = ticker?.trim().replace(/^\$/, '').toUpperCase();
  return value || undefined;
};

const trimArray = <T,>(value?: T[]): T[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.slice(0, MAX_ITEMS);
};

export function createEmptyChatContext(): ChatContext {
  return {};
}

export function updateContextFromCommandResult(
  context: ChatContext,
  input: ContextUpdateInput,
): ChatContext {
  const ticker = normalizeTicker(input.ticker) || context.currentTicker;
  return {
    ...context,
    currentTicker: ticker,
    lastIntent: input.intent || context.lastIntent,
    lastCommand: input.command || context.lastCommand,
    lastQuote: input.quote ?? context.lastQuote,
    lastFundamentals: input.fundamentals ?? context.lastFundamentals,
    lastNews: trimArray(input.news) ?? context.lastNews,
    lastVerifiedNews: trimArray(input.verifiedNews) ?? context.lastVerifiedNews,
    lastHistorySummary: input.historySummary ?? context.lastHistorySummary,
    lastSecFilings: trimArray(input.secFilings) ?? context.lastSecFilings,
    lastOfficialSources: trimArray(input.officialSources) ?? context.lastOfficialSources,
    lastSourceTrust: input.sourceTrust ?? context.lastSourceTrust,
    lastEvidenceBundle: input.evidenceBundle ?? context.lastEvidenceBundle,
    lastDataQualityNotes: trimArray(input.dataQualityNotes) ?? context.lastDataQualityNotes,
    lastDeepSeekIntentResult: input.deepSeekIntentResult ?? context.lastDeepSeekIntentResult,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function resolveContextTicker(input: {
  explicitTicker?: string;
  selectedTicker?: string;
  context?: ChatContext;
}): string | undefined {
  return normalizeTicker(input.explicitTicker)
    || normalizeTicker(input.context?.currentTicker)
    || normalizeTicker(input.selectedTicker);
}

export function shouldUseContextForFollowup(text: string, context: ChatContext): boolean {
  if (!context.currentTicker) return false;
  const normalized = text.trim().toLowerCase();
  if (!normalized) return false;

  const keywords = [
    '那', '继续', '这个', '该公司', '这个股票', '它', '再看', '再分析',
    '证据呢', '证据', '来源呢', '来源', 'sec 呢', 'sec', '新闻呢', '新闻',
    '图表呢', '图表', '走势呢', '走势',
    '完整报告', '生成完整报告', '报告',
    'this', 'it', 'that', 'continue', 'follow up', 'what about',
    'sources', 'source', 'evidence', 'sec', 'news', 'chart', 'trend', 'report', 'full report',
  ];

  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}

export function buildContextSummaryForPrompt(context: ChatContext, language: Language): string {
  if (!context.currentTicker && !context.lastCommand && !context.lastDataQualityNotes?.length) return '';

  const ticker = context.currentTicker || 'N/A';
  const command = context.lastCommand ? `/${context.lastCommand}${context.currentTicker ? ` ${context.currentTicker}` : ''}` : 'N/A';
  const dataNote = context.lastDataQualityNotes?.[0]
    || (language === 'zh' ? '部分数据可能为回退、模拟或延迟。' : 'Some data may be fallback, simulated, or delayed.');

  if (language === 'zh') {
    return [
      '当前研究上下文：',
      '',
      `* 当前标的：${ticker}`,
      `* 最近工具：${command}`,
      `* 最近数据质量提示：${dataNote}`,
      '* 请不要将模拟、回退或启发式数据当作真实市场数据。',
    ].join('\n');
  }

  return [
    'Current research context:',
    '',
    `* Current ticker: ${ticker}`,
    `* Last tool: ${command}`,
    `* Data quality note: ${dataNote}`,
    '* Do not treat simulation, fallback, or heuristic data as real market data.',
  ].join('\n');
}
