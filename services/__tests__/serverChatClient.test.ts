import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callServerChatCommand } from '../serverChatClient';

describe('serverChatClient', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      setTimeout,
      clearTimeout,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends conversationId with command mode requests', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        ok: true,
        conversationId: 'conversation-1',
        messages: [{ role: 'assistant', text: 'Fetched AAPL quote data.' }],
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await callServerChatCommand({
      message: '/quote AAPL',
      language: 'en',
      conversationId: 'conversation-1',
      selectedTicker: 'AAPL',
      clientContext: {
        currentTicker: 'AAPL',
        lastCommand: 'quote',
        lastIntent: 'quote',
      },
    });

    expect(response?.conversationId).toBe('conversation-1');
    expect(fetchMock).toHaveBeenCalledWith('/api/chat', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        message: '/quote AAPL',
        language: 'en',
        conversationId: 'conversation-1',
        selectedTicker: 'AAPL',
        clientContext: {
          currentTicker: 'AAPL',
          lastCommand: 'quote',
          lastIntent: 'quote',
        },
        mode: 'command',
      }),
    }));
  });
});
