import { describe, expect, it } from 'vitest';
import {
  buildQuoteBlocks,
  buildSecTableBlocks,
  buildEvidenceBundleBlocks,
  buildDataQualityBlock,
} from '../chatBlockBuilderService.js';

describe('chatBlockBuilderService', () => {
  it('builds valid quote blocks without raw payload leakage', () => {
    const blocks = buildQuoteBlocks({
      ticker: 'AAPL',
      quote: {
        symbol: 'AAPL',
        price: 189.12,
        previousClose: 187.5,
        change: 1.62,
        changePercent: 0.864,
        source: 'Market Data',
        apiKey: 'secret',
      },
    });

    expect(blocks.map((block) => block.type)).toEqual(['metric_grid', 'evidence_list']);
    expect(blocks.every((block) => block.createdBy === 'tool')).toBe(true);
    expect(JSON.stringify(blocks)).not.toContain('secret');
  });

  it('caps SEC table rows in the builder layer', () => {
    const blocks = buildSecTableBlocks({
      ticker: 'AAPL',
      filings: Array.from({ length: 20 }, (_, index) => ({
        form: '10-Q',
        filingDate: `2026-04-${String(index + 1).padStart(2, '0')}`,
        description: `Filing ${index + 1}`,
        url: `https://www.sec.gov/${index + 1}`,
      })),
    });

    const table = blocks.find((block) => block.type === 'data_table');
    expect(table?.rows).toHaveLength(10);
    expect(table?.validationStatus).toBe('valid');
  });

  it('builds evidence bundle blocks without raw JSON strings', () => {
    const blocks = buildEvidenceBundleBlocks({
      ticker: 'AAPL',
      evidenceListItems: [
        {
          label: 'Apple evidence',
          source: 'SEC EDGAR',
          url: 'https://www.sec.gov/example',
          raw: { apiKey: 'secret' },
        },
      ],
      trustSummary: {
        ticker: 'AAPL',
        score: 80,
        level: 'high',
        overallScore: 80,
        confidenceLevel: 'high',
        strengths: ['Official sources available'],
        warnings: [],
        notes: [],
        metrics: { officialSourceCount: 1, secFilingCount: 1, newsCount: 1, verifiedNewsCount: 1 },
      },
      secFilings: [],
      dataQualityNotes: [],
      warnings: [],
      language: 'en',
    });

    expect(blocks.map((block) => block.type)).toContain('evidence_list');
    expect(JSON.stringify(blocks)).not.toContain('apiKey');
    expect(JSON.stringify(blocks)).not.toContain('secret');
  });

  it('marks data quality as limited for partial failures', () => {
    const block = buildDataQualityBlock({
      quote: undefined,
      fundamentals: undefined,
      news: [],
      notes: ['Quote data is currently unavailable.'],
      warnings: ['backend_quote_unavailable'],
    });

    expect(block.type).toBe('data_quality');
    expect(block.dataQuality).toBe('limited');
    expect(block.validationStatus).toBe('limited');
  });
});
