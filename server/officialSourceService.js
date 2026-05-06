import axios from 'axios';
import { findCikByTicker, normalizeTicker } from './secService.js';
import { isDeepSeekConfigured, reviewOfficialSourceAuthority } from './deepseekReviewService.js';

const OFFICIAL_SOURCE_CACHE_MS = 20 * 60 * 1000;
const officialSourceCache = new Map();

const REGISTRY = {
  AAPL: {
    companyName: 'Apple Inc.',
    sources: [
      { type: 'official_website', name: 'Apple', url: 'https://www.apple.com' },
      { type: 'investor_relations', name: 'Apple Investor Relations', url: 'https://investor.apple.com' },
      { type: 'newsroom', name: 'Apple Newsroom', url: 'https://www.apple.com/newsroom/' },
    ],
  },
  MSFT: {
    companyName: 'Microsoft Corporation',
    sources: [
      { type: 'official_website', name: 'Microsoft', url: 'https://www.microsoft.com' },
      { type: 'investor_relations', name: 'Microsoft Investor Relations', url: 'https://www.microsoft.com/en-us/investor' },
      { type: 'newsroom', name: 'Microsoft News', url: 'https://news.microsoft.com' },
    ],
  },
  NVDA: {
    companyName: 'NVIDIA Corporation',
    sources: [
      { type: 'official_website', name: 'NVIDIA', url: 'https://www.nvidia.com' },
      { type: 'investor_relations', name: 'NVIDIA Investor Relations', url: 'https://investor.nvidia.com' },
      { type: 'newsroom', name: 'NVIDIA Newsroom', url: 'https://nvidianews.nvidia.com' },
    ],
  },
  TSLA: {
    companyName: 'Tesla, Inc.',
    sources: [
      { type: 'official_website', name: 'Tesla', url: 'https://www.tesla.com' },
      { type: 'investor_relations', name: 'Tesla Investor Relations', url: 'https://ir.tesla.com' },
    ],
  },
  GOOGL: {
    companyName: 'Alphabet Inc.',
    sources: [
      { type: 'official_website', name: 'Alphabet', url: 'https://www.abc.xyz' },
      { type: 'investor_relations', name: 'Alphabet Investor Relations', url: 'https://abc.xyz/investor/' },
      { type: 'press_release', name: 'Google Press Corner', url: 'https://blog.google/press/' },
    ],
  },
  META: {
    companyName: 'Meta Platforms, Inc.',
    sources: [
      { type: 'official_website', name: 'Meta', url: 'https://about.meta.com' },
      { type: 'investor_relations', name: 'Meta Investor Relations', url: 'https://investor.atmeta.com' },
      { type: 'newsroom', name: 'Meta Newsroom', url: 'https://about.fb.com/news/' },
    ],
  },
  AMZN: {
    companyName: 'Amazon.com, Inc.',
    sources: [
      { type: 'official_website', name: 'Amazon', url: 'https://www.amazon.com' },
      { type: 'investor_relations', name: 'Amazon Investor Relations', url: 'https://ir.aboutamazon.com' },
      { type: 'newsroom', name: 'Amazon News', url: 'https://www.aboutamazon.com/news' },
    ],
  },
  AMD: {
    companyName: 'Advanced Micro Devices, Inc.',
    sources: [
      { type: 'official_website', name: 'AMD', url: 'https://www.amd.com' },
      { type: 'investor_relations', name: 'AMD Investor Relations', url: 'https://ir.amd.com' },
      { type: 'newsroom', name: 'AMD Newsroom', url: 'https://www.amd.com/en/newsroom' },
    ],
  },
  NFLX: {
    companyName: 'Netflix, Inc.',
    sources: [
      { type: 'official_website', name: 'Netflix', url: 'https://about.netflix.com' },
      { type: 'investor_relations', name: 'Netflix Investor Relations', url: 'https://ir.netflix.net' },
      { type: 'newsroom', name: 'Netflix Newsroom', url: 'https://about.netflix.com/en/newsroom' },
    ],
  },
  JPM: {
    companyName: 'JPMorgan Chase & Co.',
    sources: [
      { type: 'official_website', name: 'JPMorgan Chase', url: 'https://www.jpmorganchase.com' },
      { type: 'investor_relations', name: 'JPMorgan Chase Investor Relations', url: 'https://www.jpmorganchase.com/ir' },
      { type: 'newsroom', name: 'JPMorgan Chase News', url: 'https://www.jpmorganchase.com/news-stories' },
    ],
  },
  BAC: {
    companyName: 'Bank of America Corporation',
    sources: [
      { type: 'official_website', name: 'Bank of America', url: 'https://www.bankofamerica.com' },
      { type: 'investor_relations', name: 'Bank of America Investor Relations', url: 'https://investor.bankofamerica.com' },
      { type: 'newsroom', name: 'Bank of America Newsroom', url: 'https://newsroom.bankofamerica.com' },
    ],
  },
  XOM: {
    companyName: 'Exxon Mobil Corporation',
    sources: [
      { type: 'official_website', name: 'ExxonMobil', url: 'https://corporate.exxonmobil.com' },
      { type: 'investor_relations', name: 'ExxonMobil Investor Relations', url: 'https://investor.exxonmobil.com' },
      { type: 'newsroom', name: 'ExxonMobil News', url: 'https://corporate.exxonmobil.com/news' },
    ],
  },
};

const getDomain = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
};

const classifyTier = (type) => {
  if (type === 'sec') return 'official';
  if (['investor_relations', 'press_release', 'newsroom', 'official_website', 'exchange'].includes(type)) return 'official_channel';
  if (type === 'major_media') return 'major_media';
  if (type === 'aggregator') return 'aggregator';
  return 'unknown';
};

const scoreSource = (source) => {
  const tier = classifyTier(source.type);
  const base = {
    official: 88,
    official_channel: 78,
    major_media: 58,
    aggregator: 38,
    unknown: 25,
  }[tier];

  let score = base;
  if (source.type === 'investor_relations') score += 8;
  if (source.type === 'sec') score += 7;
  if (source.type === 'official_website') score += 4;
  if (source.domain && !source.domain.includes('google.com/search')) score += 3;

  return Math.max(0, Math.min(100, score));
};

const makeSource = (ticker, companyName, source, notes = []) => {
  const domain = getDomain(source.url);
  const sourceTier = classifyTier(source.type);

  return {
    ticker,
    companyName,
    type: source.type,
    name: source.name,
    url: source.url,
    domain,
    sourceTier,
    authorityScore: scoreSource({ ...source, domain }),
    warnings: [],
    notes,
  };
};

const dedupeSources = (sources) => {
  const seen = new Set();
  return sources.filter((source) => {
    const key = source.url.replace(/\/$/, '').toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const fetchFundamentalsWebsite = async (ticker) => {
  const polygonKey = process.env.POLYGON_KEY;
  if (!polygonKey) return null;

  try {
    const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${polygonKey}`;
    const response = await axios.get(url, { timeout: 5000 });
    const result = response.data?.results;
    if (!result?.homepage_url) return null;

    return {
      companyName: result.name,
      website: result.homepage_url,
    };
  } catch (error) {
    console.warn(`[OfficialSources] Fundamentals website lookup skipped for ${ticker}: ${error.message}`);
    return null;
  }
};

const buildSecSource = async (ticker, companyName) => {
  try {
    const cik = await findCikByTicker(ticker);
    if (!cik) return null;

    return makeSource(
      ticker,
      companyName,
      {
        type: 'sec',
        name: 'SEC EDGAR Company Filings',
        url: `https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(cik)}&owner=exclude`,
      },
      ['CIK was resolved from SEC company ticker data.']
    );
  } catch (error) {
    console.warn(`[OfficialSources] SEC source lookup skipped for ${ticker}: ${error.message}`);
    return null;
  }
};

const applyDeepSeekReviews = async (sources) => {
  if (!isDeepSeekConfigured() || sources.length === 0) return sources;

  return Promise.all(
    sources.map(async (source) => {
      const review = await reviewOfficialSourceAuthority(source);
      if (!review) return source;

      return {
        ...source,
        aiReviewed: true,
        aiAssessment: review.assessment,
        aiConfidence: review.confidence,
        aiReasoning: review.reasoning,
        warnings: [...(source.warnings || []), ...review.warnings],
      };
    })
  );
};

export const getOfficialSourcesForTicker = async (tickerInput) => {
  const ticker = normalizeTicker(tickerInput);
  const mode = isDeepSeekConfigured() ? 'rule_plus_ai' : 'rule_only';
  const cached = officialSourceCache.get(`${ticker}:${mode}`);

  if (cached && Date.now() - cached.cachedAt < OFFICIAL_SOURCE_CACHE_MS) {
    return cached.value;
  }

  try {
    if (!ticker) {
      return {
        ticker,
        generatedAt: new Date().toISOString(),
        status: 'unsupported',
        sources: [],
        notes: ['Ticker is required.'],
        mode,
      };
    }

    const registryEntry = REGISTRY[ticker];
    const fundamentals = registryEntry ? null : await fetchFundamentalsWebsite(ticker);
    const companyName = registryEntry?.companyName || fundamentals?.companyName;
    const registrySources = (registryEntry?.sources || []).map((source) =>
      makeSource(ticker, companyName, source, ['Loaded from the built-in official source registry.'])
    );
    const secSource = await buildSecSource(ticker, companyName);
    const websiteSource =
      fundamentals?.website && !registryEntry
        ? makeSource(
            ticker,
            companyName,
            { type: 'official_website', name: `${companyName || ticker} Website`, url: fundamentals.website },
            ['Loaded from available company fundamentals metadata.']
          )
        : null;

    const ruleSources = dedupeSources([...registrySources, secSource, websiteSource].filter(Boolean));
    const sources = await applyDeepSeekReviews(ruleSources);
    const hasRegistry = registrySources.length > 0;
    const status = sources.length === 0 ? 'not_found' : hasRegistry || sources.some((source) => source.type === 'sec') ? 'available' : 'partial';
    const notes =
      sources.length > 0
        ? ['Official source candidates are derived from registry, SEC, and company metadata signals.']
        : ['No official source candidates were found. No URLs were generated.'];

    const value = {
      ticker,
      companyName,
      generatedAt: new Date().toISOString(),
      status,
      sources,
      notes,
      mode,
    };

    officialSourceCache.set(`${ticker}:${mode}`, { cachedAt: Date.now(), value });
    return value;
  } catch (error) {
    console.warn(`[OfficialSources] Failed to resolve official sources for ${ticker}: ${error.message}`);
    return {
      ticker,
      generatedAt: new Date().toISOString(),
      status: 'error',
      sources: [],
      notes: ['Official source discovery is currently unavailable.'],
      mode,
    };
  }
};
