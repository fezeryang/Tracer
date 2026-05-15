import { describe, expect, it } from 'vitest';
import {
  addBackendTraceStep,
  completeBackendTraceStep,
  createBackendToolTrace,
  finalizeBackendToolTrace,
} from '../chatToolTraceBuilder.js';

describe('chatToolTraceBuilder', () => {
  it('creates, updates, and finalizes backend tool traces', () => {
    let trace = createBackendToolTrace({ command: 'quote', ticker: 'AAPL' });

    trace = addBackendTraceStep(trace, {
      id: 'backend-quote-fetch',
      type: 'tool_call',
      label: 'backend_quote_fetch',
      status: 'pending',
    });
    trace = completeBackendTraceStep(trace, 'tool_call', 'success', 'Quote data retrieved.');
    trace = finalizeBackendToolTrace(trace, {
      evidenceItems: [{ id: 'quote:AAPL', type: 'quote', title: 'AAPL Quote' }],
      dataQualityNotes: ['Quote data retrieved.'],
    });

    expect(trace.command).toBe('quote');
    expect(trace.steps.some((step) => step.status === 'success')).toBe(true);
    expect(trace.evidenceItems).toHaveLength(1);
    expect(trace.dataQualityNotes).toContain('Quote data retrieved.');
  });

  it('keeps warning steps safe and does not leak raw stack strings', () => {
    const trace = finalizeBackendToolTrace(
      addBackendTraceStep(createBackendToolTrace({ command: 'evidence', ticker: 'AAPL' }), {
        id: 'backend-news-fetch',
        type: 'tool_call',
        label: 'backend_news_fetch',
        status: 'warning',
        message: 'News data was unavailable; returning remaining evidence.',
        metadata: { stack: 'secret stack should not appear' },
      }),
      { warnings: ['backend_news_unavailable'] },
    );

    expect(trace.steps[trace.steps.length - 1].status).toBe('warning');
    expect(JSON.stringify(trace)).not.toContain('secret stack');
  });
});
