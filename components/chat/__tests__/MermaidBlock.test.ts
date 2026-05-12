import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import MermaidBlock from '../MermaidBlock';

const renderBlock = (props: React.ComponentProps<typeof MermaidBlock>) => (
  renderToString(React.createElement(MermaidBlock, props))
);

describe('MermaidBlock', () => {
  it('shows validated source and diagram type for safe Mermaid', () => {
    const html = renderBlock({
      language: 'en',
      title: 'Research Workflow',
      code: 'flowchart LR\n  A["User Question"] --> B["Market Data"]',
      source: 'System Template',
      dataQuality: 'available',
      validated: true,
      diagramType: 'flowchart',
    });

    expect(html).toContain('Research Workflow');
    expect(html).toContain('Validated');
    expect(html).toContain('flowchart');
    expect(html).toContain('Safe source only.');
  });

  it('shows validation warning for unsafe Mermaid without executing HTML', () => {
    const html = renderBlock({
      language: 'en',
      title: 'Unsafe Source',
      code: 'flowchart TD\n  A["<script>alert(1)</script>"] --> B',
    });

    expect(html).toContain('Unsafe Source');
    expect(html).toContain('Unvalidated');
    expect(html).toContain('Validation failed');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');
  });

  it('handles empty code without crashing', () => {
    const html = renderBlock({
      language: 'zh',
      title: '空图',
      code: '',
    });

    expect(html).toContain('空图');
    expect(html).toContain('未验证');
    expect(html).toContain('Mermaid 源码为空');
  });
});
