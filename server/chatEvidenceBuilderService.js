const MAX_EVIDENCE_ITEMS = 8;
const MAX_TEXT_LENGTH = 180;

const safeText = (value, maxLength = MAX_TEXT_LENGTH) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const safeNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(safeNumber(value))));

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

const safeLimitArray = (items, max = MAX_EVIDENCE_ITEMS) => (
  Array.isArray(items) ? items.filter(Boolean).slice(0, max) : []
);

const sanitizeEvidenceItem = (item) => ({
  id: safeText(item?.id, 120) || `evidence:${Date.now()}`,
  type: safeText(item?.type, 40) || 'other',
  title: safeText(item?.title, MAX_TEXT_LENGTH) || 'Evidence item',
  ...(safeText(item?.source, 80) ? { source: safeText(item.source, 80) } : {}),
  ...(safeUrl(item?.url) ? { url: safeUrl(item.url) } : {}),
  ...(Number.isFinite(Number(item?.confidence)) ? { confidence: clampScore(item.confidence) } : {}),
  ...(safeText(item?.note, 180) ? { note: safeText(item.note, 180) } : {}),
  ...(safeText(item?.timestamp, 60) ? { timestamp: safeText(item.timestamp, 60) } : {}),
});

export const capEvidenceItems = (items, max = MAX_EVIDENCE_ITEMS) => (
  safeLimitArray(items, max).map(sanitizeEvidenceItem)
);

export const buildQuoteEvidenceItem = ({ quote, ticker }) => sanitizeEvidenceItem({
  id: `quote:${safeText(ticker, 16) || safeText(quote?.symbol, 16) || 'ticker'}`,
  type: 'quote',
  title: `${safeText(ticker, 16) || safeText(quote?.symbol, 16) || 'Ticker'} Quote`,
  source: safeText(quote?.source, 80) || 'Market Data',
  note: safeText(quote?.source, 120).toLowerCase().includes('sim') ? 'simulation_or_fallback' : 'quote_snapshot',
});

export const buildNewsEvidenceItems = ({ news, ticker, limit = 3 }) => safeLimitArray(news, limit).map((item, index) => {
  const confidence = Number.isFinite(Number(item?.confidenceScore)) ? clampScore(item.confidenceScore) : undefined;
  return sanitizeEvidenceItem({
    id: `${confidence === undefined ? 'news' : 'verified_news'}:${safeText(ticker, 16) || 'ticker'}:${index}`,
    type: confidence === undefined ? 'news' : 'verified_news',
    title: safeText(item?.title, MAX_TEXT_LENGTH) || 'News item',
    source: safeText(item?.source || item?.site, 80) || 'News',
    url: item?.url,
    confidence,
    timestamp: item?.publishedDate,
  });
});

export const buildSecEvidenceItems = ({ filings, ticker, limit = 3 }) => safeLimitArray(filings, limit).map((filing, index) => sanitizeEvidenceItem({
  id: `sec:${safeText(ticker, 16) || 'ticker'}:${index}`,
  type: 'sec_filing',
  title: `${safeText(filing?.form, 20) || 'SEC'} ${safeText(filing?.filingDate, 20)}`.trim(),
  source: 'SEC EDGAR',
  url: filing?.url,
  note: safeText(filing?.description || filing?.primaryDocument || filing?.reportDate, 160),
  timestamp: filing?.filingDate,
}));

export const buildOfficialSourceEvidenceItems = ({ sources, ticker, limit = 2 }) => safeLimitArray(sources, limit).map((source, index) => sanitizeEvidenceItem({
  id: `official:${safeText(ticker, 16) || 'ticker'}:${index}`,
  type: 'official_source',
  title: safeText(source?.name, 120) || `${safeText(ticker, 16) || 'Ticker'} Source`,
  source: safeText(source?.type, 80) || 'official_source',
  url: source?.url,
  note: Number.isFinite(Number(source?.authorityScore)) ? `authority_score_${Number(source.authorityScore)}` : undefined,
}));

export const buildSourceTrustEvidenceItem = ({ trustSummary }) => {
  const score = Number.isFinite(Number(trustSummary?.score))
    ? Number(trustSummary.score)
    : Number(trustSummary?.overallScore || 0);
  return sanitizeEvidenceItem({
    id: `source_trust:${safeText(trustSummary?.ticker, 16) || 'ticker'}`,
    type: 'source_trust',
    title: `Source Trust Score: ${clampScore(score)}/100`,
    source: 'Source Trust Analysis',
    note: safeText(trustSummary?.level || trustSummary?.confidenceLevel || 'unknown', 32),
    timestamp: trustSummary?.generatedAt,
  });
};
