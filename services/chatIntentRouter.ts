import { ChatIntent, ChatIntentName } from '../types';

// C-2B will add server-side DeepSeek intent classifier for ambiguous natural language inputs.
// Do not expose DeepSeek key to frontend.
// DeepSeek classifier must return strict JSON only.

const TICKER_RE = /\$?([A-Z]{1,5})/g;

const FALSE_POSITIVES = new Set([
  'AI', 'API', 'CEO', 'CFO', 'IPO', 'ETF', 'EPS', 'PE',
  'FDA', 'SEC', 'GDP', 'CPI', 'FOMC', 'NYSE', 'NASDAQ',
  'OK', 'A', 'I', 'IT', 'AT', 'BE', 'GO', 'TO', 'IN',
  'ON', 'IS', 'OR', 'ALL', 'BY', 'IV', 'RAG',
]);

function extractTicker(text: string): string | undefined {
  const matches = text.match(TICKER_RE);
  if (!matches) return undefined;
  for (const m of matches) {
    const ticker = m.startsWith('$') ? m.slice(1) : m;
    if (FALSE_POSITIVES.has(ticker)) continue;
    if (ticker.length >= 1 && ticker.length <= 5) return ticker;
  }
  return undefined;
}

interface PatternMatch {
  intent: ChatIntentName;
  confidence: number;
  ticker?: string;
  command?: string;
  reason: string;
}

type PatternFunction = (text: string, normalized: string, selectedTicker: string) => PatternMatch | null;

const patterns: PatternFunction[] = [];

function keywordPattern(
  intent: ChatIntentName,
  command: string,
  keywordsEn: string[],
  keywordsZh: string[],
  requiresTicker: boolean,
): PatternFunction {
  const allKeywords = [...keywordsEn, ...keywordsZh];
  return (text: string, normalized: string, selectedTicker: string): PatternMatch | null => {
    const matched = allKeywords.some((kw) => normalized.includes(kw));
    if (!matched) return null;

    const ticker = extractTicker(text);

    if (ticker) {
      return {
        intent,
        confidence: 0.95,
        ticker: ticker.toUpperCase(),
        command,
        reason: `Keyword match for '${intent}' with ticker ${ticker.toUpperCase()}`,
      };
    }

    if (requiresTicker && selectedTicker) {
      return {
        intent,
        confidence: 0.80,
        ticker: selectedTicker,
        command,
        reason: `Keyword match for '${intent}', using selected ticker fallback: ${selectedTicker}`,
      };
    }

    if (!requiresTicker) {
      return {
        intent,
        confidence: 0.95,
        command,
        reason: `Keyword match for '${intent}' (no ticker required)`,
      };
    }

    return {
      intent: 'unknown',
      confidence: 0,
      reason: `'${intent}' requires ticker but none found and no selectedTicker`,
    };
  };
}

// --- Pattern registration ---

patterns.push(keywordPattern('quote', 'quote',
  ['stock quote', 'quote for', 'show me quote', 'get quote', 'current price',
   'stock price', 'price of', 'what is the price of', 'how is', "how's",
   'trading at', 'market price'],
  ['报价', '价格', '行情', '股价', '当前价格'],
  true,
));

patterns.push(keywordPattern('news', 'news',
  ['news about', 'latest news', 'headlines for', "what's happening with",
   'recent news', 'news on', 'show news', 'get news', 'news for'],
  ['新闻', '最新消息', '头条'],
  true,
));

patterns.push(keywordPattern('fundamentals', 'fundamentals',
  ['fundamentals', 'financials', 'company info', 'company overview', 'company profile'],
  ['基本面', '财务', '公司信息', '公司概况'],
  true,
));

patterns.push(keywordPattern('history', 'history',
  ['price history', 'historical data', 'historical prices'],
  ['历史价格', '历史数据'],
  true,
));

patterns.push(keywordPattern('chart', 'chart',
  ['chart', 'price chart', 'candlestick', 'graph'],
  ['图表', '走势图', 'K线'],
  true,
));

patterns.push(keywordPattern('report', 'report',
  ['generate report', 'full analysis', 'detailed analysis', 'comprehensive report',
   'create report', 'analyze', 'analysis report', 'research report'],
  ['生成报告', '完整分析', '详细报告', '研究报告', '分析报告'],
  true,
));

patterns.push(keywordPattern('chain', 'chain',
  ['options chain', 'option chain', 'show options', 'view options'],
  ['期权链', '期权'],
  true,
));

patterns.push(keywordPattern('backtest', 'backtest',
  ['backtest', 'run backtest', 'test strategy', 'strategy test'],
  ['回测', '测试策略'],
  true,
));

patterns.push(keywordPattern('impact', 'impact',
  ['news impact', 'impact analysis', 'what impact', 'predict impact'],
  ['影响分析', '新闻影响', '预测影响'],
  true,
));

patterns.push(keywordPattern('macro', 'macro',
  ['macro', 'macro context', 'economic data', 'macroeconomic'],
  ['宏观', '经济数据', '宏观经济'],
  true,
));

patterns.push(keywordPattern('verified_news', 'verified-news',
  ['verified news', 'fact check', 'trusted news', 'cross reference news'],
  ['可信新闻', '事实核查', '交叉验证新闻'],
  true,
));

patterns.push(keywordPattern('sec', 'sec',
  ['sec filings', 'edgar', 'filings', 'sec filing', '10-K', '10-Q'],
  ['文件', '备案', 'SEC文件'],
  true,
));

patterns.push(keywordPattern('official', 'official',
  ['official sources', 'official', 'company sources', 'investor relations'],
  ['官方', '官方来源', '公司来源'],
  true,
));

patterns.push(keywordPattern('trust', 'trust',
  ['source trust', 'trust score', 'reliability'],
  ['信任分', '来源可信度'],
  true,
));

patterns.push(keywordPattern('evidence', 'evidence',
  ['evidence', 'evidence summary', 'data evidence', 'source evidence'],
  ['证据', '证据汇总', '数据证据'],
  true,
));

patterns.push(keywordPattern('insiders', 'insiders',
  ['insider trading', 'insiders', 'insider transactions', 'insider'],
  ['内部人交易', '内部人', '内部交易'],
  true,
));

patterns.push(keywordPattern('earnings', 'earnings',
  ['earnings calendar', 'earnings date', 'earnings report', 'earnings call'],
  ['财报日', '财报', '收益', '盈利'],
  true,
));

patterns.push(keywordPattern('dividends', 'dividends',
  ['dividends', 'dividend history', 'dividend', 'dividend yield'],
  ['分红', '股息', '股利'],
  true,
));

patterns.push(keywordPattern('help', 'help',
  ['help', 'what can you do', 'commands', 'how to use', 'what commands'],
  ['帮助', '怎么用', '命令', '功能'],
  false,
));

patterns.push(keywordPattern('clear', 'clear',
  ['clear', 'reset conversation', 'start over', 'new chat', 'wipe'],
  ['清空', '重置', '重新开始', '清除'],
  false,
));

// --- Public API ---

const CONFIDENCE_THRESHOLD = 0.80;

export function detectChatIntent(text: string, selectedTicker: string): ChatIntent {
  const normalized = text.toLowerCase().trim();

  if (normalized.length < 2) {
    return {
      name: 'unknown',
      confidence: 0,
      source: 'local_rule',
      reason: 'Input too short for intent detection',
    };
  }

  let bestMatch: PatternMatch | null = null;

  for (const pattern of patterns) {
    const match = pattern(text, normalized, selectedTicker);
    if (match && match.intent !== 'unknown') {
      if (!bestMatch || match.confidence > bestMatch.confidence) {
        bestMatch = match;
      }
    }
  }

  if (bestMatch && bestMatch.confidence >= CONFIDENCE_THRESHOLD) {
    return {
      name: bestMatch.intent,
      ticker: bestMatch.ticker,
      confidence: bestMatch.confidence,
      source: 'local_rule',
      command: bestMatch.command,
      reason: bestMatch.reason,
    };
  }

  return {
    name: 'unknown',
    confidence: bestMatch ? bestMatch.confidence : 0,
    source: 'local_rule',
    reason: bestMatch
      ? `Best match '${bestMatch.intent}' below confidence threshold (${bestMatch.confidence.toFixed(2)} < ${CONFIDENCE_THRESHOLD})`
      : 'No natural language pattern matched',
  };
}

export function explainRoutingDecision(intent: ChatIntent, language: 'zh' | 'en'): string {
  if (intent.source === 'slash') {
    return language === 'zh' ? '斜杠命令已识别' : 'Slash command recognized';
  }
  if (intent.source === 'local_rule' && intent.name !== 'unknown') {
    if (language === 'zh') {
      return `本地识别为 "${intent.name}"（置信度: ${(intent.confidence * 100).toFixed(0)}%）`;
    }
    return `Locally recognized as "${intent.name}" (confidence: ${(intent.confidence * 100).toFixed(0)}%)`;
  }
  return language === 'zh' ? '未匹配本地模式，交由 AI 分析' : 'No local pattern matched, forwarding to AI analysis';
}
