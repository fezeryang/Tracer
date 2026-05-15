import { describe, expect, it } from 'vitest';
import {
  buildResearchOnlySystemPrompt,
  buildUnavailableModelMessage,
  detectUnsafeFinancialPhrases,
  scrubModelText,
} from '../modelSafetyService.js';

describe('modelSafetyService', () => {
  it('detects English rating and trading phrases', () => {
    const result = detectUnsafeFinancialPhrases('This is a Strong Buy with a target price and stop-loss.');

    expect(result.unsafe).toBe(true);
    expect(result.warnings).toContain('unsafe_financial_language_detected');
    expect(result.matches).toEqual(expect.arrayContaining(['rating', 'target_price', 'stop_loss']));
  });

  it('detects Chinese rating and trading phrases', () => {
    const result = detectUnsafeFinancialPhrases('给出买入评级，并设置目标价和止损位。');

    expect(result.unsafe).toBe(true);
    expect(result.matches).toEqual(expect.arrayContaining(['rating', 'target_price', 'stop_loss']));
  });

  it('does not flag neutral educational buy-and-hold mentions as ratings', () => {
    const result = detectUnsafeFinancialPhrases('A buy-and-hold strategy is a general investing concept, not a rating here.');

    expect(result.unsafe).toBe(false);
    expect(result.matches).toEqual([]);
  });

  it('allows policy explanation text that names forbidden categories without giving advice', () => {
    const result = detectUnsafeFinancialPhrases('金融助手不能提供 Buy/Sell/Hold、目标价或止损建议，因为这会越过研究解释的边界。');

    expect(result.unsafe).toBe(false);
    expect(result.warnings).toContain('unsafe_terms_in_policy_context');
  });

  it('returns a safe fallback instead of unsafe model text', () => {
    const result = scrubModelText('Buy AAPL now with a clear entry point.', 'en');

    expect(result.warnings).toContain('safety_filtered');
    expect(result.text).not.toMatch(/\bBuy\b|entry point/i);
    expect(result.text).toContain('research-only');
  });

  it('returns a Chinese safe fallback instead of unsafe model text', () => {
    const result = scrubModelText('可以加仓并设置支撑位。', 'zh');

    expect(result.warnings).toContain('safety_filtered');
    expect(result.text).not.toMatch(/加仓|支撑位/);
    expect(result.text).toContain('仅供研究');
  });

  it('keeps safe model text and trims control characters', () => {
    const result = scrubModelText('  P/E compares price with earnings.\n\nUse it as one research input.\u0000 ', 'en');

    expect(result.warnings).toEqual([]);
    expect(result.text).toBe('P/E compares price with earnings. Use it as one research input.');
  });

  it('keeps policy explanation text instead of filtering it away', () => {
    const result = scrubModelText('金融助手不能提供 Buy/Sell/Hold、目标价、入场点或止损建议，因为这些属于交易指令而不是研究解释。', 'zh');

    expect(result.text).toContain('不能提供 Buy/Sell/Hold');
    expect(result.warnings).toContain('unsafe_terms_in_policy_context');
    expect(result.warnings).not.toContain('safety_filtered');
  });

  it('builds language-specific research-only prompts and unavailable messages', () => {
    expect(buildResearchOnlySystemPrompt('en')).toContain('educational financial research copilot');
    expect(buildResearchOnlySystemPrompt('zh')).toContain('教育和研究用途');
    expect(buildUnavailableModelMessage('en')).toContain('generative analysis is not configured');
    expect(buildUnavailableModelMessage('zh')).toContain('未配置生成式分析服务');
  });
});
