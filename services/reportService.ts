import { fetchCompanyFundamentals, fetchStockNews, fetchStockQuote, fetchWhisperData } from './marketDataService';
import { fetchVerifiedStockNews } from './newsVerificationService';
import { fetchSecFilingsForTicker } from './secFilingService';
import { fetchOfficialSources } from './officialSourceService';
import { assessQuoteQuality, isQuoteReliableForMarketConclusion } from './reportQualityService';
import { buildDataSourceHealth, safeResolveSource } from './requestStabilityService';
import type { Language } from '../i18n';
import {
  CompanyFundamentals,
  AiReportSections,
  DataSourceHealth,
  DataSourceStatus,
  NewsItem,
  OfficialSourceVerification,
  SecFilingVerification,
  StockAnalysisReport,
  StockQuote,
  VerifiedNewsItem,
  WhisperData,
} from '../types';

interface AiReportResponse {
  ok: boolean;
  provider?: 'deepseek';
  model?: string;
  report?: Partial<AiReportSections> & {
    optionsEducation?: string;
    disclaimer?: string;
  };
  error?: string;
}

const REPORT_DISCLAIMER = 'For educational and research use only. Not financial advice.';

const SOURCE_TIMEOUTS = {
  quote: 8000,
  fundamentals: 8000,
  news: 8000,
  verifiedNews: 8000,
  officialFilings: 10000,
  officialSources: 10000,
  whisper: 5000,
  ai: 25000,
};

const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase();

const isZh = (language: Language) => language === 'zh';

const buildUnavailableSecFilings = (ticker: string, error?: string): SecFilingVerification => ({
  ticker,
  generatedAt: new Date().toISOString(),
  filings: [],
  formsIncluded: [],
  status: 'unavailable',
  error,
  notes: ['SEC EDGAR filings are currently unavailable.'],
});

const buildUnavailableOfficialSources = (ticker: string, error?: string): OfficialSourceVerification => ({
  ticker,
  generatedAt: new Date().toISOString(),
  status: 'error',
  sources: [],
  notes: [error || 'Official source discovery is currently unavailable.'],
  mode: 'rule_only',
});

const getQuoteHealthStatus = (quote: StockQuote | null): DataSourceStatus => {
  const quality = assessQuoteQuality(quote);
  if (quality === 'simulation') return 'simulation';
  if (quality === 'fallback') return 'fallback';
  if (quality === 'unavailable') return 'unavailable';
  return 'success';
};

const mergeHealth = (items: DataSourceHealth[]) => items.filter(Boolean);

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
};

const buildAvailabilityNotes = (
  quote: StockQuote | null,
  fundamentals: CompanyFundamentals | null,
  news: NewsItem[],
  officialFilings: SecFilingVerification,
  officialSources: OfficialSourceVerification,
  whisper: WhisperData | null,
  failedSources: string[]
): string[] => {
  const notes: string[] = [];
  const quoteQuality = assessQuoteQuality(quote);

  if (!quote) notes.push('Live quote data was unavailable when this report was generated.');
  if (quote && (quoteQuality === 'simulation' || quoteQuality === 'fallback')) {
    notes.push('Quote data was simulation or fallback data and must not be treated as confirmed real-time market data.');
  }
  if (!fundamentals) notes.push('Company fundamentals were unavailable or incomplete for this run.');
  if (news.length === 0) notes.push('No recent news items were available, so news coverage is limited.');
  if (officialFilings.status !== 'available') notes.push('SEC EDGAR official filings were unavailable or empty for this report.');
  if (officialSources.status === 'not_found' || officialSources.status === 'error') notes.push('Official source discovery was unavailable or returned no candidates for this report.');
  if (!whisper) {
    notes.push('Experimental Whisper alternative signal data was unavailable for this report.');
  } else {
    notes.push('Whisper signals are experimental, simulated-style alternative indicators and not a complete or verified social media dataset.');
  }

  if (failedSources.length > 0) {
    notes.push(`Data source issues detected: ${failedSources.join(', ')}.`);
  }

  return notes;
};

const buildFallbackReport = (
  ticker: string,
  language: Language,
  quote: StockQuote | null,
  fundamentals: CompanyFundamentals | null,
  news: NewsItem[],
  verifiedNews: VerifiedNewsItem[],
  officialFilings: SecFilingVerification,
  officialSources: OfficialSourceVerification,
  whisper: WhisperData | null,
  failedSources: string[]
): StockAnalysisReport => {
  const zh = isZh(language);
  const availabilityNotes = buildAvailabilityNotes(quote, fundamentals, news, officialFilings, officialSources, whisper, failedSources);
  const quoteQuality = assessQuoteQuality(quote);
  const quoteIsReliable = isQuoteReliableForMarketConclusion(quote);
  const newsHeadlineSummary =
    news.length > 0
      ? news
          .slice(0, 3)
          .map((item) => `${item.title} (${item.site})`)
          .join('; ')
      : zh ? '当前新闻源没有可用的近期标题。' : 'No recent headlines were available from the current feed.';

  const quoteSummary = quote
    ? quoteIsReliable
      ? zh
        ? `${ticker} 当前观测价格为 $${quote.price.toFixed(2)}，日内变动为 ${quote.changePercent.toFixed(2)}%。该数据仍需结合数据源延迟和覆盖范围理解。`
        : `${ticker} was last observed at $${quote.price.toFixed(2)}, with a ${quote.change >= 0 ? 'positive' : 'negative'} daily move of ${quote.changePercent.toFixed(2)}%.`
      : zh
        ? `${ticker} 行情被标记为${quoteQuality === 'simulation' ? '模拟数据' : '回退数据'}；展示价格只能作为页面可用性参考，不能视为确认的真实市场行情。`
        : `${ticker} quote data is marked as ${quoteQuality}; the displayed price should be treated as simulation or fallback context, not confirmed market data.`
    : zh ? `${ticker} 暂时无法获取行情数据，因此价格观察有限。` : `${ticker} quote data was unavailable, so price observations are limited.`;

  const fundamentalsSummary = fundamentals
    ? zh
      ? `${fundamentals.companyName} 所属板块为 ${fundamentals.sector || '未披露板块'}。当前已获得部分公司资料，但估值、Beta 或行业字段可能仍不完整。`
      : `${fundamentals.companyName} operates in ${fundamentals.sector || 'an unspecified sector'}. Market cap and business profile were available, but some fields may remain sparse in the current backend feed.`
    : zh ? '公司基本面资料暂时不可用，因此业务背景应视为不完整。' : 'Fundamental company profile data was unavailable, so business context should be treated as incomplete.';

  const sourceTrustSummary = zh
    ? `来源核验发现 ${officialSources.sources.length} 个官方来源候选、${officialFilings.filings.length} 条近期 SEC 文件和 ${verifiedNews.length} 条可信新闻。这些信号用于提升来源透明度，但不等于验证任何投资结论。`
    : `Source checks found ${officialSources.sources.length} official source candidates, ${officialFilings.filings.length} recent SEC filings, and ${verifiedNews.length} verified news items. These signals support source transparency but do not validate any investment conclusion.`;

  return {
    ticker,
    generatedAt: new Date().toISOString(),
    quote,
    fundamentals,
    news,
    verifiedNews,
    officialFilings,
    officialSources,
    whisper,
    summary: zh
      ? `${quoteSummary} 本报告是基于当前可用行情、公司资料、新闻和来源核验信息生成的研究快照。仅供学习研究使用，不构成投资建议。`
      : `${quoteSummary} This report is a research-oriented snapshot assembled from currently available market, company, and headline data. ${REPORT_DISCLAIMER}`,
    dataAvailabilityAnalysis: zh
      ? `数据可用性：${availabilityNotes.join(' ')}`
      : `Data availability: ${availabilityNotes.join(' ')}`,
    priceAnalysis: `${quoteSummary} ${quoteIsReliable ? (zh ? '价格观察仅作为市场背景，仍需关注数据源延迟和覆盖范围。' : 'Use price observations as market context only, with attention to provider latency and coverage.') : (zh ? '由于行情未被确认为真实市场数据，不能据此形成真实价格表现结论。' : 'Because the quote is not confirmed real market data, no real price-performance conclusion should be drawn from it.')}`,
    newsAnalysis: zh
      ? `近期新闻覆盖：${newsHeadlineSummary} 新闻情绪由标题和摘要自动估算，可能不完整，只能作为研究线索。`
      : `Recent headline coverage: ${newsHeadlineSummary} News sentiment is automatically estimated from available headlines and summaries, may be incomplete, and should be treated as an educational signal.`,
    fundamentalsAnalysis: fundamentalsSummary,
    volatilityAnalysis: quote
      ? zh
        ? `当前启发式估算隐含波动率约为 ${(quote.volatility * 100).toFixed(1)}%。该数值只能作为方向性背景，不能替代正式期权定价数据。`
        : `Estimated implied volatility was approximately ${(quote.volatility * 100).toFixed(1)}% based on the current quote service heuristic. This is best used as a directional context cue, not a pricing-grade volatility measure.`
      : zh ? '由于行情不可用，波动率观察有限。' : 'Volatility observations were limited because quote data was unavailable.',
    optionsEducation: zh
      ? '期权相关观察仅供教育研究。解读任何期权信号前，应继续核对隐含波动率、事件时间和流动性。'
      : 'Options observations in this report are educational only. Monitor implied volatility, earnings timing, and liquidity before drawing conclusions from any options-related pattern.',
    sourceTrustAnalysis: sourceTrustSummary,
    followUpChecklist: [
      zh ? '确认真实行情数据源是否已正确配置并可覆盖该 ticker。' : 'Confirm live quote coverage from a configured market data provider.',
      zh ? '复核 SEC 文件和公司官方来源是否存在重大更新。' : 'Review official filings and company sources for material updates.',
      zh ? '将新闻情绪与公司公告、监管披露等一手来源交叉核对。' : 'Compare headline sentiment with primary-source disclosures before drawing conclusions.',
      zh ? '在研究期权场景前继续观察流动性、波动率和事件时间。' : 'Monitor liquidity, volatility, and event timing before studying options scenarios.',
    ],
    risks: [
      zh ? '市场数据可能延迟、模拟或暂时不可用。' : 'Market data may be delayed, simulated, or temporarily unavailable.',
      zh ? '新闻情绪为启发式估算，可能遗漏语境或后续变化。' : 'Headline sentiment is heuristic and may miss nuance or later developments.',
      zh ? 'Whisper 信号是实验性另类数据，不是完整社交媒体数据集。' : 'Experimental Whisper signals are simulated-style alternative data and not a complete social media dataset.',
      ...availabilityNotes,
    ],
    conclusion: zh
      ? '请将本报告作为研究摘要和后续观察清单使用，重点关注下一步需要核验的数据，而不是将任何部分视为建议。仅供学习研究使用，不构成投资建议。'
      : `Use this report as a research summary and watch list builder. Focus on what to monitor next rather than treating any section as a recommendation. ${REPORT_DISCLAIMER}`,
    disclaimer: zh ? '仅供学习研究使用，不构成投资建议。' : REPORT_DISCLAIMER,
    dataAvailability: availabilityNotes,
    aiProvider: 'fallback',
  };
};

const buildSourceTrustSummaryForAi = ({
  ticker,
  verifiedNews,
  officialFilings,
  officialSources,
}: {
  ticker: string;
  verifiedNews: VerifiedNewsItem[];
  officialFilings: SecFilingVerification;
  officialSources: OfficialSourceVerification;
}) => ({
  ticker,
  officialSourceCount: officialSources.sources.length,
  secFilingCount: officialFilings.filings.length,
  verifiedNewsCount: verifiedNews.length,
  highConfidenceNewsCount: verifiedNews.filter((item) => item.confidenceScore >= 75).length,
  officialSourceStatus: officialSources.status,
  secFilingStatus: officialFilings.status,
  mode: officialSources.mode,
});

const requestDeepSeekReport = async ({
  ticker,
  language,
  quote,
  fundamentals,
  news,
  verifiedNews,
  officialFilings,
  officialSources,
  dataSourceHealth,
  whisper,
}: {
  ticker: string;
  language: Language;
  quote: StockQuote | null;
  fundamentals: CompanyFundamentals | null;
  news: NewsItem[];
  verifiedNews: VerifiedNewsItem[];
  officialFilings: SecFilingVerification;
  officialSources: OfficialSourceVerification;
  dataSourceHealth: DataSourceHealth[];
  whisper: WhisperData | null;
}) => {
  const response = await fetch('/api/ai/report', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker,
      quote,
      fundamentals,
      news,
      verifiedNews,
      officialFilings,
      officialSources,
      sourceTrustSummary: buildSourceTrustSummaryForAi({ ticker, verifiedNews, officialFilings, officialSources }),
      dataSourceHealth,
      whisper,
      language,
    }),
  });

  const payload = (await response.json().catch(() => null)) as AiReportResponse | null;
  if (!response.ok) {
    const error = new Error(payload?.error || `AI report request failed with status ${response.status}.`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  if (!payload?.ok || !payload.report) {
    throw new Error(payload?.error || 'DeepSeek report engine unavailable.');
  }

  return payload;
};

export const generateStockAnalysisReport = async (tickerInput: string, language: Language = 'en'): Promise<StockAnalysisReport> => {
  const ticker = normalizeTicker(tickerInput || 'NVDA');

  const [quoteResult, fundamentalsResult, newsResult, verifiedNewsResult, secFilingsResult, officialSourcesResult, whisperResult] = await Promise.all([
    safeResolveSource({
      key: 'quote',
      label: 'Quote',
      promise: fetchStockQuote(ticker),
      timeoutMs: SOURCE_TIMEOUTS.quote,
      getSuccessMessage: (quote) => quote.source,
    }),
    safeResolveSource({
      key: 'fundamentals',
      label: 'Fundamentals',
      promise: fetchCompanyFundamentals(ticker),
      timeoutMs: SOURCE_TIMEOUTS.fundamentals,
    }),
    safeResolveSource({
      key: 'news',
      label: 'News',
      promise: fetchStockNews(ticker),
      timeoutMs: SOURCE_TIMEOUTS.news,
      getSuccessMessage: (news) => `${news.length} items`,
    }),
    safeResolveSource({
      key: 'verifiedNews',
      label: 'Verified News',
      promise: fetchVerifiedStockNews(ticker),
      timeoutMs: SOURCE_TIMEOUTS.verifiedNews,
      getSuccessMessage: (news) => `${news.length} items`,
    }),
    safeResolveSource({
      key: 'officialFilings',
      label: 'SEC Filings',
      promise: fetchSecFilingsForTicker(ticker),
      timeoutMs: SOURCE_TIMEOUTS.officialFilings,
      getSuccessMessage: (filings) => filings.status,
    }),
    safeResolveSource({
      key: 'officialSources',
      label: 'Official Sources',
      promise: fetchOfficialSources(ticker),
      timeoutMs: SOURCE_TIMEOUTS.officialSources,
      getSuccessMessage: (sources) => sources.status,
    }),
    safeResolveSource({
      key: 'whisper',
      label: 'Whisper',
      promise: fetchWhisperData(ticker),
      timeoutMs: SOURCE_TIMEOUTS.whisper,
    }),
  ]);

  const failedSources: string[] = [];

  const quote = quoteResult.value;
  if (!quote || quoteResult.health.status !== 'success') failedSources.push('quote');

  const fundamentals = fundamentalsResult.value;
  if (!fundamentals || fundamentalsResult.health.status !== 'success') failedSources.push('fundamentals');

  const news = newsResult.value || [];
  if (newsResult.health.status !== 'success') failedSources.push('news');

  const verifiedNews = verifiedNewsResult.value || [];
  if (verifiedNewsResult.health.status !== 'success') failedSources.push('verified news');

  const officialFilings =
    secFilingsResult.value ||
    buildUnavailableSecFilings(ticker, secFilingsResult.health.message || 'SEC filings failed.');
  if (secFilingsResult.health.status !== 'success' || officialFilings.status !== 'available') failedSources.push('SEC filings');

  const officialSources =
    officialSourcesResult.value ||
    buildUnavailableOfficialSources(
      ticker,
      officialSourcesResult.health.message || 'Official source discovery failed.'
    );
  if (officialSourcesResult.health.status !== 'success' || officialSources.status === 'error') failedSources.push('official sources');

  const whisper = whisperResult.value;
  if (!whisper || whisperResult.health.status !== 'success') failedSources.push('whisper');

  const dataSourceHealth = mergeHealth([
    {
      ...quoteResult.health,
      status: quoteResult.health.status === 'success' ? getQuoteHealthStatus(quote) : quoteResult.health.status,
      message: quote?.source || quoteResult.health.message,
    },
    {
      ...fundamentalsResult.health,
      status: fundamentals ? fundamentalsResult.health.status : fundamentalsResult.health.status === 'success' ? 'unavailable' : fundamentalsResult.health.status,
    },
    newsResult.health,
    verifiedNewsResult.health,
    {
      ...secFilingsResult.health,
      status: officialFilings.status === 'available' ? secFilingsResult.health.status : secFilingsResult.health.status === 'success' ? 'unavailable' : secFilingsResult.health.status,
    },
    {
      ...officialSourcesResult.health,
      status: officialSources.status === 'available' || officialSources.status === 'partial' ? officialSourcesResult.health.status : officialSourcesResult.health.status === 'success' ? 'unavailable' : officialSourcesResult.health.status,
    },
    whisperResult.health,
  ]);

  const fallbackReport = buildFallbackReport(ticker, language, quote, fundamentals, news, verifiedNews, officialFilings, officialSources, whisper, failedSources);
  fallbackReport.dataSourceHealth = [
    ...dataSourceHealth,
    buildDataSourceHealth({ key: 'ai', label: 'AI Analysis', status: 'fallback', message: 'AI analysis was not used.' }),
  ];
  const availabilityNotes = fallbackReport.dataAvailability || [];

  try {
    const aiResult = await safeResolveSource({
      key: 'ai',
      label: 'AI Analysis',
      promise: requestDeepSeekReport({
        ticker,
        language,
        quote,
        fundamentals,
        news,
        verifiedNews,
        officialFilings,
        officialSources,
        dataSourceHealth,
        whisper,
      }),
      timeoutMs: SOURCE_TIMEOUTS.ai,
      getSuccessMessage: (value) => value.model || value.provider,
    });

    if (!aiResult.value) {
      return {
        ...fallbackReport,
        dataSourceHealth: [...dataSourceHealth, aiResult.health],
      };
    }

    const parsed = aiResult.value.report || {};

    const risks = toStringArray(parsed.risks);
    const followUpChecklist = toStringArray(parsed.followUpChecklist);

    return {
      ticker,
      generatedAt: new Date().toISOString(),
      quote,
      fundamentals,
      news,
      verifiedNews,
      officialFilings,
      officialSources,
      whisper,
      summary: parsed.summary?.trim() || fallbackReport.summary,
      dataAvailabilityAnalysis: parsed.dataAvailabilityAnalysis?.trim() || fallbackReport.dataAvailabilityAnalysis,
      priceAnalysis: parsed.priceAnalysis?.trim() || fallbackReport.priceAnalysis,
      newsAnalysis: parsed.newsAnalysis?.trim() || fallbackReport.newsAnalysis,
      fundamentalsAnalysis: parsed.fundamentalsAnalysis?.trim() || fallbackReport.fundamentalsAnalysis,
      volatilityAnalysis: parsed.volatilityAnalysis?.trim() || fallbackReport.volatilityAnalysis,
      optionsEducation: parsed.optionsEducation?.trim() || fallbackReport.optionsEducation,
      sourceTrustAnalysis: parsed.sourceTrustAnalysis?.trim() || fallbackReport.sourceTrustAnalysis,
      risks: risks.length > 0 ? risks : fallbackReport.risks,
      followUpChecklist: followUpChecklist.length > 0 ? followUpChecklist : fallbackReport.followUpChecklist,
      conclusion: parsed.conclusion?.trim() || fallbackReport.conclusion,
      disclaimer: parsed.disclaimer?.trim() || fallbackReport.disclaimer,
      dataAvailability: availabilityNotes,
      dataSourceHealth: [...dataSourceHealth, aiResult.health],
      aiProvider: 'deepseek',
      aiModel: aiResult.value.model,
    };
  } catch (error) {
    console.warn('[ReportService] Falling back to deterministic report.', error);
    return {
      ...fallbackReport,
      dataSourceHealth: [
        ...dataSourceHealth,
        buildDataSourceHealth({ key: 'ai', label: 'AI Analysis', status: 'fallback', message: error instanceof Error ? error.message : 'AI analysis unavailable.' }),
      ],
      aiProvider: 'fallback',
    };
  }
};
