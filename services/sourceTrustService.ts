import {
  OfficialSourceVerification,
  SecFilingVerification,
  SourceTrustLevel,
  SourceTrustSummary,
  VerifiedNewsItem,
} from '../types';

const clampScore = (score: number) => Math.max(0, Math.min(100, score));

const getConfidenceLevel = (score: number): SourceTrustLevel => {
  if (score >= 75) return 'high';
  if (score >= 45) return 'medium';
  if (score > 0) return 'low';
  return 'unknown';
};

export const buildSourceTrustSummary = ({
  ticker,
  verifiedNews,
  officialFilings,
  officialSources,
}: {
  ticker: string;
  verifiedNews?: VerifiedNewsItem[];
  officialFilings?: SecFilingVerification;
  officialSources?: OfficialSourceVerification;
}): SourceTrustSummary => {
  const newsItems = verifiedNews || [];
  const officialSourceCount = officialSources?.sources.length || 0;
  const secFilingCount = officialFilings?.filings.length || 0;
  const verifiedNewsCount = newsItems.length;
  const highConfidenceNewsCount = newsItems.filter((item) => item.confidenceScore >= 75).length;
  const mode = officialSources?.mode || 'rule_only';
  const aiReviewed = Boolean(officialSources?.sources.some((source) => source.aiReviewed));

  let score = 0;
  if (officialSourceCount > 0) score += 30;
  if (secFilingCount > 0) score += 25;
  if (verifiedNewsCount > 0) score += 20;
  score += Math.min(highConfidenceNewsCount * 3, 15);
  if (mode === 'rule_plus_ai') score += 10;
  if (officialSources?.status === 'not_found' || officialSources?.status === 'error') score -= 10;
  if (officialFilings?.status === 'error') score -= 5;
  if (verifiedNewsCount === 0) score -= 5;

  const overallScore = clampScore(score);
  const strengths: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  if (officialSourceCount > 0) strengths.push('official_sources_available');
  if (secFilingCount > 0) strengths.push('sec_filings_available');
  if (verifiedNewsCount > 0) strengths.push('verified_news_available');
  if (highConfidenceNewsCount > 0) strengths.push('high_confidence_news_available');
  if (aiReviewed) strengths.push('ai_authority_review_available');

  if (officialSourceCount === 0) warnings.push('official_sources_missing');
  if (secFilingCount === 0) warnings.push('sec_filings_missing');
  if (verifiedNewsCount === 0) warnings.push('verified_news_missing');
  if (officialSources?.status === 'error') warnings.push('official_source_lookup_error');
  if (officialFilings?.status === 'error') warnings.push('sec_lookup_error');

  notes.push('source_trust_uses_existing_report_data');
  notes.push(mode === 'rule_plus_ai' ? 'deepseek_review_signal_present' : 'rule_only_mode');

  return {
    ticker,
    generatedAt: new Date().toISOString(),
    overallScore,
    confidenceLevel: getConfidenceLevel(overallScore),
    officialSourceCount,
    secFilingCount,
    verifiedNewsCount,
    highConfidenceNewsCount,
    aiReviewed,
    mode,
    strengths,
    warnings,
    notes,
  };
};
