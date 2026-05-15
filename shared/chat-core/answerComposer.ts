import { t as i18nT } from '../../i18n';
import {
  ChatAnswerComposition,
  ChatAnswerCompositionInput,
  ChatContext,
  Language,
  RichAnswerPlan,
} from './types';

const SECTION_HEADERS_EN = [
  'Summary',
  'Current Context',
  'Available Data & Evidence',
  'Analytical Framework',
  'Key Uncertainties',
  'Suggested Next Checks',
  'Risk Notice',
];

const SECTION_HEADERS_ZH = [
  '结论摘要',
  '当前上下文',
  '可用数据与证据',
  '分析框架',
  '主要不确定性',
  '下一步可以查看什么',
  '风险提示',
];

function buildSafetyInstructions(language: Language): string {
  const items =
    language === 'zh'
      ? [
          '禁止提供方向性交易评级。',
          '禁止给出价格目标或操作点位。',
          '禁止给出技术位或风控点位。',
          '禁止提供交易操作指南。',
          '不要逐字列举被禁止的交易评级或操作词；只使用“方向性交易评级/操作指令”等概括表述。',
          '必须标注模拟/回退/延迟数据。',
          '仅供学习研究使用，不构成投资建议。',
        ]
      : [
          'Do NOT provide directional trading ratings.',
          'Do NOT provide price targets or action levels.',
          'Do NOT provide technical trigger levels or risk-control levels.',
          'Do NOT provide trading operation instructions.',
          'Do NOT quote or enumerate prohibited trading labels or action words; use generic wording such as "directional trading ratings" or "operation instructions".',
          'You MUST label any simulation, fallback, or delayed data.',
          'You MUST include a research-only disclaimer.',
        ];

  const header =
    language === 'zh'
      ? '重要安全约束（必须遵守）：'
      : 'CRITICAL SAFETY CONSTRAINTS (MUST FOLLOW):';

  return [header, '', ...items.map((item) => `- ${item}`)].join('\n');
}

export function sanitizeFinancialSafetyText(text: string): string {
  return text
    .replace(/Strong\s+Buy|Strong\s+Sell/gi, 'directional trading rating')
    .replace(/\bBuy\b|\bSell\b|\bHold\b/gi, 'directional trading rating')
    .replace(/买入|卖出|持有|抄底|加仓|减仓/g, '方向性交易评级')
    .replace(/目标价|target price/gi, '价格目标')
    .replace(/entry point|入场点/gi, '操作点位')
    .replace(/support level|resistance level|支撑位|阻力位/gi, '技术位')
    .replace(/stop-loss|止损/gi, '风控点位')
    .replace(/trading instruction/gi, 'operation guidance');
}

export function buildRichContextSummary(
  context: ChatContext,
  language: Language,
): string {
  const zh = language === 'zh';
  const sections: string[] = [];

  const header = zh
    ? '当前研究上下文摘要：'
    : 'Current Research Context Summary:';
  sections.push(header);
  sections.push('');

  if (context.currentTicker) {
    sections.push(
      zh
        ? `- 当前标的：${context.currentTicker}`
        : `- Current ticker: ${context.currentTicker}`,
    );
  }

  if (context.lastQuote) {
    const q = context.lastQuote as any;
    const parts: string[] = [];
    if (q.symbol) parts.push(q.symbol);
    if (q.price !== undefined) parts.push(`$${q.price}`);
    if (q.changePercent !== undefined)
      parts.push(`${q.changePercent > 0 ? '+' : ''}${q.changePercent}%`);
    if (parts.length > 0) {
      sections.push(
        zh
          ? `- 最新报价：${parts.join(' ')}`
          : `- Latest quote: ${parts.join(' ')}`,
      );
    }
  }

  if (context.lastFundamentals) {
    const f = context.lastFundamentals as any;
    const parts: string[] = [];
    if (f.companyName) parts.push(f.companyName);
    if (f.sector) parts.push(f.sector);
    if (f.peRatio !== undefined) parts.push(`P/E ${f.peRatio}`);
    if (f.marketCap !== undefined) {
      const cap =
        f.marketCap >= 1e12
          ? `${(f.marketCap / 1e12).toFixed(2)}T`
          : f.marketCap >= 1e9
            ? `${(f.marketCap / 1e9).toFixed(2)}B`
            : `${(f.marketCap / 1e6).toFixed(0)}M`;
      parts.push(cap);
    }
    if (parts.length > 0) {
      sections.push(
        zh
          ? `- 基本面数据：${parts.join(' | ')}`
          : `- Fundamentals: ${parts.join(' | ')}`,
      );
    }
  }

  if (context.lastCommand) {
    sections.push(
      zh
        ? `- 最近命令：/${context.lastCommand}`
        : `- Last command: /${context.lastCommand}`,
    );
  }

  if (context.lastHistorySummary) {
    const hs = context.lastHistorySummary;
    const ticker = hs.ticker || '?';
    const points = hs.points || 0;
    const range =
      hs.startDate && hs.endDate
        ? `${hs.startDate}–${hs.endDate}`
        : '';
    const latest =
      hs.latestClose !== undefined ? `$${hs.latestClose}` : '';
    const summary = zh
      ? `${ticker}: ${points} 数据点`
      : `${ticker}: ${points} points`;
    const extra = [range, latest].filter(Boolean).join(', ');
    sections.push(
      zh
        ? `- 历史数据：${summary}${extra ? `，${extra}` : ''}`
        : `- History: ${summary}${extra ? `, ${extra}` : ''}`,
    );
  }

  if (context.lastDataQualityNotes?.length) {
    const notes = context.lastDataQualityNotes.slice(0, 2);
    const label = zh ? '- 数据质量提示：' : '- Data quality notes: ';
    sections.push(label + notes.join('; '));
  }

  if (context.lastNews?.length) {
    const newsItems = context.lastNews.slice(0, 3) as any[];
    const titles = newsItems.map((n) => n?.title || '(untitled)');
    const label = zh ? '- 最近新闻：' : '- Recent news: ';
    sections.push(label + titles.join(' | '));
  }

  if (context.lastSecFilings?.length) {
    const filings = context.lastSecFilings.slice(0, 3) as any[];
    const items = filings.map(
      (f) => `${f?.form || '?'} ${f?.filingDate || ''}`.trim(),
    );
    const label = zh ? '- SEC 文件：' : '- SEC filings: ';
    sections.push(label + items.join(', '));
  }

  if (context.lastOfficialSources?.length) {
    const sources = context.lastOfficialSources.slice(0, 3) as any[];
    const items = sources.map(
      (s) => `${s?.name || '?'} (${s?.type || 'unknown'})`,
    );
    const label = zh ? '- 官方来源：' : '- Official sources: ';
    sections.push(label + items.join(', '));
  }

  if (context.lastSourceTrust) {
    const st = context.lastSourceTrust as any;
    if (st.overallScore !== undefined) {
      sections.push(
        zh
          ? `- 来源可信度：${st.overallScore} (${st.confidenceLevel || 'N/A'})`
          : `- Source trust: ${st.overallScore} (${st.confidenceLevel || 'N/A'})`,
      );
    }
  }

  if (context.lastEvidenceBundle) {
    const eb = context.lastEvidenceBundle as any;
    const count = Array.isArray(eb) ? eb.length : eb?.items?.length || 0;
    if (count > 0) {
      sections.push(
        zh
          ? `- 已收集证据：${count} 项`
          : `- Evidence collected: ${count} items`,
      );
    }
  }

  return sections.join('\n');
}

function buildSystemPrefix(language: Language): string {
  const zh = language === 'zh';
  const headers = zh ? SECTION_HEADERS_ZH : SECTION_HEADERS_EN;

  const roleInstruction = zh
    ? '你是一个严格的金融研究分析助手。请按以下结构回答用户关于金融分析的问题。每个部分都必须使用指定的标题，不要跳过或合并任何部分。'
    : 'You are a strict financial research analyst. Structure your answer using the exact section headers below. Do NOT skip, reorder, or merge sections.';

  const numbered = headers.map((h, i) => `${i + 1}. ${h}`).join('\n');

  const formatNote = zh
    ? '请严格以编号标题开始每个段落（如 "1. 结论摘要"、"2. 当前上下文" 等），不要省略编号。'
    : 'Start each section with the numbered heading exactly as shown (e.g., "1. Summary", "2. Current Context"). Do not omit the number.';

  return [roleInstruction, '', formatNote, '', numbered].join('\n');
}

export function composeFinancialChatAnswer(
  input: ChatAnswerCompositionInput,
): ChatAnswerComposition {
  const { userText, context, language } = input;
  const zh = language === 'zh';

  const systemPrefix = buildSystemPrefix(language);
  const contextSummary = buildRichContextSummary(context, language);
  const safetyInstructions = buildSafetyInstructions(language);

  const questionLabel = zh ? '用户问题：' : 'User question:';

  const ctxBlock = contextSummary
    ? `${contextSummary}\n\n${i18nT(language, 'chat.answerComposer.contextBased')}`
    : i18nT(language, 'chat.answerComposer.noEnoughData');

  const userPrompt = `${questionLabel}\n${userText}`;

  return {
    systemPrefix,
    userPrompt: `${ctxBlock}\n\n${userPrompt}`,
    safetyInstructions,
    contextSummary,
  };
}

export function planRichAnswer(input: {
  userText: string;
  language: Language;
  context?: ChatContext;
  selectedTicker?: string;
}): RichAnswerPlan {
  const text = input.userText.trim();
  const lowerText = text.toLowerCase();

  const hasMermaidIntent = /流程图|链路图|画个图|画一下|传导路径|研究链路|证据链|mermaid|flowchart|diagram|workflow|evidence chain|risk transmission|process map/i.test(text);
  if (hasMermaidIntent) {
    return {
      purpose: 'explain_context',
      recommendedBlockKinds: ['mermaid', 'evidence_list', 'action_buttons', 'disclaimer'],
      reason: 'matched_mermaid_or_workflow_intent',
    };
  }

  const hasFormulaIntent = /p\/?e|市盈率|cagr|sharpe|夏普|drawdown|最大回撤|volatility|波动率|breakeven|盈亏平衡|market cap|市值|\beps\b|公式|怎么算/i.test(text);
  if (hasFormulaIntent) {
    return {
      purpose: 'explain_formula',
      recommendedBlockKinds: ['formula', 'action_buttons', 'disclaimer'],
      reason: 'matched_formula_intent',
    };
  }

  const hasEvidenceIntent = /证据|来源|sec|trust|credible|evidence|source|filing|official|可信/i.test(lowerText);
  if (hasEvidenceIntent) {
    return {
      purpose: 'review_evidence',
      recommendedBlockKinds: ['evidence_list', 'source_trust', 'data_table', 'action_buttons', 'disclaimer'],
      reason: 'matched_evidence_or_source_intent',
    };
  }

  const hasRiskIntent = /风险|不确定|下行|risk|uncertainty|downside/i.test(lowerText);
  if (hasRiskIntent) {
    return {
      purpose: 'analyze_risk',
      recommendedBlockKinds: ['evidence_list', 'data_quality', 'action_buttons', 'disclaimer'],
      reason: 'matched_risk_intent',
    };
  }

  const hasTrendIntent = /走势|趋势|图表|chart|trend|price action|move/i.test(lowerText);
  if (hasTrendIntent) {
    return {
      purpose: 'explain_trend',
      recommendedBlockKinds: ['chart', 'data_quality', 'action_buttons', 'disclaimer'],
      reason: 'matched_trend_intent',
    };
  }

  const hasCompareIntent = /比较|对比|compare|versus|vs\.?|sources/i.test(lowerText);
  if (hasCompareIntent) {
    return {
      purpose: 'compare_sources',
      recommendedBlockKinds: ['source_trust', 'evidence_list', 'data_table', 'action_buttons', 'disclaimer'],
      reason: 'matched_compare_intent',
    };
  }

  const hasLearningIntent = /是什么|解释|学习|learn|what is|explain/i.test(lowerText);
  if (hasLearningIntent) {
    return {
      purpose: 'learning',
      recommendedBlockKinds: ['action_buttons', 'disclaimer'],
      reason: 'matched_learning_intent',
    };
  }

  return {
    purpose: 'general',
    recommendedBlockKinds: [],
    reason: 'no_rich_answer_blocks_recommended',
  };
}
