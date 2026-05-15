import { describe, expect, it } from 'vitest';
import {
  compileChatGoal,
  createEmptyChatContext,
  routeChatModel,
  type ServerChatRequest,
  type ServerChatResponse,
} from '../../shared/chat-core';

describe('shared chat core surface', () => {
  it('exports pure goal, context, and model routing helpers', () => {
    expect(compileChatGoal('苹果现价多少', { language: 'zh' }).ticker).toBe('AAPL');
    expect(createEmptyChatContext()).toEqual({});
    expect(routeChatModel({ purpose: 'general_chat', hasGeminiKey: true }).provider).toBe('gemini');
  });

  it('defines server chat request and response drafts without frontend Message coupling', () => {
    const request: ServerChatRequest = {
      clientMessageId: 'client-1',
      conversationId: 'conversation-1',
      message: '分析 NVDA',
      language: 'zh',
      selectedTicker: 'NVDA',
      clientContext: {
        currentTicker: 'NVDA',
        lastCommand: 'chart',
        lastIntent: 'chart',
        lastDataQualityNotes: ['history available'],
      },
      mode: 'analysis',
    };

    const response: ServerChatResponse = {
      ok: true,
      messages: [{ role: 'model', text: 'draft response' }],
      warnings: [],
    };

    expect(request.clientContext?.currentTicker).toBe('NVDA');
    expect(response.messages[0]).toEqual({ role: 'model', text: 'draft response' });
  });
});
