import { normalizeTicker as normalizeSecTicker } from './secService.js';
import {
  fetchBackendQuote,
  fetchBackendNews,
  fetchBackendFundamentals,
  fetchBackendHistory,
  fetchBackendSecFilings,
  fetchBackendOfficialSources,
} from './chatToolDataService.js';
import {
  buildQuoteBlocks,
  buildNewsBlocks,
  buildFundamentalsBlocks,
  buildHistoryChartBlocks,
  buildSecTableBlocks,
  buildOfficialSourceBlocks,
  buildSourceTrustBlocks,
  buildEvidenceBundleBlocks,
  buildDisclaimerBlock,
  formatCurrency,
  formatPercent,
  inferDataQuality,
} from './chatBlockBuilderService.js';
import {
  buildQuoteEvidenceItem,
  buildNewsEvidenceItems,
  buildSecEvidenceItems,
  buildOfficialSourceEvidenceItems,
  buildSourceTrustEvidenceItem,
  capEvidenceItems,
} from './chatEvidenceBuilderService.js';
import {
  buildBackendSourceTrustSummary,
  buildBackendVerifiedNewsItems,
} from './chatSourceTrustAggregator.js';
import {
  createBackendToolTrace,
  createDefaultBackendToolTrace,
} from './chatToolTraceBuilder.js';

const SUPPORTED_BACKEND_COMMANDS = new Set([
  'help',
  'quote',
  'news',
  'fundamentals',
  'history',
  'chart',
  'sec',
  'official',
  'trust',
  'evidence',
]);

const MAX_MESSAGE_LENGTH = 2000;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_CONTEXT_ITEMS = 5;
const MAX_NEWS_ITEMS = 5;
const MAX_EVIDENCE_NEWS_ITEMS = 3;
const MAX_SEC_EVIDENCE_ITEMS = 3;
const MAX_OFFICIAL_EVIDENCE_ITEMS = 2;
const MAX_SEC_TABLE_ROWS = 10;

const nowIso = () => new Date().toISOString();

const safeText = (value, maxLength = MAX_MESSAGE_LENGTH) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const normalizeLanguage = (language) => (language === 'zh' ? 'zh' : 'en');

export const normalizeTicker = (value) => {
  const normalized = normalizeSecTicker(value || '');
  return normalized || undefined;
};

export const safeLimitArray = (value, limit = MAX_EVIDENCE_ITEMS) => (
  Array.isArray(value) ? value.filter(Boolean).slice(0, limit) : []
);

const safeUrl = (value) => {
  const text = safeText(value, 500);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const buildMessage = ({ text, blocks = [] }) => ({
  id: `backend-tool-message-${Date.now()}`,
  role: 'assistant',
  text,
  ...(blocks.length > 0 ? { blocks } : {}),
  provider: 'local',
  model: 'backend-tool-executor',
  createdAt: nowIso(),
});

const buildTrace = ({
  command,
  ticker,
  evidenceItems = [],
  dataQualityNotes = [],
  steps = [],
}) => createBackendToolTrace({
  command,
  ticker,
  evidenceItems,
  dataQualityNotes,
  steps,
});

const buildBackendToolTrace = ({
  command,
  ticker,
  parseStatus = 'success',
  executeStatus = 'success',
  qualityStatus = 'success',
  responseStatus = 'success',
  evidenceItems = [],
  dataQualityNotes = [],
}) => createDefaultBackendToolTrace({
  command,
  ticker,
  parseStatus,
  executeStatus,
  qualityStatus,
  responseStatus,
  evidenceItems,
  dataQualityNotes,
});

const sanitizeContextArray = (items, mapper) => (
  safeLimitArray(items, MAX_CONTEXT_ITEMS).map(mapper).filter(Boolean)
);

const buildEvidenceBundleSummary = (ticker, items) => ({
  ticker,
  items: sanitizeContextArray(items, (item) => ({
    label: safeText(item?.label || item?.title || item?.description || 'Evidence', 180),
    source: safeText(item?.source || '', 80) || undefined,
    url: safeUrl(item?.url),
  })),
});

const buildContextUpdate = ({
  ticker,
  command,
  intent,
  dataQualityNotes,
  secFilings,
  officialSources,
  sourceTrust,
  evidenceBundle,
}) => {
  const derivedIntent = intent
    || (typeof command === 'string'
      ? safeText(command.replace(/^\//, '').split(/\s+/)[0], 32).toLowerCase()
      : undefined);

  return {
    ...(ticker ? { currentTicker: ticker } : {}),
    ...(command ? { lastCommand: command } : {}),
    ...(derivedIntent ? { lastIntent: derivedIntent } : {}),
    ...(sourceTrust ? { lastSourceTrust: sourceTrust } : {}),
    ...(Array.isArray(secFilings) ? {
      lastSecFilings: sanitizeContextArray(secFilings, (filing) => ({
        form: safeText(filing?.form || 'N/A', 20),
        filingDate: safeText(filing?.filingDate || 'N/A', 20),
        description: safeText(filing?.description || filing?.primaryDocument || filing?.reportDate || 'N/A', 180),
        url: safeUrl(filing?.url),
      })),
    } : {}),
    ...(Array.isArray(officialSources) ? {
      lastOfficialSources: sanitizeContextArray(officialSources, (source) => ({
        name: safeText(source?.name || 'Official source', 120),
        type: safeText(source?.type || 'official_source', 40),
        url: safeUrl(source?.url),
        authorityScore: Number.isFinite(Number(source?.authorityScore)) ? Number(source.authorityScore) : undefined,
      })),
    } : {}),
    ...(evidenceBundle ? { lastEvidenceBundle: buildEvidenceBundleSummary(ticker, evidenceBundle) } : {}),
    ...(dataQualityNotes?.length ? { lastDataQualityNotes: dataQualityNotes.slice(0, 3) } : {}),
  };
};

const buildBackendCommandText = (language, key, ticker) => {
  const zh = {
    help: '当前支持的命令：/help、/quote、/news、/fundamentals、/history、/chart、/sec、/official、/trust、/evidence。\n暂不可用：/verified-news、/backtest、/chain、/impact、/macro、/insiders、/earnings、/dividends、/clear。',
    quote: `已获取 ${ticker} 行情数据。数据仅供学习研究使用。`,
    news: `已获取 ${ticker} 相关新闻。新闻内容需结合来源核验。`,
    fundamentals: `已获取 ${ticker} 基本面快照。缺失字段显示 N/A。`,
    history: `已获取 ${ticker} 历史价格数据。历史表现不代表未来。`,
    chart: `已生成 ${ticker} 价格趋势图。图表仅供学习研究。`,
    sec: `已获取 ${ticker} SEC 文件摘要。请结合原文阅读。`,
    official: `已获取 ${ticker} 官方来源候选。部分来源可能需要人工确认。`,
    trust: `已生成 ${ticker} 来源可信度摘要。该评分仅反映证据来源质量，不构成投资结论。`,
    evidence: `已生成 ${ticker} 综合证据包，包括行情、新闻、SEC 文件、官方来源与来源可信度摘要。数据仅供学习研究使用。`,
    unsupported: '这里暂不支持该命令。可使用 /help 查看当前可用命令。',
    slashRequired: 'command mode 仅接受 slash command，例如 /quote AAPL。',
    missingTicker: '该命令需要股票代码。可直接传入 /quote AAPL，或提供 selectedTicker/currentTicker。',
    fetchFailed: '后端工具执行失败。请稍后重试。',
  };

  const en = {
    help: 'Supported commands: /help, /quote, /news, /fundamentals, /history, /chart, /sec, /official, /trust, /evidence.\nCurrently unavailable: /verified-news, /backtest, /chain, /impact, /macro, /insiders, /earnings, /dividends, /clear.',
    quote: `Fetched ${ticker} quote data for educational research only.`,
    news: `Fetched recent ${ticker} news. News should be verified against primary sources.`,
    fundamentals: `Fetched ${ticker} fundamentals snapshot. Missing fields are shown as N/A.`,
    history: `Fetched ${ticker} historical price data. Past performance does not imply future results.`,
    chart: `Built a ${ticker} price trend chart for educational research only.`,
    sec: `Fetched ${ticker} SEC filing summaries. Review the original filings for context.`,
    official: `Fetched official source candidates for ${ticker}. Some sources may require manual confirmation.`,
    trust: `Generated ${ticker} source trust summary. This score reflects evidence/source quality only and is not an investment conclusion.`,
    evidence: `Generated a ${ticker} evidence bundle including quote, news, SEC filings, official sources, and source trust summary for educational research only.`,
    unsupported: 'That command is not available here yet. Use /help to see the currently available commands.',
    slashRequired: 'Command mode requires a slash command such as /quote AAPL.',
    missingTicker: 'This command requires a ticker. Pass /quote AAPL directly, or provide selectedTicker/currentTicker.',
    fetchFailed: 'Backend tool execution failed. Please try again later.',
  };

  return (language === 'zh' ? zh : en)[key];
};

const noteText = (language, en, zh) => (language === 'zh' ? zh : en);

const uniquePush = (items, value) => {
  if (value && !items.includes(value)) items.push(value);
};

const buildCommandResult = ({
  ok = true,
  command,
  ticker,
  text,
  blocks = [],
  evidenceItems = [],
  warnings = [],
  contextUpdate,
  dataQualityNotes = [],
  trace,
  error,
}) => ({
  ok,
  command,
  ...(ticker ? { ticker } : {}),
  text,
  message: buildMessage({ text, blocks }),
  blocks,
  evidenceItems,
  warnings,
  ...(contextUpdate ? { contextUpdate } : {}),
  dataQualityNotes,
  trace,
  ...(error ? { error } : {}),
});

const buildSimpleDataFailureResult = ({ command, ticker, language }) => {
  const text = buildBackendCommandText(language, 'fetchFailed', ticker);
  return buildCommandResult({
    ok: false,
    command,
    ticker,
    text,
    blocks: [],
    evidenceItems: [],
    warnings: ['backend_tool_fetch_failed'],
    contextUpdate: buildContextUpdate({ ticker, command, dataQualityNotes: ['backend_tool_fetch_failed'] }),
    dataQualityNotes: ['backend_tool_fetch_failed'],
    trace: buildBackendToolTrace({
      command,
      ticker,
      executeStatus: 'error',
      qualityStatus: 'warning',
      responseStatus: 'warning',
      dataQualityNotes: ['backend_tool_fetch_failed'],
    }),
    error: 'backend_tool_fetch_failed',
  });
};

const buildHelpResult = ({ language }) => {
  const text = buildBackendCommandText(language, 'help');
  return buildCommandResult({
    command: 'help',
    text,
    blocks: [],
    evidenceItems: [],
    warnings: [],
    contextUpdate: buildContextUpdate({ command: 'help', dataQualityNotes: [] }),
    dataQualityNotes: [],
    trace: buildBackendToolTrace({ command: 'help' }),
  });
};

const buildUnsupportedResult = ({ command, language, ticker }) => {
  const text = buildBackendCommandText(language, 'unsupported', ticker);
  return buildCommandResult({
    command,
    ticker,
    text,
    blocks: [],
    evidenceItems: [],
    warnings: ['unsupported_backend_command'],
    contextUpdate: buildContextUpdate({ ticker, command, dataQualityNotes: [] }),
    dataQualityNotes: [],
    trace: buildBackendToolTrace({
      command,
      ticker,
      executeStatus: 'warning',
      qualityStatus: 'skipped',
      evidenceItems: [],
      dataQualityNotes: ['unsupported_backend_command'],
    }),
    error: 'unsupported_backend_command',
  });
};

const buildSlashRequiredResult = ({ language }) => {
  const text = buildBackendCommandText(language, 'slashRequired');
  return buildCommandResult({
    ok: false,
    command: 'command',
    text,
    blocks: [],
    evidenceItems: [],
    warnings: ['command_mode_requires_slash_command'],
    dataQualityNotes: [],
    trace: buildBackendToolTrace({
      command: 'command',
      parseStatus: 'error',
      executeStatus: 'skipped',
      qualityStatus: 'skipped',
      responseStatus: 'warning',
      dataQualityNotes: ['command_mode_requires_slash_command'],
    }),
    error: 'command_mode_requires_slash_command',
  });
};

const buildMissingTickerResult = ({ command, language }) => {
  const text = buildBackendCommandText(language, 'missingTicker');
  return buildCommandResult({
    ok: false,
    command,
    text,
    blocks: [],
    evidenceItems: [],
    warnings: ['missing_backend_command_ticker'],
    dataQualityNotes: [],
    trace: buildBackendToolTrace({
      command,
      parseStatus: 'warning',
      executeStatus: 'error',
      qualityStatus: 'skipped',
      responseStatus: 'warning',
      dataQualityNotes: ['missing_backend_command_ticker'],
    }),
    error: 'missing_backend_command_ticker',
  });
};

const buildQuoteResult = ({ quote, ticker, language }) => {
  const evidenceItems = capEvidenceItems([buildQuoteEvidenceItem({ quote, ticker })]);
  const dataQualityNotes = inferDataQuality(quote?.source) === 'simulation'
    ? ['Quote data is currently simulation/fallback.']
    : [];
  const blocks = buildQuoteBlocks({ quote, ticker });
  const text = buildBackendCommandText(language, 'quote', ticker);
  return buildCommandResult({
    command: 'quote',
    ticker,
    text,
    blocks,
    evidenceItems,
    warnings: [],
    contextUpdate: buildContextUpdate({ ticker, command: 'quote', dataQualityNotes }),
    dataQualityNotes,
    trace: buildBackendToolTrace({ command: 'quote', ticker, evidenceItems, dataQualityNotes }),
  });
};

const buildNewsResult = ({ news, ticker, language }) => {
  const limitedNews = safeLimitArray(news, MAX_NEWS_ITEMS);
  const evidenceItems = capEvidenceItems(buildNewsEvidenceItems({ news: limitedNews, ticker, limit: MAX_NEWS_ITEMS }));
  const blocks = buildNewsBlocks({ news: limitedNews });
  const text = buildBackendCommandText(language, 'news', ticker);
  return buildCommandResult({
    command: 'news',
    ticker,
    text,
    blocks,
    evidenceItems,
    warnings: [],
    contextUpdate: buildContextUpdate({ ticker, command: 'news', dataQualityNotes: [] }),
    dataQualityNotes: [],
    trace: buildBackendToolTrace({ command: 'news', ticker, evidenceItems }),
  });
};

const buildFundamentalsResult = ({ fundamentals, ticker, language }) => {
  const item = Array.isArray(fundamentals) ? fundamentals[0] : fundamentals;
  const evidenceItems = capEvidenceItems([{
    id: `fundamentals:${ticker}`,
    type: 'fundamentals',
    title: `${ticker} Fundamentals`,
    source: safeText(item?.source, 80) || 'Market Data',
    note: item?.website ? 'company_profile_snapshot' : 'limited_snapshot',
  }]);
  const blocks = buildFundamentalsBlocks({ fundamentals, ticker });
  const text = buildBackendCommandText(language, 'fundamentals', ticker);
  return buildCommandResult({
    command: 'fundamentals',
    ticker,
    text,
    blocks,
    evidenceItems,
    warnings: [],
    contextUpdate: buildContextUpdate({ ticker, command: 'fundamentals', dataQualityNotes: [] }),
    dataQualityNotes: [],
    trace: buildBackendToolTrace({ command: 'fundamentals', ticker, evidenceItems }),
  });
};

const buildHistoryResult = ({ historyPayload, ticker, language, command }) => {
  const history = Array.isArray(historyPayload?.historical) ? historyPayload.historical : [];
  const source = safeText(historyPayload?.source, 120) || 'Market Data';
  const evidenceItems = capEvidenceItems([{
    id: `history:${ticker}`,
    type: 'history',
    title: `${ticker} History`,
    source,
    note: history.length > 0 ? `${history.length} points` : 'no_history_data',
  }]);
  const blocks = buildHistoryChartBlocks({ history, ticker, source, command });
  const textKey = command === 'chart' ? 'chart' : 'history';
  const dataQualityNotes = history.length > 0 ? ['Historical prices are for research only.'] : ['No chart data available.'];
  const warnings = history.length > 0 ? [] : ['backend_history_unavailable'];
  const text = buildBackendCommandText(language, textKey, ticker);
  return buildCommandResult({
    command,
    ticker,
    text,
    blocks,
    evidenceItems,
    warnings,
    contextUpdate: buildContextUpdate({ ticker, command, dataQualityNotes }),
    dataQualityNotes,
    trace: buildBackendToolTrace({
      command,
      ticker,
      evidenceItems,
      dataQualityNotes,
      qualityStatus: history.length > 0 ? 'success' : 'warning',
    }),
  });
};

const buildSecResult = ({ secData, ticker, language }) => {
  const filings = safeLimitArray(secData?.filings, MAX_EVIDENCE_ITEMS);
  const evidenceItems = capEvidenceItems(buildSecEvidenceItems({ filings, ticker, limit: MAX_EVIDENCE_ITEMS }), MAX_EVIDENCE_ITEMS);
  const blocks = buildSecTableBlocks({ ticker, filings, language });
  const warnings = filings.length > 0 ? [] : ['backend_sec_unavailable'];
  const dataQualityNotes = filings.length > 0 ? [] : ['No SEC filing data available.'];
  const text = buildBackendCommandText(language, 'sec', ticker);
  return buildCommandResult({
    command: 'sec',
    ticker,
    text,
    blocks,
    evidenceItems,
    warnings,
    contextUpdate: buildContextUpdate({ ticker, command: 'sec', dataQualityNotes: [] }),
    dataQualityNotes,
    trace: buildBackendToolTrace({
      command: 'sec',
      ticker,
      evidenceItems,
      qualityStatus: filings.length > 0 ? 'success' : 'warning',
    }),
  });
};

const buildOfficialResult = ({ officialData, ticker, language }) => {
  const sources = safeLimitArray(officialData?.sources, MAX_EVIDENCE_ITEMS);
  const evidenceItems = capEvidenceItems(buildOfficialSourceEvidenceItems({ sources, ticker, limit: MAX_EVIDENCE_ITEMS }), MAX_EVIDENCE_ITEMS);
  const blocks = buildOfficialSourceBlocks({ sources, ticker });
  const warnings = sources.length > 0 ? [] : ['backend_official_unavailable'];
  const dataQualityNotes = sources.length > 0 ? [] : ['No official source candidates available.'];
  const text = buildBackendCommandText(language, 'official', ticker);
  return buildCommandResult({
    command: 'official',
    ticker,
    text,
    blocks,
    evidenceItems,
    warnings,
    contextUpdate: buildContextUpdate({ ticker, command: 'official', dataQualityNotes: [] }),
    dataQualityNotes,
    trace: buildBackendToolTrace({
      command: 'official',
      ticker,
      evidenceItems,
      qualityStatus: sources.length > 0 ? 'success' : 'warning',
    }),
  });
};

const defaultSecData = (ticker) => ({ ticker, filings: [], status: 'error', notes: [] });
const defaultOfficialData = (ticker) => ({ ticker, sources: [], status: 'error', mode: 'rule_only', notes: [] });

const dataOrDefault = (result, fallback) => (result?.ok ? result.data : fallback);

const buildTrustResult = ({
  ticker,
  language,
  newsResult,
  secResult,
  officialResult,
}) => {
  const news = newsResult.ok && Array.isArray(newsResult.data) ? safeLimitArray(newsResult.data, MAX_NEWS_ITEMS) : [];
  const verifiedNews = news.length > 0 ? buildBackendVerifiedNewsItems({ ticker, news }) : [];
  const secData = dataOrDefault(secResult, defaultSecData(ticker));
  const officialData = dataOrDefault(officialResult, defaultOfficialData(ticker));
  const trustSummary = buildBackendSourceTrustSummary({
    ticker,
    news,
    verifiedNews,
    secFilings: secData,
    officialSources: officialData,
  });
  const hasTrustSignals = trustSummary.metrics.officialSourceCount > 0
    || trustSummary.metrics.secFilingCount > 0
    || trustSummary.metrics.verifiedNewsCount > 0;
  const warnings = [];
  const dataQualityNotes = [];

  if (!newsResult.ok || news.length === 0) {
    uniquePush(dataQualityNotes, noteText(language, 'News verification samples were limited.', '新闻验证样本不足。'));
  }
  if (!secResult.ok || secData?.status === 'error') {
    uniquePush(warnings, 'backend_sec_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'SEC filings are currently unavailable.', 'SEC 文件当前不可用。'));
  }
  if (!officialResult.ok || officialData?.status === 'error') {
    uniquePush(warnings, 'backend_official_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'Official source discovery is currently unavailable.', '官方来源当前不可用。'));
  }
  if (!hasTrustSignals) {
    uniquePush(warnings, 'source_trust_unavailable');
    uniquePush(dataQualityNotes, noteText(
      language,
      'Source trust signals were insufficient, so only a limited summary is available.',
      '来源可信度信号不足，当前仅能返回有限摘要。',
    ));
  }

  const blocks = buildSourceTrustBlocks({
    trustSummary,
    language,
    newsCount: news.length,
    dataQuality: hasTrustSignals ? 'available' : 'limited',
  });
  const evidenceItems = capEvidenceItems([
    buildSourceTrustEvidenceItem({ trustSummary }),
    ...buildNewsEvidenceItems({ news: verifiedNews, ticker, limit: 1 }),
    ...buildSecEvidenceItems({ filings: secData?.filings || [], ticker, limit: 1 }),
    ...buildOfficialSourceEvidenceItems({ sources: officialData?.sources || [], ticker, limit: 1 }),
  ]);
  const trace = buildTrace({
    command: 'trust',
    ticker,
    evidenceItems,
    dataQualityNotes,
    steps: [
      { id: 'backend-tool-user-input', type: 'user_input', label: 'user_input', status: 'success' },
      { id: 'backend-command-parse', type: 'command_execute', label: 'backend_command_parse', status: 'success', metadata: { command: 'trust', ticker } },
      { id: 'backend-tool-execute', type: 'tool_call', label: 'backend_tool_execute', status: 'success', metadata: { command: 'trust', ticker } },
      {
        id: 'backend-source-trust',
        type: 'evidence',
        label: 'backend_source_trust',
        status: hasTrustSignals ? 'success' : 'warning',
        message: hasTrustSignals
          ? noteText(language, 'Built source trust summary from available source signals.', '已基于可用来源信号生成可信度摘要。')
          : noteText(language, 'Source signals were limited, so a reduced trust summary was returned.', '可用来源信号不足，返回有限可信度摘要。'),
      },
      { id: 'backend-data-quality', type: 'data_quality', label: 'backend_data_quality', status: warnings.length > 0 ? 'warning' : 'success' },
      { id: 'backend-response-build', type: 'fallback', label: 'backend_response_build', status: 'success' },
    ],
  });
  const text = buildBackendCommandText(language, 'trust', ticker);

  return buildCommandResult({
    command: 'trust',
    ticker,
    text,
    blocks,
    evidenceItems,
    warnings,
    contextUpdate: buildContextUpdate({
      ticker,
      command: `/trust ${ticker}`,
      intent: 'trust',
      sourceTrust: trustSummary,
      dataQualityNotes,
    }),
    dataQualityNotes,
    trace,
  });
};

const buildEvidenceListItems = ({ ticker, quote, news, verifiedNews, secData, officialData }) => {
  const quoteItems = quote ? [{
    label: `${ticker} Quote | ${formatCurrency(quote.price)} | ${formatPercent(quote.changePercent)}`,
    source: safeText(quote.source, 80) || 'Market Data',
  }] : [];
  const newsItems = verifiedNews.length > 0
    ? safeLimitArray(verifiedNews, MAX_EVIDENCE_NEWS_ITEMS).map((item) => ({
      label: `[${Number(item.confidenceScore || 0)}% verified] ${safeText(item.title, 180)}`,
      source: safeText(item.source, 80),
      url: item.url,
    }))
    : safeLimitArray(news, MAX_EVIDENCE_NEWS_ITEMS).map((item) => ({
      label: safeText(item.title || 'News item', 180),
      source: safeText(item.site || item.source || 'News', 80),
      url: item.url,
    }));
  const secItems = safeLimitArray(secData?.filings || [], MAX_SEC_EVIDENCE_ITEMS).map((filing) => ({
    label: `${safeText(filing.form || 'SEC', 20)} | ${safeText(filing.filingDate || 'N/A', 20)}`,
    source: 'SEC EDGAR',
    url: filing.url,
  }));
  const officialItems = safeLimitArray(officialData?.sources || [], MAX_OFFICIAL_EVIDENCE_ITEMS).map((source) => ({
    label: safeText(source.name || `${ticker} Source`, 120),
    source: safeText(source.type || 'official_source', 80),
    url: source.url,
  }));

  return safeLimitArray([...quoteItems, ...newsItems, ...secItems, ...officialItems], MAX_EVIDENCE_ITEMS);
};

const addEvidenceAvailabilityWarnings = ({
  language,
  warnings,
  dataQualityNotes,
  quoteResult,
  newsResult,
  secResult,
  officialResult,
  quote,
  news,
  secData,
  officialData,
  trustSummary,
}) => {
  const quoteQuality = quote ? inferDataQuality(quote?.source) : 'unavailable';
  const hasNewsItems = news.length > 0;
  const hasSecFilings = Array.isArray(secData?.filings) && secData.filings.length > 0;
  const hasOfficialSources = Array.isArray(officialData?.sources) && officialData.sources.length > 0;

  if (!quoteResult.ok) {
    uniquePush(warnings, 'backend_quote_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'Quote data is currently unavailable.', '行情数据当前不可用。'));
  } else if (quoteQuality !== 'available') {
    uniquePush(warnings, 'backend_quote_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'Quote data is currently fallback or simulated.', '行情数据为回退或模拟值。'));
  }
  if (!newsResult.ok) {
    uniquePush(warnings, 'backend_news_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'News data is currently unavailable.', '新闻数据当前不可用。'));
  } else if (!hasNewsItems) {
    uniquePush(warnings, 'backend_news_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'No news samples are currently available.', '当前没有可用新闻样本。'));
  }
  if (!secResult.ok || secData?.status === 'error') {
    uniquePush(warnings, 'backend_sec_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'SEC filings are currently unavailable.', 'SEC 文件当前不可用。'));
  } else if (!hasSecFilings) {
    uniquePush(warnings, 'backend_sec_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'No SEC filings are currently available.', '当前没有可用 SEC 文件。'));
  }
  if (!officialResult.ok || officialData?.status === 'error') {
    uniquePush(warnings, 'backend_official_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'Official source discovery is currently unavailable.', '官方来源当前不可用。'));
  } else if (!hasOfficialSources) {
    uniquePush(warnings, 'backend_official_unavailable');
    uniquePush(dataQualityNotes, noteText(language, 'No official source candidates are currently available.', '当前没有可用官方来源。'));
  }
  if (warnings.some((warning) => warning.startsWith('backend_'))) {
    uniquePush(warnings, 'partial_evidence_unavailable');
  }
  if (
    (trustSummary.metrics.officialSourceCount || 0) === 0
    && (trustSummary.metrics.secFilingCount || 0) === 0
    && (trustSummary.metrics.verifiedNewsCount || 0) === 0
  ) {
    uniquePush(warnings, 'source_trust_unavailable');
    uniquePush(dataQualityNotes, noteText(
      language,
      'Source trust could only be generated from limited data.',
      '来源可信度仅能基于有限数据生成。',
    ));
  }
};

const buildEvidenceResult = ({
  ticker,
  language,
  quoteResult,
  newsResult,
  secResult,
  officialResult,
}) => {
  const warnings = [];
  const dataQualityNotes = [];
  const quote = quoteResult.ok ? quoteResult.data : null;
  const news = newsResult.ok && Array.isArray(newsResult.data) ? safeLimitArray(newsResult.data, MAX_NEWS_ITEMS) : [];
  const verifiedNews = news.length > 0 ? buildBackendVerifiedNewsItems({ ticker, news }) : [];
  const secData = dataOrDefault(secResult, defaultSecData(ticker));
  const officialData = dataOrDefault(officialResult, defaultOfficialData(ticker));
  const trustSummary = buildBackendSourceTrustSummary({
    ticker,
    quote,
    news,
    verifiedNews,
    secFilings: secData,
    officialSources: officialData,
  });

  addEvidenceAvailabilityWarnings({
    language,
    warnings,
    dataQualityNotes,
    quoteResult,
    newsResult,
    secResult,
    officialResult,
    quote,
    news,
    secData,
    officialData,
    trustSummary,
  });

  const evidenceListItems = buildEvidenceListItems({
    ticker,
    quote,
    news,
    verifiedNews,
    secData,
    officialData,
  });
  const secFilings = safeLimitArray(secData?.filings || [], MAX_SEC_TABLE_ROWS);
  const blocks = buildEvidenceBundleBlocks({
    ticker,
    evidenceListItems,
    trustSummary,
    secFilings,
    quote,
    news,
    dataQualityNotes,
    warnings,
    language,
  });
  const evidenceItems = capEvidenceItems([
    ...(quote ? [buildQuoteEvidenceItem({ quote, ticker })] : []),
    ...buildNewsEvidenceItems({ news: verifiedNews.length > 0 ? verifiedNews : news, ticker, limit: MAX_EVIDENCE_NEWS_ITEMS }),
    ...buildSecEvidenceItems({ filings: secData?.filings || [], ticker, limit: MAX_SEC_EVIDENCE_ITEMS }),
    ...buildOfficialSourceEvidenceItems({ sources: officialData?.sources || [], ticker, limit: MAX_OFFICIAL_EVIDENCE_ITEMS }),
  ], MAX_EVIDENCE_ITEMS);
  const trace = buildTrace({
    command: 'evidence',
    ticker,
    evidenceItems,
    dataQualityNotes,
    steps: [
      { id: 'backend-tool-user-input', type: 'user_input', label: 'user_input', status: 'success' },
      { id: 'backend-command-parse', type: 'command_execute', label: 'backend_command_parse', status: 'success', metadata: { command: 'evidence', ticker } },
      { id: 'backend-tool-execute', type: 'tool_call', label: 'backend_tool_execute', status: 'success', metadata: { command: 'evidence', ticker } },
      {
        id: 'backend-quote-fetch',
        type: 'tool_call',
        label: 'backend_quote_fetch',
        status: quoteResult.ok ? 'success' : 'warning',
        message: quoteResult.ok
          ? noteText(language, 'Quote data retrieved.', '已获取行情数据。')
          : noteText(language, 'Quote data was unavailable; returning remaining evidence.', '行情数据不可用，继续返回其他证据。'),
      },
      {
        id: 'backend-news-fetch',
        type: 'tool_call',
        label: 'backend_news_fetch',
        status: newsResult.ok ? 'success' : 'warning',
        message: newsResult.ok
          ? noteText(language, 'News data retrieved.', '已获取新闻数据。')
          : noteText(language, 'News data was unavailable; returning remaining evidence.', '新闻数据不可用，继续返回其他证据。'),
      },
      {
        id: 'backend-sec-fetch',
        type: 'tool_call',
        label: 'backend_sec_fetch',
        status: secResult.ok && secData?.status !== 'error' ? 'success' : 'warning',
        message: secResult.ok && secData?.status !== 'error'
          ? noteText(language, 'SEC filings retrieved.', '已获取 SEC 文件。')
          : noteText(language, 'SEC filings were unavailable; returning remaining evidence.', 'SEC 文件不可用，继续返回其他证据。'),
      },
      {
        id: 'backend-official-fetch',
        type: 'tool_call',
        label: 'backend_official_fetch',
        status: officialResult.ok && officialData?.status !== 'error' ? 'success' : 'warning',
        message: officialResult.ok && officialData?.status !== 'error'
          ? noteText(language, 'Official sources retrieved.', '已获取官方来源。')
          : noteText(language, 'Official sources were unavailable; returning remaining evidence.', '官方来源不可用，继续返回其他证据。'),
      },
      {
        id: 'backend-source-trust',
        type: 'evidence',
        label: 'backend_source_trust',
        status: warnings.includes('source_trust_unavailable') ? 'warning' : 'success',
      },
      {
        id: 'backend-data-quality',
        type: 'data_quality',
        label: 'backend_data_quality',
        status: warnings.length > 0 ? 'warning' : 'success',
      },
      { id: 'backend-response-build', type: 'fallback', label: 'backend_response_build', status: 'success' },
    ],
  });
  const text = buildBackendCommandText(language, 'evidence', ticker);

  return buildCommandResult({
    command: 'evidence',
    ticker,
    text,
    blocks,
    evidenceItems,
    warnings,
    contextUpdate: buildContextUpdate({
      ticker,
      command: `/evidence ${ticker}`,
      intent: 'evidence',
      sourceTrust: trustSummary,
      secFilings: secData?.filings || [],
      officialSources: officialData?.sources || [],
      evidenceBundle: evidenceListItems,
      dataQualityNotes,
    }),
    dataQualityNotes,
    trace,
  });
};

const resolveTicker = ({ parsedCommand, selectedTicker, clientContext }) => (
  normalizeTicker(parsedCommand?.ticker)
  || normalizeTicker(selectedTicker)
  || normalizeTicker(clientContext?.currentTicker)
);

export function parseBackendCommand(message) {
  const text = safeText(message || '');
  if (!text.startsWith('/')) return null;

  const parts = text.slice(1).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return null;

  const command = safeText(parts[0], 32).toLowerCase();
  const args = parts.slice(1).map((part) => safeText(part, 64));
  return {
    command,
    args,
    ticker: normalizeTicker(args[0]),
  };
}

const unwrapDataOrFailure = (result, { command, ticker, language }) => (
  result.ok ? result.data : buildSimpleDataFailureResult({ command, ticker, language })
);

export async function executeBackendChatTool(input, deps = {}) {
  const language = normalizeLanguage(input?.language);
  const parsedCommand = parseBackendCommand(input?.message);

  if (!parsedCommand) {
    return buildSlashRequiredResult({ language });
  }

  if (!SUPPORTED_BACKEND_COMMANDS.has(parsedCommand.command)) {
    return buildUnsupportedResult({
      command: parsedCommand.command,
      language,
      ticker: resolveTicker({ parsedCommand, selectedTicker: input?.selectedTicker, clientContext: input?.clientContext }),
    });
  }

  if (parsedCommand.command === 'help') {
    return buildHelpResult({ language });
  }

  const ticker = resolveTicker({
    parsedCommand,
    selectedTicker: input?.selectedTicker,
    clientContext: input?.clientContext,
  });

  if (!ticker) {
    return buildMissingTickerResult({ command: parsedCommand.command, language });
  }

  try {
    switch (parsedCommand.command) {
      case 'quote': {
        const quoteResult = await fetchBackendQuote(ticker, deps);
        const quote = unwrapDataOrFailure(quoteResult, { command: 'quote', ticker, language });
        return quoteResult.ok ? buildQuoteResult({ quote, ticker, language }) : quote;
      }
      case 'news': {
        const newsResult = await fetchBackendNews(ticker, deps);
        const news = unwrapDataOrFailure(newsResult, { command: 'news', ticker, language });
        return newsResult.ok ? buildNewsResult({ news, ticker, language }) : news;
      }
      case 'fundamentals': {
        const fundamentalsResult = await fetchBackendFundamentals(ticker, deps);
        const fundamentals = unwrapDataOrFailure(fundamentalsResult, { command: 'fundamentals', ticker, language });
        return fundamentalsResult.ok ? buildFundamentalsResult({ fundamentals, ticker, language }) : fundamentals;
      }
      case 'history':
      case 'chart': {
        const historyResult = await fetchBackendHistory(ticker, deps);
        const historyPayload = unwrapDataOrFailure(historyResult, { command: parsedCommand.command, ticker, language });
        return historyResult.ok
          ? buildHistoryResult({ historyPayload, ticker, language, command: parsedCommand.command })
          : historyPayload;
      }
      case 'sec': {
        const secResult = await fetchBackendSecFilings(ticker, deps);
        if (!secResult.ok) return buildSimpleDataFailureResult({ command: 'sec', ticker, language });
        return buildSecResult({ secData: secResult.data, ticker, language });
      }
      case 'official': {
        const officialResult = await fetchBackendOfficialSources(ticker, deps);
        if (!officialResult.ok) return buildSimpleDataFailureResult({ command: 'official', ticker, language });
        return buildOfficialResult({ officialData: officialResult.data, ticker, language });
      }
      case 'trust': {
        const [newsResult, secResult, officialResult] = await Promise.all([
          fetchBackendNews(ticker, deps),
          fetchBackendSecFilings(ticker, deps),
          fetchBackendOfficialSources(ticker, deps),
        ]);
        return buildTrustResult({ ticker, language, newsResult, secResult, officialResult });
      }
      case 'evidence': {
        const [quoteResult, newsResult, secResult, officialResult] = await Promise.all([
          fetchBackendQuote(ticker, deps),
          fetchBackendNews(ticker, deps),
          fetchBackendSecFilings(ticker, deps),
          fetchBackendOfficialSources(ticker, deps),
        ]);
        return buildEvidenceResult({ ticker, language, quoteResult, newsResult, secResult, officialResult });
      }
      default:
        return buildUnsupportedResult({ command: parsedCommand.command, language, ticker });
    }
  } catch (error) {
    console.warn(`[Backend Tool Executor] ${parsedCommand.command} failed for ${ticker}: ${safeText(error instanceof Error ? error.message : String(error), 120)}`);
    return buildSimpleDataFailureResult({ command: parsedCommand.command, ticker, language });
  }
}
