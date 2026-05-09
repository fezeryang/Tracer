import { describe, expect, it } from 'vitest';
import { compileChatGoal, extractChatGoalTicker } from '../chatGoalCompiler';

describe('compileChatGoal', () => {
  it('maps slash commands to ChatGoal with full confidence', () => {
    const goal = compileChatGoal('/quote AAPL', { language: 'en' });

    expect(goal.source).toBe('slash');
    expect(goal.intent).toBe('quote');
    expect(goal.command).toBe('quote');
    expect(goal.ticker).toBe('AAPL');
    expect(goal.confidence).toBe(1);
  });

  it('routes Chinese quote requests with aliases', () => {
    const goal = compileChatGoal('苹果现价多少', { language: 'zh' });

    expect(goal.source).toBe('local_rule');
    expect(goal.intent).toBe('quote');
    expect(goal.command).toBe('quote');
    expect(goal.ticker).toBe('AAPL');
    expect(goal.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('routes chart requests with explicit ticker', () => {
    const goal = compileChatGoal('画一下 NVDA 走势', { language: 'zh' });

    expect(goal.intent).toBe('chart');
    expect(goal.command).toBe('chart');
    expect(goal.ticker).toBe('NVDA');
    expect(goal.deliverable).toBe('chart');
  });

  it('uses selectedTicker fallback and records a safety note', () => {
    const goal = compileChatGoal('生成完整报告', { language: 'zh', selectedTicker: 'msft' });

    expect(goal.intent).toBe('report');
    expect(goal.command).toBe('report');
    expect(goal.ticker).toBe('MSFT');
    expect(goal.safetyNotes).toContain('using_current_ticker');
  });

  it('returns missing_ticker for ticker-bound intents without fallback', () => {
    const goal = compileChatGoal('生成完整报告', { language: 'zh' });

    expect(goal.intent).toBe('report');
    expect(goal.requiresTicker).toBe(true);
    expect(goal.ticker).toBeUndefined();
    expect(goal.deliverable).toBe('report');
    expect(goal.reason).toBe('missing_ticker');
    expect(goal.confidence).toBeGreaterThanOrEqual(0.45);
    expect(goal.confidence).toBeLessThan(0.8);
  });

  it('keeps broad competitive analysis on Gemini fallback path', () => {
    const goal = compileChatGoal('分析 NVDA 的长期竞争优势', { language: 'zh', selectedTicker: 'AAPL' });

    expect(goal.intent).toBe('general_analysis');
    expect(goal.command).toBeUndefined();
    expect(goal.confidence).toBeLessThan(0.8);
  });

  it('extracts supported English aliases', () => {
    expect(extractChatGoalTicker('latest news about Nvidia')).toBe('NVDA');
    expect(extractChatGoalTicker('show Microsoft market price')).toBe('MSFT');
  });

  it('routes contextual trust request to medium confidence classifier path', () => {
    const goal = compileChatGoal('这个股票来源靠谱吗', { language: 'zh', selectedTicker: 'NVDA' });

    expect(goal.intent).toBe('trust');
    expect(goal.ticker).toBe('NVDA');
    expect(goal.confidence).toBeGreaterThanOrEqual(0.45);
    expect(goal.confidence).toBeLessThan(0.8);
  });

  it('routes contextual evidence request to medium confidence classifier path', () => {
    const goal = compileChatGoal('帮我找一下这个公司的证据', { language: 'zh', selectedTicker: 'AAPL' });

    expect(goal.intent).toBe('evidence');
    expect(goal.ticker).toBe('AAPL');
    expect(goal.confidence).toBeGreaterThanOrEqual(0.45);
    expect(goal.confidence).toBeLessThan(0.8);
  });

  it('routes vague review request to medium confidence classifier path', () => {
    const goal = compileChatGoal('最近有什么重要东西需要看', { language: 'zh', selectedTicker: 'TSLA' });

    expect(goal.intent).toBe('evidence');
    expect(goal.ticker).toBe('TSLA');
    expect(goal.confidence).toBeGreaterThanOrEqual(0.45);
    expect(goal.confidence).toBeLessThan(0.8);
  });
});
