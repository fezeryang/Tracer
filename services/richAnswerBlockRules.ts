import { Language, t } from '../i18n';
import { ChatAction, ChatRenderBlock, Message } from '../types';
import { ChatContext } from './chatContextService';
import { FinanceFormulaId, isValidFinanceFormulaId } from './financeFormulaRegistry';
import { RichAnswerPlan } from './chatAnswerComposer';
import { buildMermaidTemplate, MermaidTemplateKind } from './mermaidTemplateService';
import { validateMermaidSource } from './mermaidValidator';

export interface RichAnswerBlockRulesInput {
  plan: RichAnswerPlan;
  language: Language;
  userText: string;
  context?: ChatContext;
  recentMessages?: Message[];
  selectedTicker?: string;
}

export interface RichAnswerBlockRulesResult {
  blocks: ChatRenderBlock[];
  reason: string;
}

const MAX_BLOCKS = 5;

const normalizeTicker = (ticker?: string): string | undefined => {
  const value = ticker?.trim().replace(/^\$/, '').toUpperCase();
  return value || undefined;
};

const extractTickerFromText = (text?: string): string | undefined => {
  const match = text?.match(/(?:^|[\s$（(])([A-Z]{1,5})(?=$|[\s).,，。？?）])/);
  return normalizeTicker(match?.[1]);
};

const resolveTicker = (input: RichAnswerBlockRulesInput): string | undefined => (
  normalizeTicker(input.selectedTicker)
  || normalizeTicker(input.context?.currentTicker)
  || normalizeTicker(input.context?.lastHistorySummary?.ticker)
  || extractTickerFromText(input.userText)
);

const cloneBlock = (block: ChatRenderBlock): ChatRenderBlock => ({
  ...block,
  createdBy: 'system',
  validationStatus: block.validationStatus || 'limited',
  dataQuality: block.dataQuality || 'limited',
  data: block.data && typeof block.data === 'object'
    ? Array.isArray(block.data)
      ? [...block.data]
      : { ...block.data }
    : block.data,
  metrics: block.metrics ? [...block.metrics] : undefined,
  actions: block.actions ? [...block.actions] : undefined,
  columns: block.columns ? [...block.columns] : undefined,
  rows: block.rows ? [...block.rows] : undefined,
});

const blockTicker = (block: ChatRenderBlock): string | undefined => (
  normalizeTicker(block.data?.ticker)
  || normalizeTicker(block.data?.symbol)
  || normalizeTicker(block.data?.trustSummary?.ticker)
  || normalizeTicker(block.title?.match(/\b[A-Z]{1,5}\b/)?.[0])
);

const hasUsableChartData = (block: ChatRenderBlock): boolean => {
  const chartData = Array.isArray(block.data?.chartData)
    ? block.data.chartData
    : Array.isArray(block.data)
      ? block.data
      : [];

  return chartData.length > 0 && chartData.every((point: any) => (
    point
    && typeof point.label === 'string'
    && typeof point.value === 'number'
    && Number.isFinite(point.value)
  ));
};

const findRecentBlock = (
  messages: Message[] = [],
  type: ChatRenderBlock['type'],
  ticker?: string,
  predicate?: (block: ChatRenderBlock) => boolean,
): ChatRenderBlock | undefined => {
  for (const message of [...messages].reverse()) {
    for (const block of [...(message.blocks || [])].reverse()) {
      if (block.type !== type) continue;
      if (predicate && !predicate(block)) continue;
      const candidateTicker = blockTicker(block);
      if (ticker && candidateTicker && candidateTicker !== ticker) continue;
      return cloneBlock(block);
    }
  }
  return undefined;
};

const evidenceFromContext = (context?: ChatContext): ChatRenderBlock | undefined => {
  const bundle = context?.lastEvidenceBundle as any;
  const evidence = Array.isArray(bundle)
    ? bundle
    : Array.isArray(bundle?.items)
      ? bundle.items
      : Array.isArray(bundle?.evidence)
        ? bundle.evidence
        : [];

  if (evidence.length === 0) return undefined;

  return {
    type: 'evidence_list',
    data: {
      ticker: normalizeTicker(context?.currentTicker),
      evidence: evidence.slice(0, 8).map((item: any) => ({
        label: String(item?.label || item?.title || item?.description || t('en', 'chat.blocks.noEvidence')),
        source: item?.source,
        url: item?.url,
      })),
    },
    dataQuality: 'limited',
    createdBy: 'system',
    validationStatus: 'limited',
  };
};

const sourceTrustFromContext = (context?: ChatContext): ChatRenderBlock | undefined => {
  if (!context?.lastSourceTrust) return undefined;
  return {
    type: 'source_trust',
    data: {
      trustSummary: context.lastSourceTrust,
    },
    dataQuality: 'limited',
    createdBy: 'system',
    validationStatus: 'limited',
  };
};

const secTableFromContext = (
  language: Language,
  context?: ChatContext,
  ticker?: string,
): ChatRenderBlock | undefined => {
  const filings = Array.isArray(context?.lastSecFilings) ? context?.lastSecFilings as any[] : [];
  if (filings.length === 0) return undefined;

  return {
    type: 'data_table',
    title: t(language, 'chat.blocks.secFilingsTable'),
    columns: [
      { key: 'form', label: t(language, 'chat.secTable.form'), width: '80px' },
      { key: 'filingDate', label: t(language, 'chat.secTable.filingDate'), width: '100px' },
      { key: 'description', label: t(language, 'chat.secTable.description') },
      { key: 'source', label: t(language, 'chat.secTable.source'), width: '80px' },
    ],
    rows: filings.slice(0, 5).map((filing: any) => ({
      form: filing?.form || 'N/A',
      filingDate: filing?.filingDate || 'N/A',
      description: filing?.description || filing?.reportDate || filing?.primaryDocument || 'N/A',
      source: 'SEC EDGAR',
    })),
    source: 'SEC EDGAR',
    sourceUrl: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${ticker || ''}&type=&dateb=&owner=include&count=10`,
    dataQuality: 'available',
    createdBy: 'system',
    validationStatus: 'valid',
    emptyState: t(language, 'chat.secTable.noFilings'),
    compact: true,
  };
};

const formulaIdForText = (text: string): FinanceFormulaId | undefined => {
  if (/p\/?e|市盈率/i.test(text)) return 'pe_ratio';
  if (/cagr|复合增长|年复合/i.test(text)) return 'cagr';
  if (/sharpe|夏普/i.test(text)) return 'sharpe_ratio';
  if (/drawdown|最大回撤/i.test(text)) return 'max_drawdown';
  if (/volatility|波动率/i.test(text)) return 'volatility_estimate';
  if (/breakeven|盈亏平衡/i.test(text)) {
    if (/put|看跌/i.test(text)) return 'option_breakeven_put';
    return 'option_breakeven_call';
  }
  if (/market cap|市值/i.test(text)) return 'market_cap';
  if (/\beps\b|每股收益/i.test(text)) return 'eps';
  return undefined;
};

const formulaBlockFromText = (language: Language, userText: string): ChatRenderBlock | undefined => {
  const formulaId = formulaIdForText(userText);
  if (!formulaId || !isValidFinanceFormulaId(formulaId)) return undefined;

  return {
    type: 'formula',
    title: t(language, `financeFormula.${formulaId}.title`),
    formulaId,
    source: t(language, 'richAnswer.reason.formulaAttached'),
    dataQuality: 'available',
    createdBy: 'system',
    validationStatus: 'valid',
    compact: true,
  };
};

const mermaidKindForText = (text: string): MermaidTemplateKind => {
  if (/证据链|evidence chain/i.test(text)) return 'evidence_chain';
  if (/风险传导|risk transmission|新闻到风险|risk.*path/i.test(text)) return 'risk_transmission';
  if (/数据质量|data quality/i.test(text)) return 'data_quality_flow';
  if (/研究链路|workflow|process|流程/i.test(text)) return 'research_workflow';
  return 'research_workflow';
};

const mermaidBlockFromText = (
  language: Language,
  userText: string,
  ticker?: string,
): ChatRenderBlock | undefined => {
  const kind = mermaidKindForText(userText);
  const template = buildMermaidTemplate({ kind, ticker, language });
  const validation = validateMermaidSource(template.code);
  if (!validation.valid) return undefined;

  return {
    type: 'mermaid',
    title: template.title,
    content: validation.normalizedCode,
    source: t(language, 'chat.mermaid.systemTemplate'),
    dataQuality: 'available',
    createdBy: 'system',
    validationStatus: 'valid',
    diagramType: validation.diagramType,
    validated: true,
    validationMessage: validation.reason,
    disclaimer: t(language, 'chat.mermaid.researchOnly'),
    data: {
      ticker,
      kind,
      description: template.description,
    },
  };
};

const dataQualityBlockFromContext = (context?: ChatContext): ChatRenderBlock | undefined => {
  if (!context?.lastDataQualityNotes?.length) return undefined;
  return {
    type: 'data_quality',
    data: {
      quote: context.lastQuote,
      fundamentals: context.lastFundamentals,
      news: context.lastNews,
      notes: context.lastDataQualityNotes.slice(0, 3),
    },
    dataQuality: 'limited',
    createdBy: 'system',
    validationStatus: 'limited',
  };
};

const actionLabelByCommand: Record<string, string> = {
  evidence: 'richAnswer.action.viewEvidence',
  trust: 'richAnswer.action.checkSourceTrust',
  chart: 'richAnswer.action.viewChart',
  report: 'richAnswer.action.generateReport',
  sec: 'richAnswer.action.viewSec',
};

const buildActionBlock = (
  language: Language,
  ticker: string | undefined,
  commands: string[],
): ChatRenderBlock | undefined => {
  const uniqueCommands = [...new Set(commands)].slice(0, 4);
  if (uniqueCommands.length === 0) return undefined;

  const safeTicker = ticker || '{ticker}';
  const actions: ChatAction[] = uniqueCommands.map((command) => ({
    label: t(language, actionLabelByCommand[command]),
    prompt: `/${command} ${safeTicker}`,
    ticker,
    tone: 'secondary',
  }));

  return {
    type: 'action_buttons',
    title: t(language, 'richAnswer.reason.chartMissing'),
    createdBy: 'system',
    validationStatus: ticker ? 'limited' : 'unavailable',
    dataQuality: 'limited',
    actions,
  };
};

const disclaimerBlock = (language: Language): ChatRenderBlock => ({
  type: 'disclaimer',
  content: t(language, 'chat.answerComposer.researchOnly'),
  tone: 'info',
  data: { disclaimerType: 'general' },
  dataQuality: 'limited',
  createdBy: 'system',
  validationStatus: 'limited',
});

const blockSignature = (block: ChatRenderBlock): string => {
  if (block.type === 'action_buttons') {
    return `${block.type}:${(block.actions || []).map((action) => action.prompt || action.label).join('|')}`;
  }
  if (block.type === 'formula') return `${block.type}:${block.formulaId}`;
  if (block.type === 'mermaid') return `${block.type}:${block.data?.kind || block.content}`;
  if (block.type === 'chart') return `${block.type}:${blockTicker(block) || block.title}`;
  if (block.type === 'data_table') return `${block.type}:${block.title}:${block.rows?.length || 0}`;
  if (block.type === 'disclaimer') return `${block.type}:${block.data?.disclaimerType || block.content}`;
  return `${block.type}:${block.title || block.content || JSON.stringify(block.data || {})}`;
};

const addUniqueBlock = (blocks: ChatRenderBlock[], block?: ChatRenderBlock): void => {
  if (!block || blocks.length >= MAX_BLOCKS) return;
  const signature = blockSignature(block);
  if (blocks.some((existing) => blockSignature(existing) === signature)) return;
  blocks.push(block);
};

export function buildRichBlocksForAnswer(input: RichAnswerBlockRulesInput): RichAnswerBlockRulesResult {
  const ticker = resolveTicker(input);
  const blocks: ChatRenderBlock[] = [];
  const reasons: string[] = [];
  const pendingActions: string[] = [];
  const kinds = input.plan.recommendedBlockKinds;

  for (const kind of kinds) {
    if (blocks.length >= MAX_BLOCKS) break;

    if (kind === 'chart') {
      const chart = findRecentBlock(input.recentMessages, 'chart', ticker, hasUsableChartData);
      if (chart) {
        addUniqueBlock(blocks, chart);
        reasons.push('chart_reused');
      } else {
        pendingActions.push('chart');
        reasons.push('chart_missing');
      }
      continue;
    }

    if (kind === 'evidence_list') {
      const evidence = evidenceFromContext(input.context)
        || findRecentBlock(input.recentMessages, 'evidence_list', ticker, (block) => (
          Array.isArray(block.data?.evidence) && block.data.evidence.length > 0
        ));
      if (evidence) {
        addUniqueBlock(blocks, evidence);
        reasons.push('evidence_reused');
      } else {
        pendingActions.push('evidence');
        reasons.push('evidence_missing');
      }
      continue;
    }

    if (kind === 'source_trust') {
      const sourceTrust = findRecentBlock(input.recentMessages, 'source_trust', ticker)
        || sourceTrustFromContext(input.context);
      if (sourceTrust) {
        addUniqueBlock(blocks, sourceTrust);
        reasons.push('source_trust_reused');
      } else {
        pendingActions.push('trust');
        reasons.push('source_trust_missing');
      }
      continue;
    }

    if (kind === 'data_table') {
      const table = findRecentBlock(input.recentMessages, 'data_table', ticker, (block) => (
        Array.isArray(block.rows) && block.rows.length > 0
      )) || secTableFromContext(input.language, input.context, ticker);
      if (table) {
        addUniqueBlock(blocks, table);
        reasons.push('data_table_attached');
      }
      continue;
    }

    if (kind === 'formula') {
      const formula = formulaBlockFromText(input.language, input.userText);
      if (formula) {
        addUniqueBlock(blocks, formula);
        reasons.push('formula_attached');
      }
      continue;
    }

    if (kind === 'mermaid') {
      const mermaid = mermaidBlockFromText(input.language, input.userText, ticker);
      if (mermaid) {
        addUniqueBlock(blocks, mermaid);
        reasons.push('mermaid_attached');
      }
      continue;
    }

    if (kind === 'data_quality') {
      const dataQuality = dataQualityBlockFromContext(input.context);
      if (dataQuality) {
        addUniqueBlock(blocks, dataQuality);
        reasons.push('data_quality_attached');
      }
      continue;
    }

    if (kind === 'action_buttons') {
      if (input.plan.purpose === 'explain_trend') pendingActions.push('chart');
      if (input.plan.purpose === 'review_evidence') pendingActions.push('evidence', 'trust', 'sec');
      if (input.plan.purpose === 'analyze_risk') pendingActions.push('evidence', 'chart', 'report');
      if (input.plan.purpose === 'explain_formula') pendingActions.push('report', 'evidence');
      if (input.plan.purpose === 'explain_context') pendingActions.push('evidence', 'trust', 'report');
      if (input.plan.purpose === 'compare_sources') pendingActions.push('trust', 'evidence', 'sec');
      continue;
    }

    if (kind === 'disclaimer') {
      continue;
    }
  }

  if (kinds.includes('action_buttons')) {
    addUniqueBlock(blocks, buildActionBlock(input.language, ticker, pendingActions));
  }

  if (kinds.includes('disclaimer')) {
    addUniqueBlock(blocks, disclaimerBlock(input.language));
    reasons.push('disclaimer_attached');
  }

  return {
    blocks: blocks.slice(0, MAX_BLOCKS),
    reason: reasons.length > 0 ? reasons.join(',') : 'no_blocks_attached',
  };
}
