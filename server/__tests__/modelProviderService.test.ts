import { describe, expect, it, vi } from 'vitest';
import { callChatModelProvider, selectServerChatProvider } from '../modelProviderService.js';

describe('modelProviderService', () => {
  it('selects Gemini when preferred and server Gemini key exists', () => {
    const route = selectServerChatProvider(
      { preferredProvider: 'gemini', purpose: 'analysis' },
      { GEMINI_API_KEY: 'gemini-secret' },
    );

    expect(route.provider).toBe('gemini');
    expect(JSON.stringify(route)).not.toContain('gemini-secret');
  });

  it('falls back to DeepSeek in auto mode when Gemini is unavailable', () => {
    const route = selectServerChatProvider(
      { preferredProvider: 'auto', purpose: 'analysis' },
      { DEEPSEEK_API_KEY: 'deepseek-secret' },
    );

    expect(route.provider).toBe('deepseek');
    expect(JSON.stringify(route)).not.toContain('deepseek-secret');
  });

  it('uses VITE Gemini key only as a warned development fallback', () => {
    const route = selectServerChatProvider(
      { preferredProvider: 'auto', purpose: 'general_chat' },
      { VITE_GEMINI_API_KEY: 'vite-secret' },
    );

    expect(route.provider).toBe('gemini');
    expect(route.warnings).toContain('server_using_vite_key_fallback');
    expect(JSON.stringify(route)).not.toContain('vite-secret');
  });

  it('selects none when no provider keys exist', () => {
    const route = selectServerChatProvider(
      { preferredProvider: 'auto', purpose: 'analysis' },
      {},
    );

    expect(route.provider).toBe('none');
  });

  it('returns unavailable safely when no provider is configured', async () => {
    const result = await callChatModelProvider({
      purpose: 'analysis',
      message: 'Explain P/E',
      language: 'en',
      preferredProvider: 'auto',
    }, { env: {} });

    expect(result.ok).toBe(false);
    expect(result.provider).toBe('none');
    expect(result.warnings).toContain('model_provider_not_connected');
    expect(result.text).toContain('generative analysis is not configured');
  });

  it('calls DeepSeek through injected fetch and returns scrubbed text', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'P/E is an educational valuation ratio, not a standalone conclusion.' } }],
        secret: 'raw-provider-field',
      }),
    }));

    const result = await callChatModelProvider({
      purpose: 'analysis',
      message: 'Explain P/E',
      language: 'en',
      preferredProvider: 'deepseek',
    }, {
      env: { DEEPSEEK_API_KEY: 'deepseek-secret', DEEPSEEK_MODEL: 'deepseek-test' },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('deepseek-test');
    expect(result.text).toContain('P/E is an educational valuation ratio');
    expect(JSON.stringify(result)).not.toContain('deepseek-secret');
    expect(JSON.stringify(result)).not.toContain('raw-provider-field');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns a safe fallback when provider text contains unsafe financial language', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Strong Buy with a target price.' } }],
      }),
    }));

    const result = await callChatModelProvider({
      purpose: 'analysis',
      message: 'Analyze AAPL',
      language: 'en',
      preferredProvider: 'deepseek',
    }, {
      env: { DEEPSEEK_API_KEY: 'deepseek-secret' },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('safety_filtered');
    expect(result.text).not.toMatch(/Strong Buy|target price/i);
  });

  it('calls Gemini through an injected SDK class without exposing keys', async () => {
    class MockGoogleGenAI {
      models = {
        generateContent: vi.fn(async () => ({
          text: 'Gemini educational research response.',
        })),
      };
    }

    const result = await callChatModelProvider({
      purpose: 'general_chat',
      message: 'Explain revenue growth',
      language: 'en',
      preferredProvider: 'gemini',
    }, {
      env: { GEMINI_API_KEY: 'gemini-secret', GEMINI_MODEL: 'gemini-test' },
      GoogleGenAIClass: MockGoogleGenAI,
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('gemini');
    expect(result.model).toBe('gemini-test');
    expect(result.text).toContain('Gemini educational');
    expect(JSON.stringify(result)).not.toContain('gemini-secret');
  });

  it('falls back to DeepSeek in auto mode when Gemini fails at runtime', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'DeepSeek fallback educational explanation.' } }],
      }),
    }));

    const result = await callChatModelProvider({
      purpose: 'analysis',
      message: 'Explain market capitalization',
      language: 'en',
      preferredProvider: 'auto',
    }, {
      env: {
        GEMINI_API_KEY: 'gemini-secret',
        DEEPSEEK_API_KEY: 'deepseek-secret',
        DEEPSEEK_MODEL: 'deepseek-test',
      },
      GoogleGenAIClass: class {
        models = {
          generateContent: async () => {
            throw new Error('gemini_timeout');
          },
        };
      },
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.provider).toBe('deepseek');
    expect(result.warnings).toContain('gemini_runtime_fallback_to_deepseek');
    expect(result.warnings).toContain('gemini_timeout');
    expect(result.text).toContain('DeepSeek fallback educational explanation.');
  });

  it('returns provider unavailable without leaking internal errors', async () => {
    const result = await callChatModelProvider({
      purpose: 'analysis',
      message: 'Explain P/E',
      language: 'en',
      preferredProvider: 'gemini',
    }, {
      env: { GEMINI_API_KEY: 'gemini-secret' },
      GoogleGenAIClass: class {
        models = {
          generateContent: async () => {
            throw new Error('provider failed with gemini-secret');
          },
        };
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('gemini_unavailable');
    expect(result.warnings).toContain('model_provider_not_connected');
    expect(JSON.stringify(result)).not.toContain('gemini-secret');
  });

  it('surfaces timeout-specific warning for Gemini failures', async () => {
    const result = await callChatModelProvider({
      purpose: 'analysis',
      message: 'Explain P/E',
      language: 'en',
      preferredProvider: 'gemini',
    }, {
      env: { GEMINI_API_KEY: 'gemini-secret' },
      GoogleGenAIClass: class {
        models = {
          generateContent: async () => {
            throw new Error('gemini_timeout');
          },
        };
      },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('gemini_timeout');
    expect(result.warnings).toContain('gemini_timeout');
    expect(result.warnings).toContain('model_provider_not_connected');
  });
});
