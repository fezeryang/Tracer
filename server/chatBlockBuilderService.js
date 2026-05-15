const MAX_EVIDENCE_ITEMS = 8;
const MAX_NEWS_ITEMS = 5;
const MAX_SEC_TABLE_ROWS = 10;

const safeText = (value, maxLength = 180) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const safeLimitArray = (value, limit = MAX_EVIDENCE_ITEMS) => (
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

export const formatCurrency = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `$${numeric.toFixed(2)}` : 'N/A';
};

export const formatPercent = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? `${numeric.toFixed(2)}%` : 'N/A';
};

export const formatLargeNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 'N/A';
  if (numeric >= 1_000_000_000_000) return `${(numeric / 1_000_000_000_000).toFixed(2)}T`;
  if (numeric >= 1_000_000_000) return `${(numeric / 1_000_000_000).toFixed(2)}B`;
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(2)}M`;
  return `${numeric.toFixed(0)}`;
};

export const inferDataQuality = (source) => {
  const text = safeText(source || '', 120).toLowerCase();
  if (!text) return 'unavailable';
  if (text.includes('sim')) return 'simulation';
  if (text.includes('fallback')) return 'fallback';
  return 'available';
};

const evidenceItemFromInput = (item) => ({
  label: safeText(item?.label || item?.title || item?.description || 'Evidence', 180) || 'Evidence',
  source: safeText(item?.source || item?.site || '', 80) || undefined,
  url: safeUrl(item?.url),
});

const buildEvidenceListBlock = (items) => ({
  type: 'evidence_list',
  data: {
    evidence: safeLimitArray(items).map(evidenceItemFromInput),
  },
  dataQuality: safeLimitArray(items).length > 0 ? 'available' : 'limited',
  createdBy: 'tool',
  validationStatus: safeLimitArray(items).length > 0 ? 'valid' : 'limited',
});

export const buildQuoteBlocks = ({ quote = {}, ticker }) => [
  {
    type: 'metric_grid',
    metrics: [
      { label: 'Ticker', value: safeText(ticker || quote?.symbol, 16) || 'N/A' },
      { label: 'Price', value: formatCurrency(quote?.price) },
      { label: 'Change', value: formatCurrency(quote?.change) },
      { label: 'Change %', value: formatPercent(quote?.changePercent) },
      { label: 'Previous Close', value: formatCurrency(quote?.previousClose) },
      { label: 'Source', value: safeText(quote?.source, 120) || 'Market Data' },
    ],
    dataQuality: inferDataQuality(quote?.source),
    createdBy: 'tool',
    validationStatus: Number.isFinite(Number(quote?.price)) ? 'valid' : 'limited',
  },
  buildEvidenceListBlock([
    {
      label: `${safeText(ticker || quote?.symbol, 16) || 'Ticker'} Quote | ${formatCurrency(quote?.price)} | ${formatPercent(quote?.changePercent)}`,
      source: safeText(quote?.source, 80) || 'Market Data',
    },
  ]),
];

export const buildNewsBlocks = ({ news = [] }) => [
  buildEvidenceListBlock(safeLimitArray(news, MAX_NEWS_ITEMS).map((item) => ({
    label: safeText(item?.title, 180) || 'News item',
    source: safeText(item?.site || item?.source, 80) || 'News',
    url: item?.url,
  }))),
];

export const buildFundamentalsBlocks = ({ fundamentals, ticker }) => {
  const item = Array.isArray(fundamentals) ? fundamentals[0] : fundamentals;
  return [
    {
      type: 'metric_grid',
      metrics: [
        { label: 'Company', value: safeText(item?.companyName, 120) || safeText(ticker, 16) || 'N/A' },
        { label: 'Sector', value: safeText(item?.sector, 80) || 'N/A' },
        { label: 'Industry', value: safeText(item?.industry, 100) || 'N/A' },
        { label: 'Market Cap', value: formatLargeNumber(item?.mktCap || item?.marketCap) },
        { label: 'P/E', value: Number.isFinite(Number(item?.priceEarnings || item?.peRatio)) ? Number(item?.priceEarnings || item?.peRatio).toFixed(2) : 'N/A' },
        { label: 'Beta', value: Number.isFinite(Number(item?.beta)) ? Number(item.beta).toFixed(2) : 'N/A' },
        { label: 'EPS', value: Number.isFinite(Number(item?.eps)) ? Number(item.eps).toFixed(2) : 'N/A' },
        { label: 'Revenue', value: formatLargeNumber(item?.revenue) },
      ],
      dataQuality: inferDataQuality(item?.source || 'Market Data'),
      createdBy: 'tool',
      validationStatus: item ? 'valid' : 'limited',
    },
    buildEvidenceListBlock(item?.website ? [{ label: item.website, source: item?.companyName || ticker, url: item.website }] : []),
  ];
};

export const buildHistoryChartBlocks = ({ history = [], ticker, source, command = 'history' }) => {
  const chartData = safeLimitArray(history, 365).map((point) => ({
    label: safeText(point?.date, 40),
    value: Number(point?.close),
  })).filter((point) => point.label && Number.isFinite(point.value));

  const chartBlock = {
    type: 'chart',
    title: `${safeText(ticker, 16) || 'Ticker'} ${command === 'chart' ? 'Price Trend' : 'History'}`,
    content: command === 'chart'
      ? 'Educational trend view only.'
      : 'Historical prices for educational research only.',
    chartType: 'line',
    data: { ticker: safeText(ticker, 16), chartData, chartType: 'line', chartColor: '#818cf8' },
    source: safeText(source, 120) || 'Market Data',
    dataQuality: inferDataQuality(source || 'Market Data'),
    createdBy: 'tool',
    validationStatus: chartData.length > 0 ? 'valid' : 'unavailable',
    xAxisLabel: 'Date',
    yAxisLabel: 'Price',
    legend: [safeText(ticker, 16) || 'Ticker'],
    emptyState: 'No chart data available.',
  };

  if (command === 'chart') return [chartBlock];

  const closes = history.map((point) => Number(point?.close)).filter((value) => Number.isFinite(value));
  return [
    chartBlock,
    {
      type: 'metric_grid',
      metrics: [
        { label: 'Points', value: chartData.length },
        { label: 'Latest Close', value: closes.length > 0 ? formatCurrency(closes[closes.length - 1]) : 'N/A' },
        { label: 'Highest Close', value: closes.length > 0 ? formatCurrency(Math.max(...closes)) : 'N/A' },
        { label: 'Lowest Close', value: closes.length > 0 ? formatCurrency(Math.min(...closes)) : 'N/A' },
        { label: 'Source', value: safeText(source, 120) || 'Market Data' },
      ],
      dataQuality: inferDataQuality(source || 'Market Data'),
      createdBy: 'tool',
      validationStatus: chartData.length > 0 ? 'valid' : 'limited',
    },
  ];
};

export const buildSecTableBlocks = ({ ticker, filings = [], language = 'en' }) => {
  const rows = safeLimitArray(filings, MAX_SEC_TABLE_ROWS);
  return [
    {
      type: 'data_table',
      title: `${safeText(ticker, 16) || 'Ticker'} SEC Filings`,
      columns: [
        { key: 'form', label: 'Form', width: '80px' },
        { key: 'filingDate', label: 'Filing Date', width: '110px' },
        { key: 'description', label: 'Description' },
        { key: 'source', label: 'Source', width: '90px' },
      ],
      rows: rows.map((filing) => ({
        form: safeText(filing?.form, 20) || 'N/A',
        filingDate: safeText(filing?.filingDate, 20) || 'N/A',
        description: safeText(filing?.description || filing?.primaryDocument || filing?.reportDate || 'N/A', 180) || 'N/A',
        source: 'SEC EDGAR',
      })),
      source: 'SEC EDGAR',
      sourceUrl: safeUrl(rows[0]?.url),
      dataQuality: rows.length > 0 ? 'available' : 'unavailable',
      createdBy: 'tool',
      validationStatus: rows.length > 0 ? 'valid' : 'limited',
      emptyState: language === 'zh' ? '当前无可用 SEC 文件。' : 'No SEC filing data available.',
    },
    buildEvidenceListBlock(rows.map((filing) => ({
      label: `${safeText(filing?.form, 20) || 'SEC'} | ${safeText(filing?.filingDate, 20) || 'N/A'}`,
      source: 'SEC EDGAR',
      url: filing?.url,
    }))),
  ];
};

export const buildOfficialSourceBlocks = ({ sources = [], ticker }) => [
  buildEvidenceListBlock(safeLimitArray(sources, MAX_EVIDENCE_ITEMS).map((source) => ({
    label: safeText(source?.name, 120) || `${safeText(ticker, 16) || 'Ticker'} Source`,
    source: safeText(source?.type, 80) || 'official_source',
    url: source?.url,
  }))),
];

const trustLevel = (trustSummary) => trustSummary?.level || trustSummary?.confidenceLevel || 'unknown';
const trustScore = (trustSummary) => (
  Number.isFinite(Number(trustSummary?.score))
    ? Number(trustSummary.score)
    : Number(trustSummary?.overallScore || 0)
);

const buildSourceTrustBlock = (trustSummary, dataQuality = 'available') => ({
  type: 'source_trust',
  data: { trustSummary },
  dataQuality,
  createdBy: 'tool',
  validationStatus: trustScore(trustSummary) > 0 ? 'valid' : 'limited',
});

const buildTrustMetricGrid = ({ trustSummary, language = 'en', newsCount = 0 }) => ({
  type: 'metric_grid',
  metrics: [
    { label: language === 'zh' ? '代码' : 'Ticker', value: safeText(trustSummary?.ticker, 16) || 'N/A' },
    { label: language === 'zh' ? '总分' : 'Overall Score', value: `${trustScore(trustSummary)}/100` },
    { label: language === 'zh' ? '可信度' : 'Confidence', value: trustLevel(trustSummary) },
    { label: language === 'zh' ? '官方来源' : 'Official Sources', value: trustSummary?.officialSourceCount || trustSummary?.metrics?.officialSourceCount || 0 },
    { label: language === 'zh' ? 'SEC 文件' : 'SEC Filings', value: trustSummary?.secFilingCount || trustSummary?.metrics?.secFilingCount || 0 },
    { label: language === 'zh' ? '可信新闻/新闻' : 'Verified/News', value: trustSummary?.verifiedNewsCount || trustSummary?.metrics?.verifiedNewsCount || newsCount || 0 },
  ],
  dataQuality: trustScore(trustSummary) > 0 ? 'available' : 'limited',
  createdBy: 'tool',
  validationStatus: trustScore(trustSummary) > 0 ? 'valid' : 'limited',
});

export const buildSourceTrustBlocks = ({ trustSummary, language = 'en', newsCount = 0, dataQuality = 'available' }) => [
  buildSourceTrustBlock(trustSummary, dataQuality),
  buildTrustMetricGrid({ trustSummary, language, newsCount }),
  buildDisclaimerBlock({ language }),
];

export const buildDataQualityBlock = ({
  quote,
  fundamentals,
  news,
  notes = [],
  warnings = [],
}) => ({
  type: 'data_quality',
  data: {
    quote: quote ? {
      symbol: safeText(quote?.symbol, 16) || undefined,
      price: Number.isFinite(Number(quote?.price)) ? Number(quote.price) : undefined,
      change: Number.isFinite(Number(quote?.change)) ? Number(quote.change) : undefined,
      changePercent: Number.isFinite(Number(quote?.changePercent)) ? Number(quote.changePercent) : undefined,
      previousClose: Number.isFinite(Number(quote?.previousClose)) ? Number(quote.previousClose) : undefined,
      source: safeText(quote?.source, 120) || 'Market Data',
    } : undefined,
    fundamentals: fundamentals ? {
      companyName: safeText(fundamentals?.companyName, 120) || undefined,
      sector: safeText(fundamentals?.sector, 80) || undefined,
      industry: safeText(fundamentals?.industry, 100) || undefined,
      source: safeText(fundamentals?.source, 120) || undefined,
    } : undefined,
    news: safeLimitArray(news, MAX_NEWS_ITEMS).map((item) => ({
      title: safeText(item?.title, 180) || 'News item',
      site: safeText(item?.site || item?.source, 80) || 'News',
      url: safeUrl(item?.url),
      publishedDate: safeText(item?.publishedDate, 60) || undefined,
    })),
    notes: safeLimitArray(notes, 3).map((note) => safeText(note, 160)).filter(Boolean),
  },
  dataQuality: warnings.length > 0 ? 'limited' : 'available',
  createdBy: 'tool',
  validationStatus: warnings.length > 0 ? 'limited' : 'valid',
});

export const buildDisclaimerBlock = ({ language = 'en', kind = 'research_only' } = {}) => ({
  type: 'disclaimer',
  title: language === 'zh' ? '研究用途提示' : 'Research Note',
  content: language === 'zh'
    ? '以下结果仅反映证据来源与数据可用性，不构成投资建议、评级或交易指令。'
    : 'These results reflect evidence sources and data availability only. They are not investment advice, a rating, or a trading instruction.',
  tone: 'neutral',
  data: {
    disclaimerType: kind,
  },
  createdBy: 'system',
  validationStatus: 'valid',
});

export const buildActionButtonBlock = ({ ticker, language = 'en' }) => ({
  type: 'action_buttons',
  actions: [
    { label: 'SEC', prompt: `/sec ${safeText(ticker, 16)}`, tone: 'secondary' },
    { label: language === 'zh' ? '官方来源' : 'Official', prompt: `/official ${safeText(ticker, 16)}`, tone: 'secondary' },
    { label: language === 'zh' ? '图表' : 'Chart', prompt: `/chart ${safeText(ticker, 16)}`, tone: 'secondary' },
    { label: language === 'zh' ? '报告' : 'Report', prompt: `/report ${safeText(ticker, 16)}`, tone: 'primary' },
  ],
  createdBy: 'tool',
  validationStatus: 'valid',
});

export const buildEvidenceBundleBlocks = ({
  ticker,
  evidenceListItems = [],
  trustSummary,
  secFilings = [],
  quote,
  fundamentals,
  news = [],
  dataQualityNotes = [],
  warnings = [],
  language = 'en',
}) => [
  buildEvidenceListBlock(evidenceListItems.length > 0 ? evidenceListItems : [{
    label: language === 'zh' ? '当前暂无可用证据。' : 'No evidence sources are currently available.',
  }]),
  buildSourceTrustBlock(trustSummary, warnings.includes('source_trust_unavailable') ? 'limited' : 'available'),
  buildSecTableBlocks({ ticker, filings: secFilings, language })[0],
  buildDataQualityBlock({ quote, fundamentals, news, notes: dataQualityNotes, warnings }),
  buildActionButtonBlock({ ticker, language }),
  buildDisclaimerBlock({ language }),
];
