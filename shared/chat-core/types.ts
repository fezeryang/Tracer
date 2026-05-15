export type Language = 'zh' | 'en';

export type ChatGoalSource =
  | 'slash'
  | 'local_rule'
  | 'llm_classifier';

export type ChatGoalIntent =
  | 'quote'
  | 'news'
  | 'fundamentals'
  | 'history'
  | 'chart'
  | 'verified_news'
  | 'sec'
  | 'official'
  | 'trust'
  | 'evidence'
  | 'report'
  | 'chain'
  | 'backtest'
  | 'impact'
  | 'macro'
  | 'insiders'
  | 'earnings'
  | 'dividends'
  | 'help'
  | 'clear'
  | 'general_analysis'
  | 'unknown';

export type ChatGoalDeliverable =
  | 'chat_card'
  | 'chart'
  | 'evidence_bundle'
  | 'navigate'
  | 'report'
  | 'help'
  | 'clear'
  | 'general_answer';

export interface ChatGoal {
  intent: ChatGoalIntent;
  ticker?: string;
  confidence: number;
  source: ChatGoalSource;
  command?: string;
  deliverable: ChatGoalDeliverable;
  requiresTicker: boolean;
  reason: string;
  safetyNotes: string[];
}

export type ChatModelPurpose =
  | 'tool_command'
  | 'intent_classification'
  | 'general_chat'
  | 'complex_financial_question';

export type ChatModelRole =
  | 'conversation'
  | 'answer_composer'
  | 'intent_classifier';

export type ChatModelProvider =
  | 'gemini'
  | 'deepseek'
  | 'local'
  | 'none';

export interface ChatModelRoute {
  provider: ChatModelProvider;
  role: ChatModelRole;
  reason: string;
  requiresApiKey: boolean;
  fallbackProvider?: ChatModelProvider;
}

export interface ChatContext {
  currentTicker?: string;
  lastIntent?: string;
  lastCommand?: string;
  lastQuote?: unknown;
  lastFundamentals?: unknown;
  lastNews?: unknown[];
  lastVerifiedNews?: unknown[];
  lastHistorySummary?: {
    ticker: string;
    points: number;
    startDate?: string;
    endDate?: string;
    latestClose?: number;
  };
  lastSecFilings?: unknown[];
  lastOfficialSources?: unknown[];
  lastSourceTrust?: unknown;
  lastEvidenceBundle?: unknown;
  lastDataQualityNotes?: string[];
  lastDeepSeekIntentResult?: unknown;
  lastUpdatedAt?: string;
}

export interface ContextUpdateInput {
  ticker?: string;
  command?: string;
  intent?: string;
  quote?: unknown;
  fundamentals?: unknown;
  news?: unknown[];
  verifiedNews?: unknown[];
  historySummary?: ChatContext['lastHistorySummary'];
  secFilings?: unknown[];
  officialSources?: unknown[];
  sourceTrust?: unknown;
  evidenceBundle?: unknown;
  dataQualityNotes?: string[];
  deepSeekIntentResult?: unknown;
}

export interface ChatAnswerCompositionInput {
  userText: string;
  context: ChatContext;
  language: Language;
}

export interface ChatAnswerComposition {
  systemPrefix: string;
  userPrompt: string;
  safetyInstructions: string;
  contextSummary: string;
}

export interface RichAnswerPlan {
  purpose:
    | 'explain_context'
    | 'analyze_risk'
    | 'explain_trend'
    | 'explain_formula'
    | 'review_evidence'
    | 'compare_sources'
    | 'learning'
    | 'general';
  recommendedBlockKinds: Array<
    | 'chart'
    | 'formula'
    | 'data_table'
    | 'evidence_list'
    | 'source_trust'
    | 'data_quality'
    | 'mermaid'
    | 'action_buttons'
    | 'disclaimer'
  >;
  reason: string;
}

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

export interface CreateChatTraceInput {
  messageId?: string;
  ticker?: string;
  userInput?: string;
  command?: string;
  intent?: string;
}
