export interface ServerChatRequest {
  clientMessageId?: string;
  conversationId?: string;
  message: string;
  language: 'zh' | 'en';
  selectedTicker?: string;
  clientContext?: {
    currentTicker?: string;
    lastCommand?: string;
    lastIntent?: string;
    lastDataQualityNotes?: string[];
  };
  mode?: 'auto' | 'command' | 'analysis';
}

export interface ServerChatResponse {
  ok: boolean;
  conversationId?: string;
  messages: unknown[];
  trace?: unknown;
  contextUpdate?: unknown;
  evidenceItems?: unknown[];
  modelRoute?: unknown;
  warnings?: string[];
  error?: string;
}
