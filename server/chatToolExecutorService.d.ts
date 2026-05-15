export interface ParsedBackendCommand {
  command: string;
  args: string[];
  ticker?: string;
}

export interface ExecuteBackendChatToolInput {
  message: string;
  language: 'zh' | 'en';
  selectedTicker?: string;
  clientContext?: Record<string, unknown>;
}

export interface ExecuteBackendChatToolResult {
  ok: boolean;
  command: string;
  ticker?: string;
  text: string;
  message?: Record<string, unknown>;
  blocks?: Record<string, unknown>[];
  trace?: Record<string, unknown>;
  contextUpdate?: Record<string, unknown>;
  evidenceItems?: Record<string, unknown>[];
  warnings?: string[];
  error?: string;
  dataQualityNotes?: string[];
}

export function normalizeTicker(value: unknown): string | undefined;

export function safeLimitArray<T>(value: T[] | unknown, limit?: number): T[];

export function parseBackendCommand(message: unknown): ParsedBackendCommand | null;

export function executeBackendChatTool(
  input: ExecuteBackendChatToolInput,
  deps?: Record<string, unknown>
): Promise<ExecuteBackendChatToolResult>;
