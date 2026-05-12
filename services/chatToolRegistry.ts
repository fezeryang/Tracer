/**
 * Chat Phase C-5: Lightweight Tool Registry & Command Executor Refactor
 *
 * This file provides extended metadata for chat commands beyond the basic
 * CommandSpec in chatCommandRegistry.ts. The registry includes:
 * - Category classification for tool grouping
 * - Output kind for evidence typing
 * - Safety level for policy enforcement
 * - Tool identification for Agent Platform integration
 */

// No imports needed - this is a standalone registry
// CommandSpec types are defined in chatCommandRegistry.ts

export type ChatToolCategory =
  | 'market_data'
  | 'fundamentals'
  | 'news'
  | 'filings'
  | 'source_trust'
  | 'evidence'
  | 'quant'
  | 'macro'
  | 'navigation'
  | 'system';

export type ChatToolSafetyLevel =
  | 'read_only'
  | 'educational'
  | 'simulated'
  | 'sensitive';

export type ChatToolOutputKind =
  | 'quote'
  | 'fundamentals'
  | 'news'
  | 'history'
  | 'chart'
  | 'verified_news'
  | 'sec_filings'
  | 'official_sources'
  | 'source_trust'
  | 'evidence_bundle'
  | 'insiders'
  | 'earnings'
  | 'dividends'
  | 'navigate'
  | 'help'
  | 'clear'
  | 'message';

export interface ChatToolSpec {
  /** Unique tool identifier */
  id: string;
  /** Canonical command name (e.g., 'quote') */
  command: string;
  /** Aliases for the command */
  aliases?: string[];
  /** Tool category for grouping */
  category: ChatToolCategory;
  /** Output type for evidence typing */
  outputKind: ChatToolOutputKind;
  /** Whether the command requires a ticker symbol */
  requiresTicker: boolean;
  /** Safety classification for policy enforcement */
  safetyLevel: ChatToolSafetyLevel;
  /** i18n key for description */
  descriptionKey: string;
  /** Usage string (e.g., 'quote <ticker>') */
  usage: string;
}

/**
 * Extended tool registry with metadata for all 19 chat commands.
 * Maps each CommandSpec from chatCommandRegistry to a ChatToolSpec.
 */
export const CHAT_TOOL_REGISTRY: ChatToolSpec[] = [
  // System commands
  {
    id: 'tool-help',
    command: 'help',
    aliases: ['帮助'],
    category: 'system',
    outputKind: 'help',
    requiresTicker: false,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.help',
    usage: 'help',
  },
  {
    id: 'tool-clear',
    command: 'clear',
    aliases: ['清空'],
    category: 'system',
    outputKind: 'clear',
    requiresTicker: false,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.clearDescription',
    usage: 'clear',
  },

  // Market data commands
  {
    id: 'tool-quote',
    command: 'quote',
    aliases: ['报价'],
    category: 'market_data',
    outputKind: 'quote',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.quoteDescription',
    usage: 'quote <ticker>',
  },
  {
    id: 'tool-news',
    command: 'news',
    aliases: ['新闻'],
    category: 'news',
    outputKind: 'news',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.newsDescription',
    usage: 'news <ticker>',
  },
  {
    id: 'tool-history',
    command: 'history',
    aliases: ['历史'],
    category: 'market_data',
    outputKind: 'history',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.historyDescription',
    usage: 'history <ticker>',
  },
  {
    id: 'tool-chart',
    command: 'chart',
    aliases: ['图表'],
    category: 'market_data',
    outputKind: 'chart',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.chartDescription',
    usage: 'chart <ticker>',
  },

  // Fundamentals command
  {
    id: 'tool-fundamentals',
    command: 'fundamentals',
    aliases: ['基本面'],
    category: 'fundamentals',
    outputKind: 'fundamentals',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.fundamentalsDescription',
    usage: 'fundamentals <ticker>',
  },

  // Navigation commands
  {
    id: 'tool-report',
    command: 'report',
    aliases: ['报告'],
    category: 'navigation',
    outputKind: 'navigate',
    requiresTicker: true,
    safetyLevel: 'educational',
    descriptionKey: 'chat.commands.reportDescription',
    usage: 'report <ticker>',
  },
  {
    id: 'tool-chain',
    command: 'chain',
    aliases: ['期权'],
    category: 'navigation',
    outputKind: 'navigate',
    requiresTicker: true,
    safetyLevel: 'educational',
    descriptionKey: 'chat.commands.chainDescription',
    usage: 'chain <ticker>',
  },
  {
    id: 'tool-backtest',
    command: 'backtest',
    aliases: ['回测'],
    category: 'quant',
    outputKind: 'navigate',
    requiresTicker: true,
    safetyLevel: 'educational',
    descriptionKey: 'chat.commands.backtestDescription',
    usage: 'backtest <ticker>',
  },
  {
    id: 'tool-impact',
    command: 'impact',
    aliases: ['影响'],
    category: 'navigation',
    outputKind: 'navigate',
    requiresTicker: true,
    safetyLevel: 'educational',
    descriptionKey: 'chat.commands.impactDescription',
    usage: 'impact <ticker>',
  },
  {
    id: 'tool-macro',
    command: 'macro',
    aliases: ['宏观'],
    category: 'macro',
    outputKind: 'navigate',
    requiresTicker: true,
    safetyLevel: 'educational',
    descriptionKey: 'chat.commands.macroDescription',
    usage: 'macro <ticker>',
  },

  // Source trust & evidence commands
  {
    id: 'tool-verified-news',
    command: 'verified-news',
    aliases: ['可信新闻'],
    category: 'source_trust',
    outputKind: 'verified_news',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.verifiedNewsDescription',
    usage: 'verified-news <ticker>',
  },
  {
    id: 'tool-sec',
    command: 'sec',
    aliases: ['文件'],
    category: 'filings',
    outputKind: 'sec_filings',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.secDescription',
    usage: 'sec <ticker>',
  },
  {
    id: 'tool-official',
    command: 'official',
    aliases: ['官方'],
    category: 'source_trust',
    outputKind: 'official_sources',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.officialDescription',
    usage: 'official <ticker>',
  },
  {
    id: 'tool-trust',
    command: 'trust',
    aliases: ['信任分'],
    category: 'source_trust',
    outputKind: 'source_trust',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.trustDescription',
    usage: 'trust <ticker>',
  },
  {
    id: 'tool-evidence',
    command: 'evidence',
    aliases: ['证据'],
    category: 'evidence',
    outputKind: 'evidence_bundle',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.evidenceDescription',
    usage: 'evidence <ticker>',
  },

  // Insiders, earnings, dividends
  {
    id: 'tool-insiders',
    command: 'insiders',
    aliases: ['内部人'],
    category: 'filings',
    outputKind: 'insiders',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.insidersDescription',
    usage: 'insiders <ticker>',
  },
  {
    id: 'tool-earnings',
    command: 'earnings',
    aliases: ['财报日'],
    category: 'fundamentals',
    outputKind: 'earnings',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.earningsDescription',
    usage: 'earnings <ticker>',
  },
  {
    id: 'tool-dividends',
    command: 'dividends',
    aliases: ['分红'],
    category: 'fundamentals',
    outputKind: 'dividends',
    requiresTicker: true,
    safetyLevel: 'read_only',
    descriptionKey: 'chat.commands.dividendsDescription',
    usage: 'dividends <ticker>',
  },
];

/**
 * Build a map for fast lookups by command name
 */
const TOOL_BY_COMMAND = new Map(
  CHAT_TOOL_REGISTRY.map((tool) => [tool.command, tool])
);

/**
 * Also index by aliases for lookup flexibility
 */
const TOOL_BY_ALIAS = new Map<string, ChatToolSpec>();
for (const tool of CHAT_TOOL_REGISTRY) {
  if (tool.aliases) {
    for (const alias of tool.aliases) {
      TOOL_BY_ALIAS.set(alias.toLowerCase(), tool);
    }
  }
  TOOL_BY_ALIAS.set(tool.command, tool);
}

/**
 * Find a ChatToolSpec by command name or alias.
 * Returns undefined if not found.
 */
export function getChatToolByCommand(command: string): ChatToolSpec | undefined {
  return TOOL_BY_COMMAND.get(command);
}

/**
 * Get all tools in the registry.
 */
export function listChatTools(): ChatToolSpec[] {
  return CHAT_TOOL_REGISTRY;
}

/**
 * Get tools by category.
 */
export function getChatToolsByCategory(category: ChatToolCategory): ChatToolSpec[] {
  return CHAT_TOOL_REGISTRY.filter((tool) => tool.category === category);
}

/**
 * Check if a command requires a ticker symbol.
 */
export function commandRequiresTicker(command: string): boolean {
  const tool = getChatToolByCommand(command);
  return tool?.requiresTicker ?? false;
}
