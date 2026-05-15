export interface BackendSourceTrustSummary {
  ticker: string;
  generatedAt: string;
  score: number;
  level: 'high' | 'medium' | 'low' | 'limited' | 'unavailable';
  strengths: string[];
  warnings: string[];
  notes: string[];
  metrics: {
    officialSourceCount: number;
    secFilingCount: number;
    newsCount: number;
    verifiedNewsCount: number;
  };
  overallScore: number;
  confidenceLevel: 'high' | 'medium' | 'low' | 'unknown';
  officialSourceCount: number;
  secFilingCount: number;
  verifiedNewsCount: number;
  highConfidenceNewsCount: number;
  aiReviewed: boolean;
  mode: 'rule_only' | 'rule_plus_ai';
}

export function buildBackendSourceTrustSummary(input?: Record<string, unknown>): BackendSourceTrustSummary;
export function buildBackendVerifiedNewsItems(input?: Record<string, unknown>): Record<string, unknown>[];
export function scoreBackendNewsTrust(input?: Record<string, unknown>): number;
export function summarizeBackendEvidenceAvailability(input?: Record<string, unknown>): BackendSourceTrustSummary['metrics'];
