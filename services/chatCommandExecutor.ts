/**
 * Chat Phase C-5: Lightweight Tool Registry & Command Executor Refactor
 *
 * This file provides the new result-returning command executor.
 * The old callback-based executeCommand() is kept for backward compatibility
 * but is marked as deprecated. New code should use executeChatCommand().
 */

import { Message, ShellViewMode, ChatRenderBlock, StockQuote, CompanyFundamentals, NewsItem, ChatTableRow } from '../types';
import { Language, t as i18nT } from '../i18n';
import { getCommandSpec, COMMANDS } from './chatCommandRegistry';
import { ChatEvidenceItem } from './chatTraceService';
import { ContextUpdateInput } from './chatContextService';
import {
  fetchStockQuote,
  fetchStockNews,
  fetchCompanyFundamentals,
  fetchInsiderTrading,
  fetchEarningsCalendar,
  fetchDividends,
} from './marketDataService';
import { fetchVerifiedStockNews } from './newsVerificationService';
import { fetchSecFilingsForTicker } from './secFilingService';
import { fetchOfficialSources } from './officialSourceService';
import { buildSourceTrustSummary } from './sourceTrustService';

// ============================================================================
// Types
// ============================================================================

export interface ChatCommandExecutionInput {
  /** The command name (e.g., 'quote', 'news') */
  command: string;
  /** Command arguments (e.g., ['AAPL']) */
  args: string[];
  /** Original raw input string */
  rawInput: string;
  /** Explicit ticker from intent classification */
  ticker?: string;
  /** Currently selected ticker in UI */
  selectedTicker?: string;
  /** User language preference */
  language: Language;
}

export interface ChatCommandExecutionResult {
  /** Whether execution succeeded (errors still return ok: true with error text) */
  ok: boolean;
  /** The command that was executed */
  command: string;
  /** Normalized ticker symbol if applicable */
  ticker?: string;
  /** User-facing message text */
  text: string;
  /** Optional message patch to merge into the Message object */
  messagePatch?: Partial<Message>;
  /** Optional view to navigate to */
  navigateTo?: ShellViewMode;
  /** Whether to clear all messages */
  shouldClearMessages?: boolean;
  /** Pre-extracted evidence items for trace */
  evidenceItems: ChatEvidenceItem[];
  /** Data for context service update */
  contextUpdate?: ContextUpdateInput;
  /** Data quality notes/warnings */
  dataQualityNotes?: string[];
  /** Error message if ok: false */
  error?: string;
}

type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

// ============================================================================
// Old Callback-Based API (Deprecated)
// ============================================================================

export interface CommandExecutorContext {
  language: Language;
  t: TranslateFn;
  addMessage: (msg: Message) => void;
  setTyping: (typing: boolean) => void;
  navigate: (view: ShellViewMode) => void;
  setTicker: (ticker: string) => void;
  resetMessages: (welcomeText: string) => void;
}

/**
 * @deprecated Use executeChatCommand() instead. This callback-based API
 *             is kept for backward compatibility during migration.
 */
export async function executeCommand(
  intent: { command?: string; name?: string; ticker?: string },
  ctx: CommandExecutorContext,
): Promise<void> {
  const command = intent.command || intent.name;
  if (!command) {
    ctx.addMessage({
      id: (Date.now() + 1).toString(),
      role: 'model',
      text: ctx.t('chat.commands.unknown'),
    });
    ctx.setTyping(false);
    return;
  }

  const result = await executeChatCommand({
    command,
    args: intent.ticker ? [intent.ticker] : [],
    rawInput: `/${command} ${intent.ticker || ''}`.trim(),
    ticker: intent.ticker,
    language: ctx.language,
  });

  // Handle result in callback style
  if (result.shouldClearMessages) {
    ctx.resetMessages(ctx.t('chat.welcome'));
    return;
  }

  ctx.addMessage({
    id: (Date.now() + 1).toString(),
    role: 'model',
    text: result.text,
    ...result.messagePatch,
  } as Message);

  if (result.navigateTo) {
    setTimeout(() => ctx.navigate(result.navigateTo!), 100);
  }

  if (result.ticker && intent.ticker !== result.ticker) {
    ctx.setTicker(result.ticker);
  }

  ctx.setTyping(false);
}

// ============================================================================
// New Result-Returning API
// ============================================================================

/**
 * Execute a chat command and return a structured result.
 * This is the new preferred API for command execution.
 */
export async function executeChatCommand(
  input: ChatCommandExecutionInput,
): Promise<ChatCommandExecutionResult> {
  const { command, args, ticker: explicitTicker, language } = input;

  const spec = getCommandSpec(command);
  if (!spec) {
    return {
      ok: false,
      command,
      text: i18nT(language, 'chat.commands.unknown'),
      evidenceItems: [],
      error: 'Unknown command',
    };
  }

  const ticker = explicitTicker?.toUpperCase() || args[0]?.toUpperCase();

  // Check ticker requirement
  if (spec.requiresTicker && !ticker) {
    return {
      ok: false,
      command,
      text: i18nT(language, 'chat.commands.missingTicker'),
      evidenceItems: [],
      error: 'Missing ticker',
    };
  }

  // Dispatch based on action
  switch (spec.action) {
    case 'help':
      return executeHelpCommand(language);

    case 'clear':
      return executeClearCommand(language);

    case 'fetch_quote':
      return executeQuoteCommand(ticker!, language);

    case 'fetch_news':
      return executeNewsCommand(ticker!, language);

    case 'fetch_fundamentals':
      return executeFundamentalsCommand(ticker!, language);

    case 'fetch_history':
      return executeHistoryCommand(ticker!, language, command);

    case 'navigate':
      return executeNavigateCommand(ticker!, spec.targetView!, language);

    case 'fetch_verified_news':
      return executeVerifiedNewsCommand(ticker!, language);

    case 'fetch_sec':
      return executeSecCommand(ticker!, language);

    case 'fetch_official':
      return executeOfficialCommand(ticker!, language);

    case 'fetch_trust':
      return executeTrustCommand(ticker!, language);

    case 'fetch_evidence':
      return executeEvidenceCommand(ticker!, language);

    case 'fetch_insiders':
      return executeInsidersCommand(ticker!, language);

    case 'fetch_earnings':
      return executeEarningsCommand(ticker!, language);

    case 'fetch_dividends':
      return executeDividendsCommand(ticker!, language);

    default:
      return {
        ok: false,
        command,
        text: i18nT(language, 'chat.commands.unknown'),
        evidenceItems: [],
        error: 'Unhandled command action',
      };
  }
}

// ============================================================================
// Evidence Builder Helpers
// ============================================================================

function createEvidenceId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildQuoteEvidence(quote: StockQuote): ChatEvidenceItem {
  return {
    id: createEvidenceId('quote'),
    type: 'quote',
    title: `${quote.symbol} @ $${quote.price.toFixed(2)} (${quote.changePercent >= 0 ? '+' : ''}${quote.changePercent.toFixed(2)}%)`,
    source: quote.source || 'Market Data',
    confidence: 100,
    timestamp: new Date().toISOString(),
  };
}

function buildFundamentalsEvidence(fundamentals: CompanyFundamentals): ChatEvidenceItem {
  return {
    id: createEvidenceId('fundamentals'),
    type: 'fundamentals',
    title: `${fundamentals.companyName || fundamentals.symbol} — P/E: ${fundamentals.peRatio?.toFixed(1) || 'N/A'}, Market Cap: $${((fundamentals.marketCap || 0) / 1e9).toFixed(1)}B`,
    source: 'Fundamentals',
    timestamp: new Date().toISOString(),
  };
}

function buildNewsEvidence(news: NewsItem[], maxItems: number = 3): ChatEvidenceItem[] {
  return news.slice(0, maxItems).map((n, idx) => ({
    id: createEvidenceId(`news-${idx}`),
    type: 'news' as const,
    title: n.title,
    source: n.site,
    url: n.url,
    confidence: Math.round((n.sentimentScore + 1) * 50),
    timestamp: n.publishedDate || new Date().toISOString(),
  }));
}

function buildVerifiedNewsEvidence(verifiedNews: unknown[]): ChatEvidenceItem[] {
  const items = (verifiedNews || []).slice(0, 5).map((n: any, idx: number) => ({
    id: createEvidenceId(`vnews-${idx}`),
    type: 'verified_news' as const,
    title: `[${n.confidenceScore || '?'}%] ${n.title}${n.source ? ' — ' + n.source : ''}`,
    source: n.source,
    url: n.url,
    confidence: n.confidenceScore || 50,
    timestamp: new Date().toISOString(),
  }));
  return items;
}

function buildSecEvidence(filings: unknown[]): ChatEvidenceItem[] {
  return (filings || []).slice(0, 5).map((f: any, idx: number) => ({
    id: createEvidenceId(`sec-${idx}`),
    type: 'sec_filing' as const,
    title: `${f.form || 'N/A'} | ${f.filingDate || 'N/A'}${f.description ? ': ' + f.description : ''}`,
    source: 'SEC EDGAR',
    url: f.url,
    timestamp: f.filingDate || new Date().toISOString(),
  }));
}

function buildOfficialSourceEvidence(sources: unknown[]): ChatEvidenceItem[] {
  return (sources || []).slice(0, 5).map((s: any, idx: number) => ({
    id: createEvidenceId(`official-${idx}`),
    type: 'official_source' as const,
    title: s.name || 'N/A',
    source: s.type || 'N/A',
    url: s.url,
    note: s.aiReviewed ? 'AI verified' : 'Requires manual confirmation',
    timestamp: new Date().toISOString(),
  }));
}

function buildTrustEvidence(summary: unknown): ChatEvidenceItem {
  const s = summary as any;
  return {
    id: createEvidenceId('trust'),
    type: 'source_trust',
    title: `Source Trust Score: ${s?.overallScore || 0}/100 (${s?.confidenceLevel || 'unknown'})`,
    source: 'Source Trust Analysis',
    timestamp: new Date().toISOString(),
  };
}

function buildHistoryEvidence(ticker: string, history: { date: string; close: number }[]): ChatEvidenceItem {
  return {
    id: createEvidenceId('history'),
    type: 'history',
    title: `${ticker} historical data: ${history.length} points`,
    source: 'Market Data',
    timestamp: new Date().toISOString(),
  };
}

type HistoryFetchResult = {
  history: { date: string; close: number }[];
  source?: string;
  dataQuality: 'available' | 'limited' | 'unavailable';
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

async function fetchCommandHistory(ticker: string): Promise<HistoryFetchResult> {
  const response = await fetch(`/api/history/${ticker}`);
  if (!response.ok) {
    return { history: [], dataQuality: 'unavailable' };
  }

  const payload = await response.json();
  if (payload?.status && payload.status !== 'success') {
    return { history: [], source: payload.source, dataQuality: 'unavailable' };
  }

  const rawHistory: unknown[] = Array.isArray(payload?.historical) ? payload.historical : [];
  const history = rawHistory.reduce<{ date: string; close: number }[]>((items, item) => {
    const point = item as { date?: unknown; close?: unknown };
    if (typeof point.date !== 'string' || !isFiniteNumber(point.close)) return items;
    return [...items, { date: point.date, close: point.close }];
  }, []);

  if (history.length === 0) {
    return { history: [], source: payload?.source, dataQuality: 'unavailable' };
  }

  return {
    history: history.slice().sort((a, b) => a.date.localeCompare(b.date)),
    source: typeof payload?.source === 'string' ? payload.source : undefined,
    dataQuality: typeof payload?.source === 'string' ? 'available' : 'limited',
  };
}

function buildInsiderEvidence(trades: unknown[]): ChatEvidenceItem[] {
  return (trades || []).slice(0, 5).map((t: any, idx: number) => ({
    id: createEvidenceId(`insider-${idx}`),
    type: 'insider' as const,
    title: `${t.name || 'N/A'} — ${t.transactionType === 'buy' ? 'Buy' : 'Sell'} ${t.shares} shares @ $${t.price || 'N/A'}`,
    source: t.date || 'N/A',
    timestamp: new Date().toISOString(),
  }));
}

function buildEarningsEvidence(earnings: unknown[]): ChatEvidenceItem[] {
  return (earnings || []).slice(0, 3).map((e: any, idx: number) => ({
    id: createEvidenceId(`earnings-${idx}`),
    type: 'earnings' as const,
    title: `Earnings: ${e.date || 'N/A'} | EPS Est: $${e.epsEstimate || 'N/A'} | Act: $${e.epsActual || 'N/A'}`,
    source: 'Earnings Calendar',
    timestamp: e.date || new Date().toISOString(),
  }));
}

function buildDividendEvidence(dividends: unknown[]): ChatEvidenceItem[] {
  return (dividends || []).slice(0, 5).map((d: any, idx: number) => ({
    id: createEvidenceId(`dividend-${idx}`),
    type: 'dividend' as const,
    title: `${d.date || 'N/A'} — $${d.amount != null ? d.amount.toFixed(4) : 'N/A'}${d.paymentDate ? ' (Pay: ' + d.paymentDate + ')' : ''}`,
    source: 'Dividend',
    timestamp: d.date || new Date().toISOString(),
  }));
}

// ============================================================================
// Command Handlers
// ============================================================================

async function executeHelpCommand(language: Language): Promise<ChatCommandExecutionResult> {
  // C-7: Group commands by category
  type CategoryKey = 'marketData' | 'companyNews' | 'evidenceTrust' | 'researchWorkflow' | 'system';
  const categories: { key: CategoryKey; commands: string[] }[] = [
    { key: 'marketData', commands: ['quote', 'history', 'fundamentals'] },
    { key: 'companyNews', commands: ['news', 'insiders', 'earnings', 'dividends'] },
    { key: 'evidenceTrust', commands: ['trust', 'evidence', 'sec', 'official'] },
    { key: 'researchWorkflow', commands: ['report', 'chain', 'backtest', 'impact', 'macro'] },
    { key: 'system', commands: ['help', 'clear'] },
  ];

  const parts: string[] = [`## ${i18nT(language, 'chat.commands.title')}`, ''];

  for (const cat of categories) {
    const catTitle = i18nT(language, `chat.helpCategories.${cat.key}`);
    parts.push(`### ${catTitle}`);
    parts.push('');

    for (const cmdName of cat.commands) {
      const spec = COMMANDS.find((c) => c.name === cmdName);
      if (spec) {
        const desc = i18nT(language, spec.descriptionKey);
        parts.push(`- \`/${spec.usage}\` — ${desc}`);
      }
    }
    parts.push('');
  }

  parts.push(`_${i18nT(language, 'chat.experimentDisclaimer')}_`);

  return {
    ok: true,
    command: 'help',
    text: parts.join('\n'),
    evidenceItems: [],
  };
}

async function executeClearCommand(language: Language): Promise<ChatCommandExecutionResult> {
  return {
    ok: true,
    command: 'clear',
    text: i18nT(language, 'chat.commands.cleared'),
    shouldClearMessages: true,
    evidenceItems: [],
  };
}

async function executeQuoteCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const quote = await fetchStockQuote(ticker);
    const evidenceItems = [buildQuoteEvidence(quote)];

    return {
      ok: true,
      command: 'quote',
      ticker,
      text: i18nT(language, 'chat.commands.quoteResult', { ticker }),
      messagePatch: { quote },
      evidenceItems,
      contextUpdate: { ticker, command: 'quote', quote },
    };
  } catch (error: any) {
    console.warn('[Command] Quote fetch failed:', error);
    return {
      ok: true,
      command: 'quote',
      ticker,
      text: error?.status === 429 ? i18nT(language, 'chat.commands.rateLimited') : i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: [error?.status === 429 ? 'Rate limited' : 'Fetch failed'],
    };
  }
}

async function executeNewsCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const news = await fetchStockNews(ticker);
    const evidenceItems = buildNewsEvidence(news);

    return {
      ok: true,
      command: 'news',
      ticker,
      text: i18nT(language, 'chat.commands.newsResult', { ticker }),
      messagePatch: { news },
      evidenceItems,
      contextUpdate: { ticker, command: 'news', news },
    };
  } catch (error: any) {
    console.warn('[Command] News fetch failed:', error);
    return {
      ok: true,
      command: 'news',
      ticker,
      text: error?.status === 429 ? i18nT(language, 'chat.commands.rateLimited') : i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: [error?.status === 429 ? 'Rate limited' : 'Fetch failed'],
    };
  }
}

async function executeFundamentalsCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const fundamentals = await fetchCompanyFundamentals(ticker);
    if (!fundamentals) {
      return {
        ok: true,
        command: 'fundamentals',
        ticker,
        text: i18nT(language, 'chat.commands.fetchFailed'),
        evidenceItems: [],
        dataQualityNotes: ['Fundamentals not available'],
      };
    }
    const evidenceItems = [buildFundamentalsEvidence(fundamentals)];

    return {
      ok: true,
      command: 'fundamentals',
      ticker,
      text: i18nT(language, 'chat.commands.fundamentalsResult', { ticker }),
      messagePatch: { fundamentals },
      evidenceItems,
      contextUpdate: { ticker, command: 'fundamentals', fundamentals },
    };
  } catch (error: any) {
    console.warn('[Command] Fundamentals fetch failed:', error);
    return {
      ok: true,
      command: 'fundamentals',
      ticker,
      text: error?.status === 429 ? i18nT(language, 'chat.commands.rateLimited') : i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: [error?.status === 429 ? 'Rate limited' : 'Fetch failed'],
    };
  }
}

async function executeHistoryCommand(
  ticker: string,
  language: Language,
  commandName: string = 'history',
): Promise<ChatCommandExecutionResult> {
  try {
    const historyResult = await fetchCommandHistory(ticker);
    const history = historyResult.history;
    const source = historyResult.source || 'Market Data';
    const chartTitle = commandName === 'chart'
      ? i18nT(language, 'chat.chart.priceTrend', { ticker })
      : `${ticker} ${i18nT(language, 'chat.blocks.chart')}`;

    if (history.length === 0) {
      const blocks: ChatRenderBlock[] = [
        {
          type: 'chart',
          title: chartTitle,
          chartType: 'line',
          data: { ticker, chartData: [], chartType: 'line' },
          source,
          dataQuality: 'unavailable',
          createdBy: 'tool',
          validationStatus: 'unavailable',
          disclaimer: i18nT(language, 'chat.chart.historicalDisclaimer'),
          xAxisLabel: 'Date',
          yAxisLabel: 'Price',
          emptyState: i18nT(language, 'chat.chart.noData'),
        },
      ];

      return {
        ok: true,
        command: commandName,
        ticker,
        text: i18nT(language, 'chat.commands.fetchFailed'),
        messagePatch: { blocks },
        evidenceItems: [],
        contextUpdate: { ticker, command: commandName },
        dataQualityNotes: [i18nT(language, 'chat.chart.unavailable')],
      };
    }

    const count = history.length;
    const prices = history.map(h => h.close);
    const dates = history.map(h => h.date);
    const latestClose = prices[prices.length - 1];
    const highestClose = Math.max(...prices);
    const lowestClose = Math.min(...prices);
    const chartData = history.map(h => ({ label: h.date, value: h.close }));

    const blocks: ChatRenderBlock[] = [
      {
        type: 'data_quality',
        data: { quote: undefined, fundamentals: undefined, news: undefined },
      },
      {
        type: 'chart',
        title: chartTitle,
        chartType: 'line',
        data: { ticker, chartData, chartType: 'line', chartColor: '#818cf8' },
        source,
        dataQuality: historyResult.dataQuality,
        createdBy: 'tool',
        validationStatus: historyResult.dataQuality === 'available' ? 'valid' : 'limited',
        disclaimer: i18nT(language, 'chat.chart.historicalDisclaimer'),
        xAxisLabel: 'Date',
        yAxisLabel: 'Price',
        legend: [ticker],
      },
      {
        type: 'metric_grid',
        metrics: [
          { label: i18nT(language, 'history.dataPoints'), value: count },
          { label: i18nT(language, 'history.startDate'), value: dates[0] || 'N/A' },
          { label: i18nT(language, 'history.endDate'), value: dates[dates.length - 1] || 'N/A' },
          { label: i18nT(language, 'history.latestClose'), value: `$${latestClose.toFixed(2)}` },
          { label: i18nT(language, 'history.highestClose'), value: `$${highestClose.toFixed(2)}` },
          { label: i18nT(language, 'history.lowestClose'), value: `$${lowestClose.toFixed(2)}` },
        ],
      },
      {
        type: 'disclaimer',
        content: i18nT(language, 'history.researchOnly'),
        tone: 'info',
      },
    ];

    const evidenceItems = [buildHistoryEvidence(ticker, history)];
    const historySummary = {
      ticker,
      points: count,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      latestClose,
    };

    return {
      ok: true,
      command: commandName,
      ticker,
      text: i18nT(language, 'chat.commands.historyResult', { ticker, count: String(count) }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: { ticker, command: commandName, historySummary },
      dataQualityNotes: [i18nT(language, 'history.researchOnly')],
    };
  } catch (error: any) {
    console.warn('[Command] History fetch failed:', error);
    const title = commandName === 'chart'
      ? i18nT(language, 'chat.chart.priceTrend', { ticker })
      : `${ticker} ${i18nT(language, 'chat.blocks.chart')}`;
    const blocks: ChatRenderBlock[] = [
      {
        type: 'chart',
        title,
        chartType: 'line',
        data: { ticker, chartData: [], chartType: 'line' },
        source: 'Market Data',
        dataQuality: 'unavailable',
        createdBy: 'tool',
        validationStatus: 'unavailable',
        disclaimer: i18nT(language, 'chat.chart.historicalDisclaimer'),
        xAxisLabel: 'Date',
        yAxisLabel: 'Price',
      },
    ];
    return {
      ok: true,
      command: commandName,
      ticker,
      text: error?.status === 429 ? i18nT(language, 'chat.commands.rateLimited') : i18nT(language, 'chat.commands.fetchFailed'),
      messagePatch: { blocks },
      evidenceItems: [],
      contextUpdate: { ticker, command: commandName },
      dataQualityNotes: [error?.status === 429 ? 'Rate limited' : 'Fetch failed'],
    };
  }
}

async function executeNavigateCommand(
  ticker: string,
  targetView: ShellViewMode,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  const navKey = targetView === 'report' ? 'openingReport'
    : targetView === 'chain' ? 'openingChain'
    : targetView === 'backtest' ? 'openingBacktest'
    : targetView === 'news-impact' ? 'openingImpact'
    : 'openingMacro';

  const navText = i18nT(language, `chat.commands.${navKey}`, { ticker });

  return {
    ok: true,
    command: targetView,
    ticker,
    text: navText,
    navigateTo: targetView,
    evidenceItems: [],
    contextUpdate: { ticker, command: targetView },
  };
}

async function executeVerifiedNewsCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const verifiedNews = await fetchVerifiedStockNews(ticker);
    const evidenceItems = buildVerifiedNewsEvidence(verifiedNews);
    const items = (verifiedNews || []).map((n: any) => ({
      label: `[${n.confidenceScore || '?'}%] ${n.title}${n.source ? ' — ' + n.source : ''}`,
      source: n.source,
      url: n.url,
    }));

    const blocks: ChatRenderBlock[] = [
      {
        type: 'evidence_list',
        data: { evidence: items.length > 0 ? items : [{ label: i18nT(language, 'evidence.noEvidence'), source: undefined, url: undefined }] },
      },
      {
        type: 'data_quality',
        data: { quote: undefined, fundamentals: undefined, news: undefined },
      },
    ];

    return {
      ok: true,
      command: 'verified-news',
      ticker,
      text: i18nT(language, 'chat.commands.verifiedNewsResult', { ticker }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: { ticker, command: 'verified-news', verifiedNews },
    };
  } catch (error: any) {
    console.warn('[Command] Verified news fetch failed:', error);
    return {
      ok: true,
      command: 'verified-news',
      ticker,
      text: i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: ['Fetch failed'],
    };
  }
}

async function executeSecCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const secData = await fetchSecFilingsForTicker(ticker);
    const filings = secData?.filings || [];
    const evidenceItems = buildSecEvidence(filings);
    const items = filings.map((f: any) => ({
      label: `${f.form || 'N/A'} | ${f.filingDate || 'N/A'}${f.description ? ': ' + f.description : ''}`,
      source: 'SEC EDGAR',
      url: f.url,
    }));

    if (secData?.status === 'unavailable') {
      return {
        ok: true,
        command: 'sec',
        ticker,
        text: i18nT(language, 'chat.commands.secResult', { ticker }),
        messagePatch: {
          blocks: [
            { type: 'evidence_list', data: { evidence: [{ label: i18nT(language, 'sec.unavailable'), source: undefined, url: undefined }] } },
          ],
        },
        evidenceItems: [],
        dataQualityNotes: [i18nT(language, 'sec.unavailable')],
      };
    }

    const blocks: ChatRenderBlock[] = [
      { type: 'evidence_list', data: { evidence: items } },
      { type: 'disclaimer', content: i18nT(language, 'sec.officialDisclosureNotice'), tone: 'info' },
    ];

    return {
      ok: true,
      command: 'sec',
      ticker,
      text: i18nT(language, 'chat.commands.secResult', { ticker }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: { ticker, command: 'sec', secFilings: filings },
    };
  } catch (error: any) {
    console.warn('[Command] SEC fetch failed:', error);
    return {
      ok: true,
      command: 'sec',
      ticker,
      text: i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: ['Fetch failed'],
    };
  }
}

async function executeOfficialCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const officialData = await fetchOfficialSources(ticker);
    const sources = officialData?.sources || [];
    const evidenceItems = buildOfficialSourceEvidence(sources);
    const items = sources.map((s: any) => ({
      label: `${s.name || 'N/A'}${s.aiReviewed ? ' [' + i18nT(language, 'evidence.aiVerified') + ']' : ' [' + i18nT(language, 'evidence.requiresManualConfirmation') + ']'}`,
      source: s.type || 'N/A',
      url: s.url,
    }));

    if (officialData?.status === 'error' || officialData?.status === 'not_found') {
      return {
        ok: true,
        command: 'official',
        ticker,
        text: i18nT(language, 'chat.commands.fetchFailed'),
        evidenceItems: [],
        dataQualityNotes: ['Fetch failed'],
      };
    }

    const blocks: ChatRenderBlock[] = [
      { type: 'evidence_list', data: { evidence: items.length > 0 ? items : [{ label: i18nT(language, 'evidence.noEvidence'), source: undefined, url: undefined }] } },
    ];

    return {
      ok: true,
      command: 'official',
      ticker,
      text: i18nT(language, 'chat.commands.officialResult', { ticker }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: { ticker, command: 'official', officialSources: sources },
    };
  } catch (error: any) {
    console.warn('[Command] Official sources fetch failed:', error);
    return {
      ok: true,
      command: 'official',
      ticker,
      text: i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: ['Fetch failed'],
    };
  }
}

async function executeTrustCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const [verifiedNews, secData, officialData] = await Promise.all([
      fetchVerifiedStockNews(ticker),
      fetchSecFilingsForTicker(ticker),
      fetchOfficialSources(ticker),
    ]);
    const trustSummary = buildSourceTrustSummary({ ticker, verifiedNews, officialFilings: secData, officialSources: officialData });
    const evidenceItems = [buildTrustEvidence(trustSummary)];

    const blocks: ChatRenderBlock[] = [
      {
        type: 'source_trust',
        data: { trustSummary },
      },
      {
        type: 'metric_grid',
        metrics: [
          { label: i18nT(language, 'sourceTrust.overallScore'), value: `${trustSummary.overallScore}/100` },
          { label: i18nT(language, 'sourceTrust.confidenceLevel'), value: trustSummary.confidenceLevel },
          { label: i18nT(language, 'sourceTrust.officialSources'), value: trustSummary.officialSourceCount },
          { label: i18nT(language, 'sourceTrust.secFilings'), value: trustSummary.secFilingCount },
          { label: i18nT(language, 'sourceTrust.verifiedNews'), value: trustSummary.verifiedNewsCount },
        ],
      },
    ];

    return {
      ok: true,
      command: 'trust',
      ticker,
      text: i18nT(language, 'chat.commands.trustResult', { ticker }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: { ticker, command: 'trust', sourceTrust: trustSummary },
    };
  } catch (error: any) {
    console.warn('[Command] Trust fetch failed:', error);
    return {
      ok: true,
      command: 'trust',
      ticker,
      text: i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: ['Fetch failed'],
    };
  }
}

async function executeEvidenceCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const [quote, verifiedNews, secData, officialData] = await Promise.all([
      fetchStockQuote(ticker),
      fetchVerifiedStockNews(ticker).catch(() => []),
      fetchSecFilingsForTicker(ticker).catch(() => undefined),
      fetchOfficialSources(ticker).catch(() => undefined),
    ]);
    const trustSummary = buildSourceTrustSummary({ ticker, verifiedNews, officialFilings: secData, officialSources: officialData });

    const newsItems = (verifiedNews || []).map((n: any) => ({
      label: `[${n.confidenceScore || '?'}% ${i18nT(language, 'evidence.verifiedNews')}] ${n.title}`,
      source: n.source,
      url: n.url,
    }));
    const secItems = (secData?.filings || []).map((f: any) => ({
      label: `${f.form || 'N/A'} (${f.filingDate || 'N/A'})`,
      source: 'SEC',
      url: f.url,
    }));
    const officialItems = (officialData?.sources || []).map((s: any) => ({
      label: s.name || 'N/A',
      source: s.type || 'N/A',
      url: s.url,
    }));
    const allEvidence = [...newsItems, ...secItems, ...officialItems];

    // Build evidence items
    const evidenceItems: ChatEvidenceItem[] = [
      buildQuoteEvidence(quote),
      ...buildVerifiedNewsEvidence(verifiedNews),
      ...buildSecEvidence(secData?.filings || []),
      ...buildOfficialSourceEvidence(officialData?.sources || []),
      buildTrustEvidence(trustSummary),
    ].filter(e => e !== undefined);

    const secTableRows: ChatTableRow[] = (secData?.filings || []).slice(0, 10).map((f: any) => ({
      form: f.form || 'N/A',
      filingDate: f.filingDate || 'N/A',
      description: f.description || f.reportDate || f.primaryDocument || 'N/A',
      source: 'SEC EDGAR',
    }));

    const blocks: ChatRenderBlock[] = [
      {
        type: 'data_quality',
        data: { quote: quote || undefined, fundamentals: undefined, news: undefined },
      },
      {
        type: 'source_trust',
        data: { trustSummary },
      },
      {
        type: 'evidence_list',
        data: { evidence: allEvidence.length > 0 ? allEvidence : [{ label: i18nT(language, 'evidence.noEvidence'), source: undefined, url: undefined }] },
      },
      {
        type: 'data_table',
        title: i18nT(language, 'chat.blocks.secFilingsTable'),
        columns: [
          { key: 'form', label: i18nT(language, 'chat.secTable.form'), width: '80px' },
          { key: 'filingDate', label: i18nT(language, 'chat.secTable.filingDate'), width: '100px' },
          { key: 'description', label: i18nT(language, 'chat.secTable.description') },
          { key: 'source', label: i18nT(language, 'chat.secTable.source'), width: '80px' },
        ],
        rows: secTableRows,
        source: 'SEC EDGAR',
        sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${secData?.cik || ticker}&type=&dateb=&owner=include&count=10`,
        dataQuality: (secData?.filings?.length ?? 0) > 0 ? 'available' : 'unavailable',
        createdBy: 'tool',
        validationStatus: (secData?.filings?.length ?? 0) > 0 ? 'valid' : 'unavailable',
        emptyState: i18nT(language, 'chat.secTable.noFilings'),
      },
      {
        type: 'action_buttons',
        actions: [
          { label: i18nT(language, 'chat.actions.generateReport'), view: 'report', ticker },
          { label: i18nT(language, 'chat.actions.analyzeNewsImpact'), view: 'news-impact', ticker },
          { label: i18nT(language, 'chat.actions.viewMacro'), view: 'macro', ticker },
        ],
      },
    ];

    return {
      ok: true,
      command: 'evidence',
      ticker,
      text: i18nT(language, 'chat.commands.evidenceResult', { ticker }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: {
        ticker,
        command: 'evidence',
        quote,
        verifiedNews,
        secFilings: secData?.filings,
        officialSources: officialData?.sources,
        sourceTrust: trustSummary,
        evidenceBundle: allEvidence,
      },
      dataQualityNotes: [i18nT(language, 'history.researchOnly')],
    };
  } catch (error: any) {
    console.warn('[Command] Evidence fetch failed:', error);
    return {
      ok: true,
      command: 'evidence',
      ticker,
      text: i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: ['Fetch failed'],
    };
  }
}

async function executeInsidersCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const data = await fetchInsiderTrading(ticker);
    const evidenceItems = buildInsiderEvidence(data.trades || []);

    if (data.status === 'unavailable') {
      return {
        ok: true,
        command: 'insiders',
        ticker,
        text: i18nT(language, 'chat.commands.insidersResult', { ticker }),
        messagePatch: {
          blocks: [
            {
              type: 'evidence_list',
              data: { evidence: [{ label: i18nT(language, 'insiders.unavailable'), source: undefined, url: undefined }] },
            },
          ],
        },
        evidenceItems: [],
        dataQualityNotes: [i18nT(language, 'insiders.unavailable')],
      };
    }

    const tradeItems = (data.trades || []).slice(0, 20).map((t: any) => ({
      label: `${t.name || 'N/A'} — ${t.transactionType === 'buy' ? 'Buy' : 'Sell'} ${t.shares} shares @ $${t.price || 'N/A'}`,
      source: t.date || 'N/A',
      url: undefined,
    }));

    const blocks: ChatRenderBlock[] = [
      {
        type: 'metric_grid',
        metrics: [
          { label: i18nT(language, 'insiders.totalBuys'), value: data.totalBuys, tone: data.totalBuys > data.totalSells ? 'positive' : 'neutral' },
          { label: i18nT(language, 'insiders.totalSells'), value: data.totalSells, tone: data.totalSells > data.totalBuys ? 'negative' : 'neutral' },
          { label: i18nT(language, 'insiders.transactionCount'), value: data.trades.length },
          { label: i18nT(language, 'insiders.netShares'), value: data.netShares, helper: data.sentiment },
        ],
      },
      {
        type: 'evidence_list',
        data: { evidence: tradeItems.length > 0 ? tradeItems : [{ label: 'No recent insider trades.', source: undefined, url: undefined }] },
      },
    ];

    return {
      ok: true,
      command: 'insiders',
      ticker,
      text: i18nT(language, 'chat.commands.insidersResult', { ticker }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: { ticker, command: 'insiders' },
    };
  } catch (error: any) {
    console.warn('[Command] Insiders fetch failed:', error);
    return {
      ok: true,
      command: 'insiders',
      ticker,
      text: i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: ['Fetch failed'],
    };
  }
}

async function executeEarningsCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const earnings = await fetchEarningsCalendar(ticker);
    const evidenceItems = buildEarningsEvidence(earnings || []);

    if (!earnings || earnings.length === 0) {
      return {
        ok: true,
        command: 'earnings',
        ticker,
        text: i18nT(language, 'chat.commands.earningsResult', { ticker }),
        messagePatch: {
          blocks: [
            { type: 'evidence_list', data: { evidence: [{ label: i18nT(language, 'earnings.unavailable'), source: undefined, url: undefined }] } },
          ],
        },
        evidenceItems: [],
        dataQualityNotes: [i18nT(language, 'earnings.unavailable')],
      };
    }

    const latest = earnings[0];
    const blocks: ChatRenderBlock[] = [
      {
        type: 'metric_grid',
        metrics: [
          { label: i18nT(language, 'earnings.date'), value: latest.date || 'N/A' },
          { label: i18nT(language, 'earnings.epsEstimate'), value: latest.epsEstimate != null ? `$${latest.epsEstimate}` : 'N/A' },
          { label: i18nT(language, 'earnings.epsActual'), value: latest.epsActual != null ? `$${latest.epsActual}` : 'N/A' },
          { label: i18nT(language, 'earnings.surprise'), value: latest.surprise || 'N/A' },
        ],
      },
    ];

    return {
      ok: true,
      command: 'earnings',
      ticker,
      text: i18nT(language, 'chat.commands.earningsResult', { ticker }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: { ticker, command: 'earnings' },
    };
  } catch (error: any) {
    console.warn('[Command] Earnings fetch failed:', error);
    return {
      ok: true,
      command: 'earnings',
      ticker,
      text: i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: ['Fetch failed'],
    };
  }
}

async function executeDividendsCommand(
  ticker: string,
  language: Language,
): Promise<ChatCommandExecutionResult> {
  try {
    const dividends = await fetchDividends(ticker);
    const evidenceItems = buildDividendEvidence(dividends || []);

    if (!dividends || dividends.length === 0) {
      return {
        ok: true,
        command: 'dividends',
        ticker,
        text: i18nT(language, 'chat.commands.dividendsResult', { ticker }),
        messagePatch: {
          blocks: [
            { type: 'evidence_list', data: { evidence: [{ label: i18nT(language, 'dividends.unavailable'), source: undefined, url: undefined }] } },
          ],
        },
        evidenceItems: [],
        dataQualityNotes: [i18nT(language, 'dividends.unavailable')],
      };
    }

    const items = dividends.slice(0, 20).map((d: any) => ({
      label: `${d.date || 'N/A'} — $${d.amount != null ? d.amount.toFixed(4) : 'N/A'}${d.paymentDate ? ' (Pay: ' + d.paymentDate + ')' : ''}`,
      source: 'Dividend',
      url: undefined,
    }));

    const blocks: ChatRenderBlock[] = [
      { type: 'evidence_list', data: { evidence: items } },
    ];

    return {
      ok: true,
      command: 'dividends',
      ticker,
      text: i18nT(language, 'chat.commands.dividendsResult', { ticker }),
      messagePatch: { blocks },
      evidenceItems,
      contextUpdate: { ticker, command: 'dividends' },
    };
  } catch (error: any) {
    console.warn('[Command] Dividends fetch failed:', error);
    return {
      ok: true,
      command: 'dividends',
      ticker,
      text: i18nT(language, 'chat.commands.fetchFailed'),
      evidenceItems: [],
      dataQualityNotes: ['Fetch failed'],
    };
  }
}
