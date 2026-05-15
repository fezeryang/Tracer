export interface ServerChatSessionContext {
  currentTicker?: string;
  lastCommand?: string;
  lastIntent?: string;
  lastDataQualityNotes?: string[];
  lastEvidenceBundle?: unknown;
  lastSourceTrust?: unknown;
  lastModelRoute?: {
    provider?: string;
    model?: string;
    role?: string;
    reason?: string;
    requiresApiKey?: boolean;
  };
}

export interface ServerChatSessionStoreEntry {
  context: ServerChatSessionContext;
  expiresAt: number;
}

export interface ServerChatSessionOptions {
  store?: Map<string, ServerChatSessionStoreEntry>;
  nowMs?: () => number;
  ttlMs?: number;
}

export function createServerChatSessionStore(): Map<string, ServerChatSessionStoreEntry>;

export function resolveServerChatConversationId(value?: unknown): string;

export function getServerChatSessionContext(
  conversationId: unknown,
  options?: ServerChatSessionOptions
): ServerChatSessionContext | undefined;

export function updateServerChatSessionContext(
  conversationId: unknown,
  input?: {
    clientContext?: unknown;
    contextUpdate?: unknown;
    modelRoute?: unknown;
  },
  options?: ServerChatSessionOptions
): ServerChatSessionContext;

export function mergeClientContextWithSession(
  clientContext?: unknown,
  sessionContext?: unknown
): ServerChatSessionContext | undefined;
