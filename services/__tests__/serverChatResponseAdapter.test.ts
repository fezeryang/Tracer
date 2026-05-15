import { describe, expect, it } from 'vitest';
import { adaptServerChatResponse } from '../serverChatResponseAdapter';
import type { ServerChatResponse } from '../../shared/chat-core/serverTypes';

const baseResponse = (overrides: Partial<ServerChatResponse> = {}): ServerChatResponse => ({
  ok: true,
  messages: [
    {
      id: 'server-message-1',
      role: 'assistant',
      text: 'Fetched AAPL quote data for educational research only.',
      blocks: [
        { type: 'metric_grid', metrics: [{ label: 'Ticker', value: 'AAPL' }] },
      ],
    },
  ],
  trace: {
    id: 'server-trace-1',
    command: 'quote',
    ticker: 'AAPL',
    steps: [
      {
        id: 'step-1',
        type: 'tool_call',
        label: 'backend_quote_fetch',
        status: 'success',
        metadata: {
          command: 'quote',
          stack: 'raw stack should not appear',
          apiKey: 'secret-key',
          safe: 'visible',
        },
      },
    ],
    evidenceItems: [
      { id: 'quote:AAPL', type: 'quote', title: 'AAPL Quote', source: 'Market Data' },
    ],
    dataQualityNotes: ['Quote data retrieved.'],
    createdAt: '2026-05-14T00:00:00.000Z',
    updatedAt: '2026-05-14T00:00:00.000Z',
  },
  contextUpdate: {
    currentTicker: 'AAPL',
    lastCommand: '/quote AAPL',
    lastIntent: 'quote',
    lastDataQualityNotes: ['Quote data retrieved.', 'extra note 1', 'extra note 2', 'extra note 3'],
  },
  evidenceItems: [
    { id: 'quote:AAPL', type: 'quote', title: 'AAPL Quote', source: 'Market Data' },
  ],
  warnings: [],
  ...overrides,
});

describe('serverChatResponseAdapter', () => {
  it('maps assistant role to frontend model role', () => {
    const adapted = adaptServerChatResponse({
      response: baseResponse(),
      language: 'en',
      fallbackTicker: 'AAPL',
    });

    expect(adapted?.message).toMatchObject({
      role: 'model',
      text: 'Fetched AAPL quote data for educational research only.',
    });
  });

  it('returns null for ok=false responses', () => {
    const adapted = adaptServerChatResponse({
      response: baseResponse({ ok: false, error: 'backend_tool_fetch_failed' }),
      language: 'en',
    });

    expect(adapted).toBeNull();
  });

  it('rejects missing or non-string message text', () => {
    expect(adaptServerChatResponse({
      response: baseResponse({ messages: [{ role: 'assistant', text: '' }] }),
      language: 'en',
    })).toBeNull();

    expect(adaptServerChatResponse({
      response: baseResponse({ messages: [{ role: 'assistant', text: { raw: 'json' } }] }),
      language: 'en',
    })).toBeNull();
  });

  it('rejects missing assistant messages and raw JSON text', () => {
    expect(adaptServerChatResponse({
      response: baseResponse({ messages: [] }),
      language: 'en',
    })).toBeNull();

    expect(adaptServerChatResponse({
      response: baseResponse({ messages: [{ role: 'user', text: 'hello' }] }),
      language: 'en',
    })).toBeNull();

    expect(adaptServerChatResponse({
      response: baseResponse({ messages: [{ role: 'assistant', text: '{"raw":"json"}' }] }),
      language: 'en',
    })).toBeNull();
  });

  it('keeps known blocks and drops unknown block types with a warning', () => {
    const adapted = adaptServerChatResponse({
      response: baseResponse({
        messages: [
          {
            role: 'assistant',
            text: 'Safe response.',
            blocks: [
              { type: 'metric_grid', metrics: [{ label: 'Ticker', value: 'AAPL' }] },
              { type: 'data_quality', title: 'Quality' },
              { type: 'source_trust', title: 'Trust' },
              { type: 'formula', formulaId: 'dcf' },
              { type: 'chart', chartType: 'line', data: { chartData: [] } },
              { type: 'mermaid', content: 'flowchart TD; A-->B' },
              { type: 'action_buttons', actions: [{ label: 'SEC', prompt: '/sec AAPL' }] },
              { type: 'evidence_list', data: { evidence: [] } },
              { type: 'disclaimer', content: 'Research only.' },
              { type: 'unknown_widget', raw: { apiKey: 'secret-key' } },
              { type: 'data_table', rows: [{ form: '10-K' }], columns: [{ key: 'form', label: 'Form' }] },
            ],
          },
        ],
      }),
      language: 'en',
    });

    expect(adapted?.message.blocks?.map((block) => block.type)).toEqual([
      'metric_grid',
      'data_quality',
      'source_trust',
      'formula',
      'chart',
      'mermaid',
      'action_buttons',
      'evidence_list',
      'disclaimer',
      'data_table',
    ]);
    expect(adapted?.warnings).toContain('dropped_unknown_block_type');
    expect(JSON.stringify(adapted)).not.toContain('secret-key');
  });

  it('maps server context update fields into frontend context input', () => {
    const adapted = adaptServerChatResponse({
      response: baseResponse({
        contextUpdate: {
          currentTicker: 'msft',
          lastCommand: '/sec MSFT',
          lastIntent: 'sec',
          lastDataQualityNotes: ['one', 'two', 'three', 'four'],
          lastSecFilings: Array.from({ length: 10 }, (_, index) => ({
            form: '10-K',
            filingDate: `2026-01-${String(index + 1).padStart(2, '0')}`,
            description: `Filing ${index + 1}`,
            url: 'https://www.sec.gov/example',
          })),
        },
      }),
      language: 'en',
    });

    expect(adapted?.contextUpdate).toMatchObject({
      ticker: 'MSFT',
      command: 'sec',
      intent: 'sec',
      dataQualityNotes: ['one', 'two', 'three'],
    });
    expect(adapted?.contextUpdate?.secFilings).toHaveLength(8);
  });

  it('caps evidence items at 8 and drops invalid URLs', () => {
    const adapted = adaptServerChatResponse({
      response: baseResponse({
        evidenceItems: Array.from({ length: 12 }, (_, index) => ({
          id: `item-${index}`,
          type: 'news',
          title: `News ${index}`,
          source: 'News',
          url: index === 0 ? 'javascript:alert(1)' : `https://example.com/${index}`,
        })),
      }),
      language: 'en',
    });

    expect(adapted?.evidenceItems).toHaveLength(8);
    expect(adapted?.evidenceItems?.[0].url).toBeUndefined();
  });

  it('sanitizes unsafe trace metadata and raw stack strings', () => {
    const adapted = adaptServerChatResponse({
      response: baseResponse(),
      language: 'en',
    });

    expect(JSON.stringify(adapted?.trace)).not.toContain('raw stack');
    expect(JSON.stringify(adapted?.trace)).not.toContain('secret-key');
    expect(adapted?.trace?.steps[0].metadata).toEqual({ command: 'quote', safe: 'visible' });
  });

  it('redacts API-key-like text from adapted output', () => {
    const adapted = adaptServerChatResponse({
      response: baseResponse({
        messages: [
          {
            role: 'assistant',
            text: 'Fetched quote with key sk-proj-secret1234567890 and token abc.',
            blocks: [
              { type: 'metric_grid', metrics: [{ label: 'Key', value: 'sk-proj-secret1234567890' }] },
            ],
          },
        ],
      }),
      language: 'en',
    });

    expect(adapted?.message.text).not.toContain('sk-proj-secret');
    expect(JSON.stringify(adapted)).not.toContain('sk-proj-secret');
  });
});
