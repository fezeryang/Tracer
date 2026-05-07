
import { StockQuote, CompanyFundamentals, OptionsChain, OptionContract, NewsItem, BacktestResult, EquityPoint, TradeLog, Greeks, WhisperData, WhisperSource } from '../types';

// NOTE: Keys are now securely stored in server/index.js
// We fetch from our local backend proxy /api/...

const createBackendError = async (response: Response, fallback: string) => {
  let message = fallback;
  try {
    const data = await response.json();
    message = data?.error || data?.message || fallback;
  } catch {
    // Keep the HTTP status fallback when the backend response is not JSON.
  }

  const error = new Error(message) as Error & { status?: number };
  error.status = response.status;
  return error;
};

const shouldPropagateMarketDataStatus = (error: unknown) => {
  const status = (error as { status?: number })?.status;
  return status === 429 || status === 401 || status === 403 || status === 502 || status === 503 || status === 504;
};

const throwIfProviderStatus = (data: any) => {
  if (!data?.status || data.status === 'success') return;

  const statusByProviderStatus: Record<string, number> = {
    rate_limited: 429,
    forbidden: 403,
    unavailable: 503,
  };
  const error = new Error(data.error || 'Market data provider unavailable.') as Error & { status?: number };
  error.status = statusByProviderStatus[data.status] || 500;
  throw error;
};

export const fetchStockQuote = async (ticker: string): Promise<StockQuote> => {
  const upperTicker = ticker.toUpperCase();
  
  try {
    console.log(`[MarketService] Fetching data for ${upperTicker} from Backend...`);
    
    // Call local backend (proxies to Yahoo Finance)
    const response = await fetch(`/api/quote/${upperTicker}`);
    
    if (!response.ok) throw await createBackendError(response, `Backend API Error: ${response.status}`);

    const data = await response.json();
    throwIfProviderStatus(data);
    
    if (data.error) throw new Error(data.error);

    // Consume standardized backend response
    const currentPrice = data.price;
    const change = data.change;
    const changePercent = data.changePercent;
    const source = data.source || 'Unknown';

    // Estimate IV based on ticker type (Backend could enhance this later)
    const ivMap: Record<string, number> = {
      'SPY': 0.12, 'QQQ': 0.18, 'IWM': 0.22,
      'TSLA': 0.45, 'NVDA': 0.40, 'AMD': 0.38,
      'AAPL': 0.18, 'MSFT': 0.19, 'GOOGL': 0.22, 'AMZN': 0.25,
      'META': 0.30, 'NFLX': 0.35, 'COIN': 0.65,
      'GME': 0.80, 'AMC': 0.90
    };
    
    let volatility = ivMap[upperTicker] || 0.25; 
    volatility += (Math.random() * 0.02 - 0.01); // +/- 1% jitter for liveliness

    return {
      symbol: upperTicker,
      price: parseFloat(currentPrice.toFixed(2)),
      change: parseFloat(change.toFixed(2)),
      changePercent: parseFloat(changePercent.toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      source: source
    };

  } catch (error) {
    if (shouldPropagateMarketDataStatus(error)) throw error;

    console.warn(`[MarketService] Backend fetch failed for ${upperTicker}. Falling back to simulation.`, error);
    
    const hash = upperTicker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const basePrice = (hash % 500) + 50; 
    
    return {
      symbol: upperTicker,
      price: basePrice,
      change: 1.25,
      changePercent: 0.85,
      volatility: 0.35,
      source: 'Simulation (Network Error)'
    };
  }
};

export const fetchCompanyFundamentals = async (ticker: string): Promise<CompanyFundamentals | null> => {
  const upperTicker = ticker.toUpperCase();
  try {
    const response = await fetch(`/api/fundamentals/${upperTicker}`);
    
    if (!response.ok) throw await createBackendError(response, `Backend Error: ${response.status}`);

    const data = await response.json();
    throwIfProviderStatus(data);
    
    if (data && data.length > 0) {
        const profile = data[0];
        return {
            symbol: profile.symbol,
            companyName: profile.companyName,
            description: profile.description,
            sector: profile.sector,
            industry: profile.industry,
            marketCap: profile.mktCap,
            peRatio: profile.priceEarnings,
            beta: profile.beta,
            website: profile.website
        };
    }
    return null;
  } catch (error) {
    if (shouldPropagateMarketDataStatus(error)) throw error;

    console.warn(`[MarketService] Failed to fetch fundamentals for ${upperTicker}`, error);
    return null;
  }
};

// --- Sentiment Analysis Engine ---
const analyzeSentiment = (text: string): { sentiment: 'Positive' | 'Negative' | 'Neutral', score: number } => {
    const lowerText = text.toLowerCase();
    
    const positiveWords = ['beat', 'surge', 'jump', 'rise', 'gain', 'profit', 'upgrade', 'bull', 'growth', 'record', 'higher', 'strong', 'buy', 'outperform', 'deal', 'agreement', 'launch', 'approval'];
    const negativeWords = ['miss', 'drop', 'plunge', 'fall', 'loss', 'decline', 'downgrade', 'bear', 'weak', 'risk', 'crash', 'concern', 'fail', 'lawsuit', 'investigation', 'sell', 'cut'];

    let score = 0;
    positiveWords.forEach(word => {
        if (lowerText.includes(word)) score += 1;
    });
    negativeWords.forEach(word => {
        if (lowerText.includes(word)) score -= 1;
    });

    const normalizedScore = Math.max(-1, Math.min(1, score / 3));

    let sentiment: 'Positive' | 'Negative' | 'Neutral' = 'Neutral';
    if (normalizedScore > 0.2) sentiment = 'Positive';
    else if (normalizedScore < -0.2) sentiment = 'Negative';

    return { sentiment, score: normalizedScore };
};

export const fetchStockNews = async (ticker: string): Promise<NewsItem[]> => {
    const upperTicker = ticker.toUpperCase();
    try {
        const response = await fetch(`/api/news/${upperTicker}`);
        if (!response.ok) throw await createBackendError(response, `Backend Error: ${response.status}`);
        
        const data = await response.json();
        throwIfProviderStatus(data);
        
        return data.map((item: any) => {
            const { sentiment, score } = analyzeSentiment(item.title + ' ' + item.text);
            return {
                title: item.title,
                image: item.image,
                site: item.site,
                text: item.text,
                url: item.url,
                publishedDate: item.publishedDate,
                sentiment,
                sentimentScore: score
            };
        });
    } catch (error) {
        if (shouldPropagateMarketDataStatus(error)) throw error;

        console.warn(`[MarketService] Failed to fetch news for ${upperTicker}`, error);
        return [];
    }
};


// --- Options Pricing Math (Black-Scholes) ---

const standardNormalCDF = (x: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.39894228040 * Math.exp(-x * x / 2);
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  if (x > 0) return 1 - p;
  return p;
};

const standardNormalPDF = (x: number): number => {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
};

export const calculateBlackScholes = (
  type: 'call' | 'put',
  S: number, // Stock Price
  K: number, // Strike Price
  T: number, // Time to Expiry (in years)
  r: number, // Risk-free Interest Rate (decimal)
  sigma: number // Volatility (decimal)
): number => {
  if (T <= 0) {
     return type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S);
  }

  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);

  if (type === 'call') {
     return S * standardNormalCDF(d1) - K * Math.exp(-r * T) * standardNormalCDF(d2);
  } else {
     return K * Math.exp(-r * T) * standardNormalCDF(-d2) - S * standardNormalCDF(-d1);
  }
};

// --- Heston Model ---
// Simplified complex number helpers to avoid class overhead in tight loops
const cAdd = (a: [number, number], b: [number, number]): [number, number] => [a[0] + b[0], a[1] + b[1]];
const cSub = (a: [number, number], b: [number, number]): [number, number] => [a[0] - b[0], a[1] - b[1]];
const cMul = (a: [number, number], b: [number, number]): [number, number] => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const cDiv = (a: [number, number], b: [number, number]): [number, number] => {
  const denom = b[0] * b[0] + b[1] * b[1];
  return [(a[0] * b[0] + a[1] * b[1]) / denom, (a[1] * b[0] - a[0] * b[1]) / denom];
};
const cExp = (a: [number, number]): [number, number] => {
  const ea = Math.exp(a[0]);
  return [ea * Math.cos(a[1]), ea * Math.sin(a[1])];
};
const cSqrt = (a: [number, number]): [number, number] => {
  const r = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
  const t = Math.atan2(a[1], a[0]);
  const sr = Math.sqrt(r);
  return [sr * Math.cos(t / 2), sr * Math.sin(t / 2)];
};

export const calculateHestonPrice = (
  type: 'call' | 'put',
  S: number, K: number, T: number, r: number,
  v0: number, 
  theta: number, 
  kappa: number, 
  xi: number, 
  rho: number
): number => {
    if (T < 0.001) return Math.max(0, type === 'call' ? S - K : K - S);

    // Integrand for Heston probabilities P1 and P2
    const hestonIntegrand = (j: 1 | 2, phi: number): number => {
        const u = j === 1 ? 0.5 : -0.5;
        const b = j === 1 ? kappa - rho * xi : kappa;
        
        // Characteristic Function calculations
        const term1: [number, number] = [-b, rho * xi * phi];
        const d_sq = cSub(cMul(term1, term1), cMul([xi*xi, 0], [-phi*phi, 2*u*phi]));
        const d = cSqrt(d_sq);
        
        const minusTerm1: [number, number] = [b, -rho * xi * phi];
        const gNum = cAdd(minusTerm1, d);
        const gDen = cSub(minusTerm1, d);
        const g = cDiv(gNum, gDen);
        
        const expdT = cExp(cMul(d, [T, 0]));
        const oneMinusGExpdT = cSub([1, 0], cMul(g, expdT));
        const oneMinusG = cSub([1, 0], g);
        
        const D_term = cMul(cMul(gNum, cDiv(cSub([1,0], expdT), oneMinusGExpdT)), [1/(xi*xi), 0]);
        
        // Log part for C term
        // Warning: standard log branch cut can be an issue for long T, using basic principal here
        // Usually good for T < 5
        const ratio = cDiv(oneMinusGExpdT, oneMinusG);
        const lnRatio: [number, number] = [Math.log(Math.sqrt(ratio[0]**2 + ratio[1]**2)), Math.atan2(ratio[1], ratio[0])];
        
        const C_term = cMul([kappa*theta/(xi*xi), 0], cSub(cMul(gNum, [T, 0]), cMul([2, 0], lnRatio)));
        
        const totalExp = cAdd(cAdd(C_term, cMul([v0, 0], D_term)), [0, phi * Math.log(S)]);
        const charFunc = cExp(totalExp);
        
        // Integrand = Re[ exp(-i*phi*lnK) * charFunc / (i*phi) ]
        const lnK = Math.log(K);
        const termK: [number, number] = [Math.cos(-phi * lnK), Math.sin(-phi * lnK)];
        const num = cMul(termK, charFunc);
        const res = cDiv(num, [0, phi]);
        
        return res[0];
    };

    // Numerical Integration (Trapezoidal Rule)
    // Reduce steps for performance in 3D visualization context
    const steps = 60; 
    const limit = 100;
    const dPhi = limit / steps;
    
    let sum1 = 0;
    let sum2 = 0;

    for (let i = 1; i <= steps; i++) {
        const phi = i * dPhi; // Avoid phi=0 singularity
        const w = (i === steps) ? 0.5 : 1; // Trapezoidal weight
        sum1 += w * hestonIntegrand(1, phi);
        sum2 += w * hestonIntegrand(2, phi);
    }

    const P1 = 0.5 + (1 / Math.PI) * sum1 * dPhi;
    const P2 = 0.5 + (1 / Math.PI) * sum2 * dPhi;

    const callPrice = S * P1 - K * Math.exp(-r * T) * P2;
    
    if (type === 'call') return Math.max(0, callPrice);
    return Math.max(0, callPrice - S + K * Math.exp(-r * T));
};

export const calculateGreeks = (
  type: 'call' | 'put',
  S: number,
  K: number,
  T: number, // Years
  r: number,
  sigma: number
): Greeks => {
  const sqrtT = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;
  
  const nd1 = standardNormalCDF(d1);
  const nd2 = standardNormalCDF(d2);
  const nPrimeD1 = standardNormalPDF(d1);
  const nNegD1 = standardNormalCDF(-d1);
  const nNegD2 = standardNormalCDF(-d2);

  let delta = 0;
  let theta = 0;
  let rho = 0;

  // Gamma and Vega are the same for Calls and Puts
  const gamma = nPrimeD1 / (S * sigma * sqrtT);
  const vega = (S * sqrtT * nPrimeD1) / 100; // Divide by 100 for "per 1% vol change"

  if (type === 'call') {
    delta = nd1;
    // Theta per day: (Annual Theta / 365)
    // Formula: -(S*N'(d1)*sigma)/(2*sqrtT) - r*K*exp(-rT)*N(d2)
    const thetaAnnual = -( (S * nPrimeD1 * sigma) / (2 * sqrtT) ) - ( r * K * Math.exp(-r * T) * nd2 );
    theta = thetaAnnual / 365;
    
    rho = (K * T * Math.exp(-r * T) * nd2) / 100; // per 1% rate change
  } else {
    delta = nd1 - 1;
    // Formula: -(S*N'(d1)*sigma)/(2*sqrtT) + r*K*exp(-rT)*N(-d2)
    const thetaAnnual = -( (S * nPrimeD1 * sigma) / (2 * sqrtT) ) + ( r * K * Math.exp(-r * T) * nNegD2 );
    theta = thetaAnnual / 365;

    rho = (-K * T * Math.exp(-r * T) * nNegD2) / 100;
  }

  return { delta, gamma, theta, vega, rho };
};

const generateExpirationDates = (): string[] => {
  const dates = [];
  const today = new Date();
  for (let i = 1; i <= 6; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i * 7);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
};

export const calculateEstimatedPremium = (
  stockPrice: number,
  strike: number,
  volatility: number,
  type: 'call' | 'put',
  expiryDays: number = 30
): number => {
  const timeToExpiryYears = expiryDays / 365;
  const riskFreeRate = 0.05; 
  
  const price = calculateBlackScholes(type, stockPrice, strike, timeToExpiryYears, riskFreeRate, volatility);
  return parseFloat(price.toFixed(2));
};

export const fetchOptionsChain = async (ticker: string, expirationDate?: string): Promise<OptionsChain> => {
  const quote = await fetchStockQuote(ticker);
  const currentPrice = quote.price;
  const expirations = generateExpirationDates();
  const selectedExpiration = expirationDate || expirations[0];
  
  const now = new Date();
  const targetDate = new Date(selectedExpiration);
  const diffTime = Math.abs(targetDate.getTime() - now.getTime());
  const daysToExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
  const safeDaysToExpiry = Math.max(1, daysToExpiry);

  const calls: OptionContract[] = [];
  const puts: OptionContract[] = [];

  let interval = 0.5;
  if (currentPrice > 20) interval = 1;
  if (currentPrice > 100) interval = 2.5;
  if (currentPrice > 200) interval = 5;
  if (currentPrice > 1000) interval = 10;

  const centerStrike = Math.round(currentPrice / interval) * interval;
  const numStrikes = 12;

  for (let i = -numStrikes; i <= numStrikes; i++) {
    const strike = parseFloat((centerStrike + (i * interval)).toFixed(2));
    if (strike <= 0) continue;

    const volatilitySkew = quote.volatility * (1 + (Math.pow(Math.abs(i)/numStrikes, 2) * 0.2)); 
    
    // Calls
    const callTheo = calculateEstimatedPremium(currentPrice, strike, volatilitySkew, 'call', safeDaysToExpiry);
    const callBid = parseFloat((callTheo * 0.95).toFixed(2));
    const callAsk = parseFloat((callTheo * 1.05).toFixed(2));
    
    calls.push({
        strike,
        type: 'call',
        bid: callBid,
        ask: callAsk,
        lastPrice: callTheo,
        theoreticalPrice: callTheo,
        volume: Math.floor(Math.random() * 5000 * (1 - Math.abs(i)/numStrikes)) + 100,
        openInterest: Math.floor(Math.random() * 10000) + 500,
        impliedVolatility: parseFloat((volatilitySkew * 100).toFixed(1)), 
        inTheMoney: currentPrice > strike
    });

    // Puts
    const putTheo = calculateEstimatedPremium(currentPrice, strike, volatilitySkew, 'put', safeDaysToExpiry);
    const putBid = parseFloat((putTheo * 0.95).toFixed(2));
    const putAsk = parseFloat((putTheo * 1.05).toFixed(2));

    puts.push({
        strike,
        type: 'put',
        bid: putBid,
        ask: putAsk,
        lastPrice: putTheo,
        theoreticalPrice: putTheo,
        volume: Math.floor(Math.random() * 5000 * (1 - Math.abs(i)/numStrikes)) + 100,
        openInterest: Math.floor(Math.random() * 10000) + 500,
        impliedVolatility: parseFloat((volatilitySkew * 100).toFixed(1)),
        inTheMoney: currentPrice < strike
    });
  }

  return {
    symbol: ticker.toUpperCase(),
    currentPrice,
    expirations,
    selectedExpiration,
    calls,
    puts
  };
};

// --- Whisper / Alternative Data Simulation ---

export const fetchWhisperData = async (ticker: string): Promise<WhisperData> => {
    // In a real app, this would call an MCP aggregator for Twitter, Reddit, Glassdoor, etc.
    // Here we simulate the "Whisper" signals based on ticker characteristics.
    const t = ticker.toUpperCase();
    
    // Deterministic simulation based on ticker chars
    const hash = t.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const scoreBase = (hash % 60) + 20; // Base score 20-80
    
    // Bias for popular stocks
    let score = scoreBase;
    if (['NVDA', 'TSLA', 'PLTR', 'GME', 'AMD'].includes(t)) score += 15;
    if (['AMC', 'INTC', 'PYPL'].includes(t)) score -= 15;
    
    // Clamp
    score = Math.max(10, Math.min(98, score));

    let sentiment: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell' = 'Hold';
    if (score > 80) sentiment = 'Strong Buy';
    else if (score > 60) sentiment = 'Buy';
    else if (score < 40) sentiment = 'Sell';
    else if (score < 20) sentiment = 'Strong Sell';

    // Generate Sources
    const sources: WhisperSource[] = [
        {
            source: 'Reddit',
            score: Math.min(100, score + (Math.random()*20 - 10)),
            trend: Math.random() > 0.4 ? 'up' : 'down',
            sentiment: score > 60 ? 'Bullish' : 'Bearish',
            insight: score > 60 ? "High mention volume on r/WSB. 'YOLO' sentiment rising." : "Sentiment turning negative on discussion boards."
        },
        {
            source: 'Twitter',
            score: Math.min(100, score + (Math.random()*20 - 10)),
            trend: Math.random() > 0.5 ? 'up' : 'flat',
            sentiment: score > 50 ? 'Bullish' : 'Neutral',
            insight: "FinTwit influencers posting technical breakouts."
        },
        {
            source: 'Glassdoor',
            score: Math.floor(Math.random() * 20) + 60, // 60-80 generally
            trend: 'flat',
            sentiment: 'Neutral',
            insight: "Employee sentiment stable. No major layoffs detected."
        },
        {
            source: 'Google Trends',
            score: Math.floor(Math.random() * 100),
            trend: Math.random() > 0.3 ? 'up' : 'down',
            sentiment: 'Neutral',
            insight: "Search volume for product lines is trending upwards."
        }
    ];

    // Special logic for Tech/Growth
    if (['NVDA', 'MSFT', 'GOOGL', 'PLTR', 'META'].includes(t)) {
        sources.push({
            source: 'LinkedIn',
            score: 85,
            trend: 'up',
            sentiment: 'Bullish',
            insight: "Engineering headcount up 12% MoM. Aggressive AI hiring."
        });
        sources.push({
            source: 'App Store',
            score: 75,
            trend: 'up',
            sentiment: 'Bullish',
            insight: "App ranking climbed to #4 in Productivity."
        });
    }

    return {
        ticker: t,
        overallScore: Math.floor(score),
        sentimentLabel: sentiment,
        sources: sources,
        summary: `Aggregated signals suggest a ${sentiment.toUpperCase()} outlook. Social momentum is ${sources[0].trend === 'up' ? 'accelerating' : 'decelerating'} while alternative datasets show ${score > 50 ? 'strength' : 'weakness'}.`
    };
};


// --- Backtesting Engine ---

const roundToStrike = (price: number): number => {
    return Math.round(price * 2) / 2;
};

const fetchHistoricalPrices = async (ticker: string, days: number = 252): Promise<{date: string, close: number}[]> => {
    try {
        const response = await fetch(`/api/history/${ticker}`);
        const data = await response.json();
        
        if (data && data.historical) {
            return data.historical.reverse().map((d: any) => ({
                date: d.date,
                close: d.close
            }));
        }
        throw new Error("No historical data");
    } catch (e) {
        console.warn("Historical fetch failed, using mock data", e);
        const mockData = [];
        let price = 100;
        const now = new Date();
        for(let i=days; i>0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            price = price * (1 + (Math.random() * 0.04 - 0.018));
            mockData.push({
                date: date.toISOString().split('T')[0],
                close: price
            });
        }
        return mockData;
    }
};

export const runStrategyBacktest = async (
    ticker: string, 
    strategyType: 'Covered Call' | 'Long Call' | 'Short Put',
    customConfig?: { dte?: number, moneyness?: number }
): Promise<BacktestResult> => {
    const history = await fetchHistoricalPrices(ticker, 252); 
    if (history.length === 0) throw new Error("No Data");

    const equityCurve: EquityPoint[] = [];
    const trades: TradeLog[] = [];
    const initialCapital = 10000;
    let cash = initialCapital;
    let shares = 0;
    let optionPosition = null; 
    let tradeCount = 0;
    let wins = 0;
    let tradeId = 1;
    
    const initialPrice = history[0].close;
    const benchmarkShares = Math.floor(initialCapital / initialPrice);
    const benchmarkCash = initialCapital - (benchmarkShares * initialPrice);

    // Use Custom Config or Defaults
    const DTE = customConfig?.dte || 30; 
    const TARGET_MONEYNESS = customConfig?.moneyness || 1.0; // 1.0 = ATM
    const IV = 0.35; 
    const RISK_FREE = 0.05;

    for (let i = 0; i < history.length; i++) {
        const day = history[i];
        const currentPrice = day.close;
        let dailyAction: 'entry' | 'exit' | 'hold' = 'hold';
        
        // 1. Check if we need to open a trade
        if (!optionPosition) {
             if (strategyType === 'Long Call') {
                 // Buy Call at specified moneyness
                 const strike = roundToStrike(currentPrice * TARGET_MONEYNESS);
                 const premium = calculateBlackScholes('call', currentPrice, strike, DTE/365, RISK_FREE, IV);
                 const contracts = Math.floor((cash * 0.5) / (premium * 100));
                 
                 if (contracts > 0) {
                    optionPosition = {
                        type: 'call',
                        action: 'buy',
                        strike: strike,
                        entryPremium: premium,
                        contracts: contracts,
                        entryDate: i,
                        expiryDateIndex: i + DTE,
                        stockPriceAtEntry: currentPrice
                    };
                    cash -= contracts * premium * 100;
                    tradeCount++;
                    dailyAction = 'entry';
                 }
             } 
             else if (strategyType === 'Covered Call') {
                 if (shares < 100) {
                     const sharesToBuy = Math.floor(cash / currentPrice);
                     if (sharesToBuy >= 100) {
                         shares += 100;
                         cash -= 100 * currentPrice;
                     }
                 }
                 
                 if (shares >= 100) {
                     // Sell Call at specified moneyness (default 1.05 OTM)
                     const strike = roundToStrike(currentPrice * (customConfig?.moneyness || 1.05));
                     const premium = calculateBlackScholes('call', currentPrice, strike, DTE/365, RISK_FREE, IV);
                     
                     optionPosition = {
                         type: 'call',
                         action: 'sell',
                         strike: strike,
                         entryPremium: premium,
                         contracts: 1, 
                         entryDate: i,
                         expiryDateIndex: i + DTE,
                         stockPriceAtEntry: currentPrice
                     };
                     cash += premium * 100;
                     tradeCount++;
                     dailyAction = 'entry';
                 }
             }
             else if (strategyType === 'Short Put') {
                 // Sell Put at specified moneyness (default 0.95 OTM)
                 const strike = roundToStrike(currentPrice * (customConfig?.moneyness || 0.95));
                 const collateral = strike * 100;
                 
                 if (cash >= collateral) {
                     const premium = calculateBlackScholes('put', currentPrice, strike, DTE/365, RISK_FREE, IV);
                     
                     optionPosition = {
                         type: 'put',
                         action: 'sell',
                         strike: strike,
                         entryPremium: premium,
                         contracts: 1,
                         entryDate: i,
                         expiryDateIndex: i + DTE,
                         stockPriceAtEntry: currentPrice
                     };
                     cash += premium * 100;
                     tradeCount++;
                     dailyAction = 'entry';
                 }
             }
        }

        // 2. Check if we need to close trade
        else if (optionPosition && i >= optionPosition.expiryDateIndex) {
            const p = optionPosition;
            let settlementValue = 0;
            if (p.type === 'call') settlementValue = Math.max(0, currentPrice - p.strike);
            if (p.type === 'put') settlementValue = Math.max(0, p.strike - currentPrice);
            
            let tradePnL = 0;

            if (p.action === 'buy') {
                cash += settlementValue * 100 * p.contracts;
                tradePnL = (settlementValue - p.entryPremium) * 100 * p.contracts;
                if (settlementValue > p.entryPremium) wins++;
            } else {
                cash -= settlementValue * 100 * p.contracts;
                tradePnL = (p.entryPremium - settlementValue) * 100 * p.contracts;
                
                if (strategyType === 'Covered Call' && settlementValue > 0) {
                    shares -= 100;
                    cash += p.strike * 100;
                }
                
                if (settlementValue < p.entryPremium) wins++;
            }
            
            trades.push({
                id: tradeId++,
                entryDate: history[p.entryDate].date,
                exitDate: history[i].date,
                type: p.type as 'call' | 'put',
                action: p.action as 'buy' | 'sell',
                strike: parseFloat(p.strike.toFixed(2)),
                stockPrice: parseFloat(p.stockPriceAtEntry.toFixed(2)),
                entryPrice: parseFloat(p.entryPremium.toFixed(2)),
                exitPrice: parseFloat(settlementValue.toFixed(2)),
                pnl: parseFloat(tradePnL.toFixed(2)),
                status: tradePnL >= 0 ? 'Win' : 'Loss'
            });

            optionPosition = null;
            dailyAction = 'exit';
        }

        // 3. Mark to Market & Record Granular Data
        let currentOptionValue = 0;
        
        if (optionPosition) {
            const p = optionPosition;
            const daysLeft = Math.max(0, (p.expiryDateIndex - i));
            const currentOptionPrice = calculateBlackScholes(p.type as 'call' | 'put', currentPrice, p.strike, daysLeft/365, RISK_FREE, IV);
            
            if (p.action === 'buy') {
                currentOptionValue = currentOptionPrice * 100 * p.contracts;
            } else {
                currentOptionValue = -(currentOptionPrice * 100 * p.contracts);
            }
        }

        let dailyStrategyValue = cash + (shares * currentPrice) + currentOptionValue;
        const benchmarkValue = benchmarkCash + (benchmarkShares * currentPrice);

        equityCurve.push({
            date: day.date,
            strategyValue: dailyStrategyValue,
            benchmarkValue: benchmarkValue,
            underlyingPrice: currentPrice,
            // Granular Data
            cash: parseFloat(cash.toFixed(2)),
            sharesHeld: shares,
            contractsHeld: optionPosition ? optionPosition.contracts : 0,
            optionValue: parseFloat(currentOptionValue.toFixed(2)),
            action: dailyAction
        });
    }

    const finalValue = equityCurve[equityCurve.length - 1].strategyValue;
    const totalReturn = ((finalValue - initialCapital) / initialCapital) * 100;
    
    let peak = -Infinity;
    let maxDrawdown = 0;
    equityCurve.forEach(pt => {
        if (pt.strategyValue > peak) peak = pt.strategyValue;
        const dd = (peak - pt.strategyValue) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;
    });

    return {
        ticker,
        strategy: strategyType,
        totalReturn,
        winRate: tradeCount > 0 ? (wins / tradeCount) * 100 : 0,
        maxDrawdown: maxDrawdown * 100,
        tradeCount,
        equityCurve,
        trades
    };
};
