import { Language } from '../i18n';
import { getCommandSpec, parseChatCommand } from './chatCommandRegistry';

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

interface CompileOptions {
  selectedTicker?: string;
  language: Language;
}

interface IntentRule {
  intent: ChatGoalIntent;
  command: string;
  deliverable: ChatGoalDeliverable;
  requiresTicker: boolean;
  zh: string[];
  en: string[];
}

interface WeakIntentRule {
  intent: ChatGoalIntent;
  command?: string;
  deliverable: ChatGoalDeliverable;
  requiresTicker: boolean;
  zh: string[];
  en: string[];
  confidence: number;
}

const TICKER_RE = /\$?\b([A-Z]{1,5})\b/g;
const FALSE_TICKERS = new Set([
  'AI', 'API', 'CEO', 'CFO', 'IPO', 'ETF', 'EPS', 'PE', 'SEC',
  'GDP', 'CPI', 'EIA', 'FOMC', 'NYSE', 'NASDAQ', 'USD', 'IV',
]);

const TICKER_ALIASES: Array<[RegExp, string]> = [
  [/苹果|apple/i, 'AAPL'],
  [/特斯拉|tesla/i, 'TSLA'],
  [/英伟达|nvidia/i, 'NVDA'],
  [/微软|microsoft/i, 'MSFT'],
  [/谷歌|google|alphabet/i, 'GOOGL'],
  [/亚马逊|amazon/i, 'AMZN'],
  [/\bmeta\b|facebook/i, 'META'],
  [/奈飞|netflix/i, 'NFLX'],
];

const INTENT_RULES: IntentRule[] = [
  {
    intent: 'verified_news',
    command: 'verified-news',
    deliverable: 'evidence_bundle',
    requiresTicker: true,
    zh: ['可信新闻', '核验新闻', '验证新闻'],
    en: ['verified news', 'validated news'],
  },
  {
    intent: 'quote',
    command: 'quote',
    deliverable: 'chat_card',
    requiresTicker: true,
    zh: ['现价', '行情', '价格', '涨跌', '报价', '现在多少钱'],
    en: ['quote', 'price', 'market price', 'stock price'],
  },
  {
    intent: 'news',
    command: 'news',
    deliverable: 'chat_card',
    requiresTicker: true,
    zh: ['新闻', '消息', '发生什么', '为什么涨', '为什么跌', '异动原因'],
    en: ['news', 'why moving', 'what happened'],
  },
  {
    intent: 'fundamentals',
    command: 'fundamentals',
    deliverable: 'chat_card',
    requiresTicker: true,
    zh: ['基本面', '公司情况', '市值', 'pe', 'p/e', 'beta', '行业', '营收', 'eps'],
    en: ['fundamentals', 'market cap', 'sector', 'industry', 'revenue', 'earnings'],
  },
  {
    intent: 'chart',
    command: 'chart',
    deliverable: 'chart',
    requiresTicker: true,
    zh: ['k线', '图表', '价格趋势', '画一下', '走势'],
    en: ['chart', 'price trend', 'plot'],
  },
  {
    intent: 'history',
    command: 'history',
    deliverable: 'chart',
    requiresTicker: true,
    zh: ['历史价格'],
    en: ['history'],
  },
  {
    intent: 'sec',
    command: 'sec',
    deliverable: 'evidence_bundle',
    requiresTicker: true,
    zh: ['sec', '文件', '10-k', '10-q', '8-k', '披露', '财报文件'],
    en: ['filing', 'filings', 'disclosure', '10-k', '10-q', '8-k'],
  },
  {
    intent: 'official',
    command: 'official',
    deliverable: 'evidence_bundle',
    requiresTicker: true,
    zh: ['官网', '官方来源', 'ir', '投资者关系', '官方公告'],
    en: ['official source', 'investor relations', 'official website'],
  },
  {
    intent: 'trust',
    command: 'trust',
    deliverable: 'evidence_bundle',
    requiresTicker: true,
    zh: ['信任分', '来源可信', '可信度'],
    en: ['source trust', 'source credibility', 'trust score'],
  },
  {
    intent: 'evidence',
    command: 'evidence',
    deliverable: 'evidence_bundle',
    requiresTicker: true,
    zh: ['证据', '数据依据', '来源依据', '支撑材料'],
    en: ['evidence', 'sources', 'supporting data'],
  },
  {
    intent: 'report',
    command: 'report',
    deliverable: 'report',
    requiresTicker: true,
    zh: ['完整报告', '生成报告', 'ai报告', '研报'],
    en: ['report', 'full report', 'research report'],
  },
  {
    intent: 'chain',
    command: 'chain',
    deliverable: 'navigate',
    requiresTicker: true,
    zh: ['期权链'],
    en: ['options chain', 'option chain'],
  },
  {
    intent: 'backtest',
    command: 'backtest',
    deliverable: 'navigate',
    requiresTicker: true,
    zh: ['回测'],
    en: ['backtest'],
  },
  {
    intent: 'impact',
    command: 'impact',
    deliverable: 'navigate',
    requiresTicker: true,
    zh: ['新闻影响', '事件影响', '影响股价'],
    en: ['impact', 'news impact', 'event impact'],
  },
  {
    intent: 'macro',
    command: 'macro',
    deliverable: 'navigate',
    requiresTicker: true,
    zh: ['宏观', 'eia', '原油', '利率', '通胀'],
    en: ['macro', 'macro context', 'oil', 'rates', 'inflation'],
  },
  {
    intent: 'insiders',
    command: 'insiders',
    deliverable: 'chat_card',
    requiresTicker: true,
    zh: ['内部人'],
    en: ['insider', 'insider trading'],
  },
  {
    intent: 'earnings',
    command: 'earnings',
    deliverable: 'chat_card',
    requiresTicker: true,
    zh: ['财报日', '财报时间'],
    en: ['earnings', 'earnings date'],
  },
  {
    intent: 'dividends',
    command: 'dividends',
    deliverable: 'chat_card',
    requiresTicker: true,
    zh: ['分红'],
    en: ['dividend', 'dividends'],
  },
  {
    intent: 'help',
    command: 'help',
    deliverable: 'help',
    requiresTicker: false,
    zh: ['帮助', '怎么用', '命令'],
    en: ['help', 'commands', 'how to use'],
  },
  {
    intent: 'clear',
    command: 'clear',
    deliverable: 'clear',
    requiresTicker: false,
    zh: ['清空', '重置对话', '重新开始'],
    en: ['clear', 'reset conversation', 'start over'],
  },
];

const WEAK_INTENT_RULES: WeakIntentRule[] = [
  {
    intent: 'trust',
    command: 'trust',
    deliverable: 'evidence_bundle',
    requiresTicker: true,
    zh: ['靠谱吗', '可靠', '可信', '这个股票来源', '这个公司来源'],
    en: ['reliable', 'credible', 'can i trust', 'is this source'],
    confidence: 0.65,
  },
  {
    intent: 'evidence',
    command: 'evidence',
    deliverable: 'evidence_bundle',
    requiresTicker: true,
    zh: ['这个公司的证据', '这个股票的证据', '找一下这个公司的', '重要东西需要看', '需要看什么'],
    en: ['evidence for this company', 'what should i look at', 'important things to review'],
    confidence: 0.6,
  },
  {
    intent: 'report',
    command: 'report',
    deliverable: 'report',
    requiresTicker: true,
    zh: ['生成完整报告', '完整报告', '生成报告'],
    en: ['generate full report', 'full report'],
    confidence: 0.65,
  },
  {
    intent: 'sec',
    command: 'sec',
    deliverable: 'evidence_bundle',
    requiresTicker: true,
    zh: ['看看 sec 文件', '看看sec文件', '看 sec 文件', '看sec文件'],
    en: ['look at sec filings', 'check sec filings'],
    confidence: 0.65,
  },
];

const baseSafetyNotes = (intent: ChatGoalIntent): string[] => {
  const notes = [
    'not_financial_advice',
    'no_buy_sell_hold',
    'no_target_price_or_entry_exit_levels',
    'data_quality_required',
  ];
  if (intent === 'chart' || intent === 'history') notes.push('past_performance_not_predictive');
  if (intent === 'trust' || intent === 'evidence' || intent === 'verified_news') notes.push('evidence_quality_not_investment_conclusion');
  return notes;
};

const commandToIntent = (command: string): ChatGoalIntent => {
  if (command === 'verified-news') return 'verified_news';
  if (command === 'help' || command === 'clear') return command;
  if (INTENT_RULES.some((rule) => rule.intent === command)) return command as ChatGoalIntent;
  return 'unknown';
};

const deliverableForCommand = (command: string): ChatGoalDeliverable => {
  const rule = INTENT_RULES.find((item) => item.command === command);
  if (rule) return rule.deliverable;
  return command === 'help' ? 'help' : command === 'clear' ? 'clear' : 'general_answer';
};

const normalizeTicker = (ticker?: string): string | undefined => {
  const normalized = ticker?.trim().replace(/^\$/, '').toUpperCase();
  return normalized || undefined;
};

export const extractChatGoalTicker = (input: string): string | undefined => {
  for (const [pattern, ticker] of TICKER_ALIASES) {
    if (pattern.test(input)) return ticker;
  }

  const matches = input.matchAll(TICKER_RE);
  for (const match of matches) {
    const ticker = match[1].toUpperCase();
    if (FALSE_TICKERS.has(ticker)) continue;
    return ticker;
  }

  return undefined;
};

const keywordMatched = (input: string, keywords: string[]): boolean => {
  const normalized = input.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
};

const matchedRule = (input: string): IntentRule | undefined => {
  return INTENT_RULES.find((rule) => keywordMatched(input, [...rule.zh, ...rule.en]));
};

const matchedWeakRule = (input: string): WeakIntentRule | undefined => {
  return WEAK_INTENT_RULES.find((rule) => keywordMatched(input, [...rule.zh, ...rule.en]));
};

const hasContextualReference = (input: string): boolean => {
  const normalized = input.toLowerCase();
  return ['这个股票', '这只股票', '这个公司', '这家公司', 'this stock', 'this company'].some((item) => normalized.includes(item));
};

const buildMediumGoal = (
  rule: WeakIntentRule | IntentRule,
  ticker: string | undefined,
  reason: string,
  confidence = 'confidence' in rule ? rule.confidence : 0.65,
): ChatGoal => ({
  intent: rule.intent,
  ticker,
  confidence,
  source: 'local_rule',
  command: rule.command,
  deliverable: rule.deliverable,
  requiresTicker: rule.requiresTicker,
  reason,
  safetyNotes: ticker ? [...baseSafetyNotes(rule.intent), 'using_current_ticker'] : baseSafetyNotes(rule.intent),
});

export function compileChatGoal(
  input: string,
  options: CompileOptions,
): ChatGoal {
  const trimmed = input.trim();
  const slashCommand = parseChatCommand(trimmed);

  if (slashCommand) {
    const spec = getCommandSpec(slashCommand.name);
    const intent = commandToIntent(slashCommand.name);
    const ticker = normalizeTicker(slashCommand.args[0]);
    return {
      intent,
      ticker,
      confidence: 1,
      source: 'slash',
      command: slashCommand.name,
      deliverable: deliverableForCommand(slashCommand.name),
      requiresTicker: Boolean(spec?.requiresTicker),
      reason: `slash_command:${slashCommand.name}`,
      safetyNotes: baseSafetyNotes(intent),
    };
  }

  if (trimmed.length < 2) {
    return {
      intent: 'unknown',
      confidence: 0,
      source: 'local_rule',
      deliverable: 'general_answer',
      requiresTicker: false,
      reason: 'input_too_short',
      safetyNotes: baseSafetyNotes('unknown'),
    };
  }

  const rule = matchedRule(trimmed);
  if (!rule) {
    const weakRule = matchedWeakRule(trimmed);
    if (weakRule) {
      return buildMediumGoal(
        weakRule,
        normalizeTicker(options.selectedTicker),
        `weak_local_keyword:${weakRule.intent}`,
      );
    }

    return {
      intent: 'general_analysis',
      confidence: 0.4,
      source: 'local_rule',
      deliverable: 'general_answer',
      requiresTicker: false,
      reason: 'no_local_rule_match',
      safetyNotes: baseSafetyNotes('general_analysis'),
    };
  }

  const extractedTicker = extractChatGoalTicker(trimmed);
  const selectedTicker = normalizeTicker(options.selectedTicker);
  const safetyNotes = baseSafetyNotes(rule.intent);

  if (rule.requiresTicker && !extractedTicker && (hasContextualReference(trimmed) || !selectedTicker)) {
    return buildMediumGoal(
      rule,
      selectedTicker,
      selectedTicker
        ? `medium_local_keyword:${rule.intent}:contextual_selected_ticker`
        : 'missing_ticker',
      selectedTicker ? 0.65 : 0.7,
    );
  }

  if (extractedTicker) {
    return {
      intent: rule.intent,
      ticker: extractedTicker,
      confidence: 0.95,
      source: 'local_rule',
      command: rule.command,
      deliverable: rule.deliverable,
      requiresTicker: rule.requiresTicker,
      reason: `local_keyword:${rule.intent}:explicit_ticker`,
      safetyNotes,
    };
  }

  if (rule.requiresTicker && selectedTicker) {
    return {
      intent: rule.intent,
      ticker: selectedTicker,
      confidence: 0.85,
      source: 'local_rule',
      command: rule.command,
      deliverable: rule.deliverable,
      requiresTicker: true,
      reason: `local_keyword:${rule.intent}:selected_ticker`,
      safetyNotes: [...safetyNotes, 'using_current_ticker'],
    };
  }

  if (rule.requiresTicker) {
    return {
      intent: rule.intent,
      confidence: 0.9,
      source: 'local_rule',
      deliverable: 'general_answer',
      requiresTicker: true,
      reason: 'missing_ticker',
      safetyNotes,
    };
  }

  return {
    intent: rule.intent,
    confidence: 0.95,
    source: 'local_rule',
    command: rule.command,
    deliverable: rule.deliverable,
    requiresTicker: false,
    reason: `local_keyword:${rule.intent}`,
    safetyNotes,
  };
}

// TODO C-2B:
// Add server-side DeepSeek intent classifier for ambiguous natural language.
// Only call it when local confidence is between 0.45 and 0.80.
// Do not expose DeepSeek key to frontend.
// Classifier must return strict JSON.
// Classifier must not answer financial questions directly.
