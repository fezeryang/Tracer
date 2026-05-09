
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { saveFeedback, logUserLogin, updateUserHeartbeat, getAdminLogs, getRegisteredUsers, initDB, createUser, findUser, isReady } from './database.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getSecFilingsForTicker } from './secService.js';
import { getOfficialSourcesForTicker } from './officialSourceService.js';
import { generateDeepSeekReport } from './aiReportService.js';
import { classifyChatIntent } from './chatIntentService.js';
import {
    getPolygonCompatibleBaseUrl,
    getPolygonCompatibleKey,
    getPolygonCompatibleProviderName,
    withCacheSourceLabel,
} from './marketDataKeys.js';
import { cachedMarketDataGet, sendMarketDataError } from './marketDataRequestCache.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json());

    // Secrets from Environment
    const POLYGON_KEY = getPolygonCompatibleKey();
    const FINNHUB_KEY = process.env.FINNHUB_KEY;
    const ALPACA_KEY = process.env.ALPACA_API_KEY;
    const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
    const EIA_KEY = process.env.EIA_API_KEY;
    const MASSIVE_KEY = process.env.MASSIVE_API_KEY;
    const POLYGON_COMPATIBLE_BASE_URL = getPolygonCompatibleBaseUrl();
    const POLYGON_COMPATIBLE_PROVIDER = getPolygonCompatibleProviderName();
    const MARKET_DATA_TTL = {
        quote: 45 * 1000,
        history: 20 * 60 * 1000,
        fundamentals: 12 * 60 * 60 * 1000,
        news: 7 * 60 * 1000,
        whisper: 10 * 60 * 1000,
    };
    const whisperCache = new Map();

    // --- Options Chain Cache ---
    const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
    const YAHOO_FINANCE_RAPIDAPI_HOST = process.env.YAHOO_FINANCE_RAPIDAPI_HOST || 'yh-finance.p.rapidapi.com';
    const OPTIONS_TTL = {
        chain: 60 * 1000,        // 60 seconds
        expirations: 5 * 60 * 1000, // 5 minutes
    };
    const optionsChainCache = new Map();
    const optionsExpirationsCache = new Map();
    const MAX_OPTIONS_CACHE = 500;

    const pruneCache = (cache) => {
        while (cache.size > MAX_OPTIONS_CACHE) {
            const firstKey = cache.keys().next().value;
            cache.delete(firstKey);
        }
    };

    const setCached = (cache, key, value) => {
        cache.set(key, value);
        pruneCache(cache);
    };

    const buildPolygonCompatibleUrl = (pathName, params = {}) => {
        const url = new URL(pathName, POLYGON_COMPATIBLE_BASE_URL);
        Object.entries({ ...params, apiKey: POLYGON_KEY }).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                url.searchParams.set(key, String(value));
            }
        });
        return url.toString();
    };

    // Config State
    let activeProvider = ALPACA_KEY ? 'ALPACA' : 'POLYGON';

// Middleware: Check DB Status
app.use((req, res, next) => {
    if (!isReady()) {
        if (req.path.startsWith('/api/auth/')) {
             // Let auth fail gracefully if DB is down but allow retry
        }
    }
    next();
});

// --- Admin Config Routes ---

app.get('/api/admin/provider', (req, res) => {
    res.json({ provider: activeProvider });
});

app.post('/api/admin/provider', (req, res) => {
    const { provider } = req.body;
    if (['POLYGON', 'FINNHUB', 'YAHOO', 'GOOGLE', 'SIMULATION', 'ALPACA', 'MASSIVE'].includes(provider)) {
        activeProvider = provider;
        console.log(`[Config] Market Data Provider switched to: ${activeProvider}`);
        res.json({ success: true, provider: activeProvider });
    } else {
        res.status(400).json({ error: 'Invalid provider' });
    }
});

app.get('/api/admin/test/:provider', async (req, res) => {
    const provider = req.params.provider.toUpperCase();
    const ticker = 'SPY';
    const start = Date.now();
    
    try {
        let data = {};
        if (provider === 'POLYGON') {
             const url = buildPolygonCompatibleUrl(`/v2/aggs/ticker/${ticker}/prev`, { adjusted: true });
             const response = await cachedMarketDataGet({
                 cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:admin-test:${ticker}`,
                 ttlMs: MARKET_DATA_TTL.quote,
                 url,
                 timeout: 5000,
             });
             data = response.data;
        } else if (provider === 'FINNHUB') {
             const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`;
             const response = await axios.get(url, { timeout: 5000 });
             data = response.data;
        } else if (provider === 'ALPACA') {
             const url = `https://data.alpaca.markets/v2/stocks/${ticker}/quotes/latest`;
             const response = await axios.get(url, { 
                 headers: {
                     'APCA-API-KEY-ID': ALPACA_KEY,
                     'APCA-API-SECRET-KEY': ALPACA_SECRET
                 },
                 timeout: 5000 
             });
             data = response.data;
        } else if (provider === 'YAHOO') {
             // Public Yahoo Chart Endpoint
             const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
             const response = await axios.get(url, { timeout: 5000 });
             data = response.data;
        } else if (provider === 'GOOGLE') {
             // Google has no public API, verify simulation logic
             await new Promise(r => setTimeout(r, 150)); // Simulated Latency
             data = { result: 'Google Finance Connection (Simulated) OK' };
        } else if (provider === 'SIMULATION') {
             await new Promise(r => setTimeout(r, 50)); // Fake latency
             data = { result: 'Mock Data OK' };
        } else if (provider === 'MASSIVE') {
             if (!MASSIVE_KEY) {
                 throw new Error('MASSIVE_API_KEY not configured');
             }
             const url = buildPolygonCompatibleUrl(`/v2/aggs/ticker/${ticker}/prev`);
             const response = await cachedMarketDataGet({
                 cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:admin-test:${ticker}`,
                 ttlMs: MARKET_DATA_TTL.quote,
                 url,
                 timeout: 5000,
             });
             data = response.data;
        } else {
             throw new Error('Unknown Provider');
        }

        const latency = Date.now() - start;
        res.json({ success: true, latency, provider, sample: data });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message, latency: Date.now() - start });
    }
});

// --- Market Data Routes ---

// 1. Stock Quote
app.get('/api/quote/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  
  if (activeProvider === 'SIMULATION') {
       return res.json(generateSimulatedQuote(ticker));
  }
  
  if (activeProvider === 'GOOGLE') {
      // Google Finance has no public JSON API. We simulate the data source label.
      // In a real production app, this would use a scraper or private API.
      return res.json(generateSimulatedQuote(ticker, 'Google Finance'));
  }

  if (activeProvider === 'ALPACA') {
      try {
          console.log(`[API] Fetching Snapshot for ${ticker} via Alpaca...`);
          
          const url = `https://data.alpaca.markets/v2/stocks/${ticker}/snapshot`;
          const response = await axios.get(url, {
              headers: {
                  'APCA-API-KEY-ID': ALPACA_KEY,
                  'APCA-API-SECRET-KEY': ALPACA_SECRET
              },
              params: {
                  feed: 'iex' // Explicitly use IEX for free tier to avoid SIP delays/errors
              },
              timeout: 5000
          });

          const snapshot = response.data;
          const price = snapshot.latestTrade?.p || snapshot.latestQuote?.ap || snapshot.dailyBar?.c;
          const prevClose = snapshot.prevDailyBar?.c || snapshot.dailyBar?.o;
          
          if (!price || !prevClose) throw new Error('Incomplete snapshot data');

          const change = price - prevClose;
          const changePercent = (change / prevClose) * 100;

          return res.json({
              symbol: ticker,
              price: price,
              previousClose: prevClose,
              change: change,
              changePercent: changePercent,
              source: 'Alpaca Markets (IEX)'
          });
      } catch (e) {
          console.warn(`[API] Alpaca Snapshot failed for ${ticker}: ${e.message}`);
          // If Alpaca fails, try Yahoo as a "live" fallback before going to simulation
          try {
              console.log(`[API] Falling back to Yahoo for ${ticker}...`);
              const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
              const response = await axios.get(url, { timeout: 3000 });
              const meta = response.data?.chart?.result?.[0]?.meta;
              if (meta) {
                  return res.json({
                      symbol: ticker,
                      price: meta.regularMarketPrice,
                      previousClose: meta.previousClose,
                      change: meta.regularMarketPrice - meta.previousClose,
                      changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
                      source: 'Yahoo Finance (Fallback)'
                  });
              }
          } catch (yError) {
              console.warn(`[API] Yahoo fallback also failed: ${yError.message}`);
          }
          return res.json(generateSimulatedQuote(ticker, 'Alpaca Error -> Sim'));
      }
  }

  if (activeProvider === 'YAHOO') {
      try {
          console.log(`[API] Fetching Quote for ${ticker} via Yahoo Finance...`);
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`;
          const response = await axios.get(url, { timeout: 4000 });
          const meta = response.data?.chart?.result?.[0]?.meta;

          if (!meta) throw new Error('Yahoo data structure invalid');

          return res.json({
              symbol: ticker,
              price: meta.regularMarketPrice,
              previousClose: meta.previousClose,
              change: meta.regularMarketPrice - meta.previousClose,
              changePercent: ((meta.regularMarketPrice - meta.previousClose) / meta.previousClose) * 100,
              source: 'Yahoo Finance'
          });
      } catch (e) {
          console.warn(`[API] Yahoo failed for ${ticker}: ${e.message}`);
          return res.json(generateSimulatedQuote(ticker, 'Yahoo Error -> Sim'));
      }
  }

  if (activeProvider === 'FINNHUB') {
      try {
          console.log(`[API] Fetching Quote for ${ticker} via Finnhub...`);
          const url = `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${FINNHUB_KEY}`;
          const response = await axios.get(url, { timeout: 5000 });
          const data = response.data;

          if (data.c === 0 && data.pc === 0) throw new Error('Symbol not found');

          return res.json({
              symbol: ticker,
              price: data.c,
              previousClose: data.pc,
              change: data.d,
              changePercent: data.dp,
              source: 'Finnhub.io'
          });
      } catch (e) {
          console.warn(`[API] Finnhub failed for ${ticker}: ${e.message}`);
          return res.json(generateSimulatedQuote(ticker, 'Finnhub Error -> Sim'));
      }
  }

  if (activeProvider === 'MASSIVE' && MASSIVE_KEY) {
      try {
          console.log(`[API] Fetching Quote for ${ticker} via Massive...`);
          const url = buildPolygonCompatibleUrl(`/v2/aggs/ticker/${ticker}/prev`);
          const { data, cached } = await cachedMarketDataGet({
              cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:quote:${ticker}`,
              ttlMs: MARKET_DATA_TTL.quote,
              url,
              timeout: 5000,
          });

          if (!data.results || data.results.length === 0) {
              throw new Error('No data returned from Massive');
          }

          const quote = data.results[0];
          const close = quote.c;  // Close price
          const open = quote.o;   // Open price

          // Calculate change from open (as we don't have prev_close in prev endpoint)
          const change = close - open;
          const changePercent = (change / open) * 100;

          return res.json({
              symbol: ticker,
              price: close,
              previousClose: open,
              change: change,
              changePercent: changePercent,
              source: withCacheSourceLabel(POLYGON_COMPATIBLE_PROVIDER, cached)
          });
      } catch (e) {
          console.warn(`[API] Massive failed for ${ticker}: ${e.message}`);
          if (e.providerStatus) {
              return sendMarketDataError(res, e);
          }
          return res.json(generateSimulatedQuote(ticker, 'Massive Error -> Sim'));
      }
  }

  // Default: POLYGON
  if (!POLYGON_KEY) {
    console.warn('[API] MASSIVE_API_KEY/POLYGON_KEY not configured');
    return res.json(generateSimulatedQuote(ticker, 'No Market Data Key -> Sim'));
  }

  try {
    console.log(`[API] Fetching Quote for ${ticker} via ${POLYGON_COMPATIBLE_PROVIDER} (Prev Aggs)...`);
    
    const prevUrl = buildPolygonCompatibleUrl(`/v2/aggs/ticker/${ticker}/prev`, { adjusted: true });
    const { data, cached } = await cachedMarketDataGet({
        cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:quote:${ticker}`,
        ttlMs: MARKET_DATA_TTL.quote,
        url: prevUrl,
        timeout: 5000,
    });

    if (data && data.results && data.results.length > 0) {
        const result = data.results[0];
        const price = result.c;
        const open = result.o;
        const change = price - open; 
        const changePercent = (change / open) * 100;

        return res.json({
            symbol: result.T || ticker,
            price: price,
            previousClose: open, 
            change: change,
            changePercent: changePercent,
            source: withCacheSourceLabel(POLYGON_COMPATIBLE_PROVIDER, cached)
        });
    }

    throw new Error('No data in Prev endpoint');

  } catch (prevError) {
    console.warn(`[API] ${POLYGON_COMPATIBLE_PROVIDER} Prev failed for ${ticker} (${prevError.message}). Trying Snapshot...`);
    if (prevError.providerStatus) {
        return sendMarketDataError(res, prevError);
    }

    try {
        const snapshotUrl = buildPolygonCompatibleUrl(`/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}`);
        const { data: snapshotData, cached } = await cachedMarketDataGet({
            cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:quote-snapshot:${ticker}`,
            ttlMs: MARKET_DATA_TTL.quote,
            url: snapshotUrl,
            timeout: 5000,
        });
        const data = snapshotData?.ticker;

        if (!data) throw new Error('Polygon Snapshot returned no data');

        const price = data.lastTrade?.p || data.day?.c || data.prevDay?.c;

        return res.json({
            symbol: data.ticker,
            price: price,
            previousClose: data.prevDay?.c,
            change: data.todaysChange,
            changePercent: data.todaysChangePerc,
            source: withCacheSourceLabel(`${POLYGON_COMPATIBLE_PROVIDER} (Snap)`, cached)
        });

    } catch (snapError) {
        console.error(`[API] All ${POLYGON_COMPATIBLE_PROVIDER} endpoints failed for ${ticker}:`, snapError.message);
        if (snapError.providerStatus) {
            return sendMarketDataError(res, snapError);
        }
        return res.json(generateSimulatedQuote(ticker, `${POLYGON_COMPATIBLE_PROVIDER} Error -> Sim`));
    }
  }
});

// 2. Fundamentals (Polygon Only for now, Finnhub free tier limits fundamentals)
app.get('/api/fundamentals/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  // If MASSIVE is active, try MASSIVE first
  if (activeProvider === 'MASSIVE' && MASSIVE_KEY) {
      try {
          console.log(`[API] Fetching Fundamentals for ${ticker} via Massive...`);
          const url = buildPolygonCompatibleUrl(`/v3/reference/tickers/${ticker}`);
          const { data, cached } = await cachedMarketDataGet({
              cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:fundamentals:${ticker}`,
              ttlMs: MARKET_DATA_TTL.fundamentals,
              url,
              timeout: 5000,
          });
          const result = data?.results;

          if (result) {
              const fundamentals = [{
                  symbol: result.ticker || ticker,
                  companyName: result.name || ticker,
                  description: result.description || '',
                  sector: result.sic_description || 'Technology',
                  industry: result.sic_description || 'Consumer Electronics',
                  mktCap: result.market_cap || 0,
                  priceEarnings: 0,
                  beta: 0,
                  website: result.homepage_url || '',
                  eps: 0,
                  revenue: 0,
                  dividendYield: 0,
                  bookValue: 0,
                  source: withCacheSourceLabel(POLYGON_COMPATIBLE_PROVIDER, cached),
              }];

              // Enrichment: fetch real P/E, Beta, EPS, Revenue (same as Polygon path)
              let peRatioValue = 0;
              let betaValue = 0;
              if (FINNHUB_KEY) {
                try {
                  const finnhubUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`;
                  const metricsResp = await axios.get(finnhubUrl, { timeout: 5000 });
                  const metric = metricsResp.data?.metric;
                  if (metric) {
                    peRatioValue = metric.peBasicExclExtraTTM || metric.peExclExtraTTM || 0;
                    betaValue = metric.beta || 0;
                  }
                } catch (e) {
                  console.warn(`[API] Finnhub metrics enrichment failed for ${ticker}: ${e.message}`);
                }
              }

              let epsValue = 0;
              let revenueValue = 0;
              try {
                const finUrl = buildPolygonCompatibleUrl(`/vX/reference/financials?ticker=${encodeURIComponent(ticker)}&limit=1`);
                const { data: finData } = await cachedMarketDataGet({
                  cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:financials:${ticker}`,
                  ttlMs: MARKET_DATA_TTL.fundamentals,
                  url: finUrl,
                  timeout: 5000,
                });
                const finResult = finData?.results?.[0]?.financials;
                if (finResult) {
                  epsValue = finResult?.income_statement?.basic_earnings_per_share?.value || 0;
                  revenueValue = finResult?.income_statement?.revenues?.value || 0;
                }
              } catch (e) {
                console.warn(`[API] Financials enrichment failed for ${ticker}: ${e.message}`);
              }

              fundamentals[0].priceEarnings = peRatioValue;
              fundamentals[0].beta = betaValue;
              fundamentals[0].eps = epsValue;
              fundamentals[0].revenue = revenueValue;

              return res.json(fundamentals);
          }
      } catch (e) {
          console.warn(`[API] Massive Fundamentals failed for ${ticker}: ${e.message}`);
          if (e.providerStatus) {
              return sendMarketDataError(res, e);
          }
      }
  }

  // Always use Polygon for fundamentals as it has better free tier coverage for company profiles
  if (!POLYGON_KEY) {
    console.warn('[API] MASSIVE_API_KEY/POLYGON_KEY not configured for fundamentals');
    return res.json([]);
  }

  try {
    console.log(`[API] Fetching Fundamentals for ${ticker} via ${POLYGON_COMPATIBLE_PROVIDER}...`);
    const url = buildPolygonCompatibleUrl(`/v3/reference/tickers/${ticker}`);
    const { data: responseData, cached } = await cachedMarketDataGet({
        cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:fundamentals:${ticker}`,
        ttlMs: MARKET_DATA_TTL.fundamentals,
        url,
        timeout: 5000,
    });
    const result = responseData?.results;

    if (!result) throw new Error('No fundamentals found');

    // Fetch real P/E and Beta from Finnhub metrics
    let peRatioValue = 0;
    let betaValue = 0;
    if (FINNHUB_KEY) {
      try {
        const finnhubUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${ticker}&metric=all&token=${FINNHUB_KEY}`;
        const metricsResp = await axios.get(finnhubUrl, { timeout: 5000 });
        const metric = metricsResp.data?.metric;
        if (metric) {
          peRatioValue = metric.peBasicExclExtraTTM || metric.peExclExtraTTM || 0;
          betaValue = metric.beta || 0;
        }
      } catch (e) {
        console.warn(`[API] Finnhub metrics failed for ${ticker}: ${e.message}`);
      }
    }

    // Fetch real EPS and Revenue from Polygon financials
    let epsValue = 0;
    let revenueValue = 0;
    try {
      const finUrl = buildPolygonCompatibleUrl(`/vX/reference/financials?ticker=${encodeURIComponent(ticker)}&limit=1`);
      const { data: finData } = await cachedMarketDataGet({
        cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:financials:${ticker}`,
        ttlMs: MARKET_DATA_TTL.fundamentals,
        url: finUrl,
        timeout: 5000,
      });
      const finResult = finData?.results?.[0]?.financials;
      if (finResult) {
        epsValue = finResult?.income_statement?.basic_earnings_per_share?.value || 0;
        revenueValue = finResult?.income_statement?.revenues?.value || 0;
      }
    } catch (e) {
      console.warn(`[API] Financials lookup failed for ${ticker}: ${e.message}`);
    }

    const data = [{
        symbol: result.ticker,
        companyName: result.name,
        description: result.description,
        sector: result.sic_description || 'Technology',
        industry: result.sic_description || 'Consumer Electronics',
        mktCap: result.market_cap,
        priceEarnings: peRatioValue,
        beta: betaValue,
        website: result.homepage_url,
        eps: epsValue,
        revenue: revenueValue,
        source: withCacheSourceLabel(POLYGON_COMPATIBLE_PROVIDER, cached),
    }];

    res.json(data);
  } catch (error) {
    console.error(`[API] Fundamentals failed for ${ticker}:`, error.message);
    if (error.providerStatus) {
        return sendMarketDataError(res, error);
    }
    res.json([]);
  }
});

// 3. News (Switchable)
app.get('/api/news/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  
  if (activeProvider === 'FINNHUB') {
      try {
          console.log(`[API] Fetching News for ${ticker} via Finnhub...`);
          const today = new Date();
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 2); // Last 48 hours

          const toStr = today.toISOString().split('T')[0];
          const fromStr = yesterday.toISOString().split('T')[0];

          const url = `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${fromStr}&to=${toStr}&token=${FINNHUB_KEY}`;
          const response = await axios.get(url, { timeout: 5000 });
          const results = response.data || [];

          const news = results.slice(0, 5).map(item => ({
              title: item.headline,
              image: item.image,
              site: item.source,
              text: item.summary,
              url: item.url,
              publishedDate: new Date(item.datetime * 1000).toISOString()
          }));
          return res.json(news);

      } catch (e) {
          console.warn(`[API] Finnhub News failed: ${e.message}`);
      }
  }

  if (activeProvider === 'MASSIVE' && MASSIVE_KEY) {
      try {
          console.log(`[API] Fetching News for ${ticker} via Massive...`);
          const url = buildPolygonCompatibleUrl('/v2/reference/news', { ticker, limit: 5 });
          const { data, cached } = await cachedMarketDataGet({
              cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:news:${ticker}`,
              ttlMs: MARKET_DATA_TTL.news,
              url,
              timeout: 5000,
          });
          const results = data?.results || [];

          if (results.length > 0) {
              const news = results.map(item => ({
                  title: item.title,
                  image: item.image_url,
                  site: withCacheSourceLabel(item.publisher?.name || POLYGON_COMPATIBLE_PROVIDER, cached),
                  text: item.description,
                  url: item.article_url,
                  publishedDate: item.published_utc
              }));
              return res.json(news);
          }
      } catch (e) {
          console.warn(`[API] Massive News failed: ${e.message}`);
          if (e.providerStatus) {
              return sendMarketDataError(res, e);
          }
      }
  }

  // Fallback / Default: POLYGON
  if (!POLYGON_KEY) {
    console.warn('[API] MASSIVE_API_KEY/POLYGON_KEY not configured for news');
    return res.json([]);
  }

  try {
    console.log(`[API] Fetching News for ${ticker} via ${POLYGON_COMPATIBLE_PROVIDER}...`);
    const url = buildPolygonCompatibleUrl('/v2/reference/news', { ticker, limit: 5 });
    const { data: responseData, cached } = await cachedMarketDataGet({
        cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:news:${ticker}`,
        ttlMs: MARKET_DATA_TTL.news,
        url,
        timeout: 5000,
    });
    
    const results = responseData?.results || [];

    const news = results.map(item => ({
        title: item.title,
        image: item.image_url,
        site: withCacheSourceLabel(item.publisher?.name || POLYGON_COMPATIBLE_PROVIDER, cached),
        text: item.description,
        url: item.article_url,
        publishedDate: item.published_utc
    }));

    res.json(news);
  } catch (error) {
    console.error(`[API] News failed for ${ticker}:`, error.message);
    if (error.providerStatus) {
        return sendMarketDataError(res, error);
    }
    res.json([]);
  }
});

app.get('/api/sec/filings/:ticker', async (req, res) => {
  try {
    const result = await getSecFilingsForTicker(req.params.ticker);
    res.json(result);
  } catch (e) {
    res.status(500).json({
      ticker: String(req.params.ticker || '').toUpperCase(),
      generatedAt: new Date().toISOString(),
      filings: [],
      formsIncluded: [],
      status: 'error',
      error: e.message,
      notes: ['SEC EDGAR filings are currently unavailable.'],
    });
  }
});

app.get('/api/official-sources/:ticker', async (req, res) => {
  try {
    const result = await Promise.race([
      getOfficialSourcesForTicker(req.params.ticker),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Official sources timed out')), 10000)
      ),
    ]);
    res.json(result);
  } catch (e) {
    res.status(500).json({
      ticker: String(req.params.ticker || '').toUpperCase(),
      generatedAt: new Date().toISOString(),
      status: 'error',
      sources: [],
      notes: ['Official source discovery timed out.'],
      mode: process.env.DEEPSEEK_API_KEY ? 'rule_plus_ai' : 'rule_only',
      error: e.message,
    });
  }
});

app.post('/api/ai/report', async (req, res) => {
  try {
    const result = await generateDeepSeekReport(req.body || {});
    res.json(result);
  } catch (e) {
    res.json({
      ok: false,
      provider: 'deepseek',
      error: e instanceof Error ? e.message : 'AI report generation failed.',
    });
  }
});

app.post('/api/chat/intent', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await classifyChatIntent({
      input: body.input,
      selectedTicker: body.selectedTicker,
      language: body.language,
      localGoal: body.localGoal,
    });
    res.json(result);
  } catch {
    res.json({
      ok: false,
      available: false,
      error: 'deepseek_unavailable',
    });
  }
});

// StockTwits Social Sentiment via RapidAPI
app.get('/api/stocktwits/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

  if (!RAPIDAPI_KEY) {
    return res.status(400).json({
      status: 'unavailable',
      reason: 'missing_key',
      message: 'RAPIDAPI_KEY is not configured.'
    });
  }

  try {
    const result = await fetchStocktwitsFromApi(ticker, RAPIDAPI_KEY);
    res.json(result);

  } catch (error) {
    const status = error?.response?.status;
    if (status === 429) {
      return res.status(429).json({
        status: 'rate_limited',
        message: 'StockTwits API rate limit exceeded. Please try again later.'
      });
    }
    if (status === 404 || (error?.response?.data?.message && error.response.data.message.includes('symbol'))) {
      return res.json({
        status: 'no_data',
        message: `No StockTwits data available for ${ticker}`
      });
    }
    console.error('[StockTwits] Error:', error.message);
    res.status(500).json({
      status: 'error',
      message: 'Failed to fetch StockTwits data.'
    });
  }
});

// --- Insider Trading via RapidAPI ---
app.get('/api/insiders/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

  if (!RAPIDAPI_KEY) {
    return res.status(503).json({
      status: 'unavailable',
      ticker,
      generatedAt: new Date().toISOString(),
      error: 'RAPIDAPI_KEY not configured',
      trades: [],
      totalBuys: 0,
      totalSells: 0,
      netShares: 0,
      sentiment: 'neutral',
      notes: ['Insider trading data unavailable. RapidAPI key not configured.']
    });
  }

  try {
    console.log(`[API] Fetching Insider Trading for ${ticker} via RapidAPI...`);
    const url = `https://insiders.p.rapidapi.com/gedetailedtinsiders/${ticker}`;
    const response = await axios.get(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': 'insiders.p.rapidapi.com',
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    const rawData = response.data;

    // The API returns nested data: insideTransactions[] -> reportingOwner[] -> transactions[] -> transactions[]
    // Handle both {insideTransactions: [...]} and flat array formats
    const transactionGroups = Array.isArray(rawData)
      ? rawData
      : (rawData?.insideTransactions || []);

    const trades = [];
    for (const group of transactionGroups) {
      const owner = Array.isArray(group?.reportingOwner) && group.reportingOwner.length > 0
        ? group.reportingOwner[0]
        : null;
      const name = owner?.name || 'Unknown';
      const title = owner?.title || 'Officer';

      const txnGroups = Array.isArray(group?.transactions) ? group.transactions : [];
      for (const txnGroup of txnGroups) {
        const subTxns = Array.isArray(txnGroup?.transactions) ? txnGroup.transactions : [];
        for (const sub of subTxns) {
          const shares = parseInt(sub.transactionShares, 10) || 0;
          const code = sub.transactionAcquiredDisposedCode || '';
          const price = parseFloat(sub.transactionPricePerShare) || 0;
          const date = sub.transactionDate || '';
          const form = String(sub.transactionFormType || '4');
          const transactionCode = sub.transactionCode || '';

          // Determine buy/sell from acquisition code or transaction code
          const isBuy = code === 'A' || ['P', 'A', 'J', 'M'].includes(transactionCode);
          const isSell = code === 'D' || ['S', 'D', 'W', 'F'].includes(transactionCode);

          if (shares > 0 && (isBuy || isSell)) {
            trades.push({
              name,
              transactionType: isBuy ? 'buy' : 'sell',
              shares,
              price,
              date,
              form,
              title,
            });
          }
        }
      }
    }

    const totalBuys = trades.filter(t => t.transactionType === 'buy').reduce((sum, t) => sum + t.shares, 0);
    const totalSells = trades.filter(t => t.transactionType === 'sell').reduce((sum, t) => sum + t.shares, 0);
    const netShares = totalBuys - totalSells;
    const sentiment = netShares > 10000 ? 'bullish' : netShares < -10000 ? 'bearish' : 'neutral';

    return res.json({
      ticker,
      generatedAt: new Date().toISOString(),
      status: 'success',
      trades: trades.slice(0, 20),
      totalBuys,
      totalSells,
      netShares,
      sentiment,
      notes: [`Fetched ${trades.length} insider transactions.`]
    });

  } catch (e) {
    console.warn(`[API] RapidAPI Insiders failed for ${ticker}: ${e.message}`);
    return res.status(503).json({
      status: 'unavailable',
      ticker,
      generatedAt: new Date().toISOString(),
      error: e.message,
      trades: [],
      totalBuys: 0,
      totalSells: 0,
      netShares: 0,
      sentiment: 'neutral',
      notes: ['Insider trading data temporarily unavailable.']
    });
  }
});

// --- Earnings Calendar (Finnhub) ---
app.get('/api/calendar/earnings/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  if (!FINNHUB_KEY) {
    return res.status(503).json({ error: 'FINNHUB_KEY not configured' });
  }

  try {
    console.log(`[API] Fetching Earnings Calendar for ${ticker}...`);
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    const to = new Date(today);
    to.setDate(to.getDate() + 90);

    const fromStr = from.toISOString().split('T')[0];
    const toStr = to.toISOString().split('T')[0];

    const url = `https://finnhub.io/api/v1/calendar/earnings?from=${fromStr}&to=${toStr}&symbol=${ticker}&token=${FINNHUB_KEY}`;
    const response = await axios.get(url, { timeout: 5000 });

    const earnings = response.data?.earningsCalendar || [];
    const filtered = earnings.filter(e => e.symbol === ticker);

    return res.json(filtered.map(e => ({
      date: e.date,
      hour: e.hour,
      epsEstimate: e.epsEstimate ?? null,
      epsActual: e.epsActual ?? null,
      surprise: e.epsEstimate && e.epsActual ? (e.epsActual - e.epsEstimate).toFixed(2) : null
    })));

  } catch (e) {
    console.warn(`[API] Finnhub Earnings Calendar failed for ${ticker}: ${e.message}`);
    return res.json([]);
  }
});

// --- Dividends (Finnhub) ---
app.get('/api/dividends/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  if (!FINNHUB_KEY) {
    return res.status(503).json({ error: 'FINNHUB_KEY not configured' });
  }

  try {
    console.log(`[API] Fetching Dividends for ${ticker}...`);
    const url = `https://finnhub.io/api/v1/stock/dividend?symbol=${ticker}&token=${FINNHUB_KEY}`;
    const response = await axios.get(url, { timeout: 5000 });

    const dividends = response.data || [];

    return res.json(dividends.slice(0, 8).map(d => ({
      date: d.date,
      amount: d.amount,
      recordDate: d.recordDate,
      paymentDate: d.paymentDate,
      frequency: d.frequency
    })));

  } catch (e) {
    console.warn(`[API] Finnhub Dividends failed for ${ticker}: ${e.message}`);
    return res.json([]);
  }
});

// --- Analyst Recommendations (Finnhub) ---
app.get('/api/recommendations/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();

  if (!FINNHUB_KEY) {
    return res.status(503).json({ error: 'FINNHUB_KEY not configured' });
  }

  try {
    console.log(`[API] Fetching Analyst Recommendations for ${ticker}...`);
    const url = `https://finnhub.io/api/v1/stock/recommendation?symbol=${ticker}&token=${FINNHUB_KEY}`;
    const response = await axios.get(url, { timeout: 5000 });

    const data = response.data || [];

    return res.json(data.map(d => ({
      date: d.period,
      buy: d.buy,
      hold: d.hold,
      sell: d.sell,
      strongBuy: d.strongBuy,
      strongSell: d.strongSell,
      total: d.buy + d.hold + d.sell + d.strongBuy + d.strongSell
    })));

  } catch (e) {
    console.warn(`[API] Finnhub Recommendations failed for ${ticker}: ${e.message}`);
    return res.json([]);
  }
});

// Shared StockTwits API helper — used by /api/stocktwits/:ticker and /api/whisper/:ticker fallback
const fetchStocktwitsFromApi = async (ticker, rapidApiKey) => {
  const STOCKTWITS_HOST = process.env.STOCKTWITS_RAPIDAPI_HOST || 'stocktwits.p.rapidapi.com';
  const url = `https://${STOCKTWITS_HOST}/streams/symbol/${ticker}.json?limit=30`;
  const response = await axios.get(url, {
    headers: {
      'x-rapidapi-key': rapidApiKey,
      'x-rapidapi-host': STOCKTWITS_HOST,
      'Content-Type': 'application/json'
    },
    timeout: 8000
  });

  const data = response.data;
  const messages = data?.messages || [];

  if (messages.length === 0) {
    return {
      status: 'no_data',
      message: `No StockTwits messages found for ${ticker}`
    };
  }

  let bullish = 0, bearish = 0, neutral = 0;
  messages.forEach(msg => {
    const sentiment = msg?.entities?.sentiment;
    if (sentiment) {
      if (sentiment.basic === 'Bullish') bullish++;
      else if (sentiment.basic === 'Bearish') bearish++;
    } else {
      neutral++;
    }
  });

  const total = bullish + bearish + neutral;
  const opinionated = bullish + bearish;

  let sentimentScore;
  if (opinionated > 0) {
    const bullishRatioOfOpinions = (bullish / opinionated) * 100;
    sentimentScore = Math.round(bullishRatioOfOpinions);
  } else {
    sentimentScore = 50;
  }

  let sentimentLabel;
  if (sentimentScore >= 70) sentimentLabel = 'Very Positive';
  else if (sentimentScore >= 55) sentimentLabel = 'Positive';
  else if (sentimentScore >= 45) sentimentLabel = 'Neutral';
  else if (sentimentScore >= 30) sentimentLabel = 'Negative';
  else sentimentLabel = 'Very Negative';

  return {
    ticker,
    overallScore: sentimentScore,
    sentimentLabel,
    sources: [{
      source: 'Stocktwits',
      score: sentimentScore,
      trend: bullish > bearish ? 'up' : bearish > bullish ? 'down' : 'flat',
      sentiment: bullish > bearish ? 'Bullish' : bearish > bullish ? 'Bearish' : 'Neutral',
      insight: `Based on ${total} recent messages: ${bullish} bullish, ${bearish} bearish`,
      stats: { bullish, bearish, neutral, total }
    }],
    summary: `StockTwits social sentiment for ${ticker}: numeric score ${sentimentScore}/100 based on ${total} messages.`,
    provider: 'StockTwits (RapidAPI)',
    fetchedAt: new Date().toISOString()
  };
};

// Whisper / Social Sentiment (Finnhub)
app.get('/api/whisper/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const buildWhisperResponse = ({
    status,
    reason,
    message,
    reddit = [],
    twitter = [],
    cached = false,
    provider = 'Finnhub',
  }) => ({
    ticker,
    status,
    reason,
    message,
    reddit,
    twitter,
    cached,
    fetchedAt: new Date().toISOString(),
    source: status === 'success' ? withCacheSourceLabel(provider, cached) : 'unavailable',
    provider,
  });

  const readWhisperCache = (cacheKey, provider) => {
    const cached = whisperCache.get(cacheKey);
    if (cached?.expiresAt > Date.now()) {
      return {
        ...cached.data,
        cached: true,
        source: cached.data.status === 'success' ? withCacheSourceLabel(provider, true) : 'unavailable',
      };
    }
    if (cached) whisperCache.delete(cacheKey);
    return null;
  };

  const writeWhisperCache = (cacheKey, payload) => {
    whisperCache.set(cacheKey, { data: payload, expiresAt: Date.now() + MARKET_DATA_TTL.whisper });
    return payload;
  };

  const classifyProviderError = (error) => {
    const statusCode = Number(error?.response?.status || error?.status || error?.code);
    const status = statusCode === 429
      ? 'rate_limited'
      : statusCode === 401
        ? 'forbidden'
        : statusCode === 403
          ? 'forbidden'
          : statusCode === 502 || statusCode === 503 || statusCode === 504
            ? 'unavailable'
            : 'error';
    const reasonByStatus = {
      rate_limited: 'rate_limited',
      forbidden_401: 'provider_auth_failed',
      forbidden_403: 'premium_required',
      unavailable: 'provider_unavailable',
      error: 'provider_error',
    };
    const reasonKey = status === 'forbidden'
      ? `forbidden_${statusCode}`
      : status;
    return {
      status,
      reason: reasonByStatus[reasonKey] || 'provider_error',
      message: error instanceof Error ? error.message : 'Failed to fetch social sentiment.',
    };
  };

  const fetchFinnhubWhisper = async () => {
    if (!FINNHUB_KEY) {
      return buildWhisperResponse({
        status: 'unavailable',
        reason: 'missing_key',
        message: 'FINNHUB_KEY is not configured.',
      });
    }

    const cacheKey = `finnhub:whisper:${ticker}`;
    const cached = readWhisperCache(cacheKey, 'Finnhub');
    if (cached) return cached;

    try {
      const url = `https://finnhub.io/api/v1/stock/social-sentiment?symbol=${encodeURIComponent(ticker)}&token=${FINNHUB_KEY}`;
      const response = await axios.get(url, { timeout: 5000 });
      const data = response.data;
      const hasData = (data?.reddit?.length || 0) > 0 || (data?.twitter?.length || 0) > 0;
      const payload = hasData
        ? buildWhisperResponse({
            status: 'success',
            reddit: data?.reddit || [],
            twitter: data?.twitter || [],
          })
        : buildWhisperResponse({
            status: 'unavailable',
            reason: 'no_social_data',
            message: 'Finnhub returned no Reddit or Twitter social sentiment for this ticker.',
          });
      return writeWhisperCache(cacheKey, payload);
    } catch (error) {
      return buildWhisperResponse({
        ...classifyProviderError(error),
        provider: 'Finnhub',
      });
    }
  };

  const finnhubResult = await fetchFinnhubWhisper();

  // Finnhub succeeded → return immediately
  if (finnhubResult.status === 'success') {
    return res.json(finnhubResult);
  }

  // --- Stocktwits fallback ---
  const stocktwitsCacheKey = `stocktwits:whisper:${ticker}`;
  const cachedStocktwits = readWhisperCache(stocktwitsCacheKey, 'StockTwits (RapidAPI)');
  if (cachedStocktwits) return res.json(cachedStocktwits);

  if (!process.env.RAPIDAPI_KEY) {
    return res.json(buildWhisperResponse({
      status: 'unavailable', reason: 'missing_key',
      message: 'RAPIDAPI_KEY not configured.', provider: 'StockTwits (RapidAPI)',
    }));
  }

  try {
    const stocktwitsResult = await fetchStocktwitsFromApi(ticker, process.env.RAPIDAPI_KEY);
    if (stocktwitsResult?.sources?.length > 0) {
      const payload = buildWhisperResponse({
        status: 'success',
        reddit: [],
        twitter: stocktwitsResult.sources.map(s => ({
          mention: s.stats?.total ?? 0,
          positiveMention: s.stats?.bullish ?? 0,
          negativeMention: s.stats?.bearish ?? 0,
        })),
        provider: 'StockTwits (RapidAPI)',
      });
      return res.json(writeWhisperCache(stocktwitsCacheKey, payload));
    }
    return res.json(buildWhisperResponse({
      status: 'unavailable', reason: 'no_social_data',
      message: 'No social sentiment from any provider.', provider: 'StockTwits (RapidAPI)',
    }));
  } catch (error) {
    return res.json(buildWhisperResponse({
      ...classifyProviderError(error), provider: 'StockTwits (RapidAPI)',
    }));
  }
});

// 4. Historical Data (Polygon / Alpaca)
app.get('/api/history/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  
  if (activeProvider === 'ALPACA') {
      try {
          console.log(`[API] Fetching History for ${ticker} via Alpaca...`);
          const toDate = new Date();
          const fromDate = new Date();
          fromDate.setFullYear(fromDate.getFullYear() - 1);

          const url = `https://data.alpaca.markets/v2/stocks/${ticker}/bars?start=${fromDate.toISOString()}&end=${toDate.toISOString()}&timeframe=1Day`;
          const response = await axios.get(url, {
              headers: {
                  'APCA-API-KEY-ID': ALPACA_KEY,
                  'APCA-API-SECRET-KEY': ALPACA_SECRET
              },
              timeout: 6000
          });

          if (response.data && response.data.bars) {
              const historical = response.data.bars.map(bar => ({
                  date: bar.t.split('T')[0],
                  open: bar.o,
                  high: bar.h,
                  low: bar.l,
                  close: bar.c,
                  volume: bar.v
              })).reverse();

              return res.json({
                  symbol: ticker,
                  historical
              });
          }
          throw new Error('No bars returned from Alpaca');
      } catch (e) {
          console.warn(`[API] Alpaca History failed for ${ticker}: ${e.message}`);
      }
  }

  if (activeProvider === 'MASSIVE' && MASSIVE_KEY) {
      try {
          console.log(`[API] Fetching History for ${ticker} via Massive...`);
          const toDate = new Date();
          const fromDate = new Date();
          fromDate.setFullYear(fromDate.getFullYear() - 2);

          // Polygon-style date format: YYYY-MM-DD
          const toStr = toDate.toISOString().split('T')[0];
          const fromStr = fromDate.toISOString().split('T')[0];

          const url = buildPolygonCompatibleUrl(`/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}`);
          const { data, cached } = await cachedMarketDataGet({
              cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:history:${ticker}`,
              ttlMs: MARKET_DATA_TTL.history,
              url,
              timeout: 6000,
          });

          if (data.results && data.results.length > 0) {
              const historical = data.results.map(bar => ({
                  date: new Date(bar.t).toISOString().split('T')[0],
                  open: bar.o,
                  high: bar.h,
                  low: bar.l,
                  close: bar.c,
                  volume: bar.v
              }));

              return res.json({
                  symbol: ticker,
                  historical,
                  source: withCacheSourceLabel(POLYGON_COMPATIBLE_PROVIDER, cached),
              });
          }
          throw new Error('No bars returned from Massive');
      } catch (e) {
          console.warn(`[API] Massive History failed for ${ticker}: ${e.message}`);
          if (e.providerStatus) {
              return sendMarketDataError(res, e);
          }
      }
  }

  try {
    console.log(`[API] Fetching History for ${ticker} via ${POLYGON_COMPATIBLE_PROVIDER}...`);
    if (!POLYGON_KEY) {
      console.warn('[API] MASSIVE_API_KEY/POLYGON_KEY not configured for history');
      return res.json({ symbol: ticker, historical: [] });
    }
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 2);
    
    const toStr = toDate.toISOString().split('T')[0];
    const fromStr = fromDate.toISOString().split('T')[0];

    const url = buildPolygonCompatibleUrl(`/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}`, {
        adjusted: true,
        sort: 'desc',
        limit: 5000,
    });
    
    const { data: responseData, cached } = await cachedMarketDataGet({
        cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:history:${ticker}`,
        ttlMs: MARKET_DATA_TTL.history,
        url,
        timeout: 6000,
    });
    
    if (responseData && responseData.results) {
        const historical = responseData.results.map(bar => ({
            date: new Date(bar.t).toISOString().split('T')[0],
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v
        }));

        return res.json({
            symbol: ticker,
            historical,
            source: withCacheSourceLabel(POLYGON_COMPATIBLE_PROVIDER, cached),
        });
    }

    throw new Error('No historical data returned');

  } catch (error) {
    console.error("History Fetch Error:", error.message);
    if (error.providerStatus) {
        return sendMarketDataError(res, error);
    }
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// 5. Feedback
app.post('/api/feedback', async (req, res) => {
  const { name, email, message } = req.body;
  if (!message || !email) return res.status(400).json({ error: 'Email and Message are required' });
  try {
    await saveFeedback(name, email, message);
    res.json({ success: true });
  } catch (error) {
    console.error("Feedback Save Error:", error);
    res.status(500).json({ error: 'Failed to save feedback' });
  }
});

// 6. Unified Access
app.post('/api/auth/access', async (req, res) => {
    if (!isReady()) return res.status(503).json({ error: 'System Initializing...' });
    const { username, email } = req.body;
    if (!username) return res.status(400).json({ error: 'Callsign required' });
    const normalizedEmail = email || `${username}@local.nux`;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        let user = await findUser(username);
        if (!user) await createUser(username, normalizedEmail, ip);
        const sessionId = crypto.randomUUID();
        await logUserLogin(username, sessionId, ip);
        res.json({ success: true, sessionId, username, loginTime: new Date().toISOString() });
    } catch (e) {
        console.error("Access Error", e);
        res.status(500).json({ error: 'Access denied. System error.' });
    }
});

// 7. Heartbeat
app.post('/api/auth/heartbeat', async (req, res) => {
    const { sessionId, username } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Session ID required' });
    try {
        await updateUserHeartbeat(sessionId, username);
        res.json({ success: true });
    } catch(e) {
        res.status(500).json({ error: 'Heartbeat failed' });
    }
});

// 8. Admin Logs
app.get('/api/admin/logs', async (req, res) => {
    const logs = await getAdminLogs();
    res.json(logs);
});

// 9. Admin Users
app.get('/api/admin/users', async (req, res) => {
    const users = await getRegisteredUsers();
    res.json(users);
});

// 10. EIA Energy Data
app.get('/api/macro/energy', async (req, res) => {
    if (!EIA_KEY) return res.status(400).json({ error: 'EIA API Key not configured' });
    
    try {
        console.log(`[API] Fetching Energy Data via EIA...`);
        // Example: Crude Oil Prices
        const url = `https://api.eia.gov/v2/steo/data/?api_key=${EIA_KEY}&frequency=monthly&data[]=value&facets[seriesId][]=WTREUUS&sort[0][column]=period&sort[0][direction]=desc&offset=0&length=12`;
        const response = await axios.get(url, { timeout: 5000 });
        res.json(response.data);
    } catch (e) {
        console.error(`[API] EIA failed: ${e.message}`);
        res.status(500).json({ error: 'Failed to fetch energy data' });
    }
});

// --- Alpaca Trading Routes ---

// Get Account Info
app.get('/api/trading/account', async (req, res) => {
    if (!ALPACA_KEY || !ALPACA_SECRET) {
        return res.status(400).json({ error: 'Alpaca API Keys not configured' });
    }

    try {
        const url = 'https://paper-api.alpaca.markets/v2/account';
        const response = await axios.get(url, {
            headers: {
                'APCA-API-KEY-ID': ALPACA_KEY,
                'APCA-API-SECRET-KEY': ALPACA_SECRET
            },
            timeout: 5000
        });
        res.json(response.data);
    } catch (e) {
        console.error(`[Trading] Account fetch failed: ${e.message}`);
        res.status(500).json({ error: 'Failed to fetch Alpaca account info' });
    }
});

// Get Market Clock
app.get('/api/trading/clock', async (req, res) => {
    if (!ALPACA_KEY || !ALPACA_SECRET) {
        return res.status(400).json({ error: 'Alpaca API Keys not configured' });
    }

    try {
        const url = 'https://paper-api.alpaca.markets/v2/clock';
        const response = await axios.get(url, {
            headers: {
                'APCA-API-KEY-ID': ALPACA_KEY,
                'APCA-API-SECRET-KEY': ALPACA_SECRET
            },
            timeout: 5000
        });
        res.json(response.data);
    } catch (e) {
        console.error(`[Trading] Clock fetch failed: ${e.message}`);
        res.status(500).json({ error: 'Failed to fetch market clock' });
    }
});

// Place Order
app.post('/api/trading/order', async (req, res) => {
    if (!ALPACA_KEY || !ALPACA_SECRET) {
        return res.status(400).json({ error: 'Alpaca API Keys not configured' });
    }

    const { symbol, qty, side, type, time_in_force, extended_hours } = req.body;

    try {
        const url = 'https://paper-api.alpaca.markets/v2/orders';
        const response = await axios.post(url, {
            symbol,
            qty: String(qty), // Alpaca prefers string for qty
            side,
            type,
            time_in_force,
            extended_hours: !!extended_hours
        }, {
            headers: {
                'APCA-API-KEY-ID': ALPACA_KEY,
                'APCA-API-SECRET-KEY': ALPACA_SECRET
            },
            timeout: 5000
        });
        res.json(response.data);
    } catch (e) {
        const alpacaError = e.response?.data?.message || e.message;
        console.error(`[Trading] Order placement failed: ${alpacaError}`);
        res.status(400).json({ error: alpacaError });
    }
});

// Get Positions
app.get('/api/trading/positions', async (req, res) => {
    if (!ALPACA_KEY || !ALPACA_SECRET) {
        return res.status(400).json({ error: 'Alpaca API Keys not configured' });
    }

    try {
        const url = 'https://paper-api.alpaca.markets/v2/positions';
        const response = await axios.get(url, {
            headers: {
                'APCA-API-KEY-ID': ALPACA_KEY,
                'APCA-API-SECRET-KEY': ALPACA_SECRET
            },
            timeout: 5000
        });
        res.json(response.data);
    } catch (e) {
        console.error(`[Trading] Positions fetch failed: ${e.message}`);
        res.status(500).json({ error: 'Failed to fetch Alpaca positions' });
    }
});

// --- Options Chain Helpers ---

// Retry wrapper with exponential backoff and 429 handling
async function fetchWithRetry(fn, { maxRetries = 2, baseDelay = 1000 } = {}) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            const status = error?.response?.status;
            if (status === 429) {
                const retryAfter = parseInt(error.response.headers['retry-after'] || '2', 10);
                console.warn(`[Retry] Rate limited, waiting ${retryAfter}s before retry ${attempt + 1}/${maxRetries}`);
                await new Promise(r => setTimeout(r, retryAfter * 1000));
            } else if (attempt < maxRetries) {
                const delay = baseDelay * Math.pow(2, attempt);
                console.warn(`[Retry] Attempt ${attempt + 1}/${maxRetries} failed: ${error.message}. Retrying in ${delay}ms`);
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
}

// Polygon.io options snapshot as fallback provider
async function fetchPolygonOptionsChain(ticker, expiration, currentPrice) {
    if (!POLYGON_KEY) return null;

    try {
        const expDate = new Date(`${expiration}T12:00:00Z`);
        const expStr = expDate.toISOString().split('T')[0];

        const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?expiration_date=${expStr}&limit=250&apiKey=${POLYGON_KEY}`;
        const response = await fetchWithRetry(
            () => axios.get(url, { timeout: 10000 }),
            { maxRetries: 1, baseDelay: 1000 }
        );

        const results = response.data?.results;
        if (!results || results.length === 0) return null;

        const calls = [];
        const puts = [];

        results.forEach((contract) => {
            const details = contract.details || {};
            const day = contract.day || {};
            const greeks = contract.greeks || {};
            const mapped = {
                strike: details.strike_price,
                type: details.contract_type,
                bid: day.bid || 0,
                ask: day.ask || 0,
                lastPrice: day.last?.price || contract.last_trade?.price || 0,
                theoreticalPrice: day.last?.price || contract.last_trade?.price || 0,
                volume: day.volume || 0,
                openInterest: contract.open_interest || 0,
                impliedVolatility: parseFloat(((greeks.implied_volatility || estimateIVForTicker(ticker)) * 100).toFixed(1)),
                inTheMoney: day.bid > 0 ? (details.contract_type === 'call' ? currentPrice > details.strike_price : currentPrice < details.strike_price) : false,
                contractSymbol: details.ticker || undefined,
                delta: greeks.delta,
                gamma: greeks.gamma,
                theta: greeks.theta,
                vega: greeks.vega,
            };
            if (details.contract_type === 'call') {
                calls.push(mapped);
            } else {
                puts.push(mapped);
            }
        });

        if (calls.length > 0 || puts.length > 0) {
            // Cache real ATM IV for future synthetic fallback
            const atmCall = calls.reduce((best, c) =>
                Math.abs(c.strike - currentPrice) < Math.abs(best.strike - currentPrice) ? c : best, calls[0]);
            if (atmCall) {
                tickerIVCache.set(ticker, atmCall.impliedVolatility / 100);
            }
            return { calls, puts, provider: 'Polygon.io' };
        }
    } catch (error) {
        console.warn(`[Options] Polygon.io fallback failed for ${ticker}: ${error.message}`);
    }

    return null;
}

// Cache for real ATM IV from successful chain fetches
const tickerIVCache = new Map();

function generateSimulatedExpirations() {
    // Generate OPEX-aware expiration dates: next 3 third Fridays + next 6 weekly Fridays
    const dates = [];
    const today = new Date();

    // Find next 9 Fridays
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + ((5 + 7 - today.getDay()) % 7));
    if (nextFriday <= today) nextFriday.setDate(nextFriday.getDate() + 7);

    for (let i = 0; i < 9; i++) {
        const d = new Date(nextFriday);
        d.setDate(d.getDate() + i * 7);
        dates.push(d.toISOString().split('T')[0]);
    }

    return dates;
}

function stdNormCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.39894228040 * Math.exp(-x * x / 2);
    const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
    return x > 0 ? 1 - p : p;
}

function generateSyntheticChain(ticker, currentPrice, volatility, expirationDate) {
    const now = new Date();
    const targetDate = new Date(expirationDate);
    const diffTime = Math.abs(targetDate.getTime() - now.getTime());
    const daysToExpiry = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const T = daysToExpiry / 365;
    const r = 0.05;

    let interval = 0.5;
    if (currentPrice > 20) interval = 1;
    if (currentPrice > 100) interval = 2.5;
    if (currentPrice > 200) interval = 5;
    if (currentPrice > 1000) interval = 10;

    const centerStrike = Math.round(currentPrice / interval) * interval;
    const numStrikes = 12;

    const calls = [];
    const puts = [];

    for (let i = -numStrikes; i <= numStrikes; i++) {
        const strike = parseFloat((centerStrike + (i * interval)).toFixed(2));
        if (strike <= 0) continue;

        const volatilitySkew = volatility * (1 + (Math.pow(Math.abs(i) / numStrikes, 2) * 0.2));

        // Black-Scholes call
        const d1 = (Math.log(currentPrice / strike) + (r + volatilitySkew * volatilitySkew / 2) * T) / (volatilitySkew * Math.sqrt(T));
        const d2 = d1 - volatilitySkew * Math.sqrt(T);

        const callTheo = Math.max(0, currentPrice * stdNormCDF(d1) - strike * Math.exp(-r * T) * stdNormCDF(d2));
        const callBid = parseFloat((callTheo * 0.95).toFixed(2));
        const callAsk = parseFloat((callTheo * 1.05).toFixed(2));

        calls.push({
            strike,
            type: 'call',
            bid: callBid,
            ask: callAsk,
            lastPrice: callTheo,
            theoreticalPrice: callTheo,
            volume: Math.floor(Math.random() * 5000 * (1 - Math.abs(i) / numStrikes)) + 100,
            openInterest: Math.floor(Math.random() * 10000) + 500,
            impliedVolatility: parseFloat((volatilitySkew * 100).toFixed(1)),
            inTheMoney: currentPrice > strike,
        });

        // Put via put-call parity
        const putTheo = Math.max(0, callTheo - currentPrice + strike * Math.exp(-r * T));
        const putBid = parseFloat((putTheo * 0.95).toFixed(2));
        const putAsk = parseFloat((putTheo * 1.05).toFixed(2));

        puts.push({
            strike,
            type: 'put',
            bid: putBid,
            ask: putAsk,
            lastPrice: putTheo,
            theoreticalPrice: putTheo,
            volume: Math.floor(Math.random() * 5000 * (1 - Math.abs(i) / numStrikes)) + 100,
            openInterest: Math.floor(Math.random() * 10000) + 500,
            impliedVolatility: parseFloat((volatilitySkew * 100).toFixed(1)),
            inTheMoney: currentPrice < strike,
        });
    }

    return { calls, puts };
}

function estimateIVForTicker(ticker) {
    // Check cache first for real ATM IV from successful chain fetches
    if (tickerIVCache.has(ticker)) return tickerIVCache.get(ticker);

    // Sector defaults for fallback when ticker not in explicit map
    const sectorDefaults = {
        technology: 0.35, financials: 0.25, healthcare: 0.30,
        energy: 0.40, consumer: 0.28, industrials: 0.28,
        utilities: 0.20, realestate: 0.22, materials: 0.30,
        communication: 0.30,
    };

    const ivMap = {
        // S&P 500 top constituents
        'SPY': 0.12, 'IVV': 0.12, 'VOO': 0.12,
        'QQQ': 0.18, 'IWM': 0.22, 'DIA': 0.14,
        // Mega-cap Tech
        'AAPL': 0.18, 'MSFT': 0.19, 'GOOGL': 0.22, 'GOOG': 0.22,
        'AMZN': 0.25, 'NVDA': 0.40, 'META': 0.30, 'TSLA': 0.45,
        'NFLX': 0.35, 'AMD': 0.38, 'INTC': 0.30, 'CRM': 0.32,
        'ADBE': 0.30, 'ORCL': 0.28, 'NOW': 0.35, 'IBM': 0.22,
        'CSCO': 0.22, 'QCOM': 0.32, 'TXN': 0.26, 'AVGO': 0.35,
        // Financials
        'JPM': 0.22, 'BAC': 0.24, 'WFC': 0.26, 'GS': 0.27,
        'MS': 0.28, 'C': 0.28, 'BLK': 0.24, 'AXP': 0.25,
        'V': 0.18, 'MA': 0.18, 'BRK.B': 0.15, 'SCHW': 0.28,
        // Healthcare
        'JNJ': 0.18, 'UNH': 0.20, 'PFE': 0.22, 'MRK': 0.20,
        'ABBV': 0.22, 'LLY': 0.24, 'TMO': 0.24, 'ABT': 0.22,
        'DHR': 0.24, 'BMY': 0.22, 'AMGN': 0.24, 'GILD': 0.24,
        // Consumer
        'COST': 0.20, 'WMT': 0.16, 'HD': 0.22, 'MCD': 0.18,
        'NKE': 0.26, 'SBUX': 0.26, 'DIS': 0.28, 'TGT': 0.24,
        'LOW': 0.24, 'PG': 0.16, 'KO': 0.15, 'PEP': 0.15,
        // Industrials & Energy
        'CAT': 0.28, 'BA': 0.32, 'GE': 0.28, 'HON': 0.22,
        'UPS': 0.22, 'RTX': 0.24, 'LMT': 0.20, 'XOM': 0.24,
        'CVX': 0.24, 'COP': 0.28, 'EOG': 0.30, 'SLB': 0.32,
        // Communication Services
        'TMUS': 0.20, 'VZ': 0.18, 'T': 0.20, 'CMCSA': 0.22,
        // Meme / High IV
        'COIN': 0.65, 'GME': 0.80, 'AMC': 0.90, 'SPCE': 0.70,
        'PLTR': 0.50, 'RIVN': 0.55, 'LCID': 0.60,
        // Major ETFs
        'XLF': 0.20, 'XLK': 0.24, 'XLE': 0.28, 'XLV': 0.18,
        'XLI': 0.22, 'XLY': 0.24, 'XLP': 0.16, 'XLU': 0.16,
        'XLB': 0.24, 'XLRE': 0.22, 'SMH': 0.32, 'SOXX': 0.32,
        'ARKK': 0.45, 'TQQQ': 0.55, 'SQQQ': 0.55,
        // Popular names
        'UBER': 0.35, 'LYFT': 0.40, 'SNAP': 0.42, 'PYPL': 0.32,
        'SQ': 0.38, 'ZM': 0.35, 'SHOP': 0.38, 'SNOW': 0.40,
        'DDOG': 0.38, 'CRWD': 0.38, 'NET': 0.40, 'MDB': 0.38,
        'PANW': 0.30, 'FTNT': 0.30, 'ZS': 0.35, 'OKTA': 0.35,
    };

    if (ivMap[ticker]) return ivMap[ticker];

    // Per-sector defaults
    const tickerFirstChar = ticker.charAt(0);
    if (['X', 'V', 'M', 'P', 'G', 'F'].includes(tickerFirstChar)) return sectorDefaults.financials;
    return 0.25;
}

function getSimulatedPrice(ticker) {
    const hash = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return (hash % 500) + 50;
}

function roundMetric(value, digits = 4) {
    if (!Number.isFinite(value)) return 0;
    return Number(value.toFixed(digits));
}

function standardNormalPdf(x) {
    return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function calculateGreeksForChain(type, S, K, T, r, sigma) {
    if (S <= 0 || K <= 0 || T <= 0 || sigma <= 0) {
        return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };
    }

    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;
    const nd1 = stdNormCDF(d1);
    const nd2 = stdNormCDF(d2);
    const nNegD2 = stdNormCDF(-d2);
    const nPrimeD1 = standardNormalPdf(d1);
    const gamma = nPrimeD1 / (S * sigma * sqrtT);
    const vega = (S * sqrtT * nPrimeD1) / 100;

    if (type === 'call') {
        return {
            delta: nd1,
            gamma,
            theta: (-(S * nPrimeD1 * sigma) / (2 * sqrtT) - r * K * Math.exp(-r * T) * nd2) / 365,
            vega,
            rho: (K * T * Math.exp(-r * T) * nd2) / 100,
        };
    }

    return {
        delta: nd1 - 1,
        gamma,
        theta: (-(S * nPrimeD1 * sigma) / (2 * sqrtT) + r * K * Math.exp(-r * T) * nNegD2) / 365,
        vega,
        rho: (-K * T * Math.exp(-r * T) * nNegD2) / 100,
    };
}

function computeMaxPain(calls, puts) {
    const strikes = [...new Set([...calls, ...puts].map((contract) => contract.strike))].sort((a, b) => a - b);
    if (strikes.length === 0) return 0;

    let bestStrike = strikes[0];
    let bestLoss = Number.POSITIVE_INFINITY;

    strikes.forEach((settleStrike) => {
        let loss = 0;
        calls.forEach((call) => {
            loss += Math.max(0, settleStrike - call.strike) * (call.openInterest || 0);
        });
        puts.forEach((put) => {
            loss += Math.max(0, put.strike - settleStrike) * (put.openInterest || 0);
        });
        if (loss < bestLoss) {
            bestLoss = loss;
            bestStrike = settleStrike;
        }
    });

    return bestStrike;
}

function buildStandardizedChain(payload) {
    const rate = payload.rate ?? 0.05;
    const dividendYield = payload.dividendYield ?? 0;
    const isSynthetic = Boolean(payload.isSynthetic || payload.source === 'Simulation' || payload.provider === 'Simulation');
    const expDate = new Date(`${payload.selectedExpiration}T12:00:00Z`);
    const dte = Math.max(1, Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
    const maxVolume = Math.max(1, ...payload.calls.map((contract) => contract.volume || 0), ...payload.puts.map((contract) => contract.volume || 0));
    const maxOpenInterest = Math.max(1, ...payload.calls.map((contract) => contract.openInterest || 0), ...payload.puts.map((contract) => contract.openInterest || 0));

    const normalizeContract = (contract) => {
        const bid = Number(contract.bid || 0);
        const ask = Number(contract.ask || 0);
        const lastPrice = Number(contract.lastPrice || 0);
        const midRaw = bid > 0 && ask > 0 ? (bid + ask) / 2 : lastPrice;
        const mid = roundMetric(midRaw, 2);
        const spread = roundMetric(Math.max(0, ask - bid), 2);
        const spreadPct = roundMetric(spread / Math.max(mid, 0.01), 4);
        const intrinsicValue = roundMetric(
            contract.type === 'call'
                ? Math.max(0, payload.currentPrice - contract.strike)
                : Math.max(0, contract.strike - payload.currentPrice),
            2
        );
        const greeks = calculateGreeksForChain(
            contract.type,
            payload.currentPrice,
            contract.strike,
            Math.max(dte / 365, 0.0001),
            rate,
            Math.max((contract.impliedVolatility || 0) / 100, 0.0001)
        );
        const volumeRatio = (contract.volume || 0) / maxVolume;
        const oiRatio = (contract.openInterest || 0) / maxOpenInterest;
        const spreadPenalty = 1 - Math.min(Math.max(spreadPct, 0), 1);
        return {
            ...contract,
            bid,
            ask,
            lastPrice,
            theoreticalPrice: Number(contract.theoreticalPrice || mid),
            mid,
            mark: mid,
            spread,
            spreadPct,
            dte,
            moneynessPct: roundMetric((contract.strike - payload.currentPrice) / Math.max(payload.currentPrice, 0.01), 4),
            intrinsicValue,
            extrinsicValue: roundMetric(Math.max(0, mid - intrinsicValue), 2),
            breakeven: roundMetric(contract.type === 'call' ? contract.strike + mid : contract.strike - mid, 2),
            delta: roundMetric(greeks.delta, 4),
            gamma: roundMetric(greeks.gamma, 6),
            theta: roundMetric(greeks.theta, 4),
            vega: roundMetric(greeks.vega, 4),
            rho: roundMetric(greeks.rho, 4),
            quoteTime: contract.quoteTime || payload.fetchedAt,
            lastTradeTime: contract.lastTradeTime || payload.fetchedAt,
            isSynthetic,
            liquidityScore: roundMetric(Math.min(Math.max((volumeRatio * 0.45) + (oiRatio * 0.4) + (spreadPenalty * 0.15), 0), 1), 4),
        };
    };

    const calls = [...payload.calls].map(normalizeContract).sort((a, b) => a.strike - b.strike);
    const puts = [...payload.puts].map(normalizeContract).sort((a, b) => a.strike - b.strike);
    const strikes = [...new Set([...calls, ...puts].map((contract) => contract.strike))].sort((a, b) => a - b);

    const placeholder = (strike, type) => ({
        strike,
        type,
        bid: 0,
        ask: 0,
        lastPrice: 0,
        theoreticalPrice: 0,
        volume: 0,
        openInterest: 0,
        impliedVolatility: 0,
        inTheMoney: type === 'call' ? payload.currentPrice > strike : payload.currentPrice < strike,
        mid: 0,
        mark: 0,
        spread: 0,
        spreadPct: 0,
        dte,
        moneynessPct: roundMetric((strike - payload.currentPrice) / Math.max(payload.currentPrice, 0.01), 4),
        intrinsicValue: type === 'call' ? Math.max(0, payload.currentPrice - strike) : Math.max(0, strike - payload.currentPrice),
        extrinsicValue: 0,
        breakeven: strike,
        delta: 0,
        gamma: 0,
        theta: 0,
        vega: 0,
        rho: 0,
        isSynthetic: true,
        liquidityScore: 0,
    });

    const callMap = new Map(calls.map((contract) => [contract.strike, contract]));
    const putMap = new Map(puts.map((contract) => [contract.strike, contract]));
    const rows = strikes.map((strike) => {
        const moneynessPct = roundMetric((strike - payload.currentPrice) / Math.max(payload.currentPrice, 0.01), 4);
        const callContract = callMap.get(strike) || placeholder(strike, 'call');
        const putContract = putMap.get(strike) || placeholder(strike, 'put');
        const gex = roundMetric(
            (callContract.gamma || 0) * (callContract.openInterest || 0)
            - (putContract.gamma || 0) * (putContract.openInterest || 0),
            2
        );
        return {
            strike,
            dte,
            moneynessPct,
            isAtm: Math.abs(moneynessPct) <= 0.01,
            call: callContract,
            put: putContract,
            gex,
        };
    });

    const totalCallVolume = rows.reduce((sum, row) => sum + (row.call.volume || 0), 0);
    const totalPutVolume = rows.reduce((sum, row) => sum + (row.put.volume || 0), 0);
    const totalCallOpenInterest = rows.reduce((sum, row) => sum + (row.call.openInterest || 0), 0);
    const totalPutOpenInterest = rows.reduce((sum, row) => sum + (row.put.openInterest || 0), 0);
    const atmRow = rows.reduce((closest, row) => {
        if (!closest) return row;
        return Math.abs(row.strike - payload.currentPrice) < Math.abs(closest.strike - payload.currentPrice) ? row : closest;
    }, null);
    const aggregateStats = {
        totalCallVolume,
        totalPutVolume,
        totalCallOpenInterest,
        totalPutOpenInterest,
        putCallVolumeRatio: roundMetric(totalPutVolume / Math.max(totalCallVolume, 1), 4),
        putCallOiRatio: roundMetric(totalPutOpenInterest / Math.max(totalCallOpenInterest, 1), 4),
        atmIv: atmRow ? roundMetric(((atmRow.call.impliedVolatility || 0) + (atmRow.put.impliedVolatility || 0)) / 2, 2) : 0,
        expectedMove: atmRow ? roundMetric((atmRow.call.mid || 0) + (atmRow.put.mid || 0), 2) : 0,
        maxPain: computeMaxPain(calls, puts),
        netGammaExposure: roundMetric(rows.reduce((sum, row) => {
            const callGex = (row.call.gamma || 0) * (row.call.openInterest || 0) * Math.pow(payload.currentPrice, 2) * 100;
            const putGex = (row.put.gamma || 0) * (row.put.openInterest || 0) * Math.pow(payload.currentPrice, 2) * 100;
            return sum + callGex - putGex;
        }, 0), 2),
    };

    const atmStrike = atmRow ? atmRow.strike : payload.currentPrice;

    return {
        ...payload,
        calls,
        puts,
        rows,
        provider: payload.provider || payload.source || 'Simulation',
        asOf: payload.asOf || payload.fetchedAt || new Date().toISOString(),
        isDelayed: payload.isDelayed ?? false,
        isSynthetic,
        rate,
        dividendYield,
        atmStrike,
        expectedMove: aggregateStats.expectedMove,
        putCallVolumeRatio: aggregateStats.putCallVolumeRatio,
        putCallOiRatio: aggregateStats.putCallOiRatio,
        maxPain: aggregateStats.maxPain,
        aggregateStats,
        source: payload.source || payload.provider || 'Simulation',
        fetchedAt: payload.fetchedAt || new Date().toISOString(),
        priceSource: payload.priceSource || (isSynthetic ? 'simulated' : 'real'),
        rateLimited: payload.rateLimited || false,
    };
}

// --- Options Chain API Routes ---

// GET /api/options/expirations/:ticker
app.get('/api/options/expirations/:ticker', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `yh:expirations:${ticker}`;

    // Check cache
    const cached = optionsExpirationsCache.get(cacheKey);
    if (cached?.expiresAt > Date.now()) {
        return res.json({ ...cached.data, cached: true });
    }
    if (cached) optionsExpirationsCache.delete(cacheKey);

    // If no RapidAPI key, fallback to simulation
    if (!RAPIDAPI_KEY) {
        const expirations = generateSimulatedExpirations();
        const payload = {
            ticker,
            expirations,
            source: 'Simulation',
            cached: false,
        };
        setCached(optionsExpirationsCache, cacheKey, { data: payload, expiresAt: Date.now() + OPTIONS_TTL.expirations });
        return res.json(payload);
    }

    try {
        const url = `https://${YAHOO_FINANCE_RAPIDAPI_HOST}/stock/v2/get-summary?symbol=${encodeURIComponent(ticker)}&region=US`;
        const response = await axios.get(url, {
            headers: {
                'x-rapidapi-key': RAPIDAPI_KEY,
                'x-rapidapi-host': YAHOO_FINANCE_RAPIDAPI_HOST,
            },
            timeout: 8000,
        });

        const data = response.data;
        let expirations = [];

        // Extract expiration dates from summary response
        if (data?.summaryDetail?.expirationDate) {
            const d = new Date(data.summaryDetail.expirationDate * 1000);
            expirations.push(d.toISOString().split('T')[0]);
        }
        if (data?.optionExpirationDates?.length > 0) {
            expirations = data.optionExpirationDates.map(d => {
                const dt = new Date(d * 1000);
                return dt.toISOString().split('T')[0];
            });
        }
        if (expirations.length === 0) {
            // Fallback: generate simulated
            expirations = generateSimulatedExpirations();
        }

        const payload = {
            ticker,
            expirations: expirations.sort(),
            source: 'Yahoo Finance',
            cached: false,
        };
        setCached(optionsExpirationsCache, cacheKey, { data: payload, expiresAt: Date.now() + OPTIONS_TTL.expirations });
        return res.json(payload);
    } catch (error) {
        console.warn(`[Options] Failed to fetch expirations for ${ticker}:`, error.message);
        // Fallback to simulated
        const expirations = generateSimulatedExpirations();
        const payload = {
            ticker,
            expirations,
            source: 'Simulation',
            cached: false,
        };
        setCached(optionsExpirationsCache, cacheKey, { data: payload, expiresAt: Date.now() + OPTIONS_TTL.expirations });
        return res.json(payload);
    }
});

// GET /api/options/chain/:ticker?expiration=YYYY-MM-DD
app.get('/api/options/chain/:ticker', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const expiration = req.query.expiration;
    const cacheKey = `yh:chain:${ticker}:${expiration || 'default'}`;

    // Check cache
    const cached = optionsChainCache.get(cacheKey);
    if (cached?.expiresAt > Date.now()) {
        return res.json({ ...cached.data, cached: true, fetchedAt: cached.data.fetchedAt });
    }
    if (cached) optionsChainCache.delete(cacheKey);

    // Determine current price and IV - prefer real data, fall back to simulated
    const volatility = estimateIVForTicker(ticker);
    let currentPrice = null;
    let priceSource = 'simulated';

    // Try to get real price from our quote cache
    try {
        const quoteUrl = buildPolygonCompatibleUrl(`/v2/aggs/ticker/${ticker}/prev`, { adjusted: true });
        const quoteResp = await cachedMarketDataGet({
            cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:quote:${ticker}`,
            ttlMs: MARKET_DATA_TTL.quote,
            url: quoteUrl,
            timeout: 5000,
        });
        if (quoteResp?.data?.results?.[0]?.c) {
            currentPrice = quoteResp.data.results[0].c;
            priceSource = 'real';
        }
    } catch (_) {
        // Will fall back to simulated only if chain also fails
    }

    // Generate expiration dates
    let expirations = generateSimulatedExpirations();
    const selectedExpiration = expiration || expirations[0];

    // Fall back to simulated price only if no real quote available
    if (currentPrice === null) {
        currentPrice = getSimulatedPrice(ticker);
        priceSource = 'simulated';
    }

    try {
        let calls = [];
        let puts = [];
        let chainProvider = 'Simulation';
        let isSynthetic = true;

        // Try Yahoo RapidAPI first
        if (RAPIDAPI_KEY) {
            try {
                const [expYear, expMonth, expDay] = selectedExpiration.split('-').map(Number);
                const expDate = new Date(Date.UTC(expYear, expMonth - 1, expDay, 12, 0, 0));
                const unixTs = Math.floor(expDate.getTime() / 1000);

                const url = `https://${YAHOO_FINANCE_RAPIDAPI_HOST}/stock/v2/get-options?symbol=${encodeURIComponent(ticker)}&date=${unixTs}`;
                const response = await fetchWithRetry(
                    () => axios.get(url, {
                        headers: {
                            'x-rapidapi-key': RAPIDAPI_KEY,
                            'x-rapidapi-host': YAHOO_FINANCE_RAPIDAPI_HOST,
                        },
                        timeout: 8000,
                    }),
                    { maxRetries: 2, baseDelay: 1000 }
                );

                const data = response.data;
                const result = data?.optionChain?.result?.[0];
                const quote = result?.quote;
                const options = result?.options?.[0];

                if (quote?.regularMarketPrice) {
                    currentPrice = quote.regularMarketPrice;
                    priceSource = 'real';
                }

                if (quote?.expirationDates?.length > 0) {
                    expirations = quote.expirationDates.map(d => {
                        const dt = new Date(d * 1000);
                        return dt.toISOString().split('T')[0];
                    }).sort();
                }

                const yahooCalls = (options?.calls || []).map(c => ({
                    strike: c.strike,
                    type: 'call',
                    bid: c.bid || 0,
                    ask: c.ask || 0,
                    lastPrice: c.lastPrice || 0,
                    theoreticalPrice: c.lastPrice || 0,
                    volume: c.volume || 0,
                    openInterest: c.openInterest || 0,
                    impliedVolatility: parseFloat(((c.impliedVolatility || volatility) * 100).toFixed(1)),
                    inTheMoney: c.inTheMoney || (currentPrice > c.strike),
                    contractSymbol: c.contractSymbol || undefined,
                }));

                const yahooPuts = (options?.puts || []).map(p => ({
                    strike: p.strike,
                    type: 'put',
                    bid: p.bid || 0,
                    ask: p.ask || 0,
                    lastPrice: p.lastPrice || 0,
                    theoreticalPrice: p.lastPrice || 0,
                    volume: p.volume || 0,
                    openInterest: p.openInterest || 0,
                    impliedVolatility: parseFloat(((p.impliedVolatility || volatility) * 100).toFixed(1)),
                    inTheMoney: p.inTheMoney || (currentPrice < p.strike),
                    contractSymbol: p.contractSymbol || undefined,
                }));

                if (yahooCalls.length > 0 || yahooPuts.length > 0) {
                    calls = yahooCalls;
                    puts = yahooPuts;
                    chainProvider = 'Yahoo Finance';
                    isSynthetic = false;
                    // Cache ATM IV from real data
                    const atmCall = yahooCalls.reduce((best, c) =>
                        Math.abs(c.strike - currentPrice) < Math.abs(best.strike - currentPrice) ? c : best, yahooCalls[0]);
                    if (atmCall) tickerIVCache.set(ticker, atmCall.impliedVolatility / 100);
                }
            } catch (yahooError) {
                const status = yahooError?.response?.status;
                if (status === 429) {
                    console.warn(`[Options] Yahoo rate limited for ${ticker}, trying Polygon.io fallback`);
                } else {
                    console.warn(`[Options] Yahoo fetch failed for ${ticker}: ${yahooError.message}, trying Polygon.io fallback`);
                }
            }
        }

        // Try Polygon.io as fallback
        if (isSynthetic && POLYGON_KEY) {
            const polygonResult = await fetchPolygonOptionsChain(ticker, selectedExpiration, currentPrice);
            if (polygonResult) {
                calls = polygonResult.calls;
                puts = polygonResult.puts;
                chainProvider = 'Polygon.io';
                isSynthetic = false;
                // Update currentPrice from real quote if we have contracts near ATM
                const atmStrike = currentPrice;
                if (priceSource !== 'real' && polygonResult.calls.length > 0) {
                    // Keep the best price we have
                }
            }
        }

        // Fall back to synthetic if both providers failed
        if (isSynthetic) {
            console.warn(`[Options] All providers failed for ${ticker}, using synthetic chain`);
            const synth = generateSyntheticChain(ticker, currentPrice, volatility, selectedExpiration);
            calls = synth.calls;
            puts = synth.puts;
        }

        const payload = buildStandardizedChain({
            symbol: ticker,
            currentPrice,
            expirations,
            selectedExpiration,
            calls,
            puts,
            provider: chainProvider,
            isSynthetic,
            rate: 0.05,
            dividendYield: 0,
            source: chainProvider,
            cached: false,
            fetchedAt: new Date().toISOString(),
            priceSource,
        });
        setCached(optionsChainCache, cacheKey, { data: payload, expiresAt: Date.now() + OPTIONS_TTL.chain });
        return res.json(payload);
    } catch (error) {
        console.warn(`[Options] Failed to fetch chain for ${ticker}:`, error.message);
        const status = error?.response?.status;
        // Fallback to synthetic
        if (currentPrice === null) currentPrice = getSimulatedPrice(ticker);
        const { calls, puts } = generateSyntheticChain(ticker, currentPrice, volatility, selectedExpiration);
        const payload = buildStandardizedChain({
            symbol: ticker,
            currentPrice,
            expirations,
            selectedExpiration,
            calls,
            puts,
            provider: 'Simulation',
            isSynthetic: true,
            rate: 0.05,
            dividendYield: 0,
            source: 'Simulation',
            cached: false,
            fetchedAt: new Date().toISOString(),
            priceSource: 'simulated',
            rateLimited: status === 429,
        });
        setCached(optionsChainCache, cacheKey, { data: payload, expiresAt: Date.now() + OPTIONS_TTL.chain });
        return res.json(payload);
    }
});

// Helpers
function generateSimulatedQuote(ticker, source = 'Simulation') {
    const hash = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const basePrice = (hash % 500) + 50; 
    return {
      symbol: ticker,
      price: basePrice + (Math.random() * 5),
      change: 1.25,
      changePercent: 0.85,
      source: source
    };
}

// Initialize DB then Start Server
initDB().then(async () => {
// GET /api/options/term-structure/:ticker - lightweight endpoint per expiration
app.get('/api/options/term-structure/:ticker', async (req, res) => {
    const ticker = req.params.ticker.toUpperCase();
    const cacheKey = `term-structure:${ticker}`;

    const cached = optionsChainCache.get(cacheKey);
    if (cached?.expiresAt > Date.now()) {
        return res.json({ ...cached.data, cached: true });
    }
    if (cached) optionsChainCache.delete(cacheKey);

    try {
        let expirations = [];
        let currentPrice = null;

        // Get price
        try {
            const quoteUrl = buildPolygonCompatibleUrl(`/v2/aggs/ticker/${ticker}/prev`, { adjusted: true });
            const quoteResp = await cachedMarketDataGet({
                cacheKey: `${POLYGON_COMPATIBLE_PROVIDER}:quote:${ticker}`,
                ttlMs: MARKET_DATA_TTL.quote,
                url: quoteUrl,
                timeout: 5000,
            });
            if (quoteResp?.data?.results?.[0]?.c) {
                currentPrice = quoteResp.data.results[0].c;
            }
        } catch (_) {}

        if (!currentPrice) currentPrice = getSimulatedPrice(ticker);

        // Get expirations
        if (RAPIDAPI_KEY) {
            try {
                const url = `https://${YAHOO_FINANCE_RAPIDAPI_HOST}/stock/v2/get-summary?symbol=${encodeURIComponent(ticker)}&region=US`;
                const response = await fetchWithRetry(
                    () => axios.get(url, {
                        headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': YAHOO_FINANCE_RAPIDAPI_HOST },
                        timeout: 8000,
                    }),
                    { maxRetries: 1, baseDelay: 1000 }
                );
                const data = response.data;
                if (data?.optionExpirationDates?.length > 0) {
                    expirations = data.optionExpirationDates.map(d => {
                        const dt = new Date(d * 1000);
                        return dt.toISOString().split('T')[0];
                    }).sort();
                }
            } catch (_) {}
        }

        if (expirations.length === 0) {
            expirations = generateSimulatedExpirations();
        }

        // Build term structure: one ATM IV per expiration
        const volatility = estimateIVForTicker(ticker);
        const results = await Promise.all(expirations.slice(0, 12).map(async (exp) => {
            const d = new Date(`${exp}T12:00:00Z`);
            const dte = Math.max(1, Math.ceil((d.getTime() - Date.now()) / 86400000));

            try {
                const [expYear, expMonth, expDay] = exp.split('-').map(Number);
                const expDate = new Date(Date.UTC(expYear, expMonth - 1, expDay, 12, 0, 0));
                const unixTs = Math.floor(expDate.getTime() / 1000);

                if (RAPIDAPI_KEY) {
                    const url = `https://${YAHOO_FINANCE_RAPIDAPI_HOST}/stock/v2/get-options?symbol=${encodeURIComponent(ticker)}&date=${unixTs}`;
                    const response = await fetchWithRetry(
                        () => axios.get(url, {
                            headers: { 'x-rapidapi-key': RAPIDAPI_KEY, 'x-rapidapi-host': YAHOO_FINANCE_RAPIDAPI_HOST },
                            timeout: 6000,
                        }),
                        { maxRetries: 0, baseDelay: 500 }
                    );
                    const data = response.data;
                    const options = data?.optionChain?.result?.[0]?.options?.[0];
                    const calls = options?.calls || [];
                    const puts = options?.puts || [];

                    if (calls.length > 0) {
                        // Find ATM IV
                        const atmCall = calls.reduce((best, c) =>
                            Math.abs(c.strike - currentPrice) < Math.abs(best.strike - currentPrice) ? c : best, calls[0]);
                        const atmPut = puts.reduce((best, p) =>
                            Math.abs(p.strike - currentPrice) < Math.abs(best.strike - currentPrice) ? p : best, puts[0]);
                        const atmIv = ((atmCall.impliedVolatility || volatility) + (atmPut?.impliedVolatility || volatility)) / 2 * 100;
                        const expectedMove = (atmCall.bid || atmCall.lastPrice || 0) + (atmPut?.bid || atmPut?.lastPrice || 0);

                        return { expiration: exp, dte, atmIv: parseFloat(atmIv.toFixed(2)), expectedMove: parseFloat(expectedMove.toFixed(2)) };
                    }
                }
            } catch (_) {}

            // Fallback: estimate from our IV map
            const em = currentPrice * volatility * Math.sqrt(dte / 365);
            return {
                expiration: exp,
                dte,
                atmIv: parseFloat((volatility * 100).toFixed(2)),
                expectedMove: parseFloat(em.toFixed(2)),
            };
        }));

        const payload = {
            ticker,
            termStructure: results.sort((a, b) => a.dte - b.dte),
            source: RAPIDAPI_KEY ? 'Yahoo Finance' : 'Simulation',
        };
        setCached(optionsChainCache, cacheKey, { data: payload, expiresAt: Date.now() + OPTIONS_TTL.chain });
        return res.json(payload);
    } catch (error) {
        console.warn(`[Options] Term structure failed for ${ticker}:`, error.message);
        return res.status(500).json({ error: 'Failed to fetch term structure' });
    }
});

    // Vite middleware for development
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
});
}

startServer();
