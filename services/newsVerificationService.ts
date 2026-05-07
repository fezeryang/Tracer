import { NewsItem, NewsSourceTier, NewsVerificationSummary, VerifiedNewsItem } from '../types';
import { fetchStockNews } from './marketDataService';

// Phase 3B extension points:
// - GDELT global news coverage
// - SEC EDGAR filings verification
// - Company IR / RSS feeds
// - Article extraction with Trafilatura
// - Event clustering
// - LLM-based cross-source consistency analysis

const SOURCE_TIER_BASE_SCORE: Record<NewsSourceTier, number> = {
  official: 80,
  finance_api: 65,
  major_media: 70,
  aggregator: 50,
  unknown: 35,
};

const clampScore = (score: number) => Math.max(0, Math.min(100, Math.round(score)));

export const classifySourceTier = (source: string): NewsSourceTier => {
  const normalizedSource = source.toLowerCase();

  if (
    normalizedSource.includes('sec') ||
    normalizedSource.includes('investor relations') ||
    normalizedSource.includes('company press release')
  ) {
    return 'official';
  }

  if (normalizedSource.includes('pr newswire')) {
    return 'major_media';
  }

  if (normalizedSource.includes('polygon') || normalizedSource.includes('finnhub')) {
    return 'finance_api';
  }

  if (
    normalizedSource.includes('reuters') ||
    normalizedSource.includes('bloomberg') ||
    normalizedSource.includes('cnbc') ||
    normalizedSource.includes('wsj') ||
    normalizedSource.includes('marketwatch') ||
    normalizedSource.includes('financial times') ||
    normalizedSource.includes('associated press') ||
    normalizedSource.includes(' ap ') ||
    normalizedSource.includes('bbc')
  ) {
    return 'major_media';
  }

  if (
    normalizedSource.includes('gdelt') ||
    normalizedSource.includes('yahoo') ||
    normalizedSource.includes('google news')
  ) {
    return 'aggregator';
  }

  return 'unknown';
};

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildReliabilityNotes = (item: Omit<VerifiedNewsItem, 'confidenceScore' | 'reliabilityNotes'>): string[] => {
  const notes: string[] = [];

  if (item.sourceTier === 'official') notes.push('Source appears to be official or regulatory.');
  if (item.sourceTier === 'major_media') notes.push('Source is categorized as higher-tier media, not guaranteed truth.');
  if (item.sourceTier === 'finance_api') notes.push('Source came through an existing financial data feed.');
  if (item.sourceTier === 'aggregator') notes.push('Source appears to be an aggregator and may require original-source review.');
  if (item.sourceTier === 'unknown') notes.push('Source tier is unknown; verify before relying on this item.');
  if (!item.url) notes.push('Missing original URL.');
  if (!item.publishedDate) notes.push('Missing publication date.');
  if (!item.text) notes.push('Missing summary text.');
  if (item.duplicateCount > 1) notes.push(`Matched ${item.duplicateCount} similar item(s) across available feed results.`);

  return notes;
};

export const calculateConfidenceScore = (
  item: Omit<VerifiedNewsItem, 'confidenceScore' | 'reliabilityNotes'>
) => {
  let score = SOURCE_TIER_BASE_SCORE[item.sourceTier];

  score += item.url ? 8 : -8;
  score += item.text ? 8 : 0;
  score += item.publishedDate ? 5 : -5;
  score += item.duplicateCount > 1 ? 10 : 0;
  score += item.verifiedBySources.length > 1 ? 10 : 0;
  score += item.sentiment !== 'Neutral' ? 3 : 0;
  score -= item.sourceTier === 'unknown' ? 10 : 0;
  score -= normalizeText(item.title).length < 12 ? 10 : 0;

  return clampScore(score);
};

const toVerifiedNewsItem = (item: NewsItem, ticker: string): VerifiedNewsItem => {
  const source = item.site || 'Unknown';
  const sourceTier = classifySourceTier(source);
  const baseItem: Omit<VerifiedNewsItem, 'confidenceScore' | 'reliabilityNotes'> = {
    title: item.title || 'Untitled news item',
    url: item.url || undefined,
    source,
    publishedDate: item.publishedDate || undefined,
    text: item.text || undefined,
    sentiment: item.sentiment,
    sentimentScore: item.sentimentScore,
    sourceTier,
    verifiedBySources: [source],
    duplicateCount: 1,
    relatedTickers: [ticker.toUpperCase()],
  };

  return {
    ...baseItem,
    confidenceScore: calculateConfidenceScore(baseItem),
    reliabilityNotes: buildReliabilityNotes(baseItem),
  };
};

const areSimilarTitles = (leftTitle: string, rightTitle: string) => {
  if (!leftTitle || !rightTitle) return false;
  if (leftTitle === rightTitle) return true;
  if (leftTitle.length < 20 || rightTitle.length < 20) return false;
  return leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle);
};

export const deduplicateNews = (items: VerifiedNewsItem[]): VerifiedNewsItem[] => {
  return items.reduce<VerifiedNewsItem[]>((dedupedItems, item) => {
    const normalizedTitle = normalizeText(item.title);
    const existingIndex = dedupedItems.findIndex((existingItem) => {
      const existingTitle = normalizeText(existingItem.title);
      const sameUrl = Boolean(item.url && existingItem.url && item.url === existingItem.url);
      return sameUrl || areSimilarTitles(existingTitle, normalizedTitle);
    });

    if (existingIndex === -1) {
      return [...dedupedItems, item];
    }

    const existingItem = dedupedItems[existingIndex];
    const verifiedBySources = Array.from(new Set([...existingItem.verifiedBySources, ...item.verifiedBySources]));
    const relatedTickers = Array.from(new Set([...(existingItem.relatedTickers || []), ...(item.relatedTickers || [])]));
    const mergedBase: Omit<VerifiedNewsItem, 'confidenceScore' | 'reliabilityNotes'> = {
      ...existingItem,
      text: existingItem.text || item.text,
      url: existingItem.url || item.url,
      publishedDate: existingItem.publishedDate || item.publishedDate,
      source: existingItem.source,
      sourceTier: existingItem.sourceTier,
      sentiment: existingItem.sentiment !== 'Neutral' ? existingItem.sentiment : item.sentiment,
      sentimentScore:
        Math.abs(existingItem.sentimentScore) >= Math.abs(item.sentimentScore)
          ? existingItem.sentimentScore
          : item.sentimentScore,
      verifiedBySources,
      duplicateCount: existingItem.duplicateCount + item.duplicateCount,
      relatedTickers,
    };

    const mergedItem: VerifiedNewsItem = {
      ...mergedBase,
      confidenceScore: calculateConfidenceScore(mergedBase),
      reliabilityNotes: Array.from(new Set([...buildReliabilityNotes(mergedBase), ...(item.reliabilityNotes || [])])),
    };

    return dedupedItems.map((dedupedItem, index) => (index === existingIndex ? mergedItem : dedupedItem));
  }, []);
};

export const summarizeNewsVerification = (
  ticker: string,
  items: VerifiedNewsItem[]
): NewsVerificationSummary => {
  const sourcesUsed = Array.from(new Set(items.flatMap((item) => item.verifiedBySources))).filter(Boolean);

  return {
    ticker: ticker.toUpperCase(),
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    highConfidenceCount: items.filter((item) => item.confidenceScore >= 75).length,
    mediumConfidenceCount: items.filter((item) => item.confidenceScore >= 50 && item.confidenceScore < 75).length,
    lowConfidenceCount: items.filter((item) => item.confidenceScore < 50).length,
    sourcesUsed,
    notes: [
      'Confidence scores are rule-based and intended for research triage only.',
      'Higher source tier does not guarantee factual accuracy.',
      'Cross-source verification is limited to currently available feed items in this MVP.',
    ],
  };
};

export const fetchVerifiedStockNews = async (ticker: string): Promise<VerifiedNewsItem[]> => {
  const news = await fetchStockNews(ticker);
  return verifyStockNewsItems(ticker, news);
};

export const verifyStockNewsItems = (ticker: string, news: NewsItem[]): VerifiedNewsItem[] => {
  const verifiedItems = news.map((item) => toVerifiedNewsItem(item, ticker));
  return deduplicateNews(verifiedItems);
};
