import { describe, expect, it, vi } from 'vitest';
import { buildServerChatSseEvents } from '../chatStreamService.js';

describe('chatStreamService', () => {
  it('streams analysis text chunks and a done event', async () => {
    const callChatModelProvider = vi.fn(async () => ({
      ok: true,
      provider: 'gemini',
      model: 'gemini-test',
      text: 'This is a research-only streamed analysis response.',
      warnings: [],
    }));

    const events = await buildServerChatSseEvents({
      message: 'Analyze NVDA moat',
      language: 'en',
      mode: 'analysis',
      selectedTicker: 'NVDA',
    }, {
      callChatModelProvider,
    });

    expect(callChatModelProvider).toHaveBeenCalledWith(expect.objectContaining({
      purpose: 'analysis',
      message: 'Analyze NVDA moat',
    }), expect.any(Object));
    expect(events[0]).toMatchObject({ event: 'message.start' });
    expect(events.some((event) => event.event === 'message.delta')).toBe(true);
    expect(events[events.length - 1]).toMatchObject({ event: 'message.done' });
    expect(events.map((event) => JSON.stringify(event.data)).join('')).not.toContain('apiKey');
  });

  it('rejects command-mode streaming without invoking command execution', async () => {
    const callChatModelProvider = vi.fn();

    const events = await buildServerChatSseEvents({
      message: '/quote AAPL',
      language: 'en',
      mode: 'command',
    }, {
      callChatModelProvider,
    });

    expect(callChatModelProvider).not.toHaveBeenCalled();
    expect(events).toEqual([
      {
        event: 'error',
        data: {
          error: 'streaming_command_mode_not_supported',
        },
      },
    ]);
  });
});
