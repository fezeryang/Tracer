import { describe, it, expect } from 'vitest';
import { detectChatIntent } from '../chatIntentRouter';

const DEFAULT_TICKER = 'NVDA';

describe('detectChatIntent', () => {
  describe('quote detection', () => {
    it('detects "show me the quote for AAPL" with ticker AAPL', () => {
      const r = detectChatIntent('show me the quote for AAPL', DEFAULT_TICKER);
      expect(r.name).toBe('quote');
      expect(r.ticker).toBe('AAPL');
      expect(r.confidence).toBeGreaterThanOrEqual(0.80);
      expect(r.source).toBe('local_rule');
    });

    it('detects "what is the price of TSLA"', () => {
      const r = detectChatIntent('what is the price of TSLA', DEFAULT_TICKER);
      expect(r.name).toBe('quote');
      expect(r.ticker).toBe('TSLA');
    });

    it('detects Chinese "查看 AAPL 的行情"', () => {
      const r = detectChatIntent('查看 AAPL 的行情', DEFAULT_TICKER);
      expect(r.name).toBe('quote');
      expect(r.ticker).toBe('AAPL');
    });

    it('falls back to selectedTicker for "show me the current price"', () => {
      const r = detectChatIntent('show me the current price', 'SPY');
      expect(r.name).toBe('quote');
      expect(r.ticker).toBe('SPY');
      expect(r.confidence).toBeGreaterThanOrEqual(0.75);
    });

    it('returns unknown if no ticker and no selectedTicker for quote', () => {
      const r = detectChatIntent('show me the current price', '');
      expect(r.name).toBe('unknown');
    });
  });

  describe('news detection', () => {
    it('detects "latest news about AAPL"', () => {
      const r = detectChatIntent('latest news about AAPL', DEFAULT_TICKER);
      expect(r.name).toBe('news');
      expect(r.ticker).toBe('AAPL');
    });

    it('falls back for "show news"', () => {
      const r = detectChatIntent('show news', 'MSFT');
      expect(r.name).toBe('news');
      expect(r.ticker).toBe('MSFT');
    });
  });

  describe('fundamentals detection', () => {
    it('detects "fundamentals of NVDA"', () => {
      const r = detectChatIntent('fundamentals of NVDA', DEFAULT_TICKER);
      expect(r.name).toBe('fundamentals');
      expect(r.ticker).toBe('NVDA');
    });

    it('detects Chinese "查看基本面 AAPL"', () => {
      const r = detectChatIntent('查看基本面 AAPL', '');
      expect(r.name).toBe('fundamentals');
      expect(r.ticker).toBe('AAPL');
    });
  });

  describe('report detection', () => {
    it('detects "generate report for AAPL"', () => {
      const r = detectChatIntent('generate report for AAPL', DEFAULT_TICKER);
      expect(r.name).toBe('report');
      expect(r.ticker).toBe('AAPL');
    });

    it('detects Chinese "生成 AAPL 研究报告"', () => {
      const r = detectChatIntent('生成 AAPL 研究报告', '');
      expect(r.name).toBe('report');
    });
  });

  describe('navigate commands', () => {
    it('detects "options chain for AAPL"', () => {
      const r = detectChatIntent('options chain for AAPL', DEFAULT_TICKER);
      expect(r.name).toBe('chain');
    });

    it('detects "backtest NVDA"', () => {
      const r = detectChatIntent('run backtest NVDA', DEFAULT_TICKER);
      expect(r.name).toBe('backtest');
    });
  });

  describe('help / clear', () => {
    it('detects "help" with no ticker', () => {
      const r = detectChatIntent('help', DEFAULT_TICKER);
      expect(r.name).toBe('help');
      expect(r.confidence).toBeGreaterThanOrEqual(0.80);
      expect(r.ticker).toBeUndefined();
    });

    it('detects Chinese "清空对话"', () => {
      const r = detectChatIntent('清空对话', DEFAULT_TICKER);
      expect(r.name).toBe('clear');
    });
  });

  describe('unknown fallback', () => {
    it('returns unknown for open-ended chat', () => {
      const r = detectChatIntent('what do you think about the market', DEFAULT_TICKER);
      expect(r.name).toBe('unknown');
    });

    it('returns unknown for empty input', () => {
      const r = detectChatIntent('', DEFAULT_TICKER);
      expect(r.name).toBe('unknown');
      expect(r.confidence).toBe(0);
    });

    it('returns unknown for short nonsense', () => {
      const r = detectChatIntent('x', DEFAULT_TICKER);
      expect(r.name).toBe('unknown');
    });
  });

  describe('confidence threshold', () => {
    it('confidence is exactly 0.95 for direct ticker match', () => {
      const r = detectChatIntent('quote for AAPL', DEFAULT_TICKER);
      expect(r.name).toBe('quote');
      expect(r.confidence).toBe(0.95);
    });

    it('confidence is 0.80 for selectedTicker fallback', () => {
      const r = detectChatIntent('show me the current price', DEFAULT_TICKER);
      expect(r.name).toBe('quote');
      expect(r.confidence).toBe(0.80);
    });
  });

  describe('false positives filtered', () => {
    it('does not treat "AI" as a ticker', () => {
      const r = detectChatIntent('news about AI stocks', 'AAPL');
      // "AI" should be filtered, so falls back to selectedTicker
      expect(r.ticker).not.toBe('AI');
    });
  });
});
