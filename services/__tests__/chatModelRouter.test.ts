import { describe, expect, it } from 'vitest';
import { routeChatModel } from '../chatModelRouter';

describe('routeChatModel', () => {
  it('tool_command → local regardless of keys', () => {
    const result = routeChatModel({
      purpose: 'tool_command',
      hasGeminiKey: true,
      hasDeepSeekKey: true,
    });

    expect(result.provider).toBe('local');
    expect(result.requiresApiKey).toBe(false);
  });

  it('intent_classification + deepseek key → deepseek', () => {
    const result = routeChatModel({
      purpose: 'intent_classification',
      hasDeepSeekKey: true,
    });

    expect(result.provider).toBe('deepseek');
    expect(result.role).toBe('intent_classifier');
  });

  it('intent_classification + no deepseek key → none', () => {
    const result = routeChatModel({
      purpose: 'intent_classification',
      hasDeepSeekKey: false,
    });

    expect(result.provider).toBe('none');
    expect(result.fallbackProvider).toBe('local');
  });

  it('general_chat + gemini key → gemini conversation', () => {
    const result = routeChatModel({
      purpose: 'general_chat',
      hasGeminiKey: true,
    });

    expect(result.provider).toBe('gemini');
    expect(result.role).toBe('conversation');
  });

  it('general_chat + no gemini key → none', () => {
    const result = routeChatModel({
      purpose: 'general_chat',
      hasGeminiKey: false,
    });

    expect(result.provider).toBe('none');
    expect(result.fallbackProvider).toBe('local');
  });

  it('complex_financial_question + gemini key → gemini answer_composer', () => {
    const result = routeChatModel({
      purpose: 'complex_financial_question',
      hasGeminiKey: true,
    });

    expect(result.provider).toBe('gemini');
    expect(result.role).toBe('answer_composer');
  });

  it('complex_financial_question + no gemini key → none', () => {
    const result = routeChatModel({
      purpose: 'complex_financial_question',
      hasGeminiKey: false,
    });

    expect(result.provider).toBe('none');
    expect(result.fallbackProvider).toBe('local');
  });
});
