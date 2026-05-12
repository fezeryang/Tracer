import { Language, t } from '../i18n';
import { ChatRenderBlock, Message } from '../types';
import { ChatContext } from './chatContextService';
import { buildMermaidTemplate, MermaidTemplateKind } from './mermaidTemplateService';
import { validateMermaidSource } from './mermaidValidator';

export interface RichBlockPlannerInput {
  language: Language;
  userText?: string;
  context?: ChatContext;
  recentMessages?: Message[];
  selectedTicker?: string;
}

export interface RichBlockPlannerResult {
  blocks: ChatRenderBlock[];
  reason: string;
}

const CHART_INTENT_RE = /走势|图表|趋势|chart|trend|price action|explain this move/i;
const MERMAID_INTENT_RE = /流程图|链路图|画个图|画一下流程|传导路径|研究链路|证据链|风险传导|mermaid|flowchart|diagram|workflow|evidence chain|risk transmission|process map|data quality|数据质量/i;

const normalizeTicker = (ticker?: string): string | undefined => {
  const value = ticker?.trim().replace(/^\$/, '').toUpperCase();
  return value || undefined;
};

const extractTickerFromText = (text?: string): string | undefined => {
  const match = text?.match(/(?:^|[\s$（(])([A-Z]{1,5})(?=$|[\s).,，。？?）])/);
  return normalizeTicker(match?.[1]);
};

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

const blockTicker = (block: ChatRenderBlock): string | undefined => {
  return normalizeTicker(block.data?.ticker)
    || normalizeTicker(block.data?.symbol)
    || normalizeTicker(block.title?.match(/\b[A-Z]{1,5}\b/)?.[0]);
};

const cloneBlock = (block: ChatRenderBlock): ChatRenderBlock => ({
  ...block,
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

const findRecentChartBlock = (
  messages: Message[],
  ticker?: string,
): ChatRenderBlock | undefined => {
  for (const message of [...messages].reverse()) {
    for (const block of [...(message.blocks || [])].reverse()) {
      if (block.type !== 'chart' || !hasUsableChartData(block)) continue;
      const candidateTicker = blockTicker(block);
      if (ticker && candidateTicker !== ticker) continue;
      return cloneBlock(block);
    }
  }
  return undefined;
};

const buildChartAction = (language: Language, ticker?: string): ChatRenderBlock => {
  const command = `/chart ${ticker || '{ticker}'}`;
  return {
    type: 'action_buttons',
    title: t(language, 'chat.chart.noReusableChart'),
    content: t(language, 'chat.chart.tryChartCommand', { ticker: ticker || '{ticker}' }),
    createdBy: 'system',
    validationStatus: 'unavailable',
    actions: [
      {
        label: command,
        prompt: command,
        ticker,
        tone: 'secondary',
      },
    ],
  };
};

const buildHistorySummaryAction = (language: Language, ticker?: string): ChatRenderBlock => ({
  type: 'action_buttons',
  title: t(language, 'richBlockPlanner.historySummaryOnly'),
  content: t(language, 'chat.chart.tryChartCommand', { ticker: ticker || '{ticker}' }),
  createdBy: 'system',
  validationStatus: 'limited',
  actions: [
    {
      label: `/chart ${ticker || '{ticker}'}`,
      prompt: `/chart ${ticker || '{ticker}'}`,
      ticker,
      tone: 'secondary',
    },
  ],
});

const mermaidKindForText = (text: string): MermaidTemplateKind => {
  if (/证据链|evidence chain/i.test(text)) return 'evidence_chain';
  if (/风险传导|risk transmission|新闻到风险|risk.*path/i.test(text)) return 'risk_transmission';
  if (/数据质量|data quality/i.test(text)) return 'data_quality_flow';
  if (/研究链路|workflow|process|流程/i.test(text)) return 'research_workflow';
  return 'research_workflow';
};

const mermaidReasonForKind = (kind: MermaidTemplateKind): string => {
  const reasonByKind: Record<MermaidTemplateKind, string> = {
    research_workflow: 'mermaid_research_workflow',
    evidence_chain: 'mermaid_evidence_chain',
    risk_transmission: 'mermaid_risk_transmission',
    data_quality_flow: 'mermaid_data_quality_flow',
  };
  return reasonByKind[kind];
};

const buildMermaidBlock = (
  language: Language,
  kind: MermaidTemplateKind,
  ticker?: string,
): ChatRenderBlock | undefined => {
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
      kind,
      description: template.description,
    },
  };
};

export function planRichBlocksForAnswer(input: RichBlockPlannerInput): RichBlockPlannerResult {
  const userText = input.userText || '';
  const isChartIntent = CHART_INTENT_RE.test(userText);
  const isMermaidIntent = MERMAID_INTENT_RE.test(userText);
  if (!isChartIntent && !isMermaidIntent) {
    return { blocks: [], reason: 'no_rich_block_needed' };
  }

  const ticker = normalizeTicker(input.selectedTicker)
    || normalizeTicker(input.context?.currentTicker)
    || normalizeTicker(input.context?.lastHistorySummary?.ticker)
    || extractTickerFromText(userText);

  if (isMermaidIntent) {
    const kind = mermaidKindForText(userText);
    const block = buildMermaidBlock(input.language, kind, ticker);
    if (block) {
      return {
        blocks: [block],
        reason: mermaidReasonForKind(kind),
      };
    }
    return {
      blocks: [],
      reason: 'mermaid_template_invalid',
    };
  }

  const recentChart = findRecentChartBlock(input.recentMessages || [], ticker);
  if (recentChart) {
    return {
      blocks: [recentChart],
      reason: 'reused_recent_chart_block',
    };
  }

  if (input.context?.lastHistorySummary) {
    return {
      blocks: [buildHistorySummaryAction(input.language, ticker)],
      reason: 'history_summary_only',
    };
  }

  return {
    blocks: [buildChartAction(input.language, ticker)],
    reason: 'no_reusable_chart_block',
  };
}
