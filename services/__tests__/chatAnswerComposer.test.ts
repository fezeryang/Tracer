import { describe, expect, it } from 'vitest';
import {
  composeFinancialChatAnswer,
  buildRichContextSummary,
  planRichAnswer,
  sanitizeFinancialSafetyText,
} from '../chatAnswerComposer';
import { ChatContext } from '../chatContextService';

function makeContext(overrides: Partial<ChatContext> = {}): ChatContext {
  return {
    currentTicker: undefined,
    lastCommand: undefined,
    lastQuote: undefined,
    lastFundamentals: undefined,
    lastNews: undefined,
    lastSecFilings: undefined,
    lastOfficialSources: undefined,
    lastSourceTrust: undefined,
    lastEvidenceBundle: undefined,
    lastDataQualityNotes: undefined,
    lastHistorySummary: undefined,
    lastDeepSeekIntentResult: undefined,
    ...overrides,
  };
}

describe('composeFinancialChatAnswer', () => {
  it('returns non-empty systemPrefix, userPrompt, safetyInstructions, contextSummary', () => {
    const result = composeFinancialChatAnswer({
      userText: '分析 NVDA 的长期竞争优势',
      context: makeContext({ currentTicker: 'NVDA' }),
      language: 'zh',
    });

    expect(result.systemPrefix).toBeTruthy();
    expect(result.userPrompt).toBeTruthy();
    expect(result.safetyInstructions).toBeTruthy();
    expect(result.contextSummary).toBeTruthy();
  });

  it('contextSummary contains ticker when currentTicker is set', () => {
    const ctx = makeContext({ currentTicker: 'AAPL' });
    const summary = buildRichContextSummary(ctx, 'en');

    expect(summary).toContain('AAPL');
  });

  it('contextSummary contains news titles (first 3) when lastNews has items', () => {
    const ctx = makeContext({
      lastNews: [
        { title: 'Apple Launches New Product' },
        { title: 'Market Rally Continues' },
        { title: 'Fed Signals Rate Pause' },
        { title: 'Oil Prices Drop' },
        { title: 'Tech Sector Outlook' },
        { title: 'Should not appear' },
      ],
    });

    const summary = buildRichContextSummary(ctx, 'en');

    expect(summary).toContain('Apple Launches New Product');
    expect(summary).toContain('Market Rally Continues');
    expect(summary).toContain('Fed Signals Rate Pause');
    expect(summary).not.toContain('Oil Prices Drop');
  });

  it('contextSummary contains SEC filing form/date when lastSecFilings has items', () => {
    const ctx = makeContext({
      lastSecFilings: [
        { form: '10-K', filingDate: '2025-11-30' },
        { form: '8-K', filingDate: '2026-01-15' },
      ],
    });

    const summary = buildRichContextSummary(ctx, 'en');

    expect(summary).toContain('10-K');
    expect(summary).toContain('2025-11-30');
    expect(summary).toContain('8-K');
  });

  it('contextSummary contains trust score when lastSourceTrust has overallScore', () => {
    const ctx = makeContext({
      lastSourceTrust: { overallScore: 85, confidenceLevel: 'high' },
    });

    const summary = buildRichContextSummary(ctx, 'en');

    expect(summary).toContain('85');
    expect(summary).toContain('high');
  });

  it('safetyInstructions prohibits directional trading ratings without banned labels', () => {
    const result = composeFinancialChatAnswer({
      userText: 'Should I buy NVDA?',
      context: makeContext(),
      language: 'en',
    });

    expect(result.safetyInstructions).toContain('directional trading ratings');
    expect(result.safetyInstructions).not.toContain('Buy/Sell/Hold');
  });

  it('output does NOT contain lastDeepSeekIntentResult content', () => {
    const ctx = makeContext({
      currentTicker: 'TSLA',
      lastDeepSeekIntentResult: {
        intent: 'buy_recommendation',
        confidence: 0.95,
        secretKey: 'should-not-leak',
      },
    });

    const summary = buildRichContextSummary(ctx, 'en');

    expect(summary).not.toContain('lastDeepSeekIntentResult');
    expect(summary).not.toContain('buy_recommendation');
    expect(summary).not.toContain('secretKey');
    expect(summary).not.toContain('should-not-leak');
  });

  it('empty context does not crash and produces minimal output', () => {
    const ctx = makeContext();

    expect(() => {
      const summary = buildRichContextSummary(ctx, 'en');
      expect(typeof summary).toBe('string');

      const result = composeFinancialChatAnswer({
        userText: 'hello',
        context: ctx,
        language: 'en',
      });
      expect(result.userPrompt).toContain('hello');
    }).not.toThrow();
  });

  it('both zh and en produce correct language output', () => {
    const ctx = makeContext({ currentTicker: 'AAPL' });

    const zhResult = composeFinancialChatAnswer({
      userText: '分析 AAPL',
      context: ctx,
      language: 'zh',
    });
    const enResult = composeFinancialChatAnswer({
      userText: 'analyze AAPL',
      context: ctx,
      language: 'en',
    });

    // ZH uses Chinese labels
    expect(zhResult.safetyInstructions).toContain('方向性交易评级');
    expect(zhResult.userPrompt).toContain('用户问题');

    // EN uses English labels
    expect(enResult.safetyInstructions).toContain('directional trading ratings');
    expect(enResult.userPrompt).toContain('User question');

    // Both contain the ticker
    expect(zhResult.contextSummary).toContain('AAPL');
    expect(enResult.contextSummary).toContain('AAPL');
  });

  it('lastNews with >3 items only includes first 3', () => {
    const ctx = makeContext({
      lastNews: [
        { title: 'News 1' },
        { title: 'News 2' },
        { title: 'News 3' },
        { title: 'News 4' },
        { title: 'News 5' },
      ],
    });

    const summary = buildRichContextSummary(ctx, 'en');

    expect(summary).toContain('News 1');
    expect(summary).toContain('News 2');
    expect(summary).toContain('News 3');
    expect(summary).not.toContain('News 4');
    expect(summary).not.toContain('News 5');
  });
});

describe('planRichAnswer', () => {
  it('recommends chart-oriented blocks for trend questions', () => {
    const result = planRichAnswer({
      userText: 'Explain this price action trend',
      context: makeContext({ currentTicker: 'NVDA' }),
      selectedTicker: 'NVDA',
      language: 'en',
    });

    expect(result.purpose).toBe('explain_trend');
    expect(result.recommendedBlockKinds).toEqual(
      expect.arrayContaining(['chart', 'data_quality', 'action_buttons', 'disclaimer']),
    );
  });

  it('recommends evidence and source trust blocks for evidence questions', () => {
    const result = planRichAnswer({
      userText: '结合证据和 SEC 来源看什么？',
      context: makeContext({ currentTicker: 'AAPL' }),
      selectedTicker: 'AAPL',
      language: 'zh',
    });

    expect(result.purpose).toBe('review_evidence');
    expect(result.recommendedBlockKinds).toEqual(
      expect.arrayContaining(['evidence_list', 'source_trust', 'data_table', 'action_buttons', 'disclaimer']),
    );
  });

  it('recommends formula blocks for formula questions', () => {
    const result = planRichAnswer({
      userText: 'P/E 怎么算？',
      language: 'zh',
    });

    expect(result.purpose).toBe('explain_formula');
    expect(result.recommendedBlockKinds).toEqual(
      expect.arrayContaining(['formula', 'action_buttons', 'disclaimer']),
    );
  });

  it('recommends Mermaid blocks only as a kind, without generated block data', () => {
    const result = planRichAnswer({
      userText: 'draw an evidence chain workflow',
      language: 'en',
    });

    expect(result.purpose).toBe('explain_context');
    expect(result.recommendedBlockKinds).toContain('mermaid');
    expect(JSON.stringify(result)).not.toContain('flowchart');
    expect(JSON.stringify(result)).not.toContain('chartData');
  });

  it('falls back to general for unmatched prompts', () => {
    const result = planRichAnswer({
      userText: 'hello',
      language: 'en',
    });

    expect(result.purpose).toBe('general');
    expect(result.recommendedBlockKinds).toEqual([]);
  });
});

describe('sanitizeFinancialSafetyText', () => {
  it('removes prohibited visible trading words from Gemini text', () => {
    const result = sanitizeFinancialSafetyText(
      'No Buy/Sell/Hold, no target price, no entry point, no stop-loss. 不要买入、卖出、持有、抄底、加仓、减仓。',
    );

    expect(result).not.toMatch(/Buy|Sell|Hold|target price|entry point|stop-loss|买入|卖出|持有|抄底|加仓|减仓/i);
    expect(result).toContain('directional trading rating');
    expect(result).toContain('方向性交易评级');
  });

  it('sanitizes news-style titles that contain action wording', () => {
    const result = sanitizeFinancialSafetyText('Should You Buy Nvidia Before Earnings?');

    expect(result).not.toMatch(/\bBuy\b/i);
    expect(result).toContain('directional trading rating');
  });
});
