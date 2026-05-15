import { describe, expect, it, vi } from 'vitest';
import {
  executeBackendChatTool,
  parseBackendCommand,
  safeLimitArray,
} from '../chatToolExecutorService.js';

describe('chatToolExecutorService', () => {
  it('parses /quote AAPL and uppercases ticker', () => {
    expect(parseBackendCommand('/quote aapl')).toEqual({
      command: 'quote',
      args: ['aapl'],
      ticker: 'AAPL',
    });
  });

  it('returns null for non-slash text', () => {
    expect(parseBackendCommand('quote AAPL')).toBeNull();
  });

  it('limits evidence arrays safely', () => {
    expect(safeLimitArray(Array.from({ length: 12 }, (_, index) => index), 8)).toHaveLength(8);
    expect(safeLimitArray('bad-input')).toEqual([]);
  });

  it('returns missing ticker error for ticker commands without args or context', async () => {
    const result = await executeBackendChatTool({
      message: '/quote',
      language: 'en',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing_backend_command_ticker');
    expect(result.warnings).toContain('missing_backend_command_ticker');
  });

  it('returns unsupported command for commands outside the allowlist', async () => {
    const fetchImpl = vi.fn();
    const result = await executeBackendChatTool({
      message: '/backtest AAPL',
      language: 'en',
    }, { fetchImpl });

    expect(result.ok).toBe(true);
    expect(result.error).toBe('unsupported_backend_command');
    expect(result.warnings).toContain('unsupported_backend_command');
    expect(result.text).not.toMatch(/migrated|frontend|D-\d/i);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns help text for /help', async () => {
    const result = await executeBackendChatTool({
      message: '/help',
      language: 'zh',
    });

    expect(result.ok).toBe(true);
    expect(result.command).toBe('help');
    expect(result.message).toMatchObject({
      role: 'assistant',
      provider: 'local',
      model: 'backend-tool-executor',
    });
    expect(result.text).toContain('/quote');
    expect(result.text).not.toMatch(/D-\d|backend tool executor|迁移/i);
    expect(result.warnings).toEqual([]);
  });

  it('returns quote message, blocks, and evidence from mocked data', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        symbol: 'AAPL',
        price: 189.12,
        previousClose: 187.5,
        change: 1.62,
        changePercent: 0.864,
        source: 'Yahoo Finance (Fallback)',
        apiKey: 'secret',
      }),
    }));

    const result = await executeBackendChatTool({
      message: '/quote AAPL',
      language: 'en',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
    expect(result.command).toBe('quote');
    expect(result.message).toMatchObject({
      role: 'assistant',
      provider: 'local',
      model: 'backend-tool-executor',
    });
    expect(result.blocks?.map((block) => block.type)).toEqual(['metric_grid', 'evidence_list']);
    expect(result.evidenceItems?.[0]).toMatchObject({
      type: 'quote',
      title: 'AAPL Quote',
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('uses selectedTicker fallback when command args omit ticker', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ([]),
    }));

    const result = await executeBackendChatTool({
      message: '/news',
      language: 'en',
      selectedTicker: 'msft',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
    });

    expect(result.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:3000/api/news/MSFT');
    expect(result.command).toBe('news');
    expect(result.ticker).toBe('MSFT');
  });

  it('returns a chart block for /history with mocked history data', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        symbol: 'AAPL',
        source: 'Market Data',
        historical: [
          { date: '2026-05-10', close: 182.12 },
          { date: '2026-05-11', close: 183.45 },
          { date: '2026-05-12', close: 184.91 },
        ],
      }),
    }));

    const result = await executeBackendChatTool({
      message: '/history aapl',
      language: 'zh',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
    });

    expect(result.ok).toBe(true);
    expect(result.blocks?.[0]).toMatchObject({
      type: 'chart',
      validationStatus: 'valid',
    });
    expect(result.trace).toMatchObject({
      command: 'history',
      ticker: 'AAPL',
    });
  });

  it('returns SEC table and evidence items with source labels', async () => {
    const getSecFilingsForTicker = vi.fn(async () => ({
      filings: [
        {
          form: '10-K',
          filingDate: '2026-02-01',
          description: 'Annual report',
          primaryDocument: 'aapl10k.htm',
          url: 'https://www.sec.gov/aapl-10k',
        },
      ],
    }));

    const result = await executeBackendChatTool({
      message: '/sec AAPL',
      language: 'en',
    }, {
      getSecFilingsForTicker,
    });

    expect(getSecFilingsForTicker).toHaveBeenCalledWith('AAPL');
    expect(result.ok).toBe(true);
    expect(result.blocks?.map((block) => block.type)).toEqual(['data_table', 'evidence_list']);
    expect(result.evidenceItems?.[0]).toMatchObject({
      type: 'sec_filing',
      source: 'SEC EDGAR',
    });
  });

  it('limits evidence items to 8 for SEC payloads', async () => {
    const getSecFilingsForTicker = vi.fn(async () => ({
      filings: Array.from({ length: 12 }, (_, index) => ({
        form: '8-K',
        filingDate: `2026-02-${String(index + 1).padStart(2, '0')}`,
        description: `Filing ${index + 1}`,
        url: `https://www.sec.gov/${index + 1}`,
      })),
    }));

    const result = await executeBackendChatTool({
      message: '/sec AAPL',
      language: 'en',
    }, {
      getSecFilingsForTicker,
    });

    expect(result.evidenceItems).toHaveLength(8);
  });

  it('returns a friendly failure when internal fetch fails', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'backend exploded with key=secret' }),
    }));

    const result = await executeBackendChatTool({
      message: '/fundamentals AAPL',
      language: 'en',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('backend_tool_fetch_failed');
    expect(result.text).toContain('Please try again later');
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  it('returns source trust blocks for /trust with mocked evidence inputs', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/api/news/AAPL')) {
        return {
          ok: true,
          json: async () => ([
            {
              title: 'Apple announces new device roadmap',
              site: 'Reuters',
              text: 'Apple shared product updates with investors.',
              url: 'https://example.com/reuters-apple',
              publishedDate: '2026-05-12T12:00:00.000Z',
              sentiment: 'Positive',
              sentimentScore: 0.6,
            },
          ]),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const getSecFilingsForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'available',
      filings: [
        {
          form: '10-K',
          filingDate: '2026-02-01',
          description: 'Annual report',
          url: 'https://www.sec.gov/aapl-10k',
        },
      ],
      notes: [],
    }));
    const getOfficialSourcesForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'available',
      mode: 'rule_only',
      sources: [
        {
          name: 'Apple Investor Relations',
          type: 'investor_relations',
          url: 'https://investor.apple.com',
          authorityScore: 92,
          notes: [],
        },
      ],
      notes: [],
    }));

    const result = await executeBackendChatTool({
      message: '/trust AAPL',
      language: 'en',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
      getSecFilingsForTicker,
      getOfficialSourcesForTicker,
    });

    expect(result.ok).toBe(true);
    expect(result.command).toBe('trust');
    expect(result.blocks?.some((block) => block.type === 'source_trust')).toBe(true);
    expect(result.blocks?.some((block) => block.type === 'metric_grid')).toBe(true);
    expect(result.evidenceItems?.some((item) => item.type === 'source_trust')).toBe(true);
    expect(result.contextUpdate).toMatchObject({
      currentTicker: 'AAPL',
      lastCommand: '/trust AAPL',
      lastIntent: 'trust',
    });
    const traceSteps = Array.isArray((result.trace as { steps?: Array<{ label?: string }> } | undefined)?.steps)
      ? (result.trace as { steps: Array<{ label?: string }> }).steps
      : [];
    expect(traceSteps.map((step) => step.label)).toContain('backend_source_trust');
  });

  it('returns friendly warning for /trust when trust signals are unavailable', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ([]),
    }));
    const getSecFilingsForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'error',
      filings: [],
      notes: ['SEC unavailable'],
    }));
    const getOfficialSourcesForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'error',
      mode: 'rule_only',
      sources: [],
      notes: ['Official unavailable'],
    }));

    const result = await executeBackendChatTool({
      message: '/trust AAPL',
      language: 'en',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
      getSecFilingsForTicker,
      getOfficialSourcesForTicker,
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('source_trust_unavailable');
    expect(result.text).toContain('source trust');
    expect(JSON.stringify(result)).not.toContain('Official unavailable');
  });

  it('returns evidence bundle blocks and caps evidence items at 8', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/api/quote/AAPL')) {
        return {
          ok: true,
          json: async () => ({
            symbol: 'AAPL',
            price: 189.12,
            previousClose: 187.5,
            change: 1.62,
            changePercent: 0.864,
            source: 'Yahoo Finance (Fallback)',
            apiKey: 'secret',
          }),
        };
      }

      if (url.endsWith('/api/news/AAPL')) {
        return {
          ok: true,
          json: async () => ([
            {
              title: 'Apple expands AI tooling',
              site: 'Reuters',
              text: 'Investors reviewed the latest AI product roadmap.',
              url: 'https://example.com/reuters-ai',
              publishedDate: '2026-05-12T12:00:00.000Z',
              sentiment: 'Positive',
              sentimentScore: 0.8,
            },
            {
              title: 'Apple expands AI tooling',
              site: 'MarketWatch',
              text: 'Cross-source coverage confirms the event summary.',
              url: 'https://example.com/mw-ai',
              publishedDate: '2026-05-12T12:05:00.000Z',
              sentiment: 'Positive',
              sentimentScore: 0.5,
            },
            {
              title: 'Apple services revenue remains in focus',
              site: 'CNBC',
              text: 'Analysts reviewed services mix and margins.',
              url: 'https://example.com/cnbc-services',
              publishedDate: '2026-05-11T10:00:00.000Z',
              sentiment: 'Neutral',
              sentimentScore: 0.1,
            },
          ]),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const getSecFilingsForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      cik: '0000320193',
      status: 'available',
      filings: Array.from({ length: 4 }, (_, index) => ({
        form: index % 2 === 0 ? '10-Q' : '8-K',
        filingDate: `2026-04-0${index + 1}`,
        description: `SEC filing ${index + 1}`,
        url: `https://www.sec.gov/${index + 1}`,
      })),
      notes: [],
    }));
    const getOfficialSourcesForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'available',
      mode: 'rule_only',
      sources: [
        {
          name: 'Apple Investor Relations',
          type: 'investor_relations',
          url: 'https://investor.apple.com',
          authorityScore: 92,
          notes: [],
        },
        {
          name: 'Apple Newsroom',
          type: 'newsroom',
          url: 'https://www.apple.com/newsroom',
          authorityScore: 88,
          notes: [],
        },
      ],
      notes: [],
    }));

    const result = await executeBackendChatTool({
      message: '/evidence AAPL',
      language: 'en',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
      getSecFilingsForTicker,
      getOfficialSourcesForTicker,
    });

    expect(result.ok).toBe(true);
    expect(result.command).toBe('evidence');
    expect(result.blocks?.some((block) => block.type === 'evidence_list')).toBe(true);
    expect(result.blocks?.some((block) => block.type === 'source_trust')).toBe(true);
    expect(result.blocks?.some((block) => block.type === 'data_table')).toBe(true);
    expect(result.evidenceItems && result.evidenceItems.length).toBeLessThanOrEqual(8);
    expect(result.contextUpdate).toMatchObject({
      currentTicker: 'AAPL',
      lastCommand: '/evidence AAPL',
      lastIntent: 'evidence',
    });
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(result.text).not.toMatch(/\b(Buy|Sell|Hold)\b/);
  });

  it('returns partial evidence when some sources fail', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/api/quote/AAPL')) {
        return {
          ok: true,
          json: async () => ({
            symbol: 'AAPL',
            price: 189.12,
            previousClose: 187.5,
            change: 1.62,
            changePercent: 0.864,
            source: 'Market Data',
          }),
        };
      }

      if (url.endsWith('/api/news/AAPL')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'secret-provider-error' }),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const getSecFilingsForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'error',
      filings: [],
      notes: ['SEC unavailable'],
    }));
    const getOfficialSourcesForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'available',
      mode: 'rule_only',
      sources: [
        {
          name: 'Apple Investor Relations',
          type: 'investor_relations',
          url: 'https://investor.apple.com',
          authorityScore: 92,
          notes: [],
        },
      ],
      notes: [],
    }));

    const result = await executeBackendChatTool({
      message: '/evidence AAPL',
      language: 'en',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
      getSecFilingsForTicker,
      getOfficialSourcesForTicker,
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain('partial_evidence_unavailable');
    expect(result.blocks?.some((block) => block.type === 'evidence_list')).toBe(true);
    expect(result.evidenceItems?.some((item) => item.type === 'quote')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret-provider-error');
  });

  it('keeps /evidence alive when quote and source trust signals are limited', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/api/quote/ZZZZQ')) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: 'raw quote stack with apiKey=secret' }),
        };
      }

      if (url.endsWith('/api/news/ZZZZQ')) {
        return {
          ok: true,
          json: async () => ([]),
        };
      }

      throw new Error(`Unexpected URL: ${url}`);
    });
    const getSecFilingsForTicker = vi.fn(async () => ({
      ticker: 'ZZZZQ',
      status: 'error',
      filings: [],
      notes: ['raw SEC stack with apiKey=secret'],
    }));
    const getOfficialSourcesForTicker = vi.fn(async () => ({
      ticker: 'ZZZZQ',
      status: 'error',
      mode: 'rule_only',
      sources: [],
      notes: ['raw official stack with apiKey=secret'],
    }));

    const result = await executeBackendChatTool({
      message: '/evidence ZZZZQ',
      language: 'en',
    }, {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
      getSecFilingsForTicker,
      getOfficialSourcesForTicker,
    });

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual(expect.arrayContaining([
      'backend_quote_unavailable',
      'backend_news_unavailable',
      'backend_sec_unavailable',
      'backend_official_unavailable',
      'source_trust_unavailable',
      'partial_evidence_unavailable',
    ]));
    expect(result.blocks?.some((block) => block.type === 'data_quality' && block.dataQuality === 'limited')).toBe(true);
    const traceSteps = Array.isArray((result.trace as { steps?: Array<{ label?: string; status?: string }> } | undefined)?.steps)
      ? (result.trace as { steps: Array<{ label?: string; status?: string }> }).steps
      : [];
    expect(traceSteps.some((step) => step.label === 'backend_quote_fetch' && step.status === 'warning')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toMatch(/raw .*stack/i);
  });

  it('returns missing ticker error for /trust without args or context', async () => {
    const result = await executeBackendChatTool({
      message: '/trust',
      language: 'en',
    });

    expect(result.ok).toBe(false);
    expect(result.error).toBe('missing_backend_command_ticker');
  });
});
