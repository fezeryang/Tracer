


export interface AlpacaAccount {
  id: string;
  portfolio_value: string;
  buying_power: string;
  cash: string;
  equity: string;
}

export interface AlpacaOrder {
  id: string;
  symbol: string;
}

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volatility: number; // Implied Volatility
  source?: string;
}

export type ShellViewMode =
  | 'overview'
  | 'chat'
  | 'report'
  | 'chain'
  | 'backtest'
  | 'news-impact'
  | 'macro'
  | 'trading'
  | 'timemachine'
  | 'whisper'
  | 'academy'
  | 'feedback'
  | 'admin';

export interface OptionLeg {
  type: 'call' | 'put';
  action: 'buy' | 'sell';
  strike: number;
  premium: number;
  expiration: string;
}

export interface Greeks {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export interface StrategyRecommendation {
  name: string;
  ticker: string;
  currentPrice: number;
  thesis: string; // Bullish, Bearish, Neutral, Volatile
  explanation: string;
  legs: OptionLeg[];
  maxProfit: number | 'Unlimited';
  maxLoss: number | 'Unlimited';
  breakEven: number[];
  // New "Cool" Metrics
  pop: number; // Probability of Profit (0-100)
  riskScore: number; // 1-10
  complexity: 'Low' | 'Medium' | 'High' | 'Degen';
  marketDataSource?: string;
}

export interface CompanyFundamentals {
  symbol: string;
  companyName: string;
  description: string;
  sector: string;
  industry: string;
  marketCap: number;
  peRatio: number;
  beta: number; // Volatility measure
  website: string;
}

export interface NewsItem {
  title: string;
  image: string;
  site: string;
  text: string;
  url: string;
  publishedDate: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  sentimentScore: number; // -1 to 1 range
}

export type NewsSourceTier =
  | 'official'
  | 'finance_api'
  | 'major_media'
  | 'aggregator'
  | 'unknown';

export interface VerifiedNewsItem {
  title: string;
  url?: string;
  source: string;
  publishedDate?: string;
  text?: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  sentimentScore: number;
  sourceTier: NewsSourceTier;
  confidenceScore: number;
  verifiedBySources: string[];
  duplicateCount: number;
  relatedTickers?: string[];
  reliabilityNotes?: string[];
}

export type ReportGenerationStage =
  | 'idle'
  | 'quote'
  | 'fundamentals'
  | 'news'
  | 'trust'
  | 'ai'
  | 'finalizing'
  | 'done'
  | 'error';

export type DataSourceStatus =
  | 'success'
  | 'unavailable'
  | 'timeout'
  | 'rate_limited'
  | 'forbidden'
  | 'error'
  | 'simulation'
  | 'fallback';

export interface DataSourceHealth {
  key: string;
  label: string;
  status: DataSourceStatus;
  message?: string;
  updatedAt: string;
}

export interface NewsVerificationSummary {
  ticker: string;
  generatedAt: string;
  totalItems: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  sourcesUsed: string[];
  notes: string[];
}

export interface SecFiling {
  ticker: string;
  cik: string;
  accessionNumber: string;
  form: string;
  filingDate: string;
  reportDate?: string;
  primaryDocument?: string;
  description?: string;
  url?: string;
  source: 'SEC EDGAR';
}

export interface SecFilingVerification {
  ticker: string;
  cik?: string;
  generatedAt: string;
  filings: SecFiling[];
  formsIncluded: string[];
  status: 'available' | 'unavailable' | 'not_found' | 'error';
  error?: string;
  notes: string[];
}

export type OfficialSourceType =
  | 'sec'
  | 'investor_relations'
  | 'press_release'
  | 'newsroom'
  | 'official_website'
  | 'exchange'
  | 'wire_service'
  | 'major_media'
  | 'aggregator'
  | 'unknown';

export type OfficialSourceStatus =
  | 'available'
  | 'partial'
  | 'not_found'
  | 'unsupported'
  | 'error';

export type OfficialSourceTier =
  | 'official'
  | 'official_channel'
  | 'major_media'
  | 'aggregator'
  | 'unknown';

export type AiAuthorityAssessment =
  | 'likely_official'
  | 'possibly_official'
  | 'third_party'
  | 'unknown';

export interface OfficialCompanySource {
  ticker: string;
  companyName?: string;
  type: OfficialSourceType;
  name: string;
  url: string;
  domain?: string;
  sourceTier: OfficialSourceTier;
  authorityScore: number;
  aiReviewed?: boolean;
  aiAssessment?: AiAuthorityAssessment;
  aiConfidence?: number;
  aiReasoning?: string;
  warnings?: string[];
  notes: string[];
}

export interface OfficialSourceVerification {
  ticker: string;
  companyName?: string;
  generatedAt: string;
  status: OfficialSourceStatus;
  sources: OfficialCompanySource[];
  notes: string[];
  mode: 'rule_only' | 'rule_plus_ai';
}

export type SourceTrustLevel = 'high' | 'medium' | 'low' | 'unknown';

export interface SourceTrustSummary {
  ticker: string;
  generatedAt: string;
  overallScore: number;
  confidenceLevel: SourceTrustLevel;
  officialSourceCount: number;
  secFilingCount: number;
  verifiedNewsCount: number;
  highConfidenceNewsCount: number;
  aiReviewed: boolean;
  mode: 'rule_only' | 'rule_plus_ai';
  strengths: string[];
  warnings: string[];
  notes: string[];
}

// --- News Impact Predictor Types ---
export interface HistoricalEvent {
    event: string;
    date: string;
    ticker: string;
    movePercent: number;
    similarity: number; // 0-100 match
}

export interface NewsImpactAnalysis {
    headline: string;
    ticker: string;
    publishedTime: string;
    sentimentScore: number; // 0-100
    predictedMoveLow: number; // %
    predictedMoveHigh: number; // %
    currentMove: number; // %
    remainingAlpha: number; // % (Average Predicted - Current)
    confidence: number; // 0-100
    reasoning: string;
    similarEvents: HistoricalEvent[];
    verdict: 'Load the Boat' | 'Buy Dip' | 'Wait' | 'Sell Strength' | 'Priced In';
}

export interface OptionContract {
  contractName?: string;
  strike: number;
  type: 'call' | 'put';
  bid: number;
  ask: number;
  lastPrice: number;
  theoreticalPrice: number; // Black-Scholes Model Price
  volume: number;
  openInterest: number;
  impliedVolatility: number;
  inTheMoney: boolean;
}

export interface OptionsChain {
  symbol: string;
  currentPrice: number;
  expirations: string[];
  selectedExpiration: string;
  calls: OptionContract[];
  puts: OptionContract[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text?: string;
  strategy?: StrategyRecommendation; // If the model proposes a strategy
  fundamentals?: CompanyFundamentals; // If the model fetches fundamentals
  news?: NewsItem[]; // If the model fetches news
  whisper?: WhisperData; // If the model fetches whisper data
  impactAnalysis?: NewsImpactAnalysis; // If the model predicts news impact
  quote?: StockQuote; // If the model fetches a quote
  isLoading?: boolean;
  ragContext?: string[];
}

// --- Backtest Types ---
export interface EquityPoint {
  date: string;
  strategyValue: number;
  benchmarkValue: number; // Buy & Hold stock
  underlyingPrice: number; // Raw stock price for reference
  // Granular Debug Data
  cash: number;
  sharesHeld: number;
  contractsHeld: number;
  optionValue: number;
  action?: 'entry' | 'exit' | 'hold'; // For chart markers
}

export interface TradeLog {
  id: number;
  entryDate: string;
  exitDate: string;
  type: 'call' | 'put';
  action: 'buy' | 'sell';
  strike: number;
  stockPrice: number; // Stock price at time of entry
  entryPrice: number; // Premium per share
  exitPrice: number; // Settlement per share
  pnl: number; // Total Dollar PnL
  status: 'Win' | 'Loss';
}

export interface BacktestResult {
  ticker: string;
  strategy: string;
  totalReturn: number;
  winRate: number;
  maxDrawdown: number;
  tradeCount: number;
  equityCurve: EquityPoint[];
  trades: TradeLog[];
}

// --- Auth & Admin Types ---
export interface UserSession {
  username: string;
  sessionId: string;
  loginTime: string;
}

export interface AdminLog {
  username: string;
  loginTime: string;
  lastActive: string;
  durationMinutes: number;
  platform: string; // 'BigQuery' or 'SQLite' source
  ipAddress?: string;
}

export interface RegisteredUser {
  username: string;
  email: string;
  created_at: string;
  ipAddress?: string;
}

// --- Time Machine Types ---
export interface TimeMachineFrame {
  date: string;
  price: number;
  volatility: number;
  news: string;
  commentary: string;
}

export interface MarketEvent {
  id: string;
  title: string;
  ticker: string;
  description: string;
  frames: TimeMachineFrame[];
}

// --- Whisper / Alternative Data Types ---
export interface WhisperSource {
    source: 'Reddit' | 'Twitter' | 'Glassdoor' | 'Google Trends' | 'App Store' | 'LinkedIn';
    score: number; // Normalized 0-100 or specific metric
    trend: 'up' | 'down' | 'flat';
    sentiment: 'Bullish' | 'Bearish' | 'Neutral';
    insight: string; // "Hiring spree detected", "Negative employee reviews"
    icon?: any;
}

export interface WhisperData {
    ticker: string;
    overallScore: number; // 0-100
    sentimentLabel: 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';
    sources: WhisperSource[];
    summary: string;
}

export interface AiReportSections {
  summary: string;
  dataAvailabilityAnalysis: string;
  priceAnalysis: string;
  fundamentalsAnalysis: string;
  newsAnalysis: string;
  sourceTrustAnalysis: string;
  volatilityAnalysis: string;
  optionsEducation: string;
  risks: string[];
  followUpChecklist: string[];
  conclusion: string;
}

// --- Report Types ---
export interface StockAnalysisReport {
  ticker: string;
  generatedAt: string;
  quote: StockQuote | null;
  fundamentals: CompanyFundamentals | null;
  news: NewsItem[];
  verifiedNews?: VerifiedNewsItem[];
  officialFilings?: SecFilingVerification;
  officialSources?: OfficialSourceVerification;
  whisper: WhisperData | null;
  summary: string;
  dataAvailabilityAnalysis?: string;
  priceAnalysis: string;
  newsAnalysis: string;
  fundamentalsAnalysis: string;
  volatilityAnalysis: string;
  optionsEducation: string;
  sourceTrustAnalysis?: string;
  followUpChecklist?: string[];
  risks: string[];
  conclusion: string;
  disclaimer: string;
  dataAvailability?: string[];
  dataSourceHealth?: DataSourceHealth[];
  isCached?: boolean;
  cachedAt?: string;
  aiProvider?: 'deepseek' | 'gemini' | 'fallback';
  aiModel?: string;
}
