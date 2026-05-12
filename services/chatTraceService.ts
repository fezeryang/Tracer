import { Language } from '../i18n';
import { Message } from '../types';

/**
 * Chat Phase C-4: Tool Trace & Evidence Drawer MVP
 *
 * This service provides lightweight tool tracing for chat interactions,
 * recording which tools were called, evidence sources, and data quality notes.
 *
 * Design constraints:
 * - No API keys stored
 * - No large arrays (trim to max 8 items)
 * - Safe parsing for all data
 * - No external dependencies
 * - Works without DeepSeek/Gemini keys
 */

export type ChatTraceStepType =
  | 'user_input'
  | 'slash_command'
  | 'local_intent'
  | 'deepseek_intent'
  | 'command_execute'
  | 'tool_call'
  | 'data_quality'
  | 'evidence'
  | 'fallback'
  | 'model_route'
  | 'error';

export interface ChatTraceStep {
  id: string;
  type: ChatTraceStepType;
  label: string;
  status: 'pending' | 'success' | 'warning' | 'error' | 'skipped';
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatTrace {
  id: string;
  messageId?: string;
  ticker?: string;
  command?: string;
  intent?: string;
  steps: ChatTraceStep[];
  evidenceItems: ChatEvidenceItem[];
  dataQualityNotes: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatEvidenceItem {
  id: string;
  type: 'quote' | 'news' | 'verified_news' | 'sec_filing' | 'official_source' | 'source_trust' | 'history' | 'fundamentals' | 'insider' | 'earnings' | 'dividend' | 'other';
  title: string;
  source?: string;
  url?: string;
  confidence?: number;
  note?: string;
  timestamp?: string;
}

export interface CreateChatTraceInput {
  messageId?: string;
  ticker?: string;
  userInput?: string;
  command?: string;
  intent?: string;
}

const MAX_EVIDENCE_ITEMS = 8;
const MAX_STEPS = 20;

/**
 * Create a new trace with initial metadata
 */
export function createChatTrace(input: CreateChatTraceInput = {}): ChatTrace {
  const now = new Date().toISOString();
  const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    id: traceId,
    messageId: input.messageId,
    ticker: input.ticker,
    command: input.command,
    intent: input.intent,
    steps: [],
    evidenceItems: [],
    dataQualityNotes: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Generate a unique step ID
 */
function generateStepId(): string {
  return `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Add a step to the trace
 */
export function addTraceStep(
  trace: ChatTrace,
  type: ChatTraceStepType,
  label: string,
  status: ChatTraceStep['status'] = 'pending',
  metadata?: Record<string, unknown>
): ChatTrace {
  if (trace.steps.length >= MAX_STEPS) {
    console.warn('[ChatTrace] Max steps reached, skipping step');
    return trace;
  }

  const newStep: ChatTraceStep = {
    id: generateStepId(),
    type,
    label,
    status,
    startedAt: new Date().toISOString(),
    metadata,
  };

  return {
    ...trace,
    steps: [...trace.steps, newStep],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Complete or update an existing step by type
 */
export function completeTraceStep(
  trace: ChatTrace,
  stepType: ChatTraceStepType,
  status: ChatTraceStep['status'],
  message?: string,
  metadata?: Record<string, unknown>
): ChatTrace {
  const updatedSteps = trace.steps.map((step) => {
    if (step.type === stepType && step.status === 'pending') {
      const endedAt = new Date().toISOString();
      const durationMs = step.startedAt
        ? new Date(endedAt).getTime() - new Date(step.startedAt).getTime()
        : undefined;

      return {
        ...step,
        status,
        endedAt,
        durationMs,
        message: message || step.message,
        metadata: metadata ? { ...step.metadata, ...metadata } : step.metadata,
      };
    }
    return step;
  });

  return {
    ...trace,
    steps: updatedSteps,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Add evidence items to trace (with trimming)
 */
export function addEvidenceItems(
  trace: ChatTrace,
  items: ChatEvidenceItem[]
): ChatTrace {
  // Trim to max and dedupe by URL
  const existingUrls = new Set(trace.evidenceItems.map((e) => e.url));
  const newItems = items
    .filter((item) => !item.url || !existingUrls.has(item.url))
    .slice(0, MAX_EVIDENCE_ITEMS - trace.evidenceItems.length);

  const itemsWithIds = newItems.map((item) => ({
    ...item,
    id: item.id || `evi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  }));

  return {
    ...trace,
    evidenceItems: [...trace.evidenceItems, ...itemsWithIds],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Add data quality notes
 */
export function addDataQualityNotes(
  trace: ChatTrace,
  notes: string[]
): ChatTrace {
  const uniqueNotes = Array.from(new Set([...trace.dataQualityNotes, ...notes])).slice(0, 5);
  return {
    ...trace,
    dataQualityNotes: uniqueNotes,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Extract evidence from a command result message
 */
export function extractEvidenceFromCommandResult(
  message: Message,
  command?: string
): ChatEvidenceItem[] {
  const items: ChatEvidenceItem[] = [];
  const timestamp = new Date().toISOString();

  // Extract quote evidence
  if (message.quote) {
    items.push({
      id: `quote-${timestamp}`,
      type: 'quote',
      title: `${message.quote.symbol} @ $${message.quote.price.toFixed(2)} (${message.quote.changePercent >= 0 ? '+' : ''}${message.quote.changePercent.toFixed(2)}%)`,
      source: message.quote.source || 'Market Data',
      confidence: 100,
      timestamp,
    });
  }

  // Extract fundamentals evidence
  if (message.fundamentals) {
    items.push({
      id: `fundamentals-${timestamp}`,
      type: 'fundamentals',
      title: `${message.fundamentals.companyName || message.fundamentals.symbol} — P/E: ${message.fundamentals.peRatio?.toFixed(1) || 'N/A'}, Market Cap: $${((message.fundamentals.marketCap || 0) / 1e9).toFixed(1)}B`,
      source: 'Fundamentals',
      timestamp,
    });
  }

  // Extract news evidence
  if (message.news && message.news.length > 0) {
    message.news.slice(0, 3).forEach((news, idx) => {
      items.push({
        id: `news-${timestamp}-${idx}`,
        type: 'news',
        title: news.title,
        source: news.site,
        url: news.url,
        confidence: Math.round((news.sentimentScore + 1) * 50),
        timestamp: news.publishedDate || timestamp,
      });
    });
  }

  // Extract evidence from blocks
  if (message.blocks) {
    for (const block of message.blocks) {
      if (block.type === 'evidence_list' && block.data?.evidence) {
        const evidence = block.data.evidence as Array<{ label?: string; source?: string; url?: string }>;
        evidence.slice(0, 5).forEach((evi, idx) => {
          if (evi.label || evi.url) {
            // Determine evidence type based on command
            let evidenceType: ChatEvidenceItem['type'] = 'other';
            if (command === 'verified-news') evidenceType = 'verified_news';
            else if (command === 'sec') evidenceType = 'sec_filing';
            else if (command === 'official') evidenceType = 'official_source';
            else if (command === 'trust') evidenceType = 'source_trust';

            items.push({
              id: `block-evi-${timestamp}-${idx}`,
              type: evidenceType,
              title: evi.label || evi.url || 'Evidence item',
              source: evi.source,
              url: evi.url,
              timestamp,
            });
          }
        });
      }
    }
  }

  return items.slice(0, MAX_EVIDENCE_ITEMS);
}

/**
 * Calculate overall trace status
 */
function getTraceStatus(trace: ChatTrace): 'success' | 'warning' | 'error' {
  const hasError = trace.steps.some((s) => s.status === 'error');
  if (hasError) return 'error';

  const hasWarning = trace.steps.some((s) => s.status === 'warning' || s.status === 'skipped');
  if (hasWarning) return 'warning';

  const hasSuccess = trace.steps.some((s) => s.status === 'success');
  return hasSuccess ? 'success' : 'warning';
}

/**
 * Calculate total duration of trace
 */
function getTotalDuration(trace: ChatTrace): number {
  const completedSteps = trace.steps.filter((s) => s.durationMs !== undefined);
  if (completedSteps.length === 0) return 0;
  return completedSteps.reduce((sum, s) => sum + (s.durationMs || 0), 0);
}

/**
 * Generate UI summary for trace
 */
export function summarizeTraceForUI(
  trace: ChatTrace,
  language: Language
): {
  status: 'success' | 'warning' | 'error';
  totalDuration: number;
  stepCount: number;
  evidenceCount: number;
  summaryLabel: string;
  durationLabel: string;
} {
  const status = getTraceStatus(trace);
  const totalDuration = getTotalDuration(trace);

  // Build summary label
  let summaryLabel = '';
  if (trace.command && trace.intent) {
    summaryLabel = `${trace.command} → ${trace.intent}`;
  } else if (trace.command) {
    summaryLabel = trace.command;
  } else if (trace.intent) {
    summaryLabel = trace.intent;
  } else if (trace.ticker) {
    summaryLabel = trace.ticker;
  } else {
    summaryLabel = language === 'zh' ? '聊天操作' : 'Chat action';
  }

  // Format duration
  let durationLabel = '';
  if (totalDuration < 1000) {
    durationLabel = `${totalDuration}ms`;
  } else if (totalDuration < 60000) {
    durationLabel = `${(totalDuration / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(totalDuration / 60000);
    const seconds = Math.floor((totalDuration % 60000) / 1000);
    durationLabel = language === 'zh' ? `${minutes}分${seconds}秒` : `${minutes}m ${seconds}s`;
  }

  return {
    status,
    totalDuration,
    stepCount: trace.steps.length,
    evidenceCount: trace.evidenceItems.length,
    summaryLabel,
    durationLabel,
  };
}

/**
 * Get step label in user's language
 */
export function getStepLabel(type: ChatTraceStepType, language: Language): string {
  const labels: Record<ChatTraceStepType, Record<Language, string>> = {
    user_input: { zh: '用户输入', en: 'User input' },
    slash_command: { zh: '斜杠命令', en: 'Slash command' },
    local_intent: { zh: '本地意图识别', en: 'Local intent' },
    deepseek_intent: { zh: 'DeepSeek 意图分类', en: 'DeepSeek intent' },
    command_execute: { zh: '执行命令', en: 'Execute command' },
    tool_call: { zh: '工具调用', en: 'Tool call' },
    data_quality: { zh: '数据质量检查', en: 'Data quality check' },
    evidence: { zh: '证据收集', en: 'Evidence collection' },
    fallback: { zh: '降级处理', en: 'Fallback' },
    model_route: { zh: '模型路由', en: 'Model route' },
    error: { zh: '错误', en: 'Error' },
  };
  return labels[type]?.[language] || labels[type]?.en || type;
}

/**
 * Get evidence type label in user's language
 */
export function getEvidenceTypeLabel(type: ChatEvidenceItem['type'], language: Language): string {
  const labels: Record<ChatEvidenceItem['type'], Record<Language, string>> = {
    quote: { zh: '行情', en: 'Quote' },
    news: { zh: '新闻', en: 'News' },
    verified_news: { zh: '验证新闻', en: 'Verified News' },
    sec_filing: { zh: 'SEC 文件', en: 'SEC Filing' },
    official_source: { zh: '官方来源', en: 'Official Source' },
    source_trust: { zh: '来源可信度', en: 'Source Trust' },
    history: { zh: '历史数据', en: 'Historical Data' },
    fundamentals: { zh: '基本面', en: 'Fundamentals' },
    insider: { zh: '内部交易', en: 'Insider Trading' },
    earnings: { zh: '财报', en: 'Earnings' },
    dividend: { zh: '分红', en: 'Dividend' },
    other: { zh: '其他', en: 'Other' },
  };
  return labels[type]?.[language] || labels[type]?.en || type;
}

/**
 * Associate a trace with a message
 */
export function linkTraceToMessage(trace: ChatTrace, messageId: string): ChatTrace {
  return {
    ...trace,
    messageId,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create a step from a tool call
 */
export function createToolCallStep(
  toolName: string,
  status: ChatTraceStep['status'] = 'success',
  metadata?: Record<string, unknown>
): ChatTraceStep {
  return {
    id: generateStepId(),
    type: 'tool_call',
    label: toolName,
    status,
    startedAt: new Date().toISOString(),
    endedAt: status !== 'pending' ? new Date().toISOString() : undefined,
    durationMs: status !== 'pending' ? 0 : undefined,
    metadata,
  };
}
