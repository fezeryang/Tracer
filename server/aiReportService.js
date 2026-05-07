const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const REPORT_DISCLAIMER = 'For educational and research use only. Not financial advice.';
const DEEPSEEK_REPORT_TIMEOUT_MS = 55000;

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

const toSectionString = (...values) => {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};

const normalizeReport = (value, language) => {
  const fallbackDisclaimer = language === 'zh' ? '仅供学习研究使用，不构成投资建议。' : REPORT_DISCLAIMER;

  // Extract arrays with fallbacks
  const rawRisks = toStringArray(value?.keyRisks || value?.risks);
  const rawChecklist = toStringArray(value?.followUpChecklist);

  // Ensure minimum counts (6 risks, 7 checklist items) - UPGRADED from 4/5
  const ensuredRisks = rawRisks.length >= 6
    ? rawRisks.slice(0, 10)
    : [...rawRisks, ...(language === 'zh' ? [
        '数据可能延迟或不完整，影响分析可靠性',
        '新闻情绪由算法估算，可能遗漏关键信息或语境',
        '本报告不构成投资建议',
        '波动率估算基于启发式方法，非实时期权数据',
        '市场环境可能快速变化，历史分析不能保证未来表现',
        '如遇极端市场条件，流动性可能显著下降',
        '公司特定事件（财报、监管、管理层变动）可能显著影响股价',
      ] : [
        'Data may be delayed or incomplete, affecting reliability',
        'News sentiment is algorithmically estimated and may miss key information or nuance',
        'This report is not financial advice',
        'Volatility is heuristic-based, not real-time options data',
        'Market conditions can change rapidly; historical analysis does not guarantee future performance',
        'Liquidity may significantly decrease during extreme market conditions',
        'Company-specific events (earnings, regulatory, management changes) can significantly impact stock price',
      ]).slice(0, 6 - rawRisks.length)];

  const ensuredChecklist = rawChecklist.length >= 7
    ? rawChecklist.slice(0, 12)
    : [...rawChecklist, ...(language === 'zh' ? [
        '核实数据源状态（行情、基本面、新闻）',
        '检查SEC文件和公司官方公告是否有重大更新',
        '对比多个新闻来源，交叉验证关键信息',
        '观察波动率和隐含波动率的变化趋势',
        '监控交易量和流动性状况',
        '关注即将到来的财报日期和事件催化剂',
        '评估行业和竞争动态的变化',
      ] : [
        'Verify data source status (quote, fundamentals, news)',
        'Check SEC filings and company announcements for material updates',
        'Cross-reference multiple news sources to verify key information',
        'Monitor volatility and implied volatility trend changes',
        'Watch trading volume and liquidity conditions',
        'Pay attention to upcoming earnings dates and event catalysts',
        'Evaluate industry and competitive dynamics changes',
      ]).slice(0, 7 - rawChecklist.length)];

  const investmentContext = toSectionString(value?.investmentContext);
  const executiveSummary = toSectionString(value?.executiveSummary, value?.summary);
  const dataQualityAssessment = toSectionString(value?.dataQualityAssessment, value?.dataAvailabilityAnalysis);
  const priceActionAnalysis = toSectionString(value?.priceActionAnalysis, value?.priceAnalysis);
  const fundamentalsAnalysis = toSectionString(value?.fundamentalsAnalysis);
  const newsAndEventsAnalysis = toSectionString(value?.newsAndEventsAnalysis, value?.newsAnalysis);
  const sourceTrustAnalysis = toSectionString(value?.sourceTrustAnalysis);
  const volatilityAndOptionsAnalysis = toSectionString(
    value?.volatilityAndOptionsAnalysis,
    `${value?.volatilityAnalysis || ''}\n\n${value?.optionsEducation || ''}`.trim()
  );
  const conclusion = toSectionString(value?.conclusion);

  return {
    // NEW expanded fields (fallback to old names for compatibility)
    investmentContext,
    executiveSummary,
    dataQualityAssessment,
    priceActionAnalysis,
    fundamentalsAnalysis,
    newsAndEventsAnalysis,
    sourceTrustAnalysis,
    volatilityAndOptionsAnalysis,

    // Structured outputs with minimum guarantees
    keyRisks: ensuredRisks,
    followUpChecklist: ensuredChecklist,

    // Preserve existing fields for backward compatibility
    summary: toSectionString(value?.summary, executiveSummary),
    dataAvailabilityAnalysis: toSectionString(value?.dataAvailabilityAnalysis, dataQualityAssessment),
    priceAnalysis: toSectionString(value?.priceAnalysis, priceActionAnalysis),
    newsAnalysis: toSectionString(value?.newsAnalysis, newsAndEventsAnalysis),
    volatilityAnalysis: toSectionString(value?.volatilityAnalysis, volatilityAndOptionsAnalysis),
    optionsEducation: toSectionString(value?.optionsEducation, volatilityAndOptionsAnalysis),
    risks: ensuredRisks,
    conclusion,
    disclaimer: String(value?.disclaimer || fallbackDisclaimer).trim(),
  };
};

const CONTENT_DEPTH_REQUIREMENTS = `
[CONTENT DEPTH REQUIREMENTS - CRITICAL]

Each analysis section MUST meet minimum depth standards. Short one-sentence answers are NOT acceptable.

1. Investment Context (2-3 paragraphs)
   - What data is included in this report
   - What questions this report can support
   - What questions this report cannot support
   - Whether quote data is real, delayed, cached, fallback, simulation, or unavailable

2. Executive Summary (3-5 evidence-grounded bullets or sentences)
   - Each point must cite current input evidence or a specific data gap
   - Summarize quote quality, fundamentals coverage, news/sentiment, and source trust
   - Do not include a trading stance, rating, recommendation, target price, or entry point

3. Data Quality Assessment (2-3 paragraphs OR 4-6 bullet points)
   - Specific data sources available and their quality
   - What data is missing and how it affects analysis
   - Confidence level explanation with specific reasons
   - Explicit rating: Excellent/Good/Limited/Poor

4. Price Action Analysis (2-4 paragraphs OR 5-7 bullet points)
   - Current quote, change, quote quality, and provider status
   - Price history observations only when priceHistory is available
   - Volume discussion only when volume exists in priceHistory
   - No support/resistance, target price, entry point, or trade setup
   - If data unavailable: explain WHAT is missing and WHY it matters

5. Fundamentals Analysis (3-4 paragraphs OR 5-7 bullet points)
   - Use only provided marketCap, P/E, beta, sector, industry, company description, and website
   - Explain what those fields do and do not tell the reader
   - If revenue, profit, balance sheet, margins, or peers are absent, explicitly say they are absent
   - Do not infer valuation, moat, growth, or balance sheet strength from missing data

6. News & Events Analysis (2-3 paragraphs OR 4-6 bullet points)
   - Recent headline impact assessment with examples
   - Sentiment breakdown (positive/negative/neutral counts)
   - SEC filings or official events only when provided
   - Source reliability context

7. Source Trust Analysis (2-3 paragraphs OR 3-5 bullet points)
   - Official source availability (SEC filings, company IR, official website)
   - News source credibility assessment
   - Risk of misinformation
   - Verified news count vs unverified

8. Volatility & Options Analysis (2-3 paragraphs OR 4-5 bullet points)
   - Use quote volatility only as heuristic educational context
   - State that real-time options chain data is not provided unless it appears in the input
   - Explain data limitations for options analysis
   - Do not provide trading instructions

9. Key Risks (MINIMUM 6 specific risks)
   - Each risk should be 1-2 sentences with substance
   - Mix of: company-specific, sector, market, data quality risks
   - Include regulatory, competitive, and liquidity risks
   - Be specific, not generic

10. Follow-up Checklist (MINIMUM 7 actionable items)
    - Specific actions for further research
    - Data points to monitor
    - Questions to investigate
    - Sources to check

11. Conclusion (2-3 paragraphs)
    - Synthesis of all analysis
    - Clear final perspective
    - What would change the thesis
    - Reminder of data limitations

[FORBIDDEN OUTPUT PATTERNS - ABSOLUTELY DO NOT]
- DO NOT output one-sentence sections (except where explicitly noted)
- DO NOT say "data unavailable" without explaining WHAT data and WHY it matters
- DO NOT use generic filler like "the company is a technology company" without substance
- DO NOT repeat the same point in different words
- DO NOT invent data that was not provided
- DO NOT output Buy, Sell, Strong Buy, Entry Point, Target Price, price target, support level, resistance level, or trade setup
- If data is truly unavailable, explain WHAT data is missing and WHY it matters for analysis
`;

const DATA_CITATION_REQUIREMENTS = `
[DATA CITATION REQUIREMENTS]

Whenever possible, ground your analysis in SPECIFIC data points from the provided context.

GOOD examples with specifics:
- "Quote data is marked as simulation, so the displayed price cannot support real market conclusions"
- "Of 15 recent news items analyzed, 9 were positive, 4 neutral, and 2 negative, indicating a positive sample bias"
- "Market cap is available, but P/E is missing, so valuation discussion cannot compare earnings multiples"
- "Market cap of $2.1T places it among top 5 largest companies by market value"

NOT acceptable - too vague:
- "Revenue was good"
- "The stock is expensive"
- "News was mostly positive"
- "The company is large"
- "The stock is a buy"

When exact data is unavailable, state specifically:
- "Specific revenue figures were not available in the data retrieved; however, market cap of $X suggests..."
- "While precise P/E data is missing, the company's valuation metrics appear..."
- "Historical price data was unavailable, limiting trend analysis"
`;

const LANGUAGE_CONSISTENCY = `
[LANGUAGE CONSISTENCY - CRITICAL]

- Output ENTIRELY in the requested language (zh or en)
- NO mixed language paragraphs
- NO English terms in Chinese output unless they are standard financial acronyms (P/E, EBITDA, EPS, ROI, etc.)
- For Chinese: use natural Chinese financial writing style, not translated English structure
- For English: use professional financial journalism style
- DO NOT mix languages within the same paragraph
`;

const buildPrompt = (context) => {
  const language = context.language === 'zh' ? 'Simplified Chinese' : 'English';
  const isZh = context.language === 'zh';

  return JSON.stringify({
    instruction: [
      `Generate a structured equity research report in ${language}.`,
      'Return strict JSON only. Do not use markdown.',
      'Use only the provided data. Do not invent prices, metrics, filings, news, official sources, or events.',
      'Use evidencePack as the primary structured evidence for data availability, price history, sentiment, fundamentals, and source trust.',
      'Do not provide investment advice. Do not output Buy, Sell, Strong Buy, Entry Point, or Target Price.',
      'Do not output a price target, support level, resistance level, trade setup, portfolio action, or directional recommendation.',
      'If data is missing, explicitly say it is missing and explain WHY that matters.',
      'Mention data gaps explicitly. If priceHistoryStatus is unavailable, fallback, simulation, or error, state that real historical price trend evidence is missing.',
      'Do not invent missing historical prices, fundamentals, filings, news, official sources, or chart data.',
      'If charts are unavailable, explain the data limitation instead of implying a trend.',
      'If quote data is simulation, fallback, or unavailable, explicitly state that no real market judgment can be based on that quote.',
      'If evidence quality is simulation or fallback, do not treat it as real market evidence.',
      'Keep the report for educational and research use only.',
      'Every major section must explicitly reference at least one current input evidence category: quote, quote quality, price history, fundamentals, news, verifiedNews, sentimentSummary, Source Trust Center, officialSources, SEC filings, dataSourceHealth, or missing/unavailable data.',

      // Language consistency
      isZh
        ? '输出必须全部使用中文。不要出现英文段落混入。金融术语如P/E、EBITDA等可以使用缩写，但其他内容必须是自然中文表达。'
        : 'Output entirely in English. Use professional financial writing style with proper grammar and vocabulary.',

      CONTENT_DEPTH_REQUIREMENTS,
      DATA_CITATION_REQUIREMENTS,
      LANGUAGE_CONSISTENCY,

      'Minimum requirements: at least 6 key risks and 7 follow-up checklist items.',
      'Structure the report with clear sections: Investment Context, Executive Summary, Data Quality Assessment, Price Action, Fundamentals, News & Events, Source Trust, Volatility & Options, Risks, Follow-up Checklist, Conclusion.',

      // Section-specific guidance
      isZh
        ? '对于研究背景(investmentContext): 2-3段。说明为什么研究这个标的，当前数据完整度（哪些可用、哪些缺失），本报告适合回答什么问题。'
        : 'For investmentContext: 2-3 paragraphs. Explain why this ticker matters now, data completeness (what\'s available vs missing), what questions this report can and cannot answer.',

      isZh
        ? '对于核心摘要(executiveSummary): 3-5条要点或3-5句。每条必须具体引用行情质量、基本面、新闻情绪、来源可信度或数据缺失。不要出现多空倾向、评级、买卖建议、目标价或入场点。'
        : 'For executiveSummary: 3-5 analytical bullets or sentences. Each must cite quote quality, fundamentals, news sentiment, source trust, or a data gap. Do not include directional stance, rating, recommendation, target price, or entry point.',

      isZh
        ? '对于数据质量评估(dataQualityAssessment): 2-3段或4-6个要点。明确评级（优秀/良好/有限/较差），说明成功获取的数据源、失败的数据源及其对结论可靠性的具体影响。'
        : 'For dataQualityAssessment: 2-3 paragraphs OR 4-6 bullet points. Explicitly rate (Excellent/Good/Limited/Poor), explain successful and failed data sources, specific impact on conclusion reliability.',

      isZh
        ? '对于行情表现分析(priceActionAnalysis): 2-4段或5-7个要点。如有真实行情和历史价格，可以分析价格、涨跌、趋势背景、波动和成交量；如不可用，必须说明具体缺失了什么数据及其影响。不得写支撑位、阻力位、目标价、入场点或基于simulation/fallback生成真实市场判断。'
        : 'For priceActionAnalysis: 2-4 paragraphs OR 5-7 bullet points. If real quote and history are available, analyze price, change, trend context, volatility, and volume. If unavailable, explain specifically what data is missing and its impact. Do not write support levels, resistance levels, target prices, entry points, or real market conclusions from simulation/fallback.',

      isZh
        ? '对于基本面分析(fundamentalsAnalysis): 3-4段或5-7个要点。只引用已提供的marketCap、P/E、beta、sector、industry、公司描述和官网。若营收、利润、资产负债表、同业比较缺失，必须明确说明，不能编造。'
        : 'For fundamentalsAnalysis: 3-4 paragraphs OR 5-7 bullet points. Use only provided marketCap, P/E, beta, sector, industry, description, and website. If revenue, profit, balance sheet, or peer comparison data is missing, state that explicitly and do not invent it.',

      isZh
        ? '对于新闻与事件分析(newsAndEventsAnalysis): 2-3段或4-6个要点。使用verifiedNews和普通news，分析近期头条影响、情绪分布（具体数量）、即将到来的催化剂（财报、事件、文件）。'
        : 'For newsAndEventsAnalysis: 2-3 paragraphs OR 4-6 bullet points. Use verifiedNews and regular news, analyze recent headline impact, sentiment breakdown (specific counts), upcoming catalysts (earnings, events, filings).',

      isZh
        ? '对于来源可信度分析(sourceTrustAnalysis): 2-3段或3-5个要点。官方来源可用性（SEC文件、公司IR、官网）、新闻来源可信度评估、误信息风险、已验证新闻数量。'
        : 'For sourceTrustAnalysis: 2-3 paragraphs OR 3-5 bullet points. Official source availability (SEC filings, company IR, official website), news source credibility, misinformation risk, verified news count.',

      isZh
        ? '对于波动率与期权观察(volatilityAndOptionsAnalysis): 2-3段或4-5个要点。只做教育性说明。若没有实时期权链，必须明确说明无法进行完整期权判断；不得给具体交易指令。'
        : 'For volatilityAndOptionsAnalysis: 2-3 paragraphs OR 4-5 bullet points. Educational context only. If no real-time options chain is provided, state that full options analysis is not possible; do not provide trading instructions.',

      isZh
        ? '对于关键风险(keyRisks): 至少6条具体风险。每条1-2句要有实质内容。包括：公司特有、行业、市场、数据质量、监管、竞争、流动性风险。'
        : 'For keyRisks: Minimum 6 specific risks. Each 1-2 sentences with substance. Include: company-specific, sector, market, data quality, regulatory, competitive, liquidity risks. Be specific, not generic.',

      isZh
        ? '对于后续跟踪清单(followUpChecklist): 至少7条可执行项目。包括：具体后续研究行动、需监控的数据点、待调查的问题、需核验的来源。'
        : 'For followUpChecklist: Minimum 7 actionable items. Include: specific follow-up research actions, data points to monitor, questions to investigate, sources to verify.',

      isZh
        ? '对于结论(conclusion): 2-3段。综合所有分析、清晰的最终观点、什么情况会改变论点、提醒数据限制。不要给买卖建议。'
        : 'For conclusion: 2-3 paragraphs. Synthesis of all analysis, clear final perspective, what would change the thesis, reminder of data limitations. No buy/sell recommendations.',
    ],
    requiredShape: {
      investmentContext: isZh ? 'string - 研究背景，2-3段' : 'string - Investment Context, 2-3 paragraphs',
      executiveSummary: isZh ? 'string - 核心摘要，3-5句' : 'string - Executive Summary, 3-5 sentences minimum',
      dataQualityAssessment: isZh ? 'string - 数据质量评估，2-3段或4-6个要点' : 'string - Data Quality Assessment, 2-3 paragraphs OR 4-6 bullet points',
      priceActionAnalysis: isZh ? 'string - 行情表现分析，2-4段或5-7个要点' : 'string - Price Action Analysis, 2-4 paragraphs OR 5-7 bullet points',
      fundamentalsAnalysis: isZh ? 'string - 基本面分析，3-4段或5-7个要点' : 'string - Fundamentals Analysis, 3-4 paragraphs OR 5-7 bullet points',
      newsAndEventsAnalysis: isZh ? 'string - 新闻与事件分析，2-3段或4-6个要点' : 'string - News & Events Analysis, 2-3 paragraphs OR 4-6 bullet points',
      sourceTrustAnalysis: isZh ? 'string - 来源可信度分析，2-3段或3-5个要点' : 'string - Source Trust Analysis, 2-3 paragraphs OR 3-5 bullet points',
      volatilityAndOptionsAnalysis: isZh ? 'string - 波动率与期权观察，2-3段或4-5个要点' : 'string - Volatility & Options Analysis, 2-3 paragraphs OR 4-5 bullet points',
      keyRisks: isZh ? 'array - 至少6条具体风险' : 'array of strings - minimum 6 specific risks',
      followUpChecklist: isZh ? 'array - 至少7条可执行项目' : 'array of strings - minimum 7 actionable items',
      conclusion: isZh ? 'string - 结论，2-3段' : 'string - Conclusion, 2-3 paragraphs',
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
      evidencePack: context.evidencePack,
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
            content: [
              'You generate cautious, source-grounded equity research reports.',
              'Return strict JSON only. Never provide investment advice.',
              'Each section must have substantive depth - no one-sentence answers.',
              'Use specific data points when available; explain what data is missing and why it matters.',
              'Output entirely in the requested language (zh or en) - no mixed language paragraphs.',
              'Minimum requirements: 6 key risks, 7 follow-up checklist items.',
              'When data is unavailable, explain specifically WHAT is missing and WHY it matters for analysis.',
              'Never output Buy, Sell, Strong Buy, Entry Point, Target Price, price target, support level, resistance level, or trade setup.',
              'Every major section must cite current input evidence or a specific missing-data limitation.',
            ].join(' '),
          },
          {
            role: 'user',
            content: buildPrompt(context),
          },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(DEEPSEEK_REPORT_TIMEOUT_MS),
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
    const message = error instanceof Error ? error.message : 'DeepSeek report generation failed.';
    const isTimeout = error?.name === 'TimeoutError' || error?.name === 'AbortError' || message.toLowerCase().includes('timeout');
    return {
      ok: false,
      provider,
      error: isTimeout ? 'DeepSeek report generation timed out. Fallback report is available.' : message,
    };
  }
};
