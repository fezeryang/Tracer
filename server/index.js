
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

// StockTwits Social Sentiment via RapidAPI
app.get('/api/stocktwits/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;
  const STOCKTWITS_HOST = process.env.STOCKTWITS_RAPIDAPI_HOST || 'stocktwits.p.rapidapi.com';

  if (!RAPIDAPI_KEY) {
    return res.status(400).json({
      status: 'unavailable',
      reason: 'missing_key',
      message: 'RAPIDAPI_KEY is not configured.'
    });
  }

  try {
    // Official endpoint: /streams/symbol/{ticker}.json
    const url = `https://${STOCKTWITS_HOST}/streams/symbol/${ticker}.json?limit=30`;
    const response = await axios.get(url, {
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': STOCKTWITS_HOST,
        'Content-Type': 'application/json'
      },
      timeout: 8000
    });

    const data = response.data;
    const messages = data?.messages || [];

    if (messages.length === 0) {
      return res.json({
        status: 'no_data',
        message: `No StockTwits messages found for ${ticker}`
      });
    }

    // Calculate Bullish/Bearish statistics
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

    // Improved scoring: base on opinionated sentiment (bullish % of those who expressed opinion)
    // This gives a clearer signal from actual traders vs neutral posts
    let sentimentScore;
    if (opinionated > 0) {
      const bullishRatioOfOpinions = (bullish / opinionated) * 100;
      sentimentScore = Math.round(bullishRatioOfOpinions);
    } else {
      // If no one expressed opinion, default to neutral
      sentimentScore = 50;
    }

    // Map to WhisperData sentimentLabel format
    let sentimentLabel;
    if (sentimentScore >= 70) sentimentLabel = 'Strong Buy';
    else if (sentimentScore >= 55) sentimentLabel = 'Buy';
    else if (sentimentScore >= 45) sentimentLabel = 'Hold';
    else if (sentimentScore >= 30) sentimentLabel = 'Sell';
    else sentimentLabel = 'Strong Sell';

    res.json({
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
      summary: `StockTwits sentiment for ${ticker}: ${sentimentLabel} (${sentimentScore}/100) based on ${total} messages.`,
      provider: 'StockTwits (RapidAPI)',
      fetchedAt: new Date().toISOString()
    });

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
      : statusCode === 401 || statusCode === 403
        ? 'forbidden'
        : statusCode === 502 || statusCode === 503 || statusCode === 504
          ? 'unavailable'
          : 'error';
    const reasonByStatus = {
      rate_limited: 'rate_limited',
      forbidden: 'provider_auth_failed',
      unavailable: 'provider_unavailable',
      error: 'provider_error',
    };
    return {
      status,
      reason: reasonByStatus[status] || 'provider_error',
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
  return res.json(finnhubResult);
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
