import { getSecFilingsForTicker as defaultGetSecFilingsForTicker } from './secService.js';
import { getOfficialSourcesForTicker as defaultGetOfficialSourcesForTicker } from './officialSourceService.js';

const DEFAULT_INTERNAL_ORIGIN = `http://127.0.0.1:${process.env.PORT || 3000}`;
const DEFAULT_TIMEOUT_MS = 10000;
const DATA_QUALITY_VALUES = new Set(['available', 'limited', 'fallback', 'simulation', 'unavailable']);

const nowMs = () => Date.now();

const safeText = (value, maxLength = 160) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const normalizeTicker = (value) => safeText(value, 16).replace(/^\$/, '').toUpperCase();

const inferDataQualityFromSource = (source) => {
  const text = safeText(source || '', 120).toLowerCase();
  if (!text) return 'available';
  if (text.includes('sim')) return 'simulation';
  if (text.includes('fallback')) return 'fallback';
  return 'available';
};

const normalizeDataQuality = (value, fallback = 'available') => (
  DATA_QUALITY_VALUES.has(value) ? value : fallback
);

const buildInternalUrl = (path, requestOrigin) => `${requestOrigin || DEFAULT_INTERNAL_ORIGIN}${path}`;

const sanitizeErrorCode = (code, fallback) => {
  const text = safeText(code, 80).toLowerCase();
  if (!text) return fallback;
  if (text.includes('timeout')) return `${fallback}_timeout`;
  if (text.includes('rate')) return `${fallback}_rate_limited`;
  if (text.includes('forbidden') || text.includes('auth')) return `${fallback}_forbidden`;
  if (/^backend_[a-z_]+$/.test(text)) return text;
  return fallback;
};

const withTimeout = async (promise, timeoutMs, errorCode) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const createResult = ({
  ok,
  data = null,
  warning,
  error,
  source,
  dataQuality = 'available',
  startedAt,
}) => ({
  ok: Boolean(ok),
  data,
  ...(warning ? { warning } : {}),
  ...(error ? { error } : {}),
  ...(source ? { source } : {}),
  dataQuality: normalizeDataQuality(dataQuality, ok ? 'available' : 'unavailable'),
  latencyMs: Math.max(0, nowMs() - startedAt),
});

const readJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const isErrorPayload = (data) => (
  data
  && typeof data === 'object'
  && !Array.isArray(data)
  && (typeof data.error === 'string' || ['error', 'unavailable', 'rate_limited', 'forbidden'].includes(data.status))
);

const fetchInternalJson = async (path, options = {}) => {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    throw new Error('backend_fetch_unavailable');
  }

  const response = await withTimeout(
    fetchImpl(buildInternalUrl(path, options.requestOrigin)),
    options.timeoutMs || DEFAULT_TIMEOUT_MS,
    'backend_fetch_timeout',
  );

  const data = await readJsonSafely(response);
  if (!response?.ok || isErrorPayload(data)) {
    throw new Error(sanitizeErrorCode(data?.status || data?.error || `internal_fetch_${response?.status || 500}`, 'backend_fetch_unavailable'));
  }
  return data;
};

const runBackendLoad = async ({
  ticker,
  loader,
  source,
  unavailableWarning,
  dataQuality,
}) => {
  const startedAt = nowMs();
  try {
    const data = await loader(normalizeTicker(ticker));
    return createResult({
      ok: true,
      data,
      source,
      dataQuality: typeof dataQuality === 'function' ? dataQuality(data) : dataQuality,
      startedAt,
    });
  } catch (error) {
    return createResult({
      ok: false,
      data: null,
      warning: unavailableWarning,
      error: unavailableWarning,
      source,
      dataQuality: 'unavailable',
      startedAt,
    });
  }
};

const inferArrayQuality = (data) => (Array.isArray(data) && data.length > 0 ? 'available' : 'limited');

export const fetchBackendQuote = (ticker, options = {}) => runBackendLoad({
  ticker,
  source: 'quote_route',
  unavailableWarning: 'backend_quote_unavailable',
  dataQuality: (data) => inferDataQualityFromSource(data?.source),
  loader: (symbol) => (
    typeof options.fetchQuote === 'function'
      ? options.fetchQuote(symbol)
      : fetchInternalJson(`/api/quote/${encodeURIComponent(symbol)}`, options)
  ),
});

export const fetchBackendNews = (ticker, options = {}) => runBackendLoad({
  ticker,
  source: 'news_route',
  unavailableWarning: 'backend_news_unavailable',
  dataQuality: inferArrayQuality,
  loader: (symbol) => (
    typeof options.fetchNews === 'function'
      ? options.fetchNews(symbol)
      : fetchInternalJson(`/api/news/${encodeURIComponent(symbol)}`, options)
  ),
});

export const fetchBackendFundamentals = (ticker, options = {}) => runBackendLoad({
  ticker,
  source: 'fundamentals_route',
  unavailableWarning: 'backend_fundamentals_unavailable',
  dataQuality: inferArrayQuality,
  loader: (symbol) => (
    typeof options.fetchFundamentals === 'function'
      ? options.fetchFundamentals(symbol)
      : fetchInternalJson(`/api/fundamentals/${encodeURIComponent(symbol)}`, options)
  ),
});

export const fetchBackendHistory = (ticker, options = {}) => runBackendLoad({
  ticker,
  source: 'history_route',
  unavailableWarning: 'backend_history_unavailable',
  dataQuality: (data) => {
    const history = Array.isArray(data?.historical) ? data.historical : [];
    if (history.length === 0) return 'limited';
    return inferDataQualityFromSource(data?.source);
  },
  loader: (symbol) => (
    typeof options.fetchHistory === 'function'
      ? options.fetchHistory(symbol)
      : fetchInternalJson(`/api/history/${encodeURIComponent(symbol)}`, options)
  ),
});

export const fetchBackendSecFilings = (ticker, options = {}) => runBackendLoad({
  ticker,
  source: 'sec_service',
  unavailableWarning: 'backend_sec_unavailable',
  dataQuality: (data) => {
    if (data?.status === 'error') return 'unavailable';
    return Array.isArray(data?.filings) && data.filings.length > 0 ? 'available' : 'limited';
  },
  loader: (symbol) => {
    const getSecFilingsForTicker = options.getSecFilingsForTicker || defaultGetSecFilingsForTicker;
    return getSecFilingsForTicker(symbol);
  },
});

export const fetchBackendOfficialSources = (ticker, options = {}) => runBackendLoad({
  ticker,
  source: 'official_source_service',
  unavailableWarning: 'backend_official_unavailable',
  dataQuality: (data) => {
    if (data?.status === 'error') return 'unavailable';
    return Array.isArray(data?.sources) && data.sources.length > 0 ? 'available' : 'limited';
  },
  loader: (symbol) => {
    const getOfficialSourcesForTicker = options.getOfficialSourcesForTicker || defaultGetOfficialSourcesForTicker;
    return getOfficialSourcesForTicker(symbol);
  },
});
