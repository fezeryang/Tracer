import { describe, expect, it } from 'vitest';
import {
  buildNewsEvidenceItems,
  buildSecEvidenceItems,
  buildSourceTrustEvidenceItem,
  capEvidenceItems,
} from '../chatEvidenceBuilderService.js';

describe('chatEvidenceBuilderService', () => {
  it('caps evidence items at 8 by default', () => {
    const items = capEvidenceItems(Array.from({ length: 20 }, (_, index) => ({
      id: `item-${index}`,
      type: 'news',
      title: `News ${index}`,
    })));

    expect(items).toHaveLength(8);
  });

  it('uses safe fallbacks for missing fields and unsafe URLs', () => {
    const [item] = buildNewsEvidenceItems({
      ticker: 'AAPL',
      news: [{ body: 'large raw article body', url: 'javascript:alert(1)' }],
      limit: 1,
    });

    expect(item).toMatchObject({
      type: 'news',
      title: 'News item',
      source: 'News',
    });
    expect(item.url).toBeUndefined();
  });

  it('does not include raw article body in evidence items', () => {
    const items = buildNewsEvidenceItems({
      ticker: 'AAPL',
      news: [{
        title: 'Apple expands services',
        source: 'Reuters',
        text: 'This is a long body that must not be copied into evidence items.',
        body: 'raw body must not leak',
        url: 'https://example.com/news',
      }],
    });

    expect(JSON.stringify(items)).not.toContain('raw body');
    expect(JSON.stringify(items)).not.toContain('long body');
  });

  it('builds SEC and source trust evidence with safe titles', () => {
    const secItems = buildSecEvidenceItems({
      ticker: 'AAPL',
      filings: [{ form: '10-K', filingDate: '2026-02-01', url: 'https://www.sec.gov/aapl' }],
    });
    const trustItem = buildSourceTrustEvidenceItem({
      trustSummary: { ticker: 'AAPL', score: 82, level: 'high', generatedAt: '2026-05-13T00:00:00.000Z' },
    });

    expect(secItems[0]).toMatchObject({ type: 'sec_filing', source: 'SEC EDGAR' });
    expect(trustItem.title).toBe('Source Trust Score: 82/100');
  });
});
