export type MermaidDiagramType =
  | 'flowchart'
  | 'sequenceDiagram'
  | 'stateDiagram'
  | 'erDiagram'
  | 'unknown';

export interface MermaidValidationResult {
  valid: boolean;
  diagramType: MermaidDiagramType;
  reason: string;
  normalizedCode: string;
  warnings: string[];
}

const MAX_MERMAID_LENGTH = 2048;

const UNSAFE_PATTERNS: RegExp[] = [
  /<\s*script/i,
  /<\s*\/\s*script/i,
  /<\s*iframe/i,
  /<\s*\/\s*iframe/i,
  /javascript\s*:/i,
  /onerror\s*=/i,
  /onclick\s*=/i,
  /dangerouslySetInnerHTML/i,
  /\bclick\b/i,
  /\bhref\b/i,
  /%%\s*\{\s*init/i,
  /htmlLabels/i,
  /foreignObject/i,
  /<\s*(div|span|img|a|svg|object|embed|link|meta|style)\b/i,
  /<\s*\/\s*(div|span|a|svg|object|style)\b/i,
];

const normalizeSource = (code: string): string => {
  const normalized = String(code || '').replace(/\r\n?/g, '\n').trim();
  const fenceMatch = normalized.match(/^```(?:mermaid)?\s*\n([\s\S]*?)\n```$/i);
  return (fenceMatch?.[1] || normalized).trim();
};

export function detectMermaidDiagramType(code: string): MermaidDiagramType {
  const normalizedCode = normalizeSource(code);
  const firstLine = normalizedCode.split('\n').find((line) => line.trim().length > 0)?.trim() || '';

  if (/^(flowchart|graph)\b/i.test(firstLine)) return 'flowchart';
  if (/^sequenceDiagram\b/i.test(firstLine)) return 'sequenceDiagram';
  if (/^stateDiagram(?:-v2)?\b/i.test(firstLine)) return 'stateDiagram';
  if (/^erDiagram\b/i.test(firstLine)) return 'erDiagram';
  return 'unknown';
}

export function validateMermaidSource(code: string): MermaidValidationResult {
  const normalizedCode = normalizeSource(code);
  const diagramType = detectMermaidDiagramType(normalizedCode);
  const warnings: string[] = [];

  if (!normalizedCode) {
    return {
      valid: false,
      diagramType: 'unknown',
      reason: 'empty',
      normalizedCode,
      warnings,
    };
  }

  if (normalizedCode.length > MAX_MERMAID_LENGTH) {
    return {
      valid: false,
      diagramType,
      reason: 'too_long',
      normalizedCode,
      warnings: ['max_length_exceeded'],
    };
  }

  if (diagramType === 'unknown') {
    return {
      valid: false,
      diagramType,
      reason: 'unsupported_diagram_type',
      normalizedCode,
      warnings: ['unsupported_diagram_type'],
    };
  }

  if (UNSAFE_PATTERNS.some((pattern) => pattern.test(normalizedCode))) {
    return {
      valid: false,
      diagramType,
      reason: 'unsafe_content',
      normalizedCode,
      warnings: ['unsafe_content'],
    };
  }

  return {
    valid: true,
    diagramType,
    reason: 'valid',
    normalizedCode,
    warnings,
  };
}
