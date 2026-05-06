const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const REPORT_DISCLAIMER = 'For educational and research use only. Not financial advice.';

export const isDeepSeekReportConfigured = () => Boolean(process.env.DEEPSEEK_API_KEY);

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

const toStringArray = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 12);
  if (typeof value === 'string') {
    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 12);
  }
  return [];
};

const normalizeReport = (value, language) => {
  const fallbackDisclaimer = language === 'zh' ? '仅供学习研究使用，不构成投资建议。' : REPORT_DISCLAIMER;

  return {
    summary: String(value?.summary || '').trim(),
    dataAvailabilityAnalysis: String(value?.dataAvailabilityAnalysis || '').trim(),
    priceAnalysis: String(value?.priceAnalysis || '').trim(),
    fundamentalsAnalysis: String(value?.fundamentalsAnalysis || '').trim(),
    newsAnalysis: String(value?.newsAnalysis || '').trim(),
    sourceTrustAnalysis: String(value?.sourceTrustAnalysis || '').trim(),
    volatilityAnalysis: String(value?.volatilityAnalysis || '').trim(),
    optionsEducation: String(value?.optionsEducation || '').trim(),
    risks: toStringArray(value?.risks),
    followUpChecklist: toStringArray(value?.followUpChecklist),
    conclusion: String(value?.conclusion || '').trim(),
    disclaimer: String(value?.disclaimer || fallbackDisclaimer).trim(),
  };
};

const buildPrompt = (context) => {
  const language = context.language === 'zh' ? 'Simplified Chinese' : 'English';

  return JSON.stringify({
    instruction: [
      `Generate a structured equity research report in ${language}.`,
      'Return strict JSON only. Do not use markdown.',
      'Use only the provided data. Do not invent prices, metrics, filings, news, official sources, or events.',
      'Do not provide investment advice. Do not output Buy, Sell, Strong Buy, Entry Point, or Target Price.',
      'If data is missing, explicitly say it is missing.',
      'If quote data is simulation, fallback, or unavailable, explicitly state that no real market judgment can be based on that quote.',
      'Keep the report for educational and research use only.',
    ],
    requiredShape: {
      summary: 'string',
      dataAvailabilityAnalysis: 'string',
      priceAnalysis: 'string',
      fundamentalsAnalysis: 'string',
      newsAnalysis: 'string',
      sourceTrustAnalysis: 'string',
      volatilityAnalysis: 'string',
      optionsEducation: 'string',
      risks: ['string'],
      followUpChecklist: ['string'],
      conclusion: 'string',
      disclaimer: 'string',
    },
    data: {
      ticker: context.ticker,
      quote: context.quote,
      fundamentals: context.fundamentals,
      news: Array.isArray(context.news) ? context.news.slice(0, 6) : [],
      verifiedNews: Array.isArray(context.verifiedNews) ? context.verifiedNews.slice(0, 6) : [],
      officialFilings: context.officialFilings,
      officialSources: context.officialSources,
      sourceTrustSummary: context.sourceTrustSummary,
      dataSourceHealth: context.dataSourceHealth,
      whisper: context.whisper,
      language: context.language,
    },
  });
};

export const generateDeepSeekReport = async (context) => {
  const provider = 'deepseek';
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;

  if (!isDeepSeekReportConfigured()) {
    return { ok: false, provider, error: 'DeepSeek API key is not configured.' };
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;

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
          {
            role: 'system',
            content:
              'You generate cautious, source-grounded equity research reports. Return strict JSON only. Never provide investment advice.',
          },
          {
            role: 'user',
            content: buildPrompt(context),
          },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!response.ok) {
      return { ok: false, provider, error: `DeepSeek request failed with status ${response.status}.` };
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    const candidate = extractJsonCandidate(text);
    if (!candidate) return { ok: false, provider, error: 'DeepSeek did not return JSON.' };

    const parsed = JSON.parse(candidate);
    return {
      ok: true,
      provider,
      model,
      report: normalizeReport(parsed, context.language),
    };
  } catch (error) {
    return {
      ok: false,
      provider,
      error: error instanceof Error ? error.message : 'DeepSeek report generation failed.',
    };
  }
};
