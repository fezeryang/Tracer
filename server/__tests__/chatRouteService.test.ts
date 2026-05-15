import { describe, expect, it, vi } from 'vitest';
import { handleServerChat, validateChatRequest } from '../chatRouteService.js';
import { createServerChatSessionStore } from '../chatSessionContextService.js';

describe('chatRouteService', () => {
  it('returns ok=false for missing message', async () => {
    const result = await handleServerChat({ language: 'en' });

    expect(result.ok).toBe(false);
    expect(result.messages).toEqual([]);
    expect(result.error).toBe('missing_message');
  });

  it('normalizes invalid language and mode safely', () => {
    const result = validateChatRequest({
      message: 'hello',
      language: 'fr',
      mode: 'unsupported',
    });

    expect(result.ok).toBe(true);
    expect(result.value.language).toBe('en');
    expect(result.value.mode).toBe('auto');
  });

  it('returns command passthrough warning for command mode', async () => {
    const executeBackendChatTool = vi.fn(async () => ({
      ok: true,
      command: 'help',
      text: 'Backend executor help.',
      message: {
        id: 'backend-tool-message-1',
        role: 'assistant',
        text: 'Backend executor help.',
        provider: 'local',
        model: 'backend-tool-executor',
        createdAt: new Date().toISOString(),
      },
      blocks: [],
      evidenceItems: [],
      warnings: [],
      contextUpdate: { lastCommand: 'help' },
      trace: { id: 'trace-1', command: 'help', steps: [] },
    }));

    const result = await handleServerChat({
      message: '/help',
      language: 'zh',
      mode: 'command',
    }, {
      executeBackendChatTool,
    });

    expect(result.ok).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(executeBackendChatTool).toHaveBeenCalledWith({
      message: '/help',
      language: 'zh',
      selectedTicker: undefined,
      clientContext: undefined,
    }, {});
    expect(result.messages[0]).toMatchObject({
      role: 'assistant',
      provider: 'local',
      model: 'backend-tool-executor',
      text: 'Backend executor help.',
    });
    expect(result.modelRoute).toMatchObject({
      provider: 'local',
      model: 'backend-tool-executor',
      role: 'command_executor',
      reason: 'backend_tool_executor',
    });
  });

  it('returns model-provider warning for analysis text', async () => {
    const result = await handleServerChat({
      message: 'Analyze NVDA long-term moat',
      language: 'en',
      mode: 'analysis',
      selectedTicker: 'NVDA',
    }, { providerDeps: { env: {} } });

    expect(result.ok).toBe(true);
    expect(result.messages).toHaveLength(1);
    expect(result.warnings).toContain('model_provider_not_connected');
    expect(JSON.stringify(result)).toContain('generative analysis is not configured');
  });

  it('does not call the model provider for command mode', async () => {
    const callChatModelProvider = vi.fn();
    const executeBackendChatTool = vi.fn(async () => ({
      ok: true,
      command: 'quote',
      text: 'Fetched AAPL quote data for educational research only.',
      message: {
        id: 'backend-tool-message-2',
        role: 'assistant',
        text: 'Fetched AAPL quote data for educational research only.',
        provider: 'local',
        model: 'backend-tool-executor',
        createdAt: new Date().toISOString(),
      },
      warnings: [],
      evidenceItems: [],
      trace: { id: 'trace-2', command: 'quote', steps: [] },
    }));
    const result = await handleServerChat({
      message: '/quote AAPL',
      language: 'en',
      mode: 'command',
    }, {
      callChatModelProvider,
      executeBackendChatTool,
    });

    expect(result.ok).toBe(true);
    expect(callChatModelProvider).not.toHaveBeenCalled();
    expect(executeBackendChatTool).toHaveBeenCalledTimes(1);
    expect(result.modelRoute).toMatchObject({
      provider: 'local',
      role: 'command_executor',
    });
  });

  it('returns command mode slash requirement without calling the model provider', async () => {
    const callChatModelProvider = vi.fn();
    const executeBackendChatTool = vi.fn(async () => ({
      ok: false,
      command: 'command',
      text: 'Command mode requires a slash command such as /quote AAPL.',
      message: {
        id: 'backend-tool-message-3',
        role: 'assistant',
        text: 'Command mode requires a slash command such as /quote AAPL.',
        provider: 'local',
        model: 'backend-tool-executor',
        createdAt: new Date().toISOString(),
      },
      warnings: ['command_mode_requires_slash_command'],
      trace: { id: 'trace-3', command: 'command', steps: [] },
      error: 'command_mode_requires_slash_command',
    }));

    const result = await handleServerChat({
      message: 'quote AAPL',
      language: 'en',
      mode: 'command',
    }, {
      callChatModelProvider,
      executeBackendChatTool,
    });

    expect(result.ok).toBe(false);
    expect(callChatModelProvider).not.toHaveBeenCalled();
    expect(result.warnings).toContain('command_mode_requires_slash_command');
    expect(result.error).toBe('command_mode_requires_slash_command');
  });

  it('calls the model provider for analysis mode and returns assistant message shape', async () => {
    const callChatModelProvider = vi.fn(async () => ({
      ok: true,
      provider: 'deepseek',
      model: 'deepseek-test',
      text: 'This is a research-only explanation.',
      warnings: ['provider:deepseek'],
      latencyMs: 12,
    }));

    const result = await handleServerChat({
      message: 'Explain P/E',
      language: 'en',
      mode: 'analysis',
      selectedTicker: 'AAPL',
    }, {
      callChatModelProvider,
    });

    expect(result.ok).toBe(true);
    expect(callChatModelProvider).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'analysis',
      message: 'Explain P/E',
      language: 'en',
      selectedTicker: 'AAPL',
      preferredProvider: 'auto',
    }), expect.any(Object));
    expect(result.messages[0]).toMatchObject({
      role: 'assistant',
      provider: 'deepseek',
      model: 'deepseek-test',
      text: 'This is a research-only explanation.',
    });
    expect(result.modelRoute).toMatchObject({
      provider: 'deepseek',
      model: 'deepseek-test',
      reason: 'server_model_provider',
    });
    expect(result.warnings).toContain('provider:deepseek');
  });

  it('does not return raw provider response or API key material', async () => {
    const callChatModelProvider = vi.fn(async () => ({
      ok: true,
      provider: 'gemini',
      model: 'gemini-test',
      text: 'Safe research response.',
      warnings: [],
      raw: { apiKey: 'secret-key' },
    }));

    const result = await handleServerChat({
      message: 'Explain revenue growth',
      language: 'en',
      mode: 'analysis',
    }, {
      callChatModelProvider,
    });

    expect(JSON.stringify(result)).not.toContain('secret-key');
    expect(JSON.stringify(result)).not.toContain('raw');
  });

  it('echoes only safe client context fields', async () => {
    const result = await handleServerChat({
      message: 'analyze context',
      language: 'en',
      clientContext: {
        currentTicker: 'nvda',
        lastCommand: 'chart',
        lastIntent: 'chart',
        lastDataQualityNotes: ['note 1', 'note 2', 'note 3', 'note 4'],
        secret: 'do-not-return',
        largePayload: Array.from({ length: 20 }, (_, index) => index),
      },
    });

    expect(result.contextUpdate).toEqual({
      currentTicker: 'NVDA',
      lastCommand: 'chart',
      lastIntent: 'chart',
      lastDataQualityNotes: ['note 1', 'note 2', 'note 3'],
    });
    expect(JSON.stringify(result)).not.toContain('do-not-return');
    expect(JSON.stringify(result)).not.toContain('largePayload');
  });

  it('does not throw on invalid body shapes', async () => {
    await expect(handleServerChat(null)).resolves.toMatchObject({
      ok: false,
      messages: [],
      error: 'missing_message',
    });
    await expect(handleServerChat('bad-body')).resolves.toMatchObject({
      ok: false,
      messages: [],
      error: 'missing_message',
    });
  });

  it('keeps /evidence in backend command mode without calling the model provider', async () => {
    const callChatModelProvider = vi.fn();
    const executeBackendChatTool = vi.fn(async () => ({
      ok: true,
      command: 'evidence',
      ticker: 'AAPL',
      text: 'Generated an AAPL evidence bundle including quote, news, SEC filings, official sources, and source trust summary for educational research only.',
      message: {
        id: 'backend-tool-message-evidence',
        role: 'assistant',
        text: 'Generated an AAPL evidence bundle including quote, news, SEC filings, official sources, and source trust summary for educational research only.',
        provider: 'local',
        model: 'backend-tool-executor',
        createdAt: new Date().toISOString(),
        blocks: [{ type: 'evidence_list', data: { evidence: [] } }],
      },
      warnings: ['partial_evidence_unavailable'],
      evidenceItems: [{ id: 'quote:AAPL', type: 'quote', title: 'AAPL Quote' }],
      contextUpdate: {
        currentTicker: 'AAPL',
        lastCommand: '/evidence AAPL',
        lastIntent: 'evidence',
      },
      trace: { id: 'trace-evidence', command: 'evidence', steps: [] },
    }));

    const result = await handleServerChat({
      message: '/evidence AAPL',
      language: 'en',
      mode: 'command',
      selectedTicker: 'AAPL',
    }, {
      callChatModelProvider,
      executeBackendChatTool,
    });

    expect(result.ok).toBe(true);
    expect(callChatModelProvider).not.toHaveBeenCalled();
    expect(executeBackendChatTool).toHaveBeenCalledTimes(1);
    expect(result.messages[0]).toMatchObject({
      role: 'assistant',
      provider: 'local',
      model: 'backend-tool-executor',
    });
    expect(result.modelRoute).toMatchObject({
      provider: 'local',
      role: 'command_executor',
      reason: 'backend_tool_executor',
    });
    expect(result.contextUpdate).toMatchObject({
      currentTicker: 'AAPL',
      lastCommand: '/evidence AAPL',
      lastIntent: 'evidence',
    });
  });

  it('returns a conversationId and carries server session ticker into follow-up commands', async () => {
    const store = createServerChatSessionStore();
    const firstExecutor = vi.fn(async () => ({
      ok: true,
      command: 'quote',
      ticker: 'AAPL',
      text: 'Fetched AAPL quote data for educational research only.',
      message: {
        id: 'backend-tool-message-quote',
        role: 'assistant',
        text: 'Fetched AAPL quote data for educational research only.',
        provider: 'local',
        model: 'backend-tool-executor',
        createdAt: new Date().toISOString(),
      },
      warnings: [],
      evidenceItems: [],
      contextUpdate: {
        currentTicker: 'AAPL',
        lastCommand: '/quote AAPL',
        lastIntent: 'quote',
      },
      trace: { id: 'trace-quote', command: 'quote', ticker: 'AAPL', steps: [] },
    }));

    const first = await handleServerChat({
      message: '/quote AAPL',
      language: 'en',
      mode: 'command',
    }, {
      executeBackendChatTool: firstExecutor,
      sessionDeps: { store },
    });

    expect(first.conversationId).toMatch(/^chat-session-/);

    const secondExecutor = vi.fn(async () => ({
      ok: true,
      command: 'sec',
      ticker: 'AAPL',
      text: 'Fetched AAPL SEC filing summaries.',
      message: {
        id: 'backend-tool-message-sec',
        role: 'assistant',
        text: 'Fetched AAPL SEC filing summaries.',
        provider: 'local',
        model: 'backend-tool-executor',
        createdAt: new Date().toISOString(),
      },
      warnings: [],
      evidenceItems: [],
      contextUpdate: {
        currentTicker: 'AAPL',
        lastCommand: '/sec AAPL',
        lastIntent: 'sec',
      },
      trace: { id: 'trace-sec', command: 'sec', ticker: 'AAPL', steps: [] },
    }));

    const second = await handleServerChat({
      message: '/sec',
      language: 'en',
      mode: 'command',
      conversationId: first.conversationId,
    }, {
      executeBackendChatTool: secondExecutor,
      sessionDeps: { store },
    });

    expect(second.conversationId).toBe(first.conversationId);
    expect(secondExecutor).toHaveBeenCalledWith(expect.objectContaining({
      clientContext: expect.objectContaining({
        currentTicker: 'AAPL',
        lastCommand: '/quote AAPL',
        lastIntent: 'quote',
      }),
    }), expect.any(Object));
    expect(second.contextUpdate).toMatchObject({
      currentTicker: 'AAPL',
      lastCommand: '/sec AAPL',
      lastIntent: 'sec',
    });
  });
});
