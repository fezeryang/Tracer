import { describe, expect, it } from 'vitest';
import {
  detectMermaidDiagramType,
  validateMermaidSource,
} from '../mermaidValidator';

describe('mermaidValidator', () => {
  it('accepts flowchart', () => {
    const result = validateMermaidSource('flowchart TD\n  A[Start] --> B[End]');

    expect(result.valid).toBe(true);
    expect(result.diagramType).toBe('flowchart');
    expect(result.normalizedCode).toContain('flowchart TD');
  });

  it('accepts graph as flowchart', () => {
    const result = validateMermaidSource('graph LR\n  A --> B');

    expect(result.valid).toBe(true);
    expect(result.diagramType).toBe('flowchart');
  });

  it('accepts sequenceDiagram', () => {
    const result = validateMermaidSource('sequenceDiagram\n  User->>System: Ask');

    expect(result.valid).toBe(true);
    expect(result.diagramType).toBe('sequenceDiagram');
  });

  it('accepts stateDiagram-v2', () => {
    const result = validateMermaidSource('stateDiagram-v2\n  [*] --> Research');

    expect(result.valid).toBe(true);
    expect(result.diagramType).toBe('stateDiagram');
  });

  it('accepts erDiagram', () => {
    const result = validateMermaidSource('erDiagram\n  USER ||--o{ NOTE : creates');

    expect(result.valid).toBe(true);
    expect(result.diagramType).toBe('erDiagram');
  });

  it('rejects empty source', () => {
    const result = validateMermaidSource('   ');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('empty');
  });

  it('rejects too long source', () => {
    const result = validateMermaidSource(`flowchart TD\n${'A'.repeat(2050)}`);

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('too_long');
  });

  it('rejects script tag', () => {
    const result = validateMermaidSource('flowchart TD\n  A[<script>alert(1)</script>] --> B');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unsafe_content');
  });

  it('rejects javascript protocol', () => {
    const result = validateMermaidSource('flowchart TD\n  A[javascript:alert(1)] --> B');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unsafe_content');
  });

  it('rejects click directive', () => {
    const result = validateMermaidSource('flowchart TD\n  A --> B\n  click A call callback()');

    expect(result.valid).toBe(false);
    expect(result.reason).toBe('unsafe_content');
  });

  it('strips markdown code fences and returns normalizedCode', () => {
    const result = validateMermaidSource('```mermaid\r\nflowchart TD\r\n  A --> B\r\n```');

    expect(result.valid).toBe(true);
    expect(result.normalizedCode).toBe('flowchart TD\n  A --> B');
  });

  it('detects unknown diagram type for unsupported starts', () => {
    expect(detectMermaidDiagramType('journey\n  title Bad')).toBe('unknown');
  });
});
