import { getAI, retryOperation } from './geminiService';
import { fetchCompanyFundamentals, fetchStockNews, fetchStockQuote, fetchWhisperData } from './marketDataService';
import { CompanyFundamentals, NewsItem, StockAnalysisReport, StockQuote, WhisperData } from '../types';

interface StockAnalysisReportLLMResponse {
  summary?: string;
  priceAnalysis?: string;
  newsAnalysis?: string;
  fundamentalsAnalysis?: string;
  volatilityAnalysis?: string;
  optionsEducation?: string;
  risks?: string[] | string;
  conclusion?: string;
  disclaimer?: string;
}

const REPORT_DISCLAIMER = 'For educational and research use only. Not financial advice.';

const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase();

const toStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/\n|;/)
      .map((item) => item.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }
  return [];
};

const extractJsonCandidate = (rawText: string): string | null => {
  const trimmed = rawText.trim();

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Fall through to more permissive extraction.
  }

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) {
    const candidate = codeBlockMatch[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // Keep trying.
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1).trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      return null;
    }
  }

  return null;
};

const parseReportResponse = (rawText: string): StockAnalysisReportLLMResponse | null => {
  const candidate = extractJsonCandidate(rawText);
  if (!candidate) return null;

  try {
    return JSON.parse(candidate) as StockAnalysisReportLLMResponse;
  } catch {
    return null;
  }
};

const buildAvailabilityNotes = (
  quote: StockQuote | null,
  fundamentals: CompanyFundamentals | null,
  news: NewsItem[],
  whisper: WhisperData | null,
  failedSources: string[]
): string[] => {
  const notes: string[] = [];

  if (!quote) notes.push('Live quote data was unavailable when this report was generated.');
  if (!fundamentals) notes.push('Company fundamentals were unavailable or incomplete for this run.');
  if (news.length === 0) notes.push('No recent news items were available, so news coverage is limited.');
  if (!whisper) {
    notes.push('Experimental Whisper alternative signal data was unavailable for this report.');
  } else {
    notes.push('Whisper signals are experimental, simulated-style alternative indicators and not a complete or verified social media dataset.');
  }

  if (failedSources.length > 0) {
    notes.push(`Data source issues detected: ${failedSources.join(', ')}.`);
  }

  return notes;
};

const buildFallbackReport = (
  ticker: string,
  quote: StockQuote | null,
  fundamentals: CompanyFundamentals | null,
  news: NewsItem[],
  whisper: WhisperData | null,
  failedSources: string[]
): StockAnalysisReport => {
  const availabilityNotes = buildAvailabilityNotes(quote, fundamentals, news, whisper, failedSources);
  const newsHeadlineSummary =
    news.length > 0
      ? news
          .slice(0, 3)
          .map((item) => `${item.title} (${item.site})`)
          .join('; ')
      : 'No recent headlines were available from the current feed.';

  const quoteSummary = quote
    ? `${ticker} was last observed at $${quote.price.toFixed(2)}, with a ${quote.change >= 0 ? 'positive' : 'negative'} daily move of ${quote.changePercent.toFixed(2)}%.`
    : `${ticker} quote data was unavailable, so price observations are limited.`;

  const fundamentalsSummary = fundamentals
    ? `${fundamentals.companyName} operates in ${fundamentals.sector || 'an unspecified sector'}. Market cap and business profile were available, but some fields may remain sparse in the current backend feed.`
    : 'Fundamental company profile data was unavailable, so business context should be treated as incomplete.';

  const whisperSummary = whisper
    ? `Experimental Whisper signal summary: ${whisper.summary}`
    : 'Experimental Whisper alternative signal data was not available for this run.';

  return {
    ticker,
    generatedAt: new Date().toISOString(),
    quote,
    fundamentals,
    news,
    whisper,
    summary: `${quoteSummary} This report is a research-oriented snapshot assembled from currently available market, company, and headline data. ${REPORT_DISCLAIMER}`,
    priceAnalysis: `${quoteSummary} If quote coverage is delayed or simulated, treat this as a rough reference rather than a trading input.`,
    newsAnalysis: `Recent headline coverage: ${newsHeadlineSummary} News sentiment is automatically estimated from available headlines and summaries, may be incomplete, and should be treated as an educational signal.`,
    fundamentalsAnalysis: fundamentalsSummary,
    volatilityAnalysis: quote
      ? `Estimated implied volatility was approximately ${(quote.volatility * 100).toFixed(1)}% based on the current quote service heuristic. This is best used as a directional context cue, not a pricing-grade volatility measure.`
      : 'Volatility observations were limited because quote data was unavailable.',
    optionsEducation: 'Options observations in this report are educational only. Monitor implied volatility, earnings timing, and liquidity before drawing conclusions from any options-related pattern.',
    risks: [
      'Market data may be delayed, simulated, or temporarily unavailable.',
      'Headline sentiment is heuristic and may miss nuance or later developments.',
      'Experimental Whisper signals are simulated-style alternative data and not a complete social media dataset.',
      ...availabilityNotes,
    ],
    conclusion: `Use this report as a research summary and watch list builder. Focus on what to monitor next rather than treating any section as a recommendation. ${REPORT_DISCLAIMER}`,
    disclaimer: REPORT_DISCLAIMER,
    dataAvailability: availabilityNotes,
  };
};

const buildPrompt = (
  ticker: string,
  quote: StockQuote | null,
  fundamentals: CompanyFundamentals | null,
  news: NewsItem[],
  whisper: WhisperData | null,
  availabilityNotes: string[]
) => `
You are generating a structured equity research summary for ticker ${ticker}.

Return JSON only with this exact shape:
{
  "summary": string,
  "priceAnalysis": string,
  "newsAnalysis": string,
  "fundamentalsAnalysis": string,
  "volatilityAnalysis": string,
  "optionsEducation": string,
  "risks": string[],
  "conclusion": string,
  "disclaimer": string
}

Rules:
- This is for educational and research use only.
- Do not provide investment advice.
- Do not use direct trading instructions such as Buy, Sell, Strong Buy, Entry Point, or Target Price.
- Focus on educational observations, research summary, risk factors, things to monitor, and options education.
- Explicitly acknowledge uncertainty when data is missing or incomplete.
- Treat Whisper as experimental, simulated-style alternative signal data, not as a complete or verified social media dataset.
- The disclaimer field must be exactly: "${REPORT_DISCLAIMER}"
- Mention when news sentiment is automatically estimated from available headlines/summaries and may be incomplete.

Available data:
${JSON.stringify(
  {
    ticker,
    quote,
    fundamentals,
    news: news.slice(0, 5),
    whisper,
    availabilityNotes,
  },
  null,
  2
)}
`;

export const generateStockAnalysisReport = async (tickerInput: string): Promise<StockAnalysisReport> => {
  const ticker = normalizeTicker(tickerInput || 'NVDA');

  const [quoteResult, fundamentalsResult, newsResult, whisperResult] = await Promise.allSettled([
    fetchStockQuote(ticker),
    fetchCompanyFundamentals(ticker),
    fetchStockNews(ticker),
    fetchWhisperData(ticker),
  ]);

  const failedSources: string[] = [];

  const quote = quoteResult.status === 'fulfilled' ? quoteResult.value : null;
  if (quoteResult.status === 'rejected') failedSources.push('quote');

  const fundamentals = fundamentalsResult.status === 'fulfilled' ? fundamentalsResult.value : null;
  if (fundamentalsResult.status === 'rejected') failedSources.push('fundamentals');

  const news = newsResult.status === 'fulfilled' ? newsResult.value : [];
  if (newsResult.status === 'rejected') failedSources.push('news');

  const whisper = whisperResult.status === 'fulfilled' ? whisperResult.value : null;
  if (whisperResult.status === 'rejected') failedSources.push('whisper');

  const fallbackReport = buildFallbackReport(ticker, quote, fundamentals, news, whisper, failedSources);
  const availabilityNotes = fallbackReport.dataAvailability || [];

  try {
    const ai = getAI();
    const response = (await retryOperation(() =>
      ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: buildPrompt(ticker, quote, fundamentals, news, whisper, availabilityNotes),
      })
    )) as { text?: string };

    const parsed = parseReportResponse(response.text || '');
    if (!parsed) {
      return fallbackReport;
    }

    const risks = toStringArray(parsed.risks);

    return {
      ticker,
      generatedAt: new Date().toISOString(),
      quote,
      fundamentals,
      news,
      whisper,
      summary: parsed.summary?.trim() || fallbackReport.summary,
      priceAnalysis: parsed.priceAnalysis?.trim() || fallbackReport.priceAnalysis,
      newsAnalysis: parsed.newsAnalysis?.trim() || fallbackReport.newsAnalysis,
      fundamentalsAnalysis: parsed.fundamentalsAnalysis?.trim() || fallbackReport.fundamentalsAnalysis,
      volatilityAnalysis: parsed.volatilityAnalysis?.trim() || fallbackReport.volatilityAnalysis,
      optionsEducation: parsed.optionsEducation?.trim() || fallbackReport.optionsEducation,
      risks: risks.length > 0 ? risks : fallbackReport.risks,
      conclusion: parsed.conclusion?.trim() || fallbackReport.conclusion,
      disclaimer: parsed.disclaimer?.trim() || REPORT_DISCLAIMER,
      dataAvailability: availabilityNotes,
    };
  } catch (error) {
    console.warn('[ReportService] Falling back to deterministic report.', error);
    return fallbackReport;
  }
};
