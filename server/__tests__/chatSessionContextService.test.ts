import { describe, expect, it } from 'vitest';
import {
  createServerChatSessionStore,
  getServerChatSessionContext,
  resolveServerChatConversationId,
  updateServerChatSessionContext,
} from '../chatSessionContextService.js';

describe('chatSessionContextService', () => {
  it('creates a safe conversation id when none is supplied', () => {
    expect(resolveServerChatConversationId()).toMatch(/^chat-session-/);
    expect(resolveServerChatConversationId('conversation-1')).toBe('conversation-1');
  });

  it('stores only sanitized short-term chat context', () => {
    const store = createServerChatSessionStore();
    const conversationId = resolveServerChatConversationId('conversation-1');

    const context = updateServerChatSessionContext(conversationId, {
      clientContext: {
        currentTicker: 'aapl',
        lastCommand: '/quote AAPL',
        lastIntent: 'quote',
        lastDataQualityNotes: ['one', 'two', 'three', 'four'],
        apiKey: 'secret-key',
      },
      contextUpdate: {
        currentTicker: 'msft',
        lastCommand: '/evidence MSFT',
        lastIntent: 'evidence',
        lastEvidenceBundle: {
          items: [
            { label: '10-K filing', url: 'https://www.sec.gov/example', raw: { token: 'secret-token' } },
          ],
          providerResponse: { body: 'raw body' },
        },
        lastSourceTrust: {
          ticker: 'MSFT',
          score: 81,
          secret: 'do-not-store',
        },
      },
      modelRoute: {
        provider: 'local',
        model: 'backend-tool-executor',
        role: 'command_executor',
        reason: 'backend_tool_executor',
        requiresApiKey: false,
        raw: { stack: 'secret-stack' },
      },
    }, { store });

    expect(context.currentTicker).toBe('MSFT');
    expect(context.lastCommand).toBe('/evidence MSFT');
    expect(context.lastIntent).toBe('evidence');
    expect(context.lastDataQualityNotes).toEqual(['one', 'two', 'three']);
    expect(context.lastModelRoute).toMatchObject({
      provider: 'local',
      model: 'backend-tool-executor',
      role: 'command_executor',
    });
    expect(JSON.stringify(context)).not.toContain('secret');
    expect(JSON.stringify(context)).not.toContain('providerResponse');
    expect(JSON.stringify(getServerChatSessionContext(conversationId, { store }))).not.toContain('raw body');
  });

  it('expires session entries by ttl', () => {
    const store = createServerChatSessionStore();
    const conversationId = resolveServerChatConversationId('conversation-expiring');

    updateServerChatSessionContext(conversationId, {
      contextUpdate: { currentTicker: 'NVDA' },
    }, { store, nowMs: () => 1000, ttlMs: 10 });

    expect(getServerChatSessionContext(conversationId, { store, nowMs: () => 1005 })?.currentTicker).toBe('NVDA');
    expect(getServerChatSessionContext(conversationId, { store, nowMs: () => 1011 })).toBeUndefined();
  });
});
