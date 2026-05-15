export interface ValidatedChatRequest {
  clientMessageId?: string;
  conversationId?: string;
  message: string;
  language: 'zh' | 'en';
  selectedTicker?: string;
  clientContext?: Record<string, unknown>;
  mode: 'auto' | 'command' | 'analysis';
}

export function validateChatRequest(body: unknown):
  | { ok: true; value: ValidatedChatRequest }
  | {
      ok: false;
      error: 'missing_message';
      value: {
        message: '';
        language: 'zh' | 'en';
        mode: 'auto' | 'command' | 'analysis';
      };
    };

export function handleServerChat(body: unknown, deps?: {
  executeBackendChatTool?: (
    input: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  executorDeps?: Record<string, unknown>;
  callChatModelProvider?: (
    input: Record<string, unknown>,
    deps?: Record<string, unknown>
  ) => Promise<Record<string, unknown>>;
  providerDeps?: Record<string, unknown>;
  sessionDeps?: Record<string, unknown>;
}): Promise<{
  ok: boolean;
  conversationId?: string;
  messages: unknown[];
  trace?: unknown;
  contextUpdate?: unknown;
  evidenceItems?: unknown[];
  modelRoute?: unknown;
  warnings?: string[];
  error?: string;
}>;
