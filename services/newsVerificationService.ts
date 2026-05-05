import { VerifiedNewsItem } from '../types';
import { fetchStockNews } from './marketDataService';

const calculateConfidenceScore = (item: {
  url?: string;
  text?: string;
  sentiment?: 'Positive' | 'Negative' | 'Neutral';
}) => {
  const score =
    60 +
    (item.url ? 10 : 0) +
    (item.text ? 10 : 0) +
    (item.sentiment && item.sentiment !== 'Neutral' ? 5 : 0);

  return Math.min(100, score);
};

export const fetchVerifiedStockNews = async (ticker: string): Promise<VerifiedNewsItem[]> => {
  const news = await fetchStockNews(ticker);

  return news.map((item) => {
    const source = item.site || 'Unknown';

    return {
      title: item.title,
      url: item.url,
      source,
      publishedDate: item.publishedDate,
      text: item.text,
      sentiment: item.sentiment,
      sentimentScore: item.sentimentScore,
      sourceTier: 'finance_api',
      confidenceScore: calculateConfidenceScore(item),
      verifiedBySources: [source],
      duplicateCount: 1,
    };
  });
};
