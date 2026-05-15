import type { Language } from '../i18n';
import type { ChatRenderBlock, Message } from '../types';
import type { ServerChatResponse } from '../shared/chat-core/serverTypes';
import type {
  ChatEvidenceItem,
  ChatTrace,
  ChatTraceStep,
  ChatTraceStepType,
} from './chatTraceService';
import type { ContextUpdateInput } from './chatContextService';

export interface AdaptServerChatResponseInput {
  response: ServerChatResponse;
  language: Language;
  fallbackTicker?: string;
}

export interface AdaptedServerChatResponse {
  message: Message;
  trace?: ChatTrace;
  contextUpdate?: ContextUpdateInput;
  evidenceItems?: ChatEvidenceItem[];
  warnings: string[];
}

const MAX_TEXT_LENGTH = 4000;
const MAX_METADATA_TEXT_LENGTH = 180;
const MAX_BLOCK_ARRAY_ITEMS = 50;
const MAX_CONTEXT_ITEMS = 8;
const MAX_CONTEXT_NOTES = 3;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_TRACE_STEPS = 20;
const MAX_TRACE_NOTES = 6;

const ALLOWED_BLOCK_TYPES = new Set([
  'metric_grid',
  'data_quality',
  'source_trust',
  'formula',
  'chart',
  'mermaid',
  'action_buttons',
  'evidence_list',
  'disclaimer',
  'data_table',
]);

const VALID_TRACE_STEP_TYPES = new Set<ChatTraceStepType>([
  'user_input',
  'slash_command',
  'local_intent',
  'deepseek_intent',
  'command_execute',
  'tool_call',
  'data_quality',
  'evidence',
  'fallback',
  'model_route',
  'error',
]);

const VALID_TRACE_STEP_STATUSES = new Set<ChatTraceStep['status']>([
  'pending',
  'success',
  'warning',
  'error',
  'skipped',
]);

const VALID_EVIDENCE_TYPES = new Set<ChatEvidenceItem['type']>([
  'quote',
  'news',
  'verified_news',
  'sec_filing',
  'official_source',
  'source_trust',
  'history',
  'fundamentals',
  'insider',
  'earnings',
  'dividend',
  'other',
]);

const FORBIDDEN_KEY_PATTERN = /stack|raw|secret|token|api[_-]?key|password|authorization|bearer|cookie|provider[_-]?response|response[_-]?body|body/i;
const SECRET_TEXT_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{8,}/g,
  /AIza[a-zA-Z0-9_-]{20,}/g,
  /(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
  /Bearer\s+[a-zA-Z0-9._-]+/g,
];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

const nowIso = () => new Date().toISOString();

const redactSensitiveText = (value: string): string => (
  SECRET_TEXT_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[redacted]'), value)
);

const sanitizeText = (value: unknown, maxLength = MAX_TEXT_LENGTH): string => {
  if (typeof value !== 'string') return '';
  return redactSensitiveText(value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const looksLikeRawJsonBlob = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
};

const normalizeTicker = (value?: unknown): string | undefined => {
  const ticker = sanitizeText(value, 16).replace(/^\$/, '').toUpperCase();
  return ticker || undefined;
};

const normalizeCommandName = (value?: unknown): string | undefined => {
  const command = sanitizeText(value, 80).replace(/^\//, '').split(/\s+/)[0].toLowerCase();
  return command || undefined;
};

const safeUrl = (value: unknown): string | undefined => {
  const text = sanitizeText(value, 500);
  if (!text) return undefined;
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
};

const sanitizeValue = (
  value: unknown,
  options: { depth?: number; arrayLimit?: number; textLimit?: number } = {},
): unknown => {
  const depth = options.depth ?? 3;
  const arrayLimit = options.arrayLimit ?? MAX_BLOCK_ARRAY_ITEMS;
  const textLimit = options.textLimit ?? MAX_METADATA_TEXT_LENGTH;

  if (typeof value === 'string') return sanitizeText(value, textLimit);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean' || value === null) return value;
  if (depth <= 0) return undefined;

  if (Array.isArray(value)) {
    return value
      .slice(0, arrayLimit)
      .map((item) => sanitizeValue(item, { depth: depth - 1, arrayLimit, textLimit }))
      .filter((item) => item !== undefined);
  }

  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([key]) => !FORBIDDEN_KEY_PATTERN.test(key))
      .map(([key, item]) => [
        sanitizeText(key, 80),
        sanitizeValue(item, { depth: depth - 1, arrayLimit, textLimit }),
      ] as const)
      .filter(([key, item]) => Boolean(key) && item !== undefined);

    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return undefined;
};

const sanitizeWarnings = (warnings: unknown): string[] => {
  if (!Array.isArray(warnings)) return [];
  return warnings
    .map((warning) => sanitizeText(warning, 120))
    .filter(Boolean)
    .slice(0, MAX_CONTEXT_ITEMS);
};

const pushWarning = (warnings: string[], warning: string) => {
  if (!warnings.includes(warning)) warnings.push(warning);
};

const sanitizeBlocks = (blocks: unknown, warnings: string[]): ChatRenderBlock[] | undefined => {
  if (!Array.isArray(blocks)) return undefined;

  const adaptedBlocks: ChatRenderBlock[] = [];
  for (const block of blocks) {
    if (!isRecord(block)) continue;

    const type = sanitizeText(block.type, 60);
    if (!ALLOWED_BLOCK_TYPES.has(type)) {
      pushWarning(warnings, 'dropped_unknown_block_type');
      continue;
    }

    const safeBlock = sanitizeValue(block, {
      depth: 5,
      arrayLimit: MAX_BLOCK_ARRAY_ITEMS,
      textLimit: 500,
    });

    if (isRecord(safeBlock)) {
      adaptedBlocks.push({
        ...safeBlock,
        type,
      } as ChatRenderBlock);
    }
  }

  return adaptedBlocks.length > 0 ? adaptedBlocks : undefined;
};

const sanitizeEvidenceType = (value: unknown): ChatEvidenceItem['type'] => {
  const type = sanitizeText(value, 40) as ChatEvidenceItem['type'];
  return VALID_EVIDENCE_TYPES.has(type) ? type : 'other';
};

const sanitizeEvidenceItems = (items: unknown): ChatEvidenceItem[] => {
  if (!Array.isArray(items)) return [];

  return items
    .filter(isRecord)
    .slice(0, MAX_EVIDENCE_ITEMS)
    .map((item, index) => ({
      id: sanitizeText(item.id, 120) || `server-evidence-${index + 1}`,
      type: sanitizeEvidenceType(item.type),
      title: sanitizeText(item.title, 180) || 'Evidence item',
      ...(sanitizeText(item.source, 80) ? { source: sanitizeText(item.source, 80) } : {}),
      ...(safeUrl(item.url) ? { url: safeUrl(item.url) } : {}),
      ...(Number.isFinite(Number(item.confidence)) ? { confidence: Number(item.confidence) } : {}),
      ...(sanitizeText(item.note, 180) ? { note: sanitizeText(item.note, 180) } : {}),
      ...(sanitizeText(item.timestamp, 80) ? { timestamp: sanitizeText(item.timestamp, 80) } : {}),
    }));
};

const adaptContextUpdate = (
  contextUpdate: unknown,
  fallbackTicker?: string,
): ContextUpdateInput | undefined => {
  if (!isRecord(contextUpdate)) {
    const ticker = normalizeTicker(fallbackTicker);
    return ticker ? { ticker } : undefined;
  }

  const ticker = normalizeTicker(contextUpdate.currentTicker) || normalizeTicker(fallbackTicker);
  const command = normalizeCommandName(contextUpdate.lastCommand);
  const intent = sanitizeText(contextUpdate.lastIntent, 80) || undefined;
  const dataQualityNotes = Array.isArray(contextUpdate.lastDataQualityNotes)
    ? contextUpdate.lastDataQualityNotes
      .map((note) => sanitizeText(note, 180))
      .filter(Boolean)
      .slice(0, MAX_CONTEXT_NOTES)
    : undefined;

  const safeContext: ContextUpdateInput = {
    ...(ticker ? { ticker } : {}),
    ...(command ? { command } : {}),
    ...(intent ? { intent } : {}),
    ...(dataQualityNotes?.length ? { dataQualityNotes } : {}),
  };

  const lastSecFilings = sanitizeValue(contextUpdate.lastSecFilings, {
    depth: 4,
    arrayLimit: MAX_CONTEXT_ITEMS,
    textLimit: 500,
  });
  if (Array.isArray(lastSecFilings)) safeContext.secFilings = lastSecFilings;

  const lastOfficialSources = sanitizeValue(contextUpdate.lastOfficialSources, {
    depth: 4,
    arrayLimit: MAX_CONTEXT_ITEMS,
    textLimit: 500,
  });
  if (Array.isArray(lastOfficialSources)) safeContext.officialSources = lastOfficialSources;

  const lastSourceTrust = sanitizeValue(contextUpdate.lastSourceTrust, {
    depth: 4,
    arrayLimit: MAX_CONTEXT_ITEMS,
    textLimit: 500,
  });
  if (lastSourceTrust !== undefined) safeContext.sourceTrust = lastSourceTrust;

  const lastEvidenceBundle = sanitizeValue(contextUpdate.lastEvidenceBundle, {
    depth: 4,
    arrayLimit: MAX_CONTEXT_ITEMS,
    textLimit: 500,
  });
  if (lastEvidenceBundle !== undefined) safeContext.evidenceBundle = lastEvidenceBundle;

  return Object.keys(safeContext).length > 0 ? safeContext : undefined;
};

const sanitizeTraceStepType = (value: unknown, warnings: string[]): ChatTraceStepType => {
  const type = sanitizeText(value, 60) as ChatTraceStepType;
  if (VALID_TRACE_STEP_TYPES.has(type)) return type;
  pushWarning(warnings, 'mapped_unknown_trace_step_type');
  return 'fallback';
};

const sanitizeTraceStepStatus = (value: unknown): ChatTraceStep['status'] => {
  const status = sanitizeText(value, 40) as ChatTraceStep['status'];
  return VALID_TRACE_STEP_STATUSES.has(status) ? status : 'warning';
};

const adaptTrace = (trace: unknown, warnings: string[]): ChatTrace | undefined => {
  if (!isRecord(trace)) return undefined;

  const timestamp = nowIso();
  const steps = Array.isArray(trace.steps)
    ? trace.steps
      .filter(isRecord)
      .slice(0, MAX_TRACE_STEPS)
      .map((step, index): ChatTraceStep => ({
        id: sanitizeText(step.id, 120) || `server-step-${index + 1}`,
        type: sanitizeTraceStepType(step.type, warnings),
        label: sanitizeText(step.label, 120) || 'server_chat_step',
        status: sanitizeTraceStepStatus(step.status),
        ...(sanitizeText(step.startedAt, 80) ? { startedAt: sanitizeText(step.startedAt, 80) } : {}),
        ...(sanitizeText(step.endedAt, 80) ? { endedAt: sanitizeText(step.endedAt, 80) } : {}),
        ...(Number.isFinite(Number(step.durationMs)) ? { durationMs: Number(step.durationMs) } : {}),
        ...(sanitizeText(step.message, 180) ? { message: sanitizeText(step.message, 180) } : {}),
        ...(isRecord(sanitizeValue(step.metadata, {
          depth: 3,
          arrayLimit: MAX_CONTEXT_ITEMS,
          textLimit: MAX_METADATA_TEXT_LENGTH,
        })) ? {
          metadata: sanitizeValue(step.metadata, {
            depth: 3,
            arrayLimit: MAX_CONTEXT_ITEMS,
            textLimit: MAX_METADATA_TEXT_LENGTH,
          }) as Record<string, unknown>,
        } : {}),
      }))
    : [];

  const dataQualityNotes = Array.isArray(trace.dataQualityNotes)
    ? trace.dataQualityNotes
      .map((note) => sanitizeText(note, 180))
      .filter(Boolean)
      .slice(0, MAX_TRACE_NOTES)
    : [];

  return {
    id: sanitizeText(trace.id, 120) || `server-trace-${Date.now()}`,
    ...(sanitizeText(trace.messageId, 120) ? { messageId: sanitizeText(trace.messageId, 120) } : {}),
    ...(normalizeTicker(trace.ticker) ? { ticker: normalizeTicker(trace.ticker) } : {}),
    ...(normalizeCommandName(trace.command) ? { command: normalizeCommandName(trace.command) } : {}),
    ...(sanitizeText(trace.intent, 80) ? { intent: sanitizeText(trace.intent, 80) } : {}),
    steps,
    evidenceItems: sanitizeEvidenceItems(trace.evidenceItems),
    dataQualityNotes,
    createdAt: sanitizeText(trace.createdAt, 80) || timestamp,
    updatedAt: sanitizeText(trace.updatedAt, 80) || timestamp,
  };
};

export function adaptServerChatResponse(
  input: AdaptServerChatResponseInput,
): AdaptedServerChatResponse | null {
  const { response, fallbackTicker } = input;
  if (!isRecord(response) || response.ok !== true || !Array.isArray(response.messages)) {
    return null;
  }

  const warnings = sanitizeWarnings(response.warnings);
  const assistantMessage = response.messages.find((message) => (
    isRecord(message) && message.role === 'assistant'
  ));

  if (!isRecord(assistantMessage)) return null;

  const rawText = assistantMessage.text;
  if (typeof rawText !== 'string') return null;
  if (!sanitizeText(rawText) || looksLikeRawJsonBlob(rawText)) return null;

  const message: Message = {
    id: sanitizeText(assistantMessage.id, 120) || `server-chat-${Date.now()}`,
    role: 'model',
    text: sanitizeText(rawText),
    blocks: sanitizeBlocks(assistantMessage.blocks, warnings),
  };

  const trace = adaptTrace(response.trace, warnings);
  const evidenceItems = sanitizeEvidenceItems(response.evidenceItems);
  const contextUpdate = adaptContextUpdate(response.contextUpdate, fallbackTicker);

  return {
    message,
    ...(trace ? { trace } : {}),
    ...(contextUpdate ? { contextUpdate } : {}),
    evidenceItems,
    warnings,
  };
}
