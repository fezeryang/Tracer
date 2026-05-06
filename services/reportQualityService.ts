import { CompanyFundamentals, NewsItem, OfficialSourceVerification, SecFilingVerification, StockQuote, VerifiedNewsItem } from '../types';

export type MarketDataQuality = 'realtime' | 'delayed' | 'fallback' | 'simulation' | 'unavailable';
export type AvailabilityStatus = 'available' | 'limited' | 'unavailable';

export const assessQuoteQuality = (quote: StockQuote | null): MarketDataQuality => {
  if (!quote) return 'unavailable';

  const source = (quote.source || '').toLowerCase();
  if (source.includes('simulation') || /\bsim\b/.test(source)) return 'simulation';
  if (source.includes('error') || source.includes('fallback')) return 'fallback';
  if (source.includes('yahoo')) return 'delayed';
  if (source.includes('polygon') || source.includes('alpaca') || source.includes('finnhub')) return 'realtime';
  return 'unavailable';
};

export const isQuoteReliableForMarketConclusion = (quote: StockQuote | null) => {
  const quality = assessQuoteQuality(quote);
  return quality === 'realtime' || quality === 'delayed';
};

export const getSentimentCounts = (news: NewsItem[]) => ({
  Positive: news.filter((item) => item.sentiment === 'Positive').length,
  Neutral: news.filter((item) => item.sentiment === 'Neutral').length,
  Negative: news.filter((item) => item.sentiment === 'Negative').length,
});

export const getDataAvailability = ({
  quote,
  fundamentals,
  news,
  verifiedNews,
  officialFilings,
  officialSources,
}: {
  quote: StockQuote | null;
  fundamentals: CompanyFundamentals | null;
  news: NewsItem[];
  verifiedNews?: VerifiedNewsItem[];
  officialFilings?: SecFilingVerification;
  officialSources?: OfficialSourceVerification;
}) => {
  const quoteQuality = assessQuoteQuality(quote);

  return [
    {
      key: 'quote',
      status: quoteQuality === 'realtime' || quoteQuality === 'delayed' ? 'available' : quoteQuality === 'fallback' || quoteQuality === 'simulation' ? 'limited' : 'unavailable',
    },
    { key: 'fundamentals', status: fundamentals ? 'available' : 'unavailable' },
    { key: 'news', status: news.length > 0 ? 'available' : 'unavailable' },
    { key: 'verifiedNews', status: verifiedNews && verifiedNews.length > 0 ? 'available' : 'unavailable' },
    { key: 'officialFilings', status: officialFilings?.filings.length ? 'available' : 'unavailable' },
    { key: 'officialSources', status: officialSources?.sources.length ? 'available' : 'unavailable' },
  ] as Array<{ key: string; status: AvailabilityStatus }>;
};
