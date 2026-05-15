const MAX_MODEL_TEXT_LENGTH = 6000;

const normalizeLanguage = (language) => (language === 'zh' ? 'zh' : 'en');

const safeText = (value, maxLength = MAX_MODEL_TEXT_LENGTH) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const UNSAFE_PATTERNS = [
  {
    id: 'rating',
    patterns: [
      /\bstrong\s+buy\b/i,
      /\bstrong\s+sell\b/i,
      /\bbuy\s+rating\b/i,
      /\bsell\s+rating\b/i,
      /\bhold\s+rating\b/i,
      /\bbuy\/sell\/hold\b/i,
      /\bbuy\s+recommendation\b/i,
      /\bsell\s+recommendation\b/i,
      /\bhold\s+recommendation\b/i,
      /买入评级/,
      /卖出评级/,
      /持有评级/,
    ],
  },
  {
    id: 'target_price',
    patterns: [
      /\btarget\s+price\b/i,
      /\bprice\s+target\b/i,
      /目标价/,
    ],
  },
  {
    id: 'entry_point',
    patterns: [
      /\bentry\s+point\b/i,
      /入场点/,
      /入场/,
    ],
  },
  {
    id: 'support_resistance',
    patterns: [
      /\bsupport\s+level\b/i,
      /\bresistance\s+level\b/i,
      /支撑位/,
      /阻力位/,
    ],
  },
  {
    id: 'stop_loss',
    patterns: [
      /\bstop[-\s]?loss\b/i,
      /止损/,
    ],
  },
  {
    id: 'trading_instruction',
    patterns: [
      /\btrading\s+instruction\b/i,
      /\btrade\s+setup\b/i,
      /抄底/,
      /加仓/,
      /减仓/,
    ],
  },
];

const POLICY_EXPLANATION_PATTERNS = [
  /\bdo not provide\b/i,
  /\bshould not provide\b/i,
  /\bcannot provide\b/i,
  /\bcan't provide\b/i,
  /\bnot provide\b/i,
  /\bnot give\b/i,
  /\bshould not give\b/i,
  /\bcannot give\b/i,
  /\bcan't give\b/i,
  /\bto avoid\b/i,
  /\bresearch-only\b/i,
  /\bnot financial advice\b/i,
  /不能提供/,
  /不能给/,
  /不应提供/,
  /不会提供/,
  /仅供研究/,
  /不构成投资建议/,
  /为了避免/,
];

const DIRECTIVE_PATTERNS = [
  /(?:^|[.!?]\s*)buy\b/i,
  /(?:^|[.!?]\s*)sell\b/i,
  /(?:^|[.!?]\s*)hold\b/i,
  /\byou should buy\b/i,
  /\byou should sell\b/i,
  /\bi recommend\b/i,
  /\bbuy\s+[A-Z]{1,5}\b/,
  /\bsell\s+[A-Z]{1,5}\b/,
  /\bhold\s+[A-Z]{1,5}\b/,
  /\bconsider buying\b/i,
  /\bconsider selling\b/i,
  /\bset (a )?stop[-\s]?loss\b/i,
  /\bset (a )?target price\b/i,
  /(?:^|。|！|？)\s*买入/,
  /(?:^|。|！|？)\s*卖出/,
  /(?:^|。|！|？)\s*持有/,
  /建议买入/,
  /建议卖出/,
  /可以加仓/,
  /可以减仓/,
  /设置止损/,
  /设置目标价/,
];

const isPolicyExplanation = (text) => (
  POLICY_EXPLANATION_PATTERNS.some((pattern) => pattern.test(text))
  && !DIRECTIVE_PATTERNS.some((pattern) => pattern.test(text))
);

export function detectUnsafeFinancialPhrases(text) {
  const normalized = safeText(text);
  const matches = UNSAFE_PATTERNS
    .filter((entry) => entry.patterns.some((pattern) => pattern.test(normalized)))
    .map((entry) => entry.id);
  const policyExplanation = matches.length > 0 && isPolicyExplanation(normalized);

  return {
    unsafe: matches.length > 0 && !policyExplanation,
    matches,
    warnings: matches.length > 0
      ? [policyExplanation ? 'unsafe_terms_in_policy_context' : 'unsafe_financial_language_detected']
      : [],
  };
}

export function buildResearchOnlySystemPrompt(language) {
  if (normalizeLanguage(language) === 'zh') {
    return [
      '你是一个教育和研究用途的金融研究助手。',
      '只提供通用研究解释，不提供个性化投资建议。',
      '不要输出 Buy/Sell/Hold、买入/卖出/持有评级、目标价、入场点、支撑位、阻力位、止损位或交易指令。',
      '如果当前没有可靠数据，请明确说明数据不可用，不要编造系统数据或工具结果。',
      '所有回答必须包含仅供研究参考的语气，不得把自己描述成完整投资顾问。',
    ].join('\n');
  }

  return [
    'You are an educational financial research copilot.',
    'Provide general research explanations only. Do not provide investment advice.',
    'Do not output Buy/Sell/Hold ratings, target prices, entry points, support or resistance levels, stop-loss levels, or trading instructions.',
    'If data is unavailable, say so directly. Do not invent system data or tool results.',
    'Use a research-only disclaimer tone and do not present yourself as a complete investment advisor.',
  ].join('\n');
}

export function buildUnavailableModelMessage(language) {
  if (normalizeLanguage(language) === 'zh') {
    return '已接收到分析请求，但当前未配置生成式分析服务。配置模型密钥后即可启用生成式分析。';
  }

  return 'The analysis request was received, but generative analysis is not configured. Configure a model key to enable generated analysis.';
}

export function scrubModelText(text, language) {
  const normalizedLanguage = normalizeLanguage(language);
  const cleanText = safeText(text);

  if (!cleanText) {
    return {
      text: buildUnavailableModelMessage(normalizedLanguage),
      warnings: ['empty_model_response'],
    };
  }

  const detection = detectUnsafeFinancialPhrases(cleanText);
  if (!detection.unsafe) {
    return {
      text: cleanText,
      warnings: detection.warnings,
    };
  }

  return {
    text: normalizedLanguage === 'zh'
      ? '模型回复已被安全过滤，因为包含交易导向表述。Server Chat 仅提供仅供研究参考的教育性解释；请改用事实、数据来源或概念解释类问题。'
      : 'The model response was safety-filtered because it contained trading-directed language. Server Chat provides research-only educational explanations; please ask for factual context, source review, or concept explanation.',
    warnings: [
      ...detection.warnings,
      'safety_filtered',
      ...detection.matches.map((match) => `unsafe:${match}`),
    ],
  };
}
