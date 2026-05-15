export interface ChatEvidenceInput {
  ticker?: string;
  quote?: Record<string, unknown>;
  news?: unknown[];
  filings?: unknown[];
  sources?: unknown[];
  trustSummary?: Record<string, unknown>;
  limit?: number;
}

export function buildQuoteEvidenceItem(input: ChatEvidenceInput): Record<string, unknown>;
export function buildNewsEvidenceItems(input: ChatEvidenceInput): Record<string, unknown>[];
export function buildSecEvidenceItems(input: ChatEvidenceInput): Record<string, unknown>[];
export function buildOfficialSourceEvidenceItems(input: ChatEvidenceInput): Record<string, unknown>[];
export function buildSourceTrustEvidenceItem(input: ChatEvidenceInput): Record<string, unknown>;
export function capEvidenceItems(items: unknown[], max?: number): Record<string, unknown>[];
