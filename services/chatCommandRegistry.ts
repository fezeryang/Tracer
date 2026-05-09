import { ShellViewMode } from '../types';

export interface ChatCommand {
  name: string;        // e.g. 'quote'
  args: string[];      // e.g. ['AAPL']
  raw: string;         // original input
}

export interface CommandSpec {
  name: string;
  aliases: string[];        // e.g. ['报价'] for /quote
  descriptionKey: string;   // i18n key
  usage: string;            // 'quote <ticker>'
  requiresTicker: boolean;
  action: 'fetch_quote' | 'fetch_news' | 'fetch_fundamentals' | 'navigate' | 'help' | 'clear'
    | 'fetch_history' | 'fetch_verified_news' | 'fetch_sec' | 'fetch_official'
    | 'fetch_trust' | 'fetch_evidence' | 'fetch_insiders' | 'fetch_earnings' | 'fetch_dividends';
  targetView?: ShellViewMode; // for navigate actions
}

export const COMMANDS: CommandSpec[] = [
  {
    name: 'help',
    aliases: ['帮助'],
    descriptionKey: 'chat.commands.help',
    usage: 'help',
    requiresTicker: false,
    action: 'help',
  },
  {
    name: 'quote',
    aliases: ['报价'],
    descriptionKey: 'chat.commands.quoteDescription',
    usage: 'quote <ticker>',
    requiresTicker: true,
    action: 'fetch_quote',
  },
  {
    name: 'news',
    aliases: ['新闻'],
    descriptionKey: 'chat.commands.newsDescription',
    usage: 'news <ticker>',
    requiresTicker: true,
    action: 'fetch_news',
  },
  {
    name: 'fundamentals',
    aliases: ['基本面'],
    descriptionKey: 'chat.commands.fundamentalsDescription',
    usage: 'fundamentals <ticker>',
    requiresTicker: true,
    action: 'fetch_fundamentals',
  },
  {
    name: 'report',
    aliases: ['报告'],
    descriptionKey: 'chat.commands.reportDescription',
    usage: 'report <ticker>',
    requiresTicker: true,
    action: 'navigate',
    targetView: 'report',
  },
  {
    name: 'chain',
    aliases: ['期权'],
    descriptionKey: 'chat.commands.chainDescription',
    usage: 'chain <ticker>',
    requiresTicker: true,
    action: 'navigate',
    targetView: 'chain',
  },
  {
    name: 'backtest',
    aliases: ['回测'],
    descriptionKey: 'chat.commands.backtestDescription',
    usage: 'backtest <ticker>',
    requiresTicker: true,
    action: 'navigate',
    targetView: 'backtest',
  },
  {
    name: 'impact',
    aliases: ['影响'],
    descriptionKey: 'chat.commands.impactDescription',
    usage: 'impact <ticker>',
    requiresTicker: true,
    action: 'navigate',
    targetView: 'news-impact',
  },
  {
    name: 'macro',
    aliases: ['宏观'],
    descriptionKey: 'chat.commands.macroDescription',
    usage: 'macro <ticker>',
    requiresTicker: true,
    action: 'navigate',
    targetView: 'macro',
  },
  {
    name: 'clear',
    aliases: ['清空'],
    descriptionKey: 'chat.commands.clearDescription',
    usage: 'clear',
    requiresTicker: false,
    action: 'clear',
  },
  {
    name: 'history',
    aliases: ['历史'],
    descriptionKey: 'chat.commands.historyDescription',
    usage: 'history <ticker>',
    requiresTicker: true,
    action: 'fetch_history',
  },
  {
    name: 'chart',
    aliases: ['图表'],
    descriptionKey: 'chat.commands.chartDescription',
    usage: 'chart <ticker>',
    requiresTicker: true,
    action: 'fetch_history',
  },
  {
    name: 'verified-news',
    aliases: ['可信新闻'],
    descriptionKey: 'chat.commands.verifiedNewsDescription',
    usage: 'verified-news <ticker>',
    requiresTicker: true,
    action: 'fetch_verified_news',
  },
  {
    name: 'sec',
    aliases: ['文件'],
    descriptionKey: 'chat.commands.secDescription',
    usage: 'sec <ticker>',
    requiresTicker: true,
    action: 'fetch_sec',
  },
  {
    name: 'official',
    aliases: ['官方'],
    descriptionKey: 'chat.commands.officialDescription',
    usage: 'official <ticker>',
    requiresTicker: true,
    action: 'fetch_official',
  },
  {
    name: 'trust',
    aliases: ['信任分'],
    descriptionKey: 'chat.commands.trustDescription',
    usage: 'trust <ticker>',
    requiresTicker: true,
    action: 'fetch_trust',
  },
  {
    name: 'evidence',
    aliases: ['证据'],
    descriptionKey: 'chat.commands.evidenceDescription',
    usage: 'evidence <ticker>',
    requiresTicker: true,
    action: 'fetch_evidence',
  },
  {
    name: 'insiders',
    aliases: ['内部人'],
    descriptionKey: 'chat.commands.insidersDescription',
    usage: 'insiders <ticker>',
    requiresTicker: true,
    action: 'fetch_insiders',
  },
  {
    name: 'earnings',
    aliases: ['财报日'],
    descriptionKey: 'chat.commands.earningsDescription',
    usage: 'earnings <ticker>',
    requiresTicker: true,
    action: 'fetch_earnings',
  },
  {
    name: 'dividends',
    aliases: ['分红'],
    descriptionKey: 'chat.commands.dividendsDescription',
    usage: 'dividends <ticker>',
    requiresTicker: true,
    action: 'fetch_dividends',
  },
];

/**
 * Parse a chat input string into a ChatCommand if it starts with '/'.
 * Returns null if the input is not a slash command.
 */
export const parseChatCommand = (input: string): ChatCommand | null => {
  if (!input.startsWith('/')) return null;

  const trimmed = input.trim();
  const parts = trimmed.slice(1).split(/\s+/); // remove leading '/', split on whitespace
  const rawName = parts[0].toLowerCase();

  // Find command spec by name or alias (case-insensitive)
  const spec = COMMANDS.find(
    (cmd) => cmd.name.toLowerCase() === rawName || cmd.aliases.some((alias) => alias.toLowerCase() === rawName)
  );

  if (!spec) return null;

  return {
    name: spec.name,
    args: parts.slice(1),
    raw: trimmed,
  };
};

/**
 * Look up a CommandSpec by its canonical name.
 */
export const getCommandSpec = (name: string): CommandSpec | undefined => {
  return COMMANDS.find((cmd) => cmd.name === name);
};
