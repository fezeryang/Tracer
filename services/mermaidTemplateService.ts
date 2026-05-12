import { Language, t } from '../i18n';
import { validateMermaidSource } from './mermaidValidator';

export type MermaidTemplateKind =
  | 'research_workflow'
  | 'evidence_chain'
  | 'risk_transmission'
  | 'data_quality_flow';

export interface MermaidTemplateInput {
  kind: MermaidTemplateKind;
  ticker?: string;
  language: Language;
}

export interface MermaidTemplate {
  title: string;
  code: string;
  description: string;
}

const sanitizeTicker = (ticker?: string): string | undefined => {
  const normalized = ticker?.trim().replace(/^\$/, '').toUpperCase();
  if (!normalized || !/^[A-Z0-9.-]{1,12}$/.test(normalized)) return undefined;
  return normalized;
};

const node = (id: string, label: string): string => `${id}["${label.replace(/"/g, '')}"]`;

const buildTitle = (language: Language, kind: MermaidTemplateKind): string => {
  const keyByKind: Record<MermaidTemplateKind, string> = {
    research_workflow: 'mermaidTemplate.researchWorkflow.title',
    evidence_chain: 'mermaidTemplate.evidenceChain.title',
    risk_transmission: 'mermaidTemplate.riskTransmission.title',
    data_quality_flow: 'mermaidTemplate.dataQualityFlow.title',
  };
  return t(language, keyByKind[kind]);
};

const buildDescription = (language: Language, kind: MermaidTemplateKind): string => {
  const keyByKind: Record<MermaidTemplateKind, string> = {
    research_workflow: 'mermaidTemplate.researchWorkflow.description',
    evidence_chain: 'mermaidTemplate.evidenceChain.description',
    risk_transmission: 'mermaidTemplate.riskTransmission.description',
    data_quality_flow: 'mermaidTemplate.dataQualityFlow.description',
  };
  return t(language, keyByKind[kind]);
};

const researchWorkflow = (language: Language, ticker?: string): string[] => {
  if (language === 'zh') {
    return [
      ticker || '用户问题',
      '行情数据',
      '新闻与SEC',
      '来源可信度',
      'AI分析',
      '下一步研究',
    ];
  }
  return [
    ticker || 'User Question',
    'Market Data',
    'News & SEC',
    'Source Trust',
    'AI Analysis',
    'Next Checks',
  ];
};

const evidenceChain = (language: Language, ticker?: string): string[] => (
  language === 'zh'
    ? [ticker || '标的', 'Verified News', 'SEC Filings', 'Official Sources', 'Source Trust', 'Evidence Drawer']
    : [ticker || 'Ticker', 'Verified News', 'SEC Filings', 'Official Sources', 'Source Trust', 'Evidence Drawer']
);

const riskTransmission = (language: Language): string[] => (
  language === 'zh'
    ? ['新闻事件', '市场情绪', '价格波动', '数据质量检查', '风险提示']
    : ['News Event', 'Market Sentiment', 'Price Movement', 'Data Quality Check', 'Risk Notice']
);

const dataQualityFlow = (language: Language): string[] => (
  language === 'zh'
    ? ['数据请求', 'Provider', 'Cache/Fallback', 'DataQualityCard', 'User Visible Result']
    : ['Data Request', 'Provider', 'Cache/Fallback', 'DataQualityCard', 'User Visible Result']
);

const labelsForKind = (
  kind: MermaidTemplateKind,
  language: Language,
  ticker?: string,
): string[] => {
  switch (kind) {
    case 'evidence_chain':
      return evidenceChain(language, ticker);
    case 'risk_transmission':
      return riskTransmission(language);
    case 'data_quality_flow':
      return dataQualityFlow(language);
    case 'research_workflow':
    default:
      return researchWorkflow(language, ticker);
  }
};

const buildFlowchart = (labels: string[]): string => {
  const ids = ['A', 'B', 'C', 'D', 'E', 'F'];
  const nodeLines = labels.map((label, index) => `  ${node(ids[index], label)}`);
  const edgeLines = labels.slice(1).map((_, index) => `  ${ids[index]} --> ${ids[index + 1]}`);
  return ['flowchart LR', ...nodeLines, ...edgeLines].join('\n');
};

export function buildMermaidTemplate(input: MermaidTemplateInput): MermaidTemplate {
  const ticker = sanitizeTicker(input.ticker);
  const labels = labelsForKind(input.kind, input.language, ticker);
  const code = buildFlowchart(labels);
  const validation = validateMermaidSource(code);

  if (!validation.valid) {
    throw new Error(`Mermaid system template failed validation: ${validation.reason}`);
  }

  return {
    title: buildTitle(input.language, input.kind),
    code: validation.normalizedCode,
    description: buildDescription(input.language, input.kind),
  };
}
