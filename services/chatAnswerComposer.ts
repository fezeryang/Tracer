/**
 * Chat Phase C-6: Answer Composer
 *
 * Builds enriched prompts for Gemini with full ChatContext and a structured
 * 7-section answer template for complex financial analysis questions.
 */

import { Language, t as i18nT } from '../i18n';
import { ChatContext } from './chatContextService';

export interface ChatAnswerCompositionInput {
  userText: string;
  context: ChatContext;
  language: Language;
}

export interface ChatAnswerComposition {
  systemPrefix: string;
  userPrompt: string;
  safetyInstructions: string;
  contextSummary: string;
}

// ============================================================================
// Section headers
// ============================================================================

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

// ============================================================================
// Safety instructions
// ============================================================================

function buildSafetyInstructions(language: Language): string {
  const items =
    language === 'zh'
      ? [
          '禁止提供买入/卖出/持有建议。',
          '禁止给出目标价格或入场点位。',
          '禁止提供支撑位/阻力位/止损位。',
          '禁止提供交易指令或操作指南。',
          '必须标注模拟/回退/延迟数据。',
          '仅供学习研究使用，不构成投资建议。',
        ]
      : [
          'Do NOT provide Buy/Sell/Hold recommendations.',
          'Do NOT provide target prices or entry points.',
          'Do NOT provide support/resistance/stop-loss levels.',
          'Do NOT provide trading instructions.',
          'You MUST label any simulation, fallback, or delayed data.',
          'You MUST include a research-only disclaimer.',
        ];

  const header =
    language === 'zh'
      ? '重要安全约束（必须遵守）：'
      : 'CRITICAL SAFETY CONSTRAINTS (MUST FOLLOW):';

  return [header, '', ...items.map((item) => `- ${item}`)].join('\n');
}

// ============================================================================
// Rich context summary builder
// ============================================================================

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

  // 1. Current ticker
  if (context.currentTicker) {
    sections.push(
      zh
        ? `- 当前标的：${context.currentTicker}`
        : `- Current ticker: ${context.currentTicker}`,
    );
  }

  // 2. Last quote
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

  // 3. Last fundamentals
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

  // 4. Last command
  if (context.lastCommand) {
    sections.push(
      zh
        ? `- 最近命令：/${context.lastCommand}`
        : `- Last command: /${context.lastCommand}`,
    );
  }

  // 5. History summary
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

  // 6. Data quality notes (first 2)
  if (context.lastDataQualityNotes?.length) {
    const notes = context.lastDataQualityNotes.slice(0, 2);
    const label = zh ? '- 数据质量提示：' : '- Data quality notes: ';
    sections.push(label + notes.join('; '));
  }

  // 7. News (first 3 titles)
  if (context.lastNews?.length) {
    const newsItems = context.lastNews.slice(0, 3) as any[];
    const titles = newsItems.map((n) => n?.title || '(untitled)');
    const label = zh ? '- 最近新闻：' : '- Recent news: ';
    sections.push(label + titles.join(' | '));
  }

  // 8. SEC filings (first 3: form + filingDate)
  if (context.lastSecFilings?.length) {
    const filings = context.lastSecFilings.slice(0, 3) as any[];
    const items = filings.map(
      (f) => `${f?.form || '?'} ${f?.filingDate || ''}`.trim(),
    );
    const label = zh ? '- SEC 文件：' : '- SEC filings: ';
    sections.push(label + items.join(', '));
  }

  // 9. Official sources (first 3: name + type)
  if (context.lastOfficialSources?.length) {
    const sources = context.lastOfficialSources.slice(0, 3) as any[];
    const items = sources.map(
      (s) => `${s?.name || '?'} (${s?.type || 'unknown'})`,
    );
    const label = zh ? '- 官方来源：' : '- Official sources: ';
    sections.push(label + items.join(', '));
  }

  // 10. Source trust
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

  // 11. Evidence bundle count summary
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

// ============================================================================
// System prefix (answer structure template)
// ============================================================================

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

// ============================================================================
// Main composition function
// ============================================================================

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
