import { describe, expect, it } from 'vitest';
import { validateMermaidSource } from '../mermaidValidator';
import {
  buildMermaidTemplate,
  MermaidTemplateKind,
} from '../mermaidTemplateService';

const kinds: MermaidTemplateKind[] = [
  'research_workflow',
  'evidence_chain',
  'risk_transmission',
  'data_quality_flow',
];

describe('mermaidTemplateService', () => {
  it.each(kinds)('builds a validated %s template', (kind) => {
    const template = buildMermaidTemplate({ kind, ticker: 'AAPL', language: 'en' });
    const validation = validateMermaidSource(template.code);

    expect(template.title).toBeTruthy();
    expect(template.description).toBeTruthy();
    expect(validation.valid).toBe(true);
    expect(validation.diagramType).toBe('flowchart');
  });

  it('sanitizes ticker labels', () => {
    const template = buildMermaidTemplate({
      kind: 'evidence_chain',
      ticker: 'AAPL<script>',
      language: 'en',
    });

    expect(template.code).not.toContain('script');
    expect(template.code).not.toContain('<');
  });

  it('allows safe ticker characters', () => {
    const template = buildMermaidTemplate({
      kind: 'research_workflow',
      ticker: 'BRK.B',
      language: 'en',
    });

    expect(template.code).toContain('BRK.B');
  });

  it.each(kinds)('does not include unsafe directives in %s', (kind) => {
    const template = buildMermaidTemplate({ kind, ticker: 'TSLA', language: 'zh' });

    expect(template.code).not.toMatch(/<[^>]+>/);
    expect(template.code).not.toMatch(/click|href|javascript:|%%\{init|htmlLabels|foreignObject/i);
  });
});
