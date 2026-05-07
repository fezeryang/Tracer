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

  // Multi-dimensional scoring (max 100)
  // Dimension 1: Source diversity (max 30)
  const distinctTypes = new Set(officialSources?.sources.map((s) => s.type) || []).size;
  const sourceDiversityScore = Math.min(distinctTypes * 8, 30);

  // Dimension 2: Authority depth (max 35)
  let authorityDepthScore = 0;
  if (secFilingCount > 0) authorityDepthScore += 18;
  const irChannelCount = officialSources?.sources.filter((s) => s.type === 'investor_relations').length || 0;
  if (irChannelCount > 0) authorityDepthScore += 10;
  const officialChannelCount = officialSources?.sources.filter((s) =>
    ['official_website', 'newsroom', 'press_release', 'exchange'].includes(s.type)
  ).length || 0;
  if (officialChannelCount > 0) authorityDepthScore += 7;
  authorityDepthScore = Math.min(authorityDepthScore, 35);

  // Dimension 3: Cross-verification (max 20)
  let crossVerificationScore = 0;
  if (officialSourceCount >= 2 && secFilingCount > 0) crossVerificationScore += 12;
  crossVerificationScore += Math.min(highConfidenceNewsCount * 2, 8);
  crossVerificationScore = Math.min(crossVerificationScore, 20);

  // Dimension 4: Mode bonus (max 15)
  let modeBonus = 0;
  if (mode === 'rule_plus_ai' && aiReviewed) modeBonus += 10;
  if (mode === 'rule_plus_ai' && !aiReviewed) modeBonus += 5;
  modeBonus = Math.min(modeBonus, 15);

  const score = sourceDiversityScore + authorityDepthScore + crossVerificationScore + modeBonus;

  const overallScore = clampScore(score);
  const strengths: string[] = [];
  const warnings: string[] = [];
  const notes: string[] = [];

  // Named strengths with specific details
  if (officialSourceCount > 0) strengths.push(`official_sources_available[${officialSourceCount} sources, ${distinctTypes} types]`);
  if (secFilingCount > 0) strengths.push(`sec_filings_available[${secFilingCount} filings]`);
  if (verifiedNewsCount > 0) strengths.push(`verified_news_available[${verifiedNewsCount} items]`);
  if (highConfidenceNewsCount > 0) strengths.push(`high_confidence_news[${highConfidenceNewsCount} >= 75]`);
  if (aiReviewed) strengths.push('ai_authority_review[deepseek]');
  if (irChannelCount > 0) strengths.push(`ir_channels_found[${irChannelCount}]`);
  if (sourceDiversityScore >= 24) strengths.push(`source_diversity[score=${sourceDiversityScore}/30]`);
  if (authorityDepthScore >= 28) strengths.push(`authority_depth[score=${authorityDepthScore}/35]`);

  // Named warnings with specific details
  if (officialSourceCount === 0) warnings.push('official_sources_missing[no_official_source_found]');
  if (secFilingCount === 0) warnings.push('sec_filings_missing[no_sec_filings]');
  if (verifiedNewsCount === 0) warnings.push('verified_news_missing[no_verified_news]');
  if (officialSources?.status === 'error') warnings.push('official_source_lookup_error[lookup_failed]');
  if (officialFilings?.status === 'error') warnings.push('sec_lookup_error[sec_fetch_failed]');
  if (officialSources?.sources.some((s) => s.notes?.some((n) => n.includes('Auto-generated') || n.includes('manual confirmation')))) {
    warnings.push('auto_generated_sources_present[requires_manual_confirmation]');
  }
  if (crossVerificationScore < 8) warnings.push(`cross_verification_weak[score=${crossVerificationScore}/20]`);

  notes.push('source_trust_scoring_v2[4-dimensional]');
  notes.push(`scoring_dimensions[div=${sourceDiversityScore}/30, auth=${authorityDepthScore}/35, cross=${crossVerificationScore}/20, mode=${modeBonus}/15]`);
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
