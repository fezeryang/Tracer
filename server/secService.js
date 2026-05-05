import axios from 'axios';

// Phase 3B extension points:
// - GDELT global news coverage
// - SEC EDGAR filings verification
// - Company IR / RSS feeds
// - Article extraction with Trafilatura
// - Event clustering
// - LLM-based cross-source consistency analysis

const TICKER_MAP_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_SUBMISSIONS_URL = 'https://data.sec.gov/submissions';
const IMPORTANT_FORMS = new Set(['10-K', '10-Q', '8-K', '20-F', '6-K']);
const TICKER_MAP_CACHE_MS = 24 * 60 * 60 * 1000;
const FILINGS_CACHE_MS = 20 * 60 * 1000;
const MIN_SEC_REQUEST_INTERVAL_MS = 250;
const MAX_RECENT_FILINGS = 10;

let tickerMapCache = null;
let tickerMapCachedAt = 0;
let lastSecRequestAt = 0;
const filingsCache = new Map();

export const normalizeTicker = (ticker) => String(ticker || '').trim().toUpperCase();

export const padCik = (cik) => String(cik || '').replace(/\D/g, '').padStart(10, '0');

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getSecHeaders = () => ({
  'User-Agent': process.env.SEC_USER_AGENT || 'NUX Research Terminal contact@example.com',
  Accept: 'application/json',
});

const secGet = async (url) => {
  const elapsed = Date.now() - lastSecRequestAt;
  if (elapsed < MIN_SEC_REQUEST_INTERVAL_MS) {
    await pause(MIN_SEC_REQUEST_INTERVAL_MS - elapsed);
  }

  lastSecRequestAt = Date.now();
  return axios.get(url, { headers: getSecHeaders(), timeout: 8000 });
};

export const getCompanyTickerMap = async () => {
  const now = Date.now();
  if (tickerMapCache && now - tickerMapCachedAt < TICKER_MAP_CACHE_MS) {
    return tickerMapCache;
  }

  const response = await secGet(TICKER_MAP_URL);
  tickerMapCache = Object.values(response.data || {}).map((entry) => ({
    ticker: normalizeTicker(entry.ticker),
    cik: String(entry.cik_str),
    title: entry.title,
  }));
  tickerMapCachedAt = now;

  return tickerMapCache;
};

export const findCikByTicker = async (ticker) => {
  const normalizedTicker = normalizeTicker(ticker);
  if (!normalizedTicker) return null;

  const companyMap = await getCompanyTickerMap();
  const match = companyMap.find((entry) => entry.ticker === normalizedTicker);
  return match?.cik || null;
};

export const buildSecFilingUrl = (cik, accessionNumber, primaryDocument) => {
  if (!cik || !accessionNumber || !primaryDocument) return undefined;

  const compactAccession = String(accessionNumber).replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${compactAccession}/${primaryDocument}`;
};

export const fetchRecentFilings = async (ticker) => {
  const normalizedTicker = normalizeTicker(ticker);
  const cik = await findCikByTicker(normalizedTicker);

  if (!cik) {
    return {
      ticker: normalizedTicker,
      cik: undefined,
      generatedAt: new Date().toISOString(),
      filings: [],
      formsIncluded: [],
      status: 'not_found',
      notes: [`No SEC CIK mapping found for ${normalizedTicker}.`],
    };
  }

  const paddedCik = padCik(cik);
  const response = await secGet(`${SEC_SUBMISSIONS_URL}/CIK${paddedCik}.json`);
  const recent = response.data?.filings?.recent || {};
  const forms = recent.form || [];

  const filings = forms
    .map((form, index) => ({
      ticker: normalizedTicker,
      cik: String(cik),
      accessionNumber: recent.accessionNumber?.[index] || '',
      form,
      filingDate: recent.filingDate?.[index] || '',
      reportDate: recent.reportDate?.[index] || undefined,
      primaryDocument: recent.primaryDocument?.[index] || undefined,
      description: recent.primaryDocDescription?.[index] || undefined,
      source: 'SEC EDGAR',
    }))
    .filter((filing) => IMPORTANT_FORMS.has(filing.form) && filing.accessionNumber && filing.filingDate)
    .slice(0, MAX_RECENT_FILINGS)
    .map((filing) => ({
      ...filing,
      url: buildSecFilingUrl(filing.cik, filing.accessionNumber, filing.primaryDocument),
    }));

  return {
    ticker: normalizedTicker,
    cik: String(cik),
    generatedAt: new Date().toISOString(),
    filings,
    formsIncluded: [...new Set(filings.map((filing) => filing.form))],
    status: filings.length > 0 ? 'available' : 'unavailable',
    notes:
      filings.length > 0
        ? ['Recent important SEC filings were loaded from SEC EDGAR submissions.']
        : ['No recent 10-K, 10-Q, 8-K, 20-F, or 6-K filings were found in the current SEC feed.'],
  };
};

export const getSecFilingsForTicker = async (ticker) => {
  const normalizedTicker = normalizeTicker(ticker);
  const cached = filingsCache.get(normalizedTicker);

  if (cached && Date.now() - cached.cachedAt < FILINGS_CACHE_MS) {
    return cached.value;
  }

  try {
    const value = await fetchRecentFilings(normalizedTicker);
    filingsCache.set(normalizedTicker, { cachedAt: Date.now(), value });
    return value;
  } catch (error) {
    console.warn(`[SEC] Failed to load filings for ${normalizedTicker}: ${error.message}`);
    return {
      ticker: normalizedTicker,
      generatedAt: new Date().toISOString(),
      filings: [],
      formsIncluded: [],
      status: 'error',
      error: error.message,
      notes: ['SEC EDGAR filings are currently unavailable.'],
    };
  }
};
