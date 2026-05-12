import { describe, expect, it } from 'vitest';
import {
  getStarterSuggestions,
  getContextualSuggestions,
  getDynamicPlaceholder,
} from '../chatSuggestionService';

describe('chatSuggestionService', () => {
  describe('getStarterSuggestions', () => {
    it('No ticker starter includes /help', () => {
      const suggestions = getStarterSuggestions({ language: 'en' });
      const helpSuggestion = suggestions.find((s) => s.command === 'help');
      expect(helpSuggestion).toBeDefined();
      expect(helpSuggestion?.label).toBeTruthy();
      expect(helpSuggestion?.prompt).toBe('/help');
    });

    it('Ticker starter includes ticker references', () => {
      const suggestions = getStarterSuggestions({ language: 'en', selectedTicker: 'AAPL' });
      const quoteSuggestion = suggestions.find((s) => s.command === 'quote');
      expect(quoteSuggestion).toBeDefined();
      expect(quoteSuggestion?.prompt).toContain('AAPL');
      expect(quoteSuggestion?.label).toContain('AAPL');
    });

    it('Quote context includes news/history/trust/report', () => {
      const suggestions = getContextualSuggestions({
        language: 'en',
        context: { currentTicker: 'TSLA', lastCommand: 'quote' },
        lastCommand: 'quote',
      });

      const commands = suggestions.map((s) => s.command);
      expect(commands).toContain('news');
      expect(commands).toContain('history');
      expect(commands).toContain('trust');
      expect(commands).toContain('report');
    });

    it('Evidence context includes trust/SEC/report', () => {
      const suggestions = getContextualSuggestions({
        language: 'en',
        context: { currentTicker: 'TSLA', lastCommand: 'evidence' },
        lastCommand: 'evidence',
      });

      const commands = suggestions.map((s) => s.command);
      expect(commands).toContain('trust');
      expect(commands).toContain('sec');
      expect(commands).toContain('report');
    });

    it('Dynamic placeholder changes with ticker', () => {
      const withoutTicker = getDynamicPlaceholder({ language: 'en' });
      const withTicker = getDynamicPlaceholder({ language: 'en', selectedTicker: 'AAPL' });
      expect(withoutTicker).not.toBe(withTicker);
      expect(withTicker).toContain('AAPL');
    });

    it('No unsafe trading words', () => {
      // Test both ZH and EN
      const enSuggestions = getStarterSuggestions({ language: 'en' });
      const zhSuggestions = getStarterSuggestions({ language: 'zh', selectedTicker: 'AAPL' });
      const allSuggestions = [...enSuggestions, ...zhSuggestions];

      const unsafeWords = ['buy', 'sell', 'target price', '目标价', '入场', '抄底', '逃顶', '做多', '做空'];
      for (const suggestion of allSuggestions) {
        const text = `${suggestion.label} ${suggestion.prompt}`.toLowerCase();
        for (const word of unsafeWords) {
          expect(text).not.toContain(word.toLowerCase());
        }
      }
    });

    it('English suggestions render', () => {
      const suggestions = getStarterSuggestions({ language: 'en', selectedTicker: 'AAPL' });
      expect(suggestions.length).toBeGreaterThan(0);
      for (const s of suggestions) {
        expect(s.label).toBeTruthy();
        expect(s.prompt).toBeTruthy();
        expect(s.kind).toBeTruthy();
        expect(s.category).toBeTruthy();
      }
    });
  });

  describe('getContextualSuggestions', () => {
    it('returns empty array when no ticker', () => {
      const suggestions = getContextualSuggestions({ language: 'en', lastCommand: 'quote' });
      expect(suggestions).toHaveLength(0);
    });

    it('fundamentals context returns report/chain/evidence suggestions', () => {
      const suggestions = getContextualSuggestions({
        language: 'en',
        context: { currentTicker: 'MSFT', lastCommand: 'fundamentals' },
        lastCommand: 'fundamentals',
      });

      const commands = suggestions.map((s) => s.command);
      expect(commands).toContain('report');
      expect(commands).toContain('chain');
      expect(commands).toContain('evidence');
    });
  });

  describe('getDynamicPlaceholder', () => {
    it('uses context ticker when available', () => {
      const placeholder = getDynamicPlaceholder({
        language: 'zh',
        context: { currentTicker: 'NVDA' },
      });
      expect(placeholder).toContain('NVDA');
    });

    it('falls back to selectedTicker when no context ticker', () => {
      const placeholder = getDynamicPlaceholder({
        language: 'en',
        selectedTicker: 'META',
      });
      expect(placeholder).toContain('META');
    });

    it('default placeholder when no ticker', () => {
      const placeholder = getDynamicPlaceholder({ language: 'zh' });
      expect(placeholder).toBeTruthy();
    });
  });
});