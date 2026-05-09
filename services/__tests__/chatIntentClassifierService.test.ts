import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyChatIntentWithDeepSeek } from '../chatIntentClassifierService';

describe('classifyChatIntentWithDeepSeek', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when backend marks classifier unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, available: false, error: 'deepseek_unavailable' }),
    } as Response);

    const result = await classifyChatIntentWithDeepSeek({
      text: '这个股票来源靠谱吗',
      selectedTicker: 'NVDA',
      language: 'zh',
    });

    expect(result).toBeNull();
  });

  it('normalizes a valid executable classifier result', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        available: true,
        result: {
          intent: 'trust',
          ticker: 'nvda',
          confidence: 0.9,
          shouldExecute: true,
          command: '/trust NVDA',
          needsClarification: false,
          clarifyingQuestion: null,
          reason: 'Selected ticker is available.',
        },
      }),
    } as Response);

    const result = await classifyChatIntentWithDeepSeek({
      text: '这个股票来源靠谱吗',
      selectedTicker: 'NVDA',
      language: 'zh',
    });

    expect(result?.intent).toBe('trust');
    expect(result?.ticker).toBe('NVDA');
    expect(result?.command).toBe('/trust NVDA');
    expect(result?.shouldExecute).toBe(true);
  });

  it('returns null on request failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network failed'));

    const result = await classifyChatIntentWithDeepSeek({
      text: 'recent important things',
      language: 'en',
    });

    expect(result).toBeNull();
  });
});
