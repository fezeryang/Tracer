import { describe, expect, it } from 'vitest';
import {
  buildBackendSourceTrustSummary,
  scoreBackendNewsTrust,
  summarizeBackendEvidenceAvailability,
} from '../chatSourceTrustAggregator.js';

describe('chatSourceTrustAggregator', () => {
  it('returns high trust when official, SEC, and news evidence are available', () => {
    const summary = buildBackendSourceTrustSummary({
      ticker: 'AAPL',
      news: [{ title: 'Apple results covered by Reuters', source: 'Reuters', url: 'https://example.com' }],
      secFilings: { status: 'available', filings: [{ form: '10-K' }] },
      officialSources: { status: 'available', sources: [{ type: 'investor_relations', name: 'Apple IR' }] },
    });

    expect(summary.score).toBeGreaterThanOrEqual(70);
    expect(summary.level).toBe('high');
    expect(summary.metrics).toMatchObject({
      officialSourceCount: 1,
      secFilingCount: 1,
      newsCount: 1,
    });
  });

  it('returns limited or unavailable trust when evidence is sparse', () => {
    const summary = buildBackendSourceTrustSummary({
      ticker: 'ZZZZQ',
      news: [],
      secFilings: { status: 'error', filings: [] },
      officialSources: { status: 'error', sources: [] },
    });

    expect(['limited', 'unavailable']).toContain(summary.level);
    expect(summary.score).toBeLessThan(45);
    expect(summary.warnings.length).toBeGreaterThan(0);
  });

  it('does not expose internal raw labels in user-facing trust text', () => {
    const summary = buildBackendSourceTrustSummary({
      ticker: 'AAPL',
      news: [{ title: 'Apple news', source: 'Reuters' }],
      secFilings: { status: 'available', filings: [{ form: '10-Q' }] },
      officialSources: { status: 'available', sources: [{ type: 'official_website', name: 'Apple' }] },
    });

    expect(JSON.stringify(summary.strengths)).not.toMatch(/\w+\[[^\]]+\]/);
    expect(JSON.stringify(summary.warnings)).not.toMatch(/\w+\[[^\]]+\]/);
  });

  it('scores backend news trust and summarizes evidence availability', () => {
    expect(scoreBackendNewsTrust({ source: 'Reuters', url: 'https://example.com', title: 'Long enough title' })).toBeGreaterThan(60);
    expect(summarizeBackendEvidenceAvailability({
      news: [{ title: 'News' }],
      secFilings: { filings: [{ form: '8-K' }] },
      officialSources: { sources: [] },
    })).toMatchObject({
      newsCount: 1,
      secFilingCount: 1,
      officialSourceCount: 0,
    });
  });
});
