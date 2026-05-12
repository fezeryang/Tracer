import { describe, expect, it } from 'vitest';
import { Message } from '../../types';
import { ChatContext } from '../chatContextService';
import { planRichAnswer } from '../chatAnswerComposer';
import { buildRichBlocksForAnswer } from '../richAnswerBlockRules';

const makeContext = (overrides: Partial<ChatContext> = {}): ChatContext => ({
  currentTicker: undefined,
  lastCommand: undefined,
  lastQuote: undefined,
  lastFundamentals: undefined,
  lastNews: undefined,
  lastVerifiedNews: undefined,
  lastHistorySummary: undefined,
  lastSecFilings: undefined,
  lastOfficialSources: undefined,
  lastSourceTrust: undefined,
  lastEvidenceBundle: undefined,
  lastDataQualityNotes: undefined,
  lastDeepSeekIntentResult: undefined,
  ...overrides,
});

const chartMessage = (ticker: string): Message => ({
  id: `chart-${ticker}`,
  role: 'model',
  text: `${ticker} chart`,
  blocks: [
    {
      type: 'chart',
      title: `${ticker} Price Trend`,
      chartType: 'line',
      data: {
        ticker,
        chartData: [
          { label: '2026-01-01', value: 100 },
          { label: '2026-01-02', value: 103 },
        ],
      },
      source: 'Market Data',
      dataQuality: 'available',
      createdBy: 'tool',
      validationStatus: 'valid',
    },
  ],
});

const evidenceMessage = (ticker: string): Message => ({
  id: `evidence-${ticker}`,
  role: 'model',
  text: `${ticker} evidence`,
  blocks: [
    {
      type: 'evidence_list',
      data: {
        ticker,
        evidence: [
          { label: '10-K filing', source: 'SEC', url: 'https://www.sec.gov/' },
        ],
      },
      createdBy: 'tool',
      validationStatus: 'valid',
    },
  ],
});

describe('buildRichBlocksForAnswer', () => {
  it('attaches a recent matching chart block for a trend question', () => {
    const plan = planRichAnswer({
      userText: 'Explain this trend',
      language: 'en',
      selectedTicker: 'NVDA',
      context: makeContext({ currentTicker: 'NVDA' }),
    });

    const result = buildRichBlocksForAnswer({
      plan,
      language: 'en',
      userText: 'Explain this trend',
      selectedTicker: 'NVDA',
      context: makeContext({ currentTicker: 'NVDA' }),
      recentMessages: [chartMessage('NVDA')],
    });

    expect(result.blocks.some((block) => block.type === 'chart')).toBe(true);
    expect(result.blocks.find((block) => block.type === 'chart')?.data?.chartData).toHaveLength(2);
  });

  it('suggests /chart when trend question has no chart and does not generate fake chart data', () => {
    const plan = planRichAnswer({
      userText: '解释一下这个走势',
      language: 'zh',
      selectedTicker: 'AAPL',
      context: makeContext({ currentTicker: 'AAPL' }),
    });

    const result = buildRichBlocksForAnswer({
      plan,
      language: 'zh',
      userText: '解释一下这个走势',
      selectedTicker: 'AAPL',
      context: makeContext({ currentTicker: 'AAPL' }),
      recentMessages: [],
    });

    const actions = result.blocks.flatMap((block) => block.actions || []);
    expect(actions.some((action) => action.prompt === '/chart AAPL')).toBe(true);
    expect(JSON.stringify(result.blocks)).not.toContain('chartData');
  });

  it('attaches evidence list from context evidence bundle', () => {
    const context = makeContext({
      currentTicker: 'AAPL',
      lastEvidenceBundle: {
        items: [
          { label: 'Verified news item', source: 'News', url: 'https://example.com/news' },
        ],
      },
    });
    const plan = planRichAnswer({
      userText: 'review the evidence',
      language: 'en',
      selectedTicker: 'AAPL',
      context,
    });

    const result = buildRichBlocksForAnswer({
      plan,
      language: 'en',
      userText: 'review the evidence',
      selectedTicker: 'AAPL',
      context,
      recentMessages: [],
    });

    expect(result.blocks.some((block) => block.type === 'evidence_list')).toBe(true);
    expect(JSON.stringify(result.blocks)).toContain('Verified news item');
  });

  it('suggests /evidence when no evidence is available', () => {
    const plan = planRichAnswer({
      userText: 'what evidence should I trust?',
      language: 'en',
      selectedTicker: 'TSLA',
      context: makeContext({ currentTicker: 'TSLA' }),
    });

    const result = buildRichBlocksForAnswer({
      plan,
      language: 'en',
      userText: 'what evidence should I trust?',
      selectedTicker: 'TSLA',
      context: makeContext({ currentTicker: 'TSLA' }),
      recentMessages: [],
    });

    const actions = result.blocks.flatMap((block) => block.actions || []);
    expect(actions.some((action) => action.prompt === '/evidence TSLA')).toBe(true);
  });

  it('attaches source_trust from context', () => {
    const context = makeContext({
      currentTicker: 'NVDA',
      lastSourceTrust: { ticker: 'NVDA', overallScore: 82, confidenceLevel: 'high' },
    });
    const plan = planRichAnswer({
      userText: 'is this source credible?',
      language: 'en',
      selectedTicker: 'NVDA',
      context,
    });

    const result = buildRichBlocksForAnswer({
      plan,
      language: 'en',
      userText: 'is this source credible?',
      selectedTicker: 'NVDA',
      context,
      recentMessages: [],
    });

    expect(result.blocks.some((block) => block.type === 'source_trust')).toBe(true);
  });

  it('attaches verified formula blocks for P/E and CAGR', () => {
    const pePlan = planRichAnswer({ userText: '解释一下 P/E 是什么', language: 'zh' });
    const cagrPlan = planRichAnswer({ userText: 'what is CAGR?', language: 'en' });

    const peResult = buildRichBlocksForAnswer({
      plan: pePlan,
      language: 'zh',
      userText: '解释一下 P/E 是什么',
      recentMessages: [],
    });
    const cagrResult = buildRichBlocksForAnswer({
      plan: cagrPlan,
      language: 'en',
      userText: 'what is CAGR?',
      recentMessages: [],
    });

    expect(peResult.blocks.find((block) => block.type === 'formula')?.formulaId).toBe('pe_ratio');
    expect(cagrResult.blocks.find((block) => block.type === 'formula')?.formulaId).toBe('cagr');
  });

  it('attaches a validated system Mermaid block for diagram requests', () => {
    const plan = planRichAnswer({
      userText: '画一下研究链路',
      language: 'zh',
      selectedTicker: 'AAPL',
      context: makeContext({ currentTicker: 'AAPL' }),
    });

    const result = buildRichBlocksForAnswer({
      plan,
      language: 'zh',
      userText: '画一下研究链路',
      selectedTicker: 'AAPL',
      context: makeContext({ currentTicker: 'AAPL' }),
      recentMessages: [],
    });

    const mermaid = result.blocks.find((block) => block.type === 'mermaid');
    expect(mermaid).toMatchObject({
      createdBy: 'system',
      validated: true,
      validationStatus: 'valid',
    });
  });

  it('limits blocks to 5 and avoids unsafe trading action labels', () => {
    const context = makeContext({
      currentTicker: 'AAPL',
      lastEvidenceBundle: {
        items: [{ label: '10-K filing', source: 'SEC', url: 'https://www.sec.gov/' }],
      },
      lastSourceTrust: { ticker: 'AAPL', overallScore: 75, confidenceLevel: 'medium' },
      lastDataQualityNotes: ['Delayed quote'],
      lastSecFilings: [
        { form: '10-K', filingDate: '2026-01-01', description: 'Annual report', url: 'https://www.sec.gov/' },
      ],
    });
    const plan = planRichAnswer({
      userText: 'show evidence chain and risk with CAGR trend',
      language: 'en',
      selectedTicker: 'AAPL',
      context,
    });

    const result = buildRichBlocksForAnswer({
      plan,
      language: 'en',
      userText: 'show evidence chain and risk with CAGR trend',
      selectedTicker: 'AAPL',
      context,
      recentMessages: [chartMessage('AAPL'), evidenceMessage('AAPL')],
    });

    expect(result.blocks.length).toBeLessThanOrEqual(5);
    const labels = result.blocks.flatMap((block) => block.actions || []).map((action) => action.label).join(' ');
    expect(labels).not.toMatch(/\b(Buy|Sell|Hold)\b/i);
  });

  it('does not create fake table rows when SEC filings are missing', () => {
    const plan = planRichAnswer({
      userText: 'review SEC evidence',
      language: 'en',
      selectedTicker: 'MSFT',
      context: makeContext({ currentTicker: 'MSFT' }),
    });

    const result = buildRichBlocksForAnswer({
      plan,
      language: 'en',
      userText: 'review SEC evidence',
      selectedTicker: 'MSFT',
      context: makeContext({ currentTicker: 'MSFT' }),
      recentMessages: [],
    });

    expect(result.blocks.some((block) => block.type === 'data_table')).toBe(false);
    expect(JSON.stringify(result.blocks)).not.toContain('"rows"');
  });

  it('handles missing ticker safely and does not include raw JSON', () => {
    const plan = planRichAnswer({ userText: 'explain this trend', language: 'en' });
    const result = buildRichBlocksForAnswer({
      plan,
      language: 'en',
      userText: 'explain this trend',
      recentMessages: [],
    });

    expect(JSON.stringify(result.blocks)).not.toMatch(/\{"role"|raw|api[_-]?key/i);
    expect(result.blocks.every((block) => block.createdBy === 'system')).toBe(true);
  });
});
