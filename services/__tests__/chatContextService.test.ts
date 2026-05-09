import { describe, expect, it } from 'vitest';
import {
  buildContextSummaryForPrompt,
  createEmptyChatContext,
  resolveContextTicker,
  shouldUseContextForFollowup,
  updateContextFromCommandResult,
} from '../chatContextService';

describe('chatContextService', () => {
  it('updates current ticker and trims large arrays', () => {
    const context = updateContextFromCommandResult(createEmptyChatContext(), {
      ticker: 'aapl',
      command: 'news',
      intent: 'news',
      news: Array.from({ length: 12 }, (_, index) => ({ index })),
    });

    expect(context.currentTicker).toBe('AAPL');
    expect(context.lastCommand).toBe('news');
    expect(context.lastNews).toHaveLength(8);
    expect(context.lastUpdatedAt).toBeTruthy();
  });

  it('resolves explicit ticker before context and selected ticker', () => {
    expect(resolveContextTicker({
      explicitTicker: 'tsla',
      selectedTicker: 'MSFT',
      context: { currentTicker: 'AAPL' },
    })).toBe('TSLA');
  });

  it('detects follow-up language only when context has ticker', () => {
    expect(shouldUseContextForFollowup('那新闻呢', { currentTicker: 'AAPL' })).toBe(true);
    expect(shouldUseContextForFollowup('那新闻呢', {})).toBe(false);
  });

  it('builds a compact prompt summary', () => {
    const summary = buildContextSummaryForPrompt({
      currentTicker: 'AAPL',
      lastCommand: 'evidence',
      lastDataQualityNotes: ['部分数据可能为回退或延迟'],
    }, 'zh');

    expect(summary).toContain('当前标的：AAPL');
    expect(summary).toContain('/evidence AAPL');
    expect(summary).not.toContain('API key');
  });
});
