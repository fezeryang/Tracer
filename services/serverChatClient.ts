import type { Language } from '../i18n';
import type { ServerChatResponse } from '../shared/chat-core/serverTypes';

export interface CallServerChatInput {
  message: string;
  language: Language;
  conversationId?: string;
  selectedTicker?: string;
  clientContext?: {
    currentTicker?: string;
    lastCommand?: string;
    lastIntent?: string;
    lastDataQualityNotes?: string[];
  };
  mode?: 'auto' | 'command' | 'analysis';
  timeoutMs?: number;
}

export type CallServerChatCommandInput = Omit<CallServerChatInput, 'mode'>;

export async function callServerChat(
  input: CallServerChatInput,
): Promise<ServerChatResponse | null> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), input.timeoutMs ?? 12000);

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: input.message,
        language: input.language,
        conversationId: input.conversationId,
        selectedTicker: input.selectedTicker,
        clientContext: input.clientContext,
        mode: input.mode,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || typeof payload !== 'object' || !Array.isArray(payload.messages)) {
      return null;
    }
    return payload as ServerChatResponse;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function callServerChatCommand(
  input: CallServerChatCommandInput,
): Promise<ServerChatResponse | null> {
  return callServerChat({
    ...input,
    mode: 'command',
  });
}
