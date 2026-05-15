const SOURCE_TIER_BASE_SCORE = {
  official: 82,
  finance_api: 65,
  major_media: 70,
  aggregator: 48,
  unknown: 35,
};

const safeText = (value, maxLength = 220) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const safeLimitArray = (value, limit = 8) => (
  Array.isArray(value) ? value.filter(Boolean).slice(0, limit) : []
);

const clampScore = (score) => Math.max(0, Math.min(100, Math.round(Number(score) || 0)));

const normalizeNewsTitle = (value) => safeText(value || '', 220)
  .toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const areSimilarTitles = (leftTitle, rightTitle) => {
  if (!leftTitle || !rightTitle) return false;
  if (leftTitle === rightTitle) return true;
  if (leftTitle.length < 20 || rightTitle.length < 20) return false;
  return leftTitle.includes(rightTitle) || rightTitle.includes(leftTitle);
};

const classifySourceTier = (source) => {
  const normalizedSource = safeText(source || '', 120).toLowerCase();

  if (
    normalizedSource.includes('sec')
    || normalizedSource.includes('investor relations')
    || normalizedSource.includes('company press release')
  ) {
    return 'official';
  }

  if (normalizedSource.includes('polygon') || normalizedSource.includes('finnhub')) return 'finance_api';
  if (normalizedSource.includes('pr newswire')) return 'major_media';

  if (
    normalizedSource.includes('reuters')
    || normalizedSource.includes('bloomberg')
    || normalizedSource.includes('cnbc')
    || normalizedSource.includes('wsj')
    || normalizedSource.includes('marketwatch')
    || normalizedSource.includes('financial times')
    || normalizedSource.includes('associated press')
    || normalizedSource.includes(' ap ')
    || normalizedSource.includes('bbc')
  ) {
    return 'major_media';
  }

  if (
    normalizedSource.includes('gdelt')
    || normalizedSource.includes('yahoo')
    || normalizedSource.includes('google news')
  ) {
    return 'aggregator';
  }

  return 'unknown';
};

const confidenceLevelFromScore = (score, totalSignals) => {
  if (totalSignals === 0) return 'unavailable';
  if (score >= 70) return 'high';
  if (score >= 45) return 'medium';
  if (score > 0) return 'limited';
  return 'unavailable';
};

const compatibilityConfidenceLevel = (level) => {
  if (level === 'high' || level === 'medium' || level === 'low') return level;
  if (level === 'limited') return 'low';
  return 'unknown';
};

export const scoreBackendNewsTrust = (input = {}) => {
  const source = safeText(input.source || input.site || 'Unknown', 80) || 'Unknown';
  const sourceTier = classifySourceTier(source);
  let score = SOURCE_TIER_BASE_SCORE[sourceTier] || SOURCE_TIER_BASE_SCORE.unknown;

  if (input.url) score += 8;
  else score -= 8;
  if (input.text) score += 6;
  if (input.publishedDate) score += 5;
  else score -= 5;
  if (input.sentiment && input.sentiment !== 'Neutral') score += 3;
  if (sourceTier === 'unknown') score -= 10;
  if (normalizeNewsTitle(input.title).length < 12) score -= 10;

  return clampScore(score);
};

export const buildBackendVerifiedNewsItems = ({ ticker, news, limit = 5 }) => {
  const verifiedItems = safeLimitArray(news, limit).map((item) => {
    const source = safeText(item?.source || item?.site || 'Unknown', 80) || 'Unknown';
    const sourceTier = classifySourceTier(source);
    const confidenceScore = scoreBackendNewsTrust(item);
    return {
      title: safeText(item?.title || 'Untitled news item', 220) || 'Untitled news item',
      url: safeText(item?.url || '', 500) || undefined,
      source,
      publishedDate: safeText(item?.publishedDate || '', 60) || undefined,
      text: safeText(item?.text || '', 320) || undefined,
      sentiment: item?.sentiment || 'Neutral',
      sentimentScore: Number.isFinite(Number(item?.sentimentScore)) ? Number(item.sentimentScore) : 0,
      sourceTier,
      confidenceScore,
      verifiedBySources: [source],
      duplicateCount: 1,
      relatedTickers: [safeText(ticker, 16) || ''],
    };
  });

  return verifiedItems.reduce((dedupedItems, item) => {
    const normalizedTitle = normalizeNewsTitle(item.title);
    const existingIndex = dedupedItems.findIndex((existingItem) => {
      const existingTitle = normalizeNewsTitle(existingItem.title);
      const sameUrl = Boolean(item.url && existingItem.url && item.url === existingItem.url);
      return sameUrl || areSimilarTitles(existingTitle, normalizedTitle);
    });

    if (existingIndex === -1) return [...dedupedItems, item];

    const existingItem = dedupedItems[existingIndex];
    const verifiedBySources = Array.from(new Set([...existingItem.verifiedBySources, ...item.verifiedBySources]));
    const duplicateCount = existingItem.duplicateCount + item.duplicateCount;
    const mergedItem = {
      ...existingItem,
      text: existingItem.text || item.text,
      url: existingItem.url || item.url,
      publishedDate: existingItem.publishedDate || item.publishedDate,
      sentiment: existingItem.sentiment !== 'Neutral' ? existingItem.sentiment : item.sentiment,
      sentimentScore: Math.abs(existingItem.sentimentScore) >= Math.abs(item.sentimentScore)
        ? existingItem.sentimentScore
        : item.sentimentScore,
      verifiedBySources,
      duplicateCount,
      confidenceScore: clampScore(Math.max(existingItem.confidenceScore, item.confidenceScore) + (duplicateCount > 1 ? 8 : 0) + (verifiedBySources.length > 1 ? 8 : 0)),
      relatedTickers: Array.from(new Set([...(existingItem.relatedTickers || []), ...(item.relatedTickers || [])].filter(Boolean))),
    };

    return dedupedItems.map((dedupedItem, index) => (index === existingIndex ? mergedItem : dedupedItem));
  }, []);
};

export const summarizeBackendEvidenceAvailability = (input = {}) => {
  const news = safeLimitArray(input.news || input.verifiedNews, 50);
  const officialSources = Array.isArray(input.officialSources?.sources)
    ? input.officialSources.sources
    : safeLimitArray(input.officialSources, 50);
  const secFilings = Array.isArray(input.secFilings?.filings)
    ? input.secFilings.filings
    : safeLimitArray(input.secFilings, 50);
  const verifiedNews = safeLimitArray(input.verifiedNews, 50);
  const verifiedNewsCount = verifiedNews.length > 0
    ? verifiedNews.length
    : news.filter((item) => scoreBackendNewsTrust(item) >= 60).length;

  return {
    officialSourceCount: officialSources.length,
    secFilingCount: secFilings.length,
    newsCount: news.length,
    verifiedNewsCount,
  };
};

export const buildBackendSourceTrustSummary = (input = {}) => {
  const ticker = safeText(input.ticker, 16) || 'N/A';
  const metrics = summarizeBackendEvidenceAvailability(input);
  const totalSignals = metrics.officialSourceCount + metrics.secFilingCount + metrics.verifiedNewsCount;
  const officialSources = Array.isArray(input.officialSources?.sources) ? input.officialSources.sources : [];
  const secFilings = Array.isArray(input.secFilings?.filings) ? input.secFilings.filings : [];
  const verifiedNews = input.verifiedNews || buildBackendVerifiedNewsItems({ ticker, news: input.news || [] });
  const highConfidenceNewsCount = safeLimitArray(verifiedNews, 50)
    .filter((item) => Number(item?.confidenceScore) >= 75).length;
  const distinctTypes = new Set(officialSources.map((source) => source?.type).filter(Boolean)).size;
  const irChannelCount = officialSources.filter((source) => source?.type === 'investor_relations').length;
  const officialChannelCount = officialSources.filter((source) => (
    ['official_website', 'newsroom', 'press_release', 'exchange'].includes(source?.type)
  )).length;
  const mode = input.officialSources?.mode || 'rule_only';
  const aiReviewed = Boolean(officialSources.some((source) => source?.aiReviewed));

  let score = 0;
  if (metrics.officialSourceCount > 0) score += Math.min(30, 18 + metrics.officialSourceCount * 6 + distinctTypes * 2);
  if (metrics.secFilingCount > 0) score += Math.min(30, 20 + metrics.secFilingCount * 2);
  if (metrics.verifiedNewsCount > 0) score += Math.min(22, metrics.verifiedNewsCount * 7 + highConfidenceNewsCount * 3);
  if (irChannelCount > 0) score += 6;
  if (officialChannelCount > 0) score += 4;
  if (metrics.officialSourceCount > 0 && metrics.secFilingCount > 0) score += 8;
  if (metrics.officialSourceCount > 0 && metrics.secFilingCount > 0 && metrics.verifiedNewsCount > 0) score += 3;
  if (aiReviewed && mode === 'rule_plus_ai') score += 5;
  score = clampScore(score);

  const level = confidenceLevelFromScore(score, totalSignals);
  const strengths = [];
  const warnings = [];
  const notes = [];

  if (metrics.officialSourceCount > 0) strengths.push(`${metrics.officialSourceCount} official source candidate${metrics.officialSourceCount === 1 ? '' : 's'} available.`);
  if (metrics.secFilingCount > 0) strengths.push(`${metrics.secFilingCount} SEC filing${metrics.secFilingCount === 1 ? '' : 's'} available.`);
  if (metrics.verifiedNewsCount > 0) strengths.push(`${metrics.verifiedNewsCount} news item${metrics.verifiedNewsCount === 1 ? '' : 's'} passed rule-based source checks.`);
  if (irChannelCount > 0) strengths.push('Investor relations channel is present.');
  if (aiReviewed) strengths.push('Authority review signal is present.');

  if (metrics.officialSourceCount === 0) warnings.push('No official source candidates were available.');
  if (metrics.secFilingCount === 0) warnings.push('No SEC filing summaries were available.');
  if (metrics.verifiedNewsCount === 0) warnings.push('No news items passed rule-based source checks.');
  if (input.officialSources?.status === 'error') warnings.push('Official source discovery was unavailable.');
  if (input.secFilings?.status === 'error') warnings.push('SEC filing lookup was unavailable.');
  if (metrics.officialSourceCount > 0 && officialSources.some((source) => (
    Array.isArray(source?.notes)
    && source.notes.some((note) => /auto-generated|manual confirmation/i.test(String(note)))
  ))) {
    warnings.push('Some official source candidates require manual confirmation.');
  }
  if (totalSignals === 0) warnings.push('Source trust is unavailable because no usable evidence signals were returned.');
  else if (level === 'limited') warnings.push('Source trust is limited because evidence coverage is sparse.');

  notes.push('Rule-based source trust summary; no AI model was called.');
  notes.push('Score reflects source coverage and evidence availability only.');

  return {
    ticker,
    generatedAt: new Date().toISOString(),
    score,
    level,
    metrics,
    strengths,
    warnings,
    notes,
    overallScore: score,
    confidenceLevel: compatibilityConfidenceLevel(level),
    officialSourceCount: metrics.officialSourceCount,
    secFilingCount: metrics.secFilingCount,
    verifiedNewsCount: metrics.verifiedNewsCount,
    highConfidenceNewsCount,
    aiReviewed,
    mode,
  };
};
