const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const INTENT_TIMEOUT_MS = 30000;

const VALID_INTENTS = new Set([
  'quote', 'news', 'fundamentals', 'history', 'chart', 'verified_news',
  'sec', 'official', 'trust', 'evidence', 'report', 'chain', 'backtest',
  'impact', 'macro', 'insiders', 'earnings', 'dividends', 'help', 'clear',
  'general_analysis', 'none', 'unknown',
]);

const COMMAND_BY_INTENT = {
  quote: 'quote',
  news: 'news',
  fundamentals: 'fundamentals',
  history: 'history',
  chart: 'chart',
  verified_news: 'verified-news',
  sec: 'sec',
  official: 'official',
  trust: 'trust',
  evidence: 'evidence',
  report: 'report',
  chain: 'chain',
  backtest: 'backtest',
  impact: 'impact',
  macro: 'macro',
  insiders: 'insiders',
  earnings: 'earnings',
  dividends: 'dividends',
  help: 'help',
  clear: 'clear',
};

const TICKER_RE = /^[A-Z]{1,5}$/;

export const isDeepSeekIntentConfigured = () => Boolean(process.env.DEEPSEEK_API_KEY);

const extractJsonCandidate = (rawText) => {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Continue with tolerant extraction.
  }

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
};

const normalizeTicker = (value) => {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim().replace(/^\$/, '').toUpperCase();
  return TICKER_RE.test(normalized) ? normalized : null;
};

const clampConfidence = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(1, numeric));
};

const normalizeCommand = (intent, ticker, rawCommand, shouldExecute) => {
  const commandName = COMMAND_BY_INTENT[intent];
  if (!shouldExecute || !commandName) return null;

  const raw = typeof rawCommand === 'string' ? rawCommand.trim() : '';
  if (!raw) return null;

  if (intent === 'help' || intent === 'clear') {
    return raw.replace(/^\//, '') === commandName ? `/${commandName}` : null;
  }

  if (!ticker) return null;

  const expected = `/${commandName} ${ticker}`;
  const parts = raw.replace(/^\//, '').split(/\s+/);
  const rawName = parts[0];
  const rawTicker = normalizeTicker(parts[1]);
  if (rawName === commandName && rawTicker === ticker) return expected;

  return expected;
};

const normalizeIntentResult = (value) => {
  const intent = VALID_INTENTS.has(value?.intent) ? value.intent : 'unknown';
  const ticker = normalizeTicker(value?.ticker);
  const confidence = clampConfidence(value?.confidence);
  const needsClarification = Boolean(value?.needsClarification);
  const shouldExecute = Boolean(value?.shouldExecute) && confidence >= 0.75 && !needsClarification && Boolean(COMMAND_BY_INTENT[intent]);
  const command = normalizeCommand(intent, ticker, value?.command, shouldExecute);

  return {
    intent,
    ticker,
    confidence,
    shouldExecute: Boolean(command),
    command,
    needsClarification,
    clarifyingQuestion: typeof value?.clarifyingQuestion === 'string' && value.clarifyingQuestion.trim()
      ? value.clarifyingQuestion.trim().slice(0, 240)
      : null,
    reason: typeof value?.reason === 'string' ? value.reason.trim().slice(0, 600) : '',
  };
};

const buildSystemPrompt = () => `You are an intent classifier for a financial research terminal.
You do not answer the user's financial question.
You do not provide investment advice.
You do not generate market analysis.
You do not call tools.
You only classify the user's intent and return strict JSON.

Never output Buy, Sell, Hold, Strong Buy, Strong Sell, target price, entry point, support level, resistance level, stop-loss, trading instructions, or market predictions.

Return exactly this JSON object:
{"intent":"quote|news|fundamentals|history|chart|verified_news|sec|official|trust|evidence|report|chain|backtest|impact|macro|insiders|earnings|dividends|help|clear|general_analysis|none|unknown","ticker":string|null,"confidence":number,"shouldExecute":boolean,"command":string|null,"needsClarification":boolean,"clarifyingQuestion":string|null,"reason":string}

Rules:
1. If the user clearly asks for a data query, return the matching command intent.
2. If the user asks broad analysis or learning questions, return general_analysis with shouldExecute false.
3. If ticker is missing but selectedTicker is available, use selectedTicker.
4. If ticker is missing and selectedTicker is unavailable for a ticker-required intent, set needsClarification true and shouldExecute false.
5. The command must be a slash command like "/quote AAPL" only when shouldExecute is true.

Examples:
Input: 苹果现价多少
Output: {"intent":"quote","ticker":"AAPL","confidence":0.95,"shouldExecute":true,"command":"/quote AAPL","needsClarification":false,"clarifyingQuestion":null,"reason":"The user asks for Apple's current price."}

Input: 这个股票来源可信吗
selectedTicker: NVDA
Output: {"intent":"trust","ticker":"NVDA","confidence":0.9,"shouldExecute":true,"command":"/trust NVDA","needsClarification":false,"clarifyingQuestion":null,"reason":"The user asks about source credibility and selectedTicker is available."}

Input: 分析 NVDA 的长期竞争优势
Output: {"intent":"general_analysis","ticker":"NVDA","confidence":0.7,"shouldExecute":false,"command":null,"needsClarification":false,"clarifyingQuestion":null,"reason":"The user asks for broad strategic analysis rather than a specific data command."}

Input: 生成完整报告
selectedTicker: null
Output: {"intent":"report","ticker":null,"confidence":0.85,"shouldExecute":false,"command":null,"needsClarification":true,"clarifyingQuestion":"请提供股票代码，例如：生成 AAPL 完整报告。","reason":"The user asks for a report but no ticker is available."}`;

export const classifyChatIntent = async ({ input, selectedTicker, language, localGoal }) => {
  if (!isDeepSeekIntentConfigured()) {
    return { ok: false, available: false, error: 'deepseek_unavailable' };
  }

  const text = String(input || '').trim();
  if (!text) {
    return { ok: false, available: false, error: 'empty_input' };
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: buildSystemPrompt() },
          {
            role: 'user',
            content: JSON.stringify({
              input: text,
              selectedTicker: selectedTicker || null,
              language: language === 'en' ? 'en' : 'zh',
              localGoal: localGoal ? {
                intent: localGoal.intent,
                ticker: localGoal.ticker || null,
                confidence: localGoal.confidence,
                reason: localGoal.reason,
              } : null,
            }),
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(INTENT_TIMEOUT_MS),
    });

    if (!response.ok) {
      return { ok: false, available: false, error: 'deepseek_unavailable' };
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content;
    const candidate = extractJsonCandidate(rawText);
    if (!candidate) {
      return { ok: false, available: false, error: 'invalid_classifier_json' };
    }

    const result = normalizeIntentResult(JSON.parse(candidate));
    return { ok: true, available: true, result };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'DeepSeek intent classifier failed.';
    console.warn(`[DeepSeek Intent] ${message}`);
    return { ok: false, available: false, error: 'deepseek_unavailable' };
  }
};
