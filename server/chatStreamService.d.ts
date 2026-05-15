export interface ServerChatSseEvent {
  event: string;
  data: Record<string, unknown>;
}

export function formatSseEvent(event: ServerChatSseEvent): string;

export function buildServerChatSseEvents(
  body: unknown,
  deps?: {
    callChatModelProvider?: (
      input: Record<string, unknown>,
      deps?: Record<string, unknown>
    ) => Promise<Record<string, unknown>>;
    providerDeps?: Record<string, unknown>;
  }
): Promise<ServerChatSseEvent[]>;
