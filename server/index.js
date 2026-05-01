
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { saveFeedback, logUserLogin, updateUserHeartbeat, getAdminLogs, getRegisteredUsers, initDB, createUser, findUser, isReady } from './database.js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json());

    // Secrets from Environment
    const POLYGON_KEY = process.env.POLYGON_KEY || '_jZsuxjLnWGqIBGTmI39mw5xO16vMAoS';
    const FINNHUB_KEY = process.env.FINNHUB_KEY || 'd4t2hehr01qhr5tnsgp0d4t2hehr01qhr5tnsgpg';
    const ALPACA_KEY = process.env.ALPACA_API_KEY;
    const ALPACA_SECRET = process.env.ALPACA_SECRET_KEY;
    const EIA_KEY = process.env.EIA_API_KEY;

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
    if (['POLYGON', 'FINNHUB', 'YAHOO', 'GOOGLE', 'SIMULATION', 'ALPACA'].includes(provider)) {
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
             const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_KEY}`;
             const response = await axios.get(url, { timeout: 5000 });
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

  // Default: POLYGON
  try {
    console.log(`[API] Fetching Quote for ${ticker} via Polygon (Prev Aggs)...`);
    
    const prevUrl = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${POLYGON_KEY}`;
    const response = await axios.get(prevUrl, { timeout: 5000 });

    if (response.data && response.data.results && response.data.results.length > 0) {
        const result = response.data.results[0];
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
            source: 'Polygon.io'
        });
    }

    throw new Error('No data in Prev endpoint');

  } catch (prevError) {
    console.warn(`[API] Polygon Prev failed for ${ticker} (${prevError.message}). Trying Snapshot...`);

    try {
        const snapshotUrl = `https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers/${ticker}?apiKey=${POLYGON_KEY}`;
        const response = await axios.get(snapshotUrl, { timeout: 5000 });
        const data = response.data?.ticker;

        if (!data) throw new Error('Polygon Snapshot returned no data');

        const price = data.lastTrade?.p || data.day?.c || data.prevDay?.c;

        return res.json({
            symbol: data.ticker,
            price: price,
            previousClose: data.prevDay?.c,
            change: data.todaysChange,
            changePercent: data.todaysChangePerc,
            source: 'Polygon.io (Snap)'
        });

    } catch (snapError) {
        console.error(`[API] All Polygon endpoints failed for ${ticker}:`, snapError.message);
        return res.json(generateSimulatedQuote(ticker, 'Polygon Error -> Sim'));
    }
  }
});

// 2. Fundamentals (Polygon Only for now, Finnhub free tier limits fundamentals)
app.get('/api/fundamentals/:ticker', async (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  
  // Always use Polygon for fundamentals as it has better free tier coverage for company profiles
  try {
    console.log(`[API] Fetching Fundamentals for ${ticker} via Polygon...`);
    const url = `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`;
    const response = await axios.get(url, { timeout: 5000 });
    const result = response.data?.results;

    if (!result) throw new Error('No fundamentals found');

    const data = [{
        symbol: result.ticker,
        companyName: result.name,
        description: result.description,
        sector: result.sic_description || 'Technology', 
        industry: result.sic_description || 'Consumer Electronics',
        mktCap: result.market_cap,
        priceEarnings: 0, 
        beta: 0, 
        website: result.homepage_url
    }];

    res.json(data);
  } catch (error) {
    console.error(`[API] Fundamentals failed for ${ticker}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch fundamentals' });
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

  // Fallback / Default: POLYGON
  try {
    console.log(`[API] Fetching News for ${ticker} via Polygon...`);
    const url = `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=5&apiKey=${POLYGON_KEY}`;
    const response = await axios.get(url, { timeout: 5000 });
    
    const results = response.data?.results || [];

    const news = results.map(item => ({
        title: item.title,
        image: item.image_url,
        site: item.publisher?.name || 'Polygon',
        text: item.description,
        url: item.article_url,
        publishedDate: item.published_utc
    }));

    res.json(news);
  } catch (error) {
    console.error(`[API] News failed for ${ticker}:`, error.message);
    res.status(500).json({ error: 'Failed to fetch news' });
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

  try {
    console.log(`[API] Fetching History for ${ticker} via Polygon...`);
    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setFullYear(fromDate.getFullYear() - 2);
    
    const toStr = toDate.toISOString().split('T')[0];
    const fromStr = fromDate.toISOString().split('T')[0];

    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${fromStr}/${toStr}?adjusted=true&sort=desc&limit=5000&apiKey=${POLYGON_KEY}`;
    
    const response = await axios.get(url, { timeout: 6000 });
    
    if (response.data && response.data.results) {
        const historical = response.data.results.map(bar => ({
            date: new Date(bar.t).toISOString().split('T')[0],
            open: bar.o,
            high: bar.h,
            low: bar.l,
            close: bar.c,
            volume: bar.v
        }));

        return res.json({
            symbol: ticker,
            historical
        });
    }

    throw new Error('No historical data returned');

  } catch (error) {
    console.error("History Fetch Error:", error.message);
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
    if (!username || !email) return res.status(400).json({ error: 'Callsign and Email required' });
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

    try {
        let user = await findUser(username);
        if (!user) await createUser(username, email, ip);
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
