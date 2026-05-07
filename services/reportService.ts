import { fetchCompanyFundamentals, fetchStockNews, fetchStockQuote, fetchWhisperData } from './marketDataService';
import { verifyStockNewsItems } from './newsVerificationService';
import { fetchSecFilingsForTicker } from './secFilingService';
import { fetchOfficialSources } from './officialSourceService';
import { assessQuoteQuality, isQuoteReliableForMarketConclusion } from './reportQualityService';
import { buildDataSourceHealth, safeResolveSource } from './requestStabilityService';
import { buildSourceTrustSummary } from './sourceTrustService';
import type { Language } from '../i18n';
import {
  CompanyFundamentals,
  AiReportSections,
  AiReportSectionsExpanded,
  DataSourceHealth,
  DataSourceStatus,
  NewsItem,
  OfficialSourceVerification,
  PriceHistoryPoint,
  ReportEvidencePack,
  ReportGenerationStage,
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
  report?: Partial<AiReportSections & AiReportSectionsExpanded> & {
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
  priceHistory: 8000,
  whisper: 5000,
  ai: 310000,
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

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const fetchReportPriceHistory = async (ticker: string): Promise<PriceHistoryPoint[]> => {
  const response = await fetch(`/api/history/${ticker}`);
  if (!response.ok) {
    const error = new Error(`Historical price request failed with status ${response.status}.`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const data = await response.json();
  if (data?.status && data.status !== 'success') {
    const statusByProviderStatus: Record<string, number> = {
      rate_limited: 429,
      forbidden: 403,
      unavailable: 503,
    };
    const error = new Error(data.error || 'Historical price request failed.');
    (error as Error & { status?: number }).status = statusByProviderStatus[data.status] || 500;
    throw error;
  }

  const historical: unknown[] = Array.isArray(data?.historical) ? data.historical : [];
  return historical
    .reduce<PriceHistoryPoint[]>((items: PriceHistoryPoint[], item: unknown) => {
      const point = item as { date?: unknown; close?: unknown; volume?: unknown };
      if (typeof point.date !== 'string' || !isFiniteNumber(point.close)) return items;
      return [
        ...items,
        {
        date: point.date,
        close: point.close,
        ...(isFiniteNumber(point.volume) ? { volume: point.volume } : {}),
        },
      ];
    }, [])
    .sort((a: PriceHistoryPoint, b: PriceHistoryPoint) => a.date.localeCompare(b.date))
    .slice(-90);
};

const buildAiFallbackHealth = (message?: string) =>
  buildDataSourceHealth({
    key: 'ai',
    label: 'AI Analysis',
    status: 'fallback',
    message: message || 'AI engine unavailable. A deterministic fallback report is shown.',
  });

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
  evidencePack: ReportEvidencePack | null,
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
  if (officialSources.status === 'not_found') notes.push('No official source candidates were found for this ticker through automated discovery.');
  if (officialSources.status === 'error') notes.push('Official source discovery encountered an error for this ticker.');
  if (!evidencePack || evidencePack.priceHistoryStatus !== 'available') {
    notes.push('Real historical price data was unavailable, so no price trend chart should be treated as market evidence.');
  }
  if (!whisper) {
    notes.push('Experimental Whisper alternative signal data was unavailable for this report.');
  } else {
    notes.push('Whisper social sentiment data is from Finnhub and reflects social media signals.');
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
  evidencePack: ReportEvidencePack,
  failedSources: string[]
): StockAnalysisReport => {
  const zh = isZh(language);
  const availabilityNotes = buildAvailabilityNotes(quote, fundamentals, news, officialFilings, officialSources, whisper, evidencePack, failedSources);
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

  const sourceNamesForReport = officialSources.sources.slice(0, 8).map((s) => {
    const tier = s.sourceTier === 'official' ? '★' : s.sourceTier === 'official_channel' ? '◆' : '○';
    return `${tier} ${s.name} (${s.authorityScore})`;
  });
  const sourceNamesText = sourceNamesForReport.length > 0
    ? (zh
        ? `已识别来源：${sourceNamesForReport.join('；')}`
        : `Identified sources: ${sourceNamesForReport.join('; ')}`)
    : '';

  const verificationSourceNames = verifiedNews.slice(0, 4).map((v) =>
    `${v.source} (置信度${v.confidenceScore})`
  );
  const verificationSourceText = verificationSourceNames.length > 0
    ? (zh
        ? `已验证新闻来源：${verificationSourceNames.join('；')}`
        : `Verified news sources: ${verificationSourceNames.join('; ')}`)
    : '';

  const autoGenWarning = officialSources.sources.some((s) =>
    s.notes?.some((n) => n.includes('Auto-generated'))
  )
    ? (zh
        ? '注意：部分来源为自动生成候选，需人工确认。'
        : 'Note: Some sources are auto-generated candidates requiring manual confirmation.')
    : '';

  const sourceTrustSummary = zh
    ? `来源核验发现 ${officialSources.sources.length} 个官方来源候选、${officialFilings.filings.length} 条近期 SEC 文件和 ${verifiedNews.length} 条可信新闻。${sourceNamesText}${verificationSourceText ? ` ${verificationSourceText}` : ''}${autoGenWarning ? ` ${autoGenWarning}` : ''}这些信号用于提升来源透明度，但不等于验证任何投资结论。`
    : `Source checks found ${officialSources.sources.length} official source candidates, ${officialFilings.filings.length} recent SEC filings, and ${verifiedNews.length} verified news items. ${sourceNamesText}${verificationSourceText ? ` ${verificationSourceText}` : ''}${autoGenWarning ? ` ${autoGenWarning}` : ''}These signals support source transparency but do not validate any investment conclusion.`;
  const sourceTrustAnalysisText = zh
    ? `【来源可信度概览】${sourceTrustSummary}

【证据链强项】当前来源核验覆盖了官方来源候选、SEC 文件和可信新闻三个维度。${sourceNamesForReport.length > 0 ? `具体包含${sourceNamesForReport.length}个已命名来源，权威分数范围为${Math.min(...officialSources.sources.slice(0, 8).map(s => s.authorityScore)) || 'N/A'}–${Math.max(...officialSources.sources.slice(0, 8).map(s => s.authorityScore)) || 'N/A'}分。` : ''}若官方来源或 SEC 文件数量较高，报告的事实核验基础更稳；若这些数据缺失，则应降低对新闻和二手摘要的依赖。

【证据链弱项】新闻来源即使被归类为可信，也不等于事实已经完全确认。涉及财报、监管、重大合同、诉讼或管理层变化的信息，应继续回到公司公告、SEC EDGAR、投资者关系页面或交易所公告交叉核验。${autoGenWarning ? ` ${autoGenWarning}` : ''}${officialSources.sources.length <= 2 ? '来源覆盖面有限，结论可靠性相应降低。' : ''}`
    : `Source Trust Overview: ${sourceTrustSummary}

Evidence strengths: The source review covers official source candidates, SEC filings, and verified news.${sourceNamesForReport.length > 0 ? ` Specifically ${sourceNamesForReport.length} named sources, with authority scores ranging from ${Math.min(...officialSources.sources.slice(0, 8).map(s => s.authorityScore)) || 'N/A'}–${Math.max(...officialSources.sources.slice(0, 8).map(s => s.authorityScore)) || 'N/A'}.` : ''} When official sources or SEC filings are available, the factual verification base is stronger; when they are missing, reliance on headlines and secondary summaries should be reduced.

Evidence weaknesses: A credible news source does not mean every claim is fully verified. Earnings, regulatory matters, material contracts, litigation, or management changes should be cross-checked against company announcements, SEC EDGAR, investor relations pages, or exchange notices.${autoGenWarning ? ` ${autoGenWarning}` : ''}${officialSources.sources.length <= 2 ? ' Source coverage is limited, reducing conclusion reliability accordingly.' : ''}`;
  const fundamentalsAvailableMetrics = fundamentals
    ? {
        marketCap: typeof fundamentals.marketCap === 'number' && fundamentals.marketCap > 0 ? fundamentals.marketCap.toLocaleString() : null,
        peRatio: typeof fundamentals.peRatio === 'number' && fundamentals.peRatio > 0 ? fundamentals.peRatio.toFixed(1) : null,
        beta: typeof fundamentals.beta === 'number' && fundamentals.beta > 0 ? fundamentals.beta.toFixed(2) : null,
        eps: typeof fundamentals.eps === 'number' && fundamentals.eps > 0 ? fundamentals.eps.toFixed(2) : null,
        revenue: typeof fundamentals.revenue === 'number' && fundamentals.revenue > 0 ? fundamentals.revenue.toLocaleString() : null,
      }
    : null;

  const buildMetricsText = (zh: boolean) => {
    if (!fundamentalsAvailableMetrics) return '';
    const m = fundamentalsAvailableMetrics;
    const parts: string[] = [];
    if (zh) {
      parts.push(`市值${m.marketCap ? `（${m.marketCap}）` : '（缺失或为0）'}`);
      parts.push(`P/E${m.peRatio ? `（${m.peRatio}）` : '（缺失或为0）'}`);
      parts.push(`Beta${m.beta ? `（${m.beta}）` : '（缺失或为0）'}`);
      parts.push(`EPS${m.eps ? `（${m.eps}）` : '（缺失或为0）'}`);
      parts.push(`营收${m.revenue ? `（${m.revenue}）` : '（缺失或为0）'}`);
    } else {
      parts.push(`market cap${m.marketCap ? ` (${m.marketCap})` : ' (missing or zero)'}`);
      parts.push(`P/E${m.peRatio ? ` (${m.peRatio})` : ' (missing or zero)'}`);
      parts.push(`beta${m.beta ? ` (${m.beta})` : ' (missing or zero)'}`);
      parts.push(`EPS${m.eps ? ` (${m.eps})` : ' (missing or zero)'}`);
      parts.push(`revenue${m.revenue ? ` (${m.revenue})` : ' (missing or zero)'}`);
    }
    return parts.join('、');
  };

  const buildLimitationText = (zh: boolean) => {
    if (!fundamentalsAvailableMetrics) return '';
    const m = fundamentalsAvailableMetrics;
    const missingMetrics: string[] = [];
    if (!m.eps) missingMetrics.push(zh ? 'EPS' : 'EPS');
    if (!m.revenue) missingMetrics.push(zh ? '营收' : 'revenue');
    if (zh) {
      return `当前没有完整利润率、现金流、资产负债表和同业估值数据，因此不能据此判断增长质量、财务稳健性或相对估值高低。${missingMetrics.length > 0 ? `具体缺失：${missingMetrics.join('、')}数据在当前数据源不可用。` : 'EPS和营收数据可用，但完整的财务报表仍需额外数据源。'}`;
    }
    return `Full margin, cash flow, balance sheet, and peer valuation data are not available in this snapshot, so the report cannot judge growth quality, financial resilience, or relative valuation from those missing inputs.${missingMetrics.length > 0 ? ` Specifically missing: ${missingMetrics.join(', ')} data unavailable from the current provider.` : ' EPS and revenue data are available, but full financial statements require additional data sources.'}`;
  };

  const fundamentalsAnalysisText = fundamentals
    ? zh
      ? `【公司背景】${fundamentalsSummary}

【可用指标】当前基本面快照包含${buildMetricsText(true)}、板块和行业字段。这些字段有助于理解公司规模、估值口径和价格波动属性，但不能替代完整财务报表。

【限制说明】${buildLimitationText(true)}`
      : `Company context: ${fundamentalsSummary}

Available metrics: The fundamentals snapshot includes ${buildMetricsText(false)}, sector, and industry fields. These fields help frame company scale, valuation context, and price sensitivity, but they do not replace full financial statements.

Limitations: ${buildLimitationText(false)}`
    : zh
      ? `【公司背景】公司基本面资料暂时不可用，因此无法确认公司规模、板块、行业、估值倍数或 Beta。

【分析限制】缺少 marketCap、P/E、Beta、sector 和 industry 会削弱估值与行业定位分析。当前不能判断公司相对规模、盈利估值口径、波动属性或同业位置。

【后续要求】应优先补充公司官方资料、财报、SEC 文件和基础估值指标，再进行更深入的基本面研究。`
      : `Company context: Fundamental company profile data is unavailable, so company scale, sector, industry, valuation multiple, and beta cannot be confirmed.

Analytical limitation: Missing marketCap, P/E, beta, sector, and industry weakens valuation and industry-position analysis. The report cannot assess relative scale, earnings valuation context, price sensitivity, or peer positioning from absent fields.

Follow-up requirement: Company official materials, financial statements, SEC filings, and core valuation metrics should be reviewed before deeper fundamental research.`;
  const priceHistorySummary = evidencePack.priceHistoryStatus === 'available' && evidencePack.priceHistory?.length
    ? zh
      ? `已获得 ${evidencePack.priceHistory.length} 个真实历史收盘价点，可用于观察近期价格趋势，但仍不构成预测。`
      : `${evidencePack.priceHistory.length} real historical close-price points were available for recent trend context, without implying prediction.`
    : zh
      ? '真实历史价格序列不可用，因此本报告不生成或解读价格趋势图。'
      : 'Real historical price history was unavailable, so this report does not generate or interpret a price-trend chart.';
  const sentimentSummary = zh
    ? `新闻情绪样本：正面 ${evidencePack.sentimentSummary.positive}、中性 ${evidencePack.sentimentSummary.neutral}、负面 ${evidencePack.sentimentSummary.negative}，总计 ${evidencePack.sentimentSummary.total} 条。`
    : `News sentiment sample: ${evidencePack.sentimentSummary.positive} positive, ${evidencePack.sentimentSummary.neutral} neutral, ${evidencePack.sentimentSummary.negative} negative, ${evidencePack.sentimentSummary.total} total.`;

  // UPGRADED: Ensure minimum 6 risks and 7 checklist items (increased from 4/5)
  const baseRisks = [
    zh ? '市场数据可能延迟、模拟或暂时不可用，影响分析的时效性和准确性。' : 'Market data may be delayed, simulated, or temporarily unavailable, affecting analysis timeliness and accuracy.',
    zh ? '新闻情绪为启发式估算，可能遗漏语境或后续变化。' : 'Headline sentiment is heuristic and may miss nuance or later developments.',
    zh ? 'Whisper 信号是实验性另类数据，不是完整或经过验证的社交媒体数据集。' : 'Experimental Whisper signals are simulated-style alternative data and not a complete or verified social media dataset.',
    zh ? '如遇极端市场条件，流动性可能显著下降，导致交易困难或价格滑点扩大。' : 'During extreme market conditions, liquidity may significantly decrease, causing trading difficulties or wider price slippage.',
    zh ? '公司特定事件（财报、监管变更、管理层变动）可能在没有预警的情况下显著影响股价。' : 'Company-specific events (earnings, regulatory changes, management changes) can significantly impact stock price without warning.',
    zh ? '行业和竞争格局的变化可能改变公司的增长前景和估值逻辑。' : 'Industry and competitive landscape changes may alter the company\'s growth prospects and valuation rationale.',
    zh ? '宏观经济因素（利率、通胀、政策变化）可能对整体市场情绪和资产价格产生广泛影响。' : 'Macroeconomic factors (interest rates, inflation, policy changes) can have broad impacts on overall market sentiment and asset prices.',
    ...availabilityNotes,
  ];
  const ensuredRisks = baseRisks.slice(0, 10);

  const baseChecklist = [
    zh ? '确认真实行情数据源是否已正确配置并可覆盖该 ticker。' : 'Confirm live quote coverage from a configured market data provider.',
    zh ? '复核 SEC 文件和公司官方来源是否存在重大更新（10-K、10-Q、8-K 等）。' : 'Review SEC filings and company sources for material updates (10-K, 10-Q, 8-K, etc.).',
    zh ? '将新闻情绪与公司公告、监管披露等一手来源交叉核对。' : 'Compare headline sentiment with primary-source disclosures before drawing conclusions.',
    zh ? '在研究期权场景前继续观察流动性、波动率和事件时间。' : 'Monitor liquidity, volatility, and event timing before studying options scenarios.',
    zh ? '关注即将到来的财报日期、分红除权日和其他可能影响股价的事件催化剂。' : 'Pay attention to upcoming earnings dates, ex-dividend dates, and other event catalysts that may affect stock price.',
    zh ? '评估行业和竞争动态的变化，包括新进入者、技术变革或监管环境变化。' : 'Evaluate industry and competitive dynamics changes, including new entrants, technological shifts, or regulatory environment changes.',
    zh ? '检查分析师评级变化和机构持仓变动，了解市场预期和专业观点。' : 'Check analyst rating changes and institutional holding changes to understand market expectations and professional views.',
  ];
  const ensuredChecklist = baseChecklist.slice(0, 12);

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
      ? `数据可用性：${availabilityNotes.join(' ')} ${priceHistorySummary} ${sentimentSummary}`
      : `Data availability: ${availabilityNotes.join(' ')} ${priceHistorySummary} ${sentimentSummary}`,
    priceAnalysis: `${quoteSummary} ${quoteIsReliable ? (zh ? '价格观察仅作为市场背景，仍需关注数据源延迟和覆盖范围。' : 'Use price observations as market context only, with attention to provider latency and coverage.') : (zh ? '由于行情未被确认为真实市场数据，不能据此形成真实价格表现结论。' : 'Because the quote is not confirmed real market data, no real price-performance conclusion should be drawn from it.')}`,
    newsAnalysis: zh
      ? `近期新闻覆盖：${newsHeadlineSummary} 新闻情绪由标题和摘要自动估算，可能不完整，只能作为研究线索。`
      : `Recent headline coverage: ${newsHeadlineSummary} News sentiment is automatically estimated from available headlines and summaries, may be incomplete, and should be treated as an educational signal.`,
    fundamentalsAnalysis: fundamentalsAnalysisText,
    volatilityAnalysis: quote
      ? zh
        ? `当前启发式估算隐含波动率约为 ${(quote.volatility * 100).toFixed(1)}%。该数值只能作为方向性背景，不能替代正式期权定价数据。`
        : `Estimated implied volatility was approximately ${(quote.volatility * 100).toFixed(1)}% based on the current quote service heuristic. This is best used as a directional context cue, not a pricing-grade volatility measure.`
      : zh ? '由于行情不可用，波动率观察有限。' : 'Volatility observations were limited because quote data was unavailable.',
    optionsEducation: zh
      ? '期权相关观察仅供教育研究。解读任何期权信号前，应继续核对隐含波动率、事件时间和流动性。'
      : 'Options observations in this report are educational only. Monitor implied volatility, earnings timing, and liquidity before drawing conclusions from any options-related pattern.',
    sourceTrustAnalysis: sourceTrustAnalysisText,
    followUpChecklist: ensuredChecklist,
    risks: ensuredRisks,
    conclusion: zh
      ? `【研究综合】本报告对 ${ticker} 进行了多维度分析，涵盖行情表现、基本面背景、新闻情绪、来源可信度和波动率观察。${availabilityNotes.length === 0 ? '当前数据质量相对较高，分析基于多个数据源的交叉信息。' : `由于存在${availabilityNotes.length}个数据限制，分析可靠性受到影响，建议通过官方渠道核验关键信息。`}

【关键观点】${quoteIsReliable ? `当前观测价格为 $${quote?.price.toFixed(2)}。` : '当前行情数据为模拟或回退值。'}${fundamentals ? `${fundamentals.companyName} 属于${fundamentals.sector || '相关'}板块。` : ''}${news.length > 0 ? `新闻情绪样本显示${evidencePack.sentimentSummary.positive > evidencePack.sentimentSummary.negative ? '偏正面' : evidencePack.sentimentSummary.negative > evidencePack.sentimentSummary.positive ? '偏负面' : '中性'}情绪。` : '新闻数据有限。'}${officialSources.sources.length > 0 ? `来源可信度分析识别${officialSources.sources.length}个官方来源候选，整体可信度分数${evidencePack.sourceTrustScore}/100（${evidencePack.sourceTrustLevel === 'high' ? '高' : evidencePack.sourceTrustLevel === 'medium' ? '中' : '低'}）。` : '来源可信度数据有限。'}

【后续观察重点】1) 核实数据源状态和覆盖范围；2) 监控 SEC 文件和公司官方公告的更新；3) 交叉验证关键新闻信息；4) 观察流动性和波动率变化；5) 关注即将到来的事件催化剂（如财报日期）。

【免责声明】本报告为算法生成的研究快照，基于当前可获得的公开信息。仅供学习研究使用，不构成投资建议。金融市场存在风险，过去表现不能保证未来结果。用户应基于自身判断做出投资决策，并对自己的决策承担全部责任。`
      : `【Research Synthesis】This report conducted a multi-dimensional analysis of ${ticker}, covering price action, fundamental context, news sentiment, source credibility, and volatility observations.${availabilityNotes.length === 0 ? ' Current data quality is relatively good, with analysis based on cross-information from multiple data sources.' : ` Due to ${availabilityNotes.length} data limitations, analysis reliability is affected; verifying key information through official channels is recommended.`}

【Key Perspectives】${quoteIsReliable ? `Current observed price is $${quote?.price.toFixed(2)}.` : 'Current quote data is simulated or fallback.'}${fundamentals ? ` ${fundamentals.companyName} operates in the ${fundamentals.sector || 'related'} sector.` : ''}${news.length > 0 ? ` News sentiment sample shows ${evidencePack.sentimentSummary.positive > evidencePack.sentimentSummary.negative ? 'leaning positive' : evidencePack.sentimentSummary.negative > evidencePack.sentimentSummary.positive ? 'leaning negative' : 'neutral'} sentiment.` : ' News data is limited.'}${officialSources.sources.length > 0 ? ` Source trust analysis found ${officialSources.sources.length} official source candidates, overall trust score ${evidencePack.sourceTrustScore}/100 (${evidencePack.sourceTrustLevel}).` : ' Source trust data is limited.'}

【Focus for Next Steps】1) Verify data source status and coverage; 2) Monitor SEC filings and company official announcements for updates; 3) Cross-verify key news information; 4) Observe liquidity and volatility changes; 5) Pay attention to upcoming event catalysts (such as earnings dates).

【Disclaimer】This report is an algorithm-generated research snapshot based on currently available public information. It is for educational and research purposes only, not financial advice. Financial markets carry risks, and past performance does not guarantee future results. Users should make investment decisions based on their own judgment and bear full responsibility for their decisions. ${REPORT_DISCLAIMER}`,
    disclaimer: zh ? '仅供学习研究使用，不构成投资建议。' : REPORT_DISCLAIMER,
    dataAvailability: availabilityNotes,
    evidencePack,
    aiProvider: 'fallback',

    // NEW: Expanded AI report fields for fallback - UPGRADED with more depth
    investmentContext: zh
      ? `${ticker} 是此次分析的目标标的。在当前市场环境下，对该公司的深入分析需要结合其基本面表现、行业动态以及宏观市场趋势。

${fundamentals ? `${fundamentals.companyName} 所属${fundamentals.sector || '相关'}板块。` : ''}${quoteIsReliable ? '当前已获得实时行情数据，' : '当前行情数据为模拟或回退数据，'}${news.length > 0 ? `新闻流中有 ${news.length} 条近期标题可用于情绪分析。` : '新闻流数据有限。'}${officialFilings.filings.length > 0 ? `已检索到 ${officialFilings.filings.length} 条 SEC 文件。` : 'SEC 文件暂不可用。'}

数据质量评级：${availabilityNotes.length === 0 ? '良好' : '有限'}。${availabilityNotes.length > 0 ? `主要限制：${availabilityNotes.slice(0, 2).join('；')}` : '多数核心数据源可用。'}本报告适合作为研究背景和后续观察清单，不适合作为交易决策依据。`
      : `${ticker} is the subject of this analysis. In the current market environment, a thorough assessment requires examining fundamental performance, industry dynamics, and broader market trends.

${fundamentals ? `${fundamentals.companyName} operates in the ${fundamentals.sector || 'related'} sector.` : ''}${quoteIsReliable ? 'Real-time quote data is available, ' : 'Current quote data is simulated or fallback, '}${news.length > 0 ? `with ${news.length} recent headlines available for sentiment analysis.` : 'with limited news flow data.'}${officialFilings.filings.length > 0 ? ` ${officialFilings.filings.length} SEC filings were retrieved.` : ' SEC filings are unavailable.'}

Data quality rating: ${availabilityNotes.length === 0 ? 'Good' : 'Limited'}.${availabilityNotes.length > 0 ? ` Key limitations: ${availabilityNotes.slice(0, 2).join('; ')}` : ' Most core data sources are available.'} This report is suitable as research context and a watch list builder, not as a trading decision basis.`,

    executiveSummary: zh
      ? `【行情表现】${quoteSummary}${quoteIsReliable ? '该价格来自已识别数据源，但需注意可能的延迟和覆盖范围限制。' : '该价格为模拟或回退数据，不能视为确认的市场价格。'}

【基本面背景】${fundamentalsSummary}

【新闻情绪】${news.length > 0 ? `近期共扫描 ${news.length} 条新闻标题。${sentimentSummary}近期覆盖主题包括：${newsHeadlineSummary}` : '当前新闻流中暂无近期标题，新闻情绪分析受限。'}

【数据质量】数据完整度${availabilityNotes.length === 0 ? '较高' : '有限'}${availabilityNotes.length > 0 ? `，主要限制：${availabilityNotes.slice(0, 2).join('、')}` : '，多数数据源可用。'}

【结论】本报告为研究性快照，基于当前可获得的公开信息和算法分析。仅供学习研究使用，不构成投资建议。用户应将本报告作为后续研究起点，而非投资决策依据。`
      : `【Price Action】${quoteSummary}${quoteIsReliable ? ' This price comes from a recognized data source, but provider latency and coverage limitations may apply.' : ' This price is simulated or fallback data and should not be treated as confirmed market pricing.'}

【Fundamental Context】${fundamentalsSummary}

【News Sentiment】${news.length > 0 ? `A total of ${news.length} recent headlines were scanned. ${sentimentSummary} Recent coverage includes: ${newsHeadlineSummary}` : 'No recent headlines are currently available in the news feed, limiting sentiment analysis.'}

【Data Quality】Data completeness is ${availabilityNotes.length === 0 ? 'relatively high' : 'limited'}${availabilityNotes.length > 0 ? `, with key limitations: ${availabilityNotes.slice(0, 2).join(', ')}` : ', with most data sources available.'}

【Conclusion】This report is a research-oriented snapshot based on currently available public information and algorithmic analysis. It is for educational and research purposes only, not financial advice. Users should treat this report as a starting point for further research, not as a basis for investment decisions.`,

    dataQualityAssessment: zh
      ? `【数据质量评级】${availabilityNotes.length === 0 ? '良好' : availabilityNotes.length <= 2 ? '有限' : '较差'}

【数据源状态】${quoteIsReliable ? '✓ 行情数据：已获得来自已识别数据源的价格信息。' : '✗ 行情数据：为模拟或回退数据，不能视为真实市场行情。'}${fundamentals ? '✓ 基本面数据：公司资料可用。' : '✗ 基本面数据：公司资料不可用或不完整。'}${news.length > 0 ? `✓ 新闻数据：共 ${news.length} 条近期标题。` : '✗ 新闻数据：当前无可用标题。'}${evidencePack.priceHistoryStatus === 'available' ? `✓ 历史价格：已获得 ${evidencePack.priceHistory?.length || 0} 个历史数据点。` : '✗ 历史价格：真实历史价格序列不可用。'}${officialFilings.filings.length > 0 ? `✓ SEC 文件：已检索到 ${officialFilings.filings.length} 条文件。` : '✗ SEC 文件：暂不可用。'}

【数据限制说明】${availabilityNotes.length > 0 ? availabilityNotes.join(' ') : '当前未检测到重大数据源问题。'}${priceHistorySummary}

【可靠性影响】${availabilityNotes.length === 0 ? '多数核心数据源运行正常，分析可靠性相对较高。但用户仍应交叉验证关键信息，特别是涉及投资决策时。' : '由于存在上述数据限制，分析可靠性受到影响。建议用户通过官方渠道（SEC EDGAR、公司投资者关系页面等）核验关键信息，并等待更多数据可用时重新评估。'}`
      : `【Data Quality Rating】${availabilityNotes.length === 0 ? 'Good' : availabilityNotes.length <= 2 ? 'Limited' : 'Poor'}

【Data Source Status】${quoteIsReliable ? '✓ Quote data: Available from recognized data source.' : '✗ Quote data: Simulation or fallback, not confirmed market data.'}${fundamentals ? '✓ Fundamentals: Company profile available.' : '✗ Fundamentals: Company data unavailable or incomplete.'}${news.length > 0 ? `✓ News data: ${news.length} recent headlines.` : '✗ News data: No headlines currently available.'}${evidencePack.priceHistoryStatus === 'available' ? `✓ Price history: ${evidencePack.priceHistory?.length || 0} historical data points.` : '✗ Price history: Real historical price series unavailable.'}${officialFilings.filings.length > 0 ? `✓ SEC filings: ${officialFilings.filings.length} filings retrieved.` : '✗ SEC filings: Currently unavailable.'}

【Data Limitations】${availabilityNotes.length > 0 ? availabilityNotes.join(' ') : 'No major data source issues currently detected.'} ${priceHistorySummary}

【Reliability Impact】${availabilityNotes.length === 0 ? 'Most core data sources are operational, providing relatively higher analysis reliability. However, users should still cross-verify key information, especially when making investment-related decisions.' : 'Due to the data limitations noted above, analysis reliability is affected. Users are advised to verify key information through official channels (SEC EDGAR, company investor relations pages) and reassess when more data becomes available.'}`,

    priceActionAnalysis: (() => {
      const zhContext = zh;
      const trendPart = quoteIsReliable && quote
        ? (zhContext
            ? `\n\n【价格趋势背景】基于当前已识别的数据源，该标的近期${quote.change >= 0 ? '表现为正向' : '表现为负向'}的日内变动。建议结合更长时间序列（如日线、周线）观察趋势，而非仅依赖单一数据点。\n\n【数据质量说明】该价格数据来自已识别的市场数据提供商，但可能存在延迟（通常15-20分钟），且覆盖范围可能不包含所有交易所或交易时段。在盘前盘后时段，价格信息可能尤其有限。`
            : `\n\nPrice Trend Context: Based on current recognized data sources, the ticker recently showed a ${quote.change >= 0 ? 'positive' : 'negative'} intraday move. Consider combining this with longer timeframes (daily, weekly) to observe trends rather than relying on a single data point.\n\nData Quality Note: This price data comes from a recognized market data provider, but may have latency (typically 15-20 minutes) and coverage may not include all exchanges or trading sessions.`)
        : (zhContext
            ? `\n\n【数据质量警告】当前显示的价格为${quoteQuality === 'simulation' ? '模拟数据' : '回退数据'}，仅用于页面功能展示，不能视为真实市场行情。\n\n【限制说明】由于行情未被确认为真实市场数据，不能据此形成任何真实价格表现结论或趋势判断。`
            : `\n\nData Quality Warning: The displayed price is ${quoteQuality} data, intended only for page functionality demonstration.\n\nLimitation: Because the quote is not confirmed as real market data, no genuine price performance conclusions should be drawn from it.`);

      const historyPart = evidencePack.priceHistoryStatus === 'available' && evidencePack.priceHistory?.length
        ? (zhContext
            ? `\n\n【历史价格背景】已获得 ${evidencePack.priceHistory.length} 个历史收盘价数据点，可用于观察近期价格走势。然而，历史表现不能保证未来结果。`
            : `\n\nHistorical Price Context: ${evidencePack.priceHistory.length} historical close-price data points are available for observing recent price trends. However, past performance does not guarantee future results.`)
        : (zhContext
            ? `\n\n【历史价格限制】真实历史价格序列当前不可用，因此无法生成或解读价格趋势图。`
            : `\n\nHistorical Price Limitation: Real historical price series is currently unavailable, preventing generation or interpretation of price trend charts.`);

      const reminderPart = zhContext
        ? '\n\n【提醒】本报告的价格分析仅供教育研究参考，不构成交易建议。'
        : '\n\nReminder: Price analysis in this report is for educational and research reference only and does not constitute trading recommendations.';

      return `${quoteSummary}${trendPart}${historyPart}${reminderPart}`;
    })(),

    newsAndEventsAnalysis: zh
      ? `新闻覆盖概览: ${news.length > 0 ? `当前共扫描到 ${news.length} 条近期新闻标题。${sentimentSummary}` : '当前新闻流中暂无近期标题，新闻分析受限。'}

近期主要话题: ${news.length > 0 ? newsHeadlineSummary : '无可用新闻标题。'}${news.length > 3 ? `\n\n新闻来源分布: 本次扫描覆盖了来自 ${new Set(news.map(n => n.site)).size} 个不同来源的标题。建议交叉验证关键信息，特别是涉及重大公司事件或监管变化时。` : ''}

${verifiedNews.length > 0 ? `\n\n可信新闻验证: 已识别 ${verifiedNews.length} 条可信新闻（经过来源层级、重复覆盖和摘要完整度评估）。可信新闻占比约 ${((verifiedNews.length / Math.max(news.length, 1)) * 100).toFixed(0)}%。` : `\n\n可信新闻验证: 当前未检测到高可信度新闻样本。建议在依赖新闻信息做决策前，通过官方渠道（公司公告、SEC 文件）核验。`}

情绪分析说明: 新闻情绪由标题和摘要自动估算，可能遗漏语境或后续发展。建议阅读原文获取完整信息，并结合公司一手公告进行综合判断。`
      : `News Coverage Overview: ${news.length > 0 ? `A total of ${news.length} recent headlines were scanned. ${sentimentSummary}` : 'No recent headlines are currently available in the news feed, limiting news analysis.'}

Recent Key Topics: ${news.length > 0 ? newsHeadlineSummary : 'No headlines available.'}${news.length > 3 ? `\n\nNews Source Distribution: This scan covered headlines from ${new Set(news.map(n => n.site)).size} different sources. Cross-verifying key information is recommended, especially for material company events or regulatory changes.` : ''}

${verifiedNews.length > 0 ? `\n\nVerified News Assessment: ${verifiedNews.length} verified news items were identified (assessed by source tier, duplicate coverage, and summary completeness). Verified news represents approximately ${((verifiedNews.length / Math.max(news.length, 1)) * 100).toFixed(0)}% of coverage.` : `\n\nVerified News Assessment: No high-confidence news samples were currently detected. Before relying on news information for decisions, verification through official channels (company announcements, SEC filings) is recommended.`}

Sentiment Analysis Note: News sentiment is automatically estimated from headlines and summaries, potentially missing context or subsequent developments. Reading the original text for complete information and combining it with primary company announcements for comprehensive assessment is advisable.`,

    volatilityAndOptionsAnalysis: (() => {
      const zhContext = zh;
      const obsPart = quote
        ? (zhContext
            ? `波动率观察: 基于当前报价服务的启发式估算，${ticker} 的隐含波动率约为 ${(quote.volatility * 100).toFixed(1)}%。该数值基于历史价格波动和期权定价模型估算，只能作为方向性背景参考，不能替代正式的实时期权链数据。`
            : `Volatility Observation: Based on the current quote service heuristic, ${ticker}'s implied volatility is estimated at approximately ${(quote.volatility * 100).toFixed(1)}%. This value is estimated from historical price volatility and options pricing models, serving only as directional context.`)
        : (zhContext
            ? '波动率观察: 由于当前报价不可用，波动率估算有限。'
            : 'Volatility Observation: Volatility estimation is limited as the current quote is unavailable.');

      const interpPart = quote
        ? (zhContext
            ? `\n\n波动率解读: 该估算值${quote.volatility > 0.3 ? '高于市场平均水平，可能反映标的近期波动较大或市场预期不确定性较高。' : quote.volatility > 0.2 ? '处于市场中等水平，表明波动性适中。' : '低于市场平均水平，可能表示标的近期相对稳定。'}然而，该数值不保证未来波动率会保持在当前水平。`
            : `\n\nVolatility Interpretation: This estimated value${quote.volatility > 0.3 ? 'is above market average, potentially reflecting recent higher volatility in the underlying or elevated uncertainty in market expectations.' : quote.volatility > 0.2 ? 'is at a moderate market level, indicating moderate volatility.' : 'is below market average, suggesting the underlying has been relatively stable recently.'} However, this value does not guarantee future volatility will remain at current levels.`)
        : '';

      const optionsNote = zhContext
        ? '\n\n期权市场说明: 本报告当前不包含实时期权链数据。如需期权相关研究，建议查看专门的期权链工具获取实时数据，关注即将到来的财报日期和事件催化剂，监控隐含波动率与历史波动率的差异，评估流动性和买卖价差。\n\n风险提醒: 期权交易具有高风险，可能导致全部投资损失。建议在进行任何期权交易前充分了解相关风险，并咨询持牌金融顾问。'
        : '\n\nOptions Market Note: This report currently does not include real-time options chain data. For options-related research, view dedicated options chain tools for real-time data, monitor upcoming earnings dates and event catalysts, assess the difference between implied and historical volatility, and evaluate liquidity and bid-ask spreads.\n\nRisk Reminder: Options trading carries significant risk and may result in loss of the entire investment. Before engaging in any options trading, fully understand the related risks and consult a licensed financial advisor.';

      return `${obsPart}${interpPart}${optionsNote}`;
    })(),

    keyRisks: ensuredRisks,
  };
};

const buildSentimentSummary = (news: NewsItem[]) => {
  const positive = news.filter((item) => item.sentiment === 'Positive').length;
  const neutral = news.filter((item) => item.sentiment === 'Neutral').length;
  const negative = news.filter((item) => item.sentiment === 'Negative').length;
  return {
    positive,
    neutral,
    negative,
    total: positive + neutral + negative,
  };
};

const buildEvidencePack = ({
  ticker,
  quote,
  fundamentals,
  news,
  verifiedNews,
  officialFilings,
  officialSources,
  whisper,
  priceHistory,
  priceHistoryStatus,
  failedSources,
}: {
  ticker: string;
  quote: StockQuote | null;
  fundamentals: CompanyFundamentals | null;
  news: NewsItem[];
  verifiedNews: VerifiedNewsItem[];
  officialFilings: SecFilingVerification;
  officialSources: OfficialSourceVerification;
  whisper: WhisperData | null;
  priceHistory: PriceHistoryPoint[];
  priceHistoryStatus: ReportEvidencePack['priceHistoryStatus'];
  failedSources: string[];
}): ReportEvidencePack => {
  const sourceTrustSummary = buildSourceTrustSummary({
    ticker,
    verifiedNews,
    officialFilings,
    officialSources,
  });
  const quoteQuality = assessQuoteQuality(quote);
  const notes = buildAvailabilityNotes(
    quote,
    fundamentals,
    news,
    officialFilings,
    officialSources,
    whisper,
    {
      ticker,
      generatedAt: new Date().toISOString(),
      priceHistory,
      priceHistoryStatus,
      sentimentSummary: buildSentimentSummary(news),
      sourceTrustScore: sourceTrustSummary.overallScore,
      sourceTrustLevel: sourceTrustSummary.confidenceLevel,
      dataQualityNotes: [],
    },
    failedSources
  );

  if (quoteQuality === 'simulation' || quoteQuality === 'fallback') {
    notes.push('Quote data quality is simulation or fallback and must not be used as real market evidence.');
  }
  if (priceHistoryStatus !== 'available') {
    notes.push('Historical price chart data is unavailable and must not be fabricated.');
  }

  return {
    ticker,
    generatedAt: new Date().toISOString(),
    ...(priceHistory.length > 0 ? { priceHistory } : {}),
    priceHistoryStatus,
    sentimentSummary: buildSentimentSummary(news),
    ...(fundamentals
      ? {
          fundamentalsSnapshot: {
            marketCap: fundamentals.marketCap,
            peRatio: fundamentals.peRatio,
            beta: fundamentals.beta,
            sector: fundamentals.sector,
            industry: fundamentals.industry,
            eps: fundamentals.eps,
            revenue: fundamentals.revenue,
          },
        }
      : {}),
    sourceTrustScore: sourceTrustSummary.overallScore,
    sourceTrustLevel: sourceTrustSummary.confidenceLevel,
    dataQualityNotes: notes,
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
}) => {
  // Enriched source details (max 20)
  const officialSourceDetails = officialSources.sources.slice(0, 20).map((src) => ({
    name: src.name,
    type: src.type,
    sourceTier: src.sourceTier,
    authorityScore: src.authorityScore,
    aiAssessment: src.aiAssessment || null,
    aiConfidence: src.aiConfidence || null,
    domain: src.domain || null,
    warnings: src.warnings || [],
    notes: (src.notes || []).filter((n) => n.includes('Auto-generated') || n.includes('manual confirmation')),
  }));

  // SEC filing details (max 10)
  const secFilingDetails = officialFilings.filings.slice(0, 10).map((f) => ({
    form: f.form,
    filingDate: f.filingDate,
    description: f.description || '',
  }));

  // Verified news details (max 10)
  const verifiedNewsDetails = verifiedNews.slice(0, 10).map((v) => ({
    source: v.source || '',
    sourceTier: v.sourceTier || 'unknown',
    confidenceScore: v.confidenceScore,
    title: v.title,
    url: v.url || '',
  }));

  // Aggregate summary
  const aggregate = {
    ticker,
    officialSourceCount: officialSources.sources.length,
    secFilingCount: officialFilings.filings.length,
    verifiedNewsCount: verifiedNews.length,
    highConfidenceNewsCount: verifiedNews.filter((item) => item.confidenceScore >= 75).length,
    officialSourceStatus: officialSources.status,
    secFilingStatus: officialFilings.status,
    mode: officialSources.mode,
    distinctSourceTypes: [...new Set(officialSources.sources.map((s) => s.type))],
    autoGeneratedCount: officialSources.sources.filter((s) =>
      s.notes?.some((n) => n.includes('Auto-generated'))
    ).length,
  };

  return {
    ...aggregate,
    officialSourceDetails,
    secFilingDetails,
    verifiedNewsDetails,
  };
};

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
  evidencePack,
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
  evidencePack: ReportEvidencePack;
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
      evidencePack,
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

export const generateStockAnalysisReport = async (
  tickerInput: string,
  language: Language = 'en',
  onProgress?: (stage: ReportGenerationStage) => void,
): Promise<StockAnalysisReport> => {
  const ticker = normalizeTicker(tickerInput || 'NVDA');

  // Track reported stages so each is only emitted once (parallel fetches finish in any order)
  const emitted = new Set<ReportGenerationStage>();
  const reportStage = (stage: ReportGenerationStage) => {
    if (!emitted.has(stage)) {
      emitted.add(stage);
      onProgress?.(stage);
    }
  };

  // Progress sequence driven by real source completion:
  //   quote → fundamentals → news → trust → (later: ai → finalizing)
  const sourceStage: Record<string, ReportGenerationStage> = {
    quote: 'fundamentals',
    fundamentals: 'news',
    news: 'trust',
    officialFilings: 'trust',
    officialSources: 'trust',
  };

  const wrapSource = <T>(key: string, promise: Promise<T>): Promise<T> =>
    promise.then((result) => {
      const stage = sourceStage[key];
      if (stage) reportStage(stage);
      return result;
    });

  const [quoteResult, fundamentalsResult, newsResult, secFilingsResult, officialSourcesResult, priceHistoryResult, whisperResult] = await Promise.all([
    safeResolveSource({
      key: 'quote',
      label: 'Quote',
      promise: wrapSource('quote', fetchStockQuote(ticker)),
      timeoutMs: SOURCE_TIMEOUTS.quote,
      getSuccessMessage: (quote) => quote.source,
    }),
    safeResolveSource({
      key: 'fundamentals',
      label: 'Fundamentals',
      promise: wrapSource('fundamentals', fetchCompanyFundamentals(ticker)),
      timeoutMs: SOURCE_TIMEOUTS.fundamentals,
    }),
    safeResolveSource({
      key: 'news',
      label: 'News',
      promise: wrapSource('news', fetchStockNews(ticker)),
      timeoutMs: SOURCE_TIMEOUTS.news,
      getSuccessMessage: (news) => `${news.length} items`,
    }),
    safeResolveSource({
      key: 'officialFilings',
      label: 'SEC Filings',
      promise: wrapSource('officialFilings', fetchSecFilingsForTicker(ticker)),
      timeoutMs: SOURCE_TIMEOUTS.officialFilings,
      getSuccessMessage: (filings) => filings.status,
    }),
    safeResolveSource({
      key: 'officialSources',
      label: 'Official Sources',
      promise: wrapSource('officialSources', fetchOfficialSources(ticker)),
      timeoutMs: SOURCE_TIMEOUTS.officialSources,
      getSuccessMessage: (sources) => sources.status,
    }),
    safeResolveSource({
      key: 'priceHistory',
      label: 'Price History',
      promise: fetchReportPriceHistory(ticker),
      timeoutMs: SOURCE_TIMEOUTS.priceHistory,
      getSuccessMessage: (history) => `${history.length} points`,
    }),
    safeResolveSource({
      key: 'whisper',
      label: 'Whisper',
      promise: fetchWhisperData(ticker),
      timeoutMs: SOURCE_TIMEOUTS.whisper,
      isUnavailableValue: (whisper) => !whisper,
      getUnavailableMessage: () => 'Whisper alternative signal data is unavailable for this ticker.',
    }),
  ]);

  const failedSources: string[] = [];

  const quote = quoteResult.value;
  if (!quote || quoteResult.health.status !== 'success') failedSources.push('quote');

  const fundamentals = fundamentalsResult.value;
  if (!fundamentals || fundamentalsResult.health.status !== 'success') failedSources.push('fundamentals');

  const news = newsResult.value || [];
  if (newsResult.health.status !== 'success') failedSources.push('news');

  const verifiedNews = news.length > 0 ? verifyStockNewsItems(ticker, news) : [];
  const verifiedNewsResult = {
    value: verifiedNews,
    health: buildDataSourceHealth({
      key: 'verifiedNews',
      label: 'Verified News',
      status: newsResult.health.status,
      message: newsResult.health.status === 'success' ? `${verifiedNews.length} items` : newsResult.health.message,
    }),
  };
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

  const priceHistory = priceHistoryResult.value || [];
  const priceHistoryStatus: ReportEvidencePack['priceHistoryStatus'] =
    priceHistoryResult.health.status === 'success'
      ? priceHistory.length > 0
        ? 'available'
        : 'unavailable'
      : priceHistoryResult.health.status === 'timeout' || priceHistoryResult.health.status === 'error'
        ? 'error'
        : 'unavailable';
  if (priceHistoryStatus !== 'available') failedSources.push('price history');

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
    {
      ...priceHistoryResult.health,
      status: priceHistoryStatus === 'available' ? 'success' : priceHistoryResult.health.status === 'success' ? 'unavailable' : priceHistoryResult.health.status,
      message: priceHistoryStatus === 'available' ? `${priceHistory.length} real historical close points` : priceHistoryResult.health.message,
    },
    whisperResult.health,
  ]);

  const evidencePack = buildEvidencePack({
    ticker,
    quote,
    fundamentals,
    news,
    verifiedNews,
    officialFilings,
    officialSources,
    whisper,
    priceHistory,
    priceHistoryStatus,
    failedSources,
  });

  const fallbackReport = buildFallbackReport(ticker, language, quote, fundamentals, news, verifiedNews, officialFilings, officialSources, whisper, evidencePack, failedSources);
  fallbackReport.dataSourceHealth = [
    ...dataSourceHealth,
    buildAiFallbackHealth('AI analysis was not used.'),
  ];
  const availabilityNotes = fallbackReport.dataAvailability || [];

  try {
    reportStage('ai');

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
        evidencePack,
        whisper,
      }),
      timeoutMs: SOURCE_TIMEOUTS.ai,
      getSuccessMessage: (value) => value.model || value.provider,
    });

    reportStage('finalizing');

    if (!aiResult.value) {
      return {
        ...fallbackReport,
        dataSourceHealth: [...dataSourceHealth, buildAiFallbackHealth(aiResult.health.message)],
      };
    }

    const parsed = aiResult.value.report || {};

    const risks = toStringArray(parsed.keyRisks || parsed.risks);
    const followUpChecklist = toStringArray(parsed.followUpChecklist);
    const investmentContext = parsed.investmentContext?.trim() || fallbackReport.investmentContext;
    const executiveSummary = parsed.executiveSummary?.trim() || parsed.summary?.trim() || fallbackReport.executiveSummary;
    const dataQualityAssessment = parsed.dataQualityAssessment?.trim() || parsed.dataAvailabilityAnalysis?.trim() || fallbackReport.dataQualityAssessment;
    const priceActionAnalysis = parsed.priceActionAnalysis?.trim() || parsed.priceAnalysis?.trim() || fallbackReport.priceActionAnalysis;
    const newsAndEventsAnalysis = parsed.newsAndEventsAnalysis?.trim() || parsed.newsAnalysis?.trim() || fallbackReport.newsAndEventsAnalysis;
    const volatilityAndOptionsAnalysis = parsed.volatilityAndOptionsAnalysis?.trim()
      || [parsed.volatilityAnalysis, parsed.optionsEducation].filter(Boolean).join('\n\n').trim()
      || fallbackReport.volatilityAndOptionsAnalysis;
    const keyRisks = risks.length > 0 ? risks : fallbackReport.keyRisks || fallbackReport.risks;

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
      evidencePack,
      investmentContext,
      executiveSummary,
      dataQualityAssessment,
      priceActionAnalysis,
      newsAndEventsAnalysis,
      volatilityAndOptionsAnalysis,
      keyRisks,
      summary: parsed.summary?.trim() || executiveSummary || fallbackReport.summary,
      dataAvailabilityAnalysis: parsed.dataAvailabilityAnalysis?.trim() || dataQualityAssessment || fallbackReport.dataAvailabilityAnalysis,
      priceAnalysis: parsed.priceAnalysis?.trim() || priceActionAnalysis || fallbackReport.priceAnalysis,
      newsAnalysis: parsed.newsAnalysis?.trim() || newsAndEventsAnalysis || fallbackReport.newsAnalysis,
      fundamentalsAnalysis: parsed.fundamentalsAnalysis?.trim() || fallbackReport.fundamentalsAnalysis,
      volatilityAnalysis: parsed.volatilityAnalysis?.trim() || volatilityAndOptionsAnalysis || fallbackReport.volatilityAnalysis,
      optionsEducation: parsed.optionsEducation?.trim() || volatilityAndOptionsAnalysis || fallbackReport.optionsEducation,
      sourceTrustAnalysis: parsed.sourceTrustAnalysis?.trim() || fallbackReport.sourceTrustAnalysis,
      risks: keyRisks,
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
        buildAiFallbackHealth(error instanceof Error ? error.message : 'AI analysis unavailable.'),
      ],
      aiProvider: 'fallback',
    };
  }
};
