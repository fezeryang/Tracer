export type ServerChatProvider = 'gemini' | 'deepseek' | 'none';

export interface ServerChatProviderInput {
  purpose?: 'general_chat' | 'analysis';
  message?: string;
  language?: 'zh' | 'en';
  selectedTicker?: string;
  clientContext?: Record<string, unknown>;
  preferredProvider?: 'gemini' | 'deepseek' | 'auto';
  timeoutMs?: number;
}

export interface ServerChatProviderRoute {
  provider: ServerChatProvider;
  model?: string;
  warnings: string[];
}

export interface ChatModelProviderResult {
  ok: boolean;
  provider: ServerChatProvider;
  model?: string;
  text: string;
  warnings: string[];
  error?: string;
  latencyMs?: number;
}

export function selectServerChatProvider(
  input?: ServerChatProviderInput,
  env?: Record<string, string | undefined>
): ServerChatProviderRoute;

export function callChatModelProvider(
  input?: ServerChatProviderInput,
  deps?: Record<string, unknown>
): Promise<ChatModelProviderResult>;
