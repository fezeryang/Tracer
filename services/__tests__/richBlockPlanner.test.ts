import { describe, expect, it } from 'vitest';
import { Message } from '../../types';
import { ChatContext } from '../chatContextService';
import { planRichBlocksForAnswer } from '../richBlockPlanner';

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
          { label: '2026-01-02', value: 102 },
        ],
      },
      source: 'Market Data',
      dataQuality: 'available',
      createdBy: 'tool',
      validationStatus: 'valid',
    },
  ],
});

const makeContext = (overrides: Partial<ChatContext> = {}): ChatContext => ({
  currentTicker: undefined,
  lastHistorySummary: undefined,
  lastEvidenceBundle: undefined,
  ...overrides,
});

describe('planRichBlocksForAnswer', () => {
  it('reuses an existing chart block when a trend question matches the recent ticker', () => {
    const result = planRichBlocksForAnswer({
      language: 'en',
      userText: 'Explain this trend',
      selectedTicker: 'NVDA',
      context: makeContext({ currentTicker: 'NVDA' }),
      recentMessages: [chartMessage('NVDA')],
    });

    expect(result.reason).toBe('reused_recent_chart_block');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('chart');
    expect(result.blocks[0].data?.chartData).toHaveLength(2);
  });

  it('does not create chart points from history summary only', () => {
    const result = planRichBlocksForAnswer({
      language: 'en',
      userText: 'show the chart trend',
      selectedTicker: 'TSLA',
      context: makeContext({
        currentTicker: 'TSLA',
        lastHistorySummary: {
          ticker: 'TSLA',
          points: 252,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
          latestClose: 250,
        },
      }),
      recentMessages: [],
    });

    expect(result.reason).toBe('history_summary_only');
    expect(result.blocks.some((block) => block.type === 'chart')).toBe(false);
  });

  it('returns an action suggestion when no reusable chart data exists', () => {
    const result = planRichBlocksForAnswer({
      language: 'zh',
      userText: '解释一下这个走势',
      selectedTicker: 'AAPL',
      context: makeContext({ currentTicker: 'AAPL' }),
      recentMessages: [],
    });

    expect(result.reason).toBe('no_reusable_chart_block');
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].type).toBe('action_buttons');
    expect(result.blocks[0].actions?.[0].prompt).toBe('/chart AAPL');
  });

  it('does not generate fake chart data in any fallback path', () => {
    const result = planRichBlocksForAnswer({
      language: 'en',
      userText: 'price action please',
      selectedTicker: 'MSFT',
      context: makeContext({ currentTicker: 'MSFT' }),
      recentMessages: [],
    });

    expect(JSON.stringify(result.blocks)).not.toContain('chartData');
  });

  it('returns a validated research workflow mermaid block', () => {
    const result = planRichBlocksForAnswer({
      language: 'zh',
      userText: '帮我画一下这个股票的研究链路',
      selectedTicker: 'AAPL',
      context: makeContext({ currentTicker: 'AAPL' }),
      recentMessages: [],
    });

    expect(result.reason).toBe('mermaid_research_workflow');
    expect(result.blocks[0]).toMatchObject({
      type: 'mermaid',
      createdBy: 'system',
      validated: true,
      diagramType: 'flowchart',
      validationStatus: 'valid',
    });
  });

  it('returns a validated evidence chain mermaid block', () => {
    const result = planRichBlocksForAnswer({
      language: 'en',
      userText: 'draw an evidence chain',
      selectedTicker: 'TSLA',
      context: makeContext({ currentTicker: 'TSLA' }),
      recentMessages: [],
    });

    expect(result.reason).toBe('mermaid_evidence_chain');
    expect(result.blocks[0].content).toContain('Evidence Drawer');
    expect(result.blocks[0].validated).toBe(true);
  });

  it('returns a validated risk transmission mermaid block', () => {
    const result = planRichBlocksForAnswer({
      language: 'zh',
      userText: '画一下新闻到风险的传导路径',
      selectedTicker: 'NVDA',
      context: makeContext({ currentTicker: 'NVDA' }),
      recentMessages: [],
    });

    expect(result.reason).toBe('mermaid_risk_transmission');
    expect(result.blocks[0].content).toContain('风险提示');
    expect(result.blocks[0].createdBy).toBe('system');
  });

  it('returns a validated data quality mermaid block', () => {
    const result = planRichBlocksForAnswer({
      language: 'en',
      userText: 'show a data quality process map',
      selectedTicker: 'MSFT',
      context: makeContext({ currentTicker: 'MSFT' }),
      recentMessages: [],
    });

    expect(result.reason).toBe('mermaid_data_quality_flow');
    expect(result.blocks[0].content).toContain('DataQualityCard');
    expect(result.blocks[0].validated).toBe(true);
  });

  it('does not return a mermaid block when user does not ask for a diagram', () => {
    const result = planRichBlocksForAnswer({
      language: 'en',
      userText: 'summarize the latest research context',
      selectedTicker: 'AAPL',
      context: makeContext({ currentTicker: 'AAPL' }),
      recentMessages: [],
    });

    expect(result.blocks.some((block) => block.type === 'mermaid')).toBe(false);
  });
});
