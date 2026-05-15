import { describe, expect, it, vi } from 'vitest';
import {
  fetchBackendQuote,
  fetchBackendNews,
  fetchBackendFundamentals,
  fetchBackendHistory,
  fetchBackendSecFilings,
  fetchBackendOfficialSources,
} from '../chatToolDataService.js';

describe('chatToolDataService', () => {
  it('wraps each backend fetch in a consistent result envelope', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ symbol: 'AAPL', source: 'Market Data' }),
    }));

    const quote = await fetchBackendQuote('AAPL', { fetchImpl, requestOrigin: 'http://localhost:3000' });
    const news = await fetchBackendNews('AAPL', { fetchImpl, requestOrigin: 'http://localhost:3000' });
    const fundamentals = await fetchBackendFundamentals('AAPL', { fetchImpl, requestOrigin: 'http://localhost:3000' });
    const history = await fetchBackendHistory('AAPL', { fetchImpl, requestOrigin: 'http://localhost:3000' });
    const sec = await fetchBackendSecFilings('AAPL', {
      getSecFilingsForTicker: vi.fn(async () => ({ ticker: 'AAPL', status: 'available', filings: [] })),
    });
    const official = await fetchBackendOfficialSources('AAPL', {
      getOfficialSourcesForTicker: vi.fn(async () => ({ ticker: 'AAPL', status: 'available', sources: [] })),
    });

    for (const result of [quote, news, fundamentals, history, sec, official]) {
      expect(result).toHaveProperty('ok');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('dataQuality');
      expect(result).toHaveProperty('latencyMs');
    }
  });

  it('returns ok=false without leaking raw stacks or provider payloads', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 503,
      json: async () => ({ error: 'provider stack with apiKey=secret-value' }),
    }));

    const result = await fetchBackendQuote('AAPL', {
      fetchImpl,
      requestOrigin: 'http://localhost:3000',
    });

    expect(result.ok).toBe(false);
    expect(result.warning).toBe('backend_quote_unavailable');
    expect(result.error).toBe('backend_quote_unavailable');
    expect(JSON.stringify(result)).not.toContain('secret-value');
    expect(JSON.stringify(result)).not.toMatch(/stack|apiKey/i);
  });

  it('converts backend wrapper failures into safe unavailable envelopes', async () => {
    const failingFetch = vi.fn(async () => {
      throw new Error('raw stack with token=secret');
    });
    const throwingService = vi.fn(async () => {
      throw new Error('service exploded with token=secret');
    });

    const results = await Promise.all([
      fetchBackendQuote('AAPL', { fetchImpl: failingFetch }),
      fetchBackendNews('AAPL', { fetchImpl: failingFetch }),
      fetchBackendFundamentals('AAPL', { fetchImpl: failingFetch }),
      fetchBackendHistory('AAPL', { fetchImpl: failingFetch }),
      fetchBackendSecFilings('AAPL', { getSecFilingsForTicker: throwingService }),
      fetchBackendOfficialSources('AAPL', { getOfficialSourcesForTicker: throwingService }),
    ]);

    expect(results.every((result) => result.ok === false)).toBe(true);
    expect(results.map((result) => result.dataQuality)).toEqual(Array(6).fill('unavailable'));
    expect(JSON.stringify(results)).not.toContain('secret');
    expect(JSON.stringify(results)).not.toMatch(/stack|token/i);
  });

  it('uses injected service dependencies for SEC and official sources', async () => {
    const getSecFilingsForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'available',
      filings: [{ form: '10-K' }],
    }));
    const getOfficialSourcesForTicker = vi.fn(async () => ({
      ticker: 'AAPL',
      status: 'available',
      sources: [{ name: 'Apple Investor Relations' }],
    }));

    await expect(fetchBackendSecFilings('AAPL', { getSecFilingsForTicker })).resolves.toMatchObject({
      ok: true,
      source: 'sec_service',
    });
    await expect(fetchBackendOfficialSources('AAPL', { getOfficialSourcesForTicker })).resolves.toMatchObject({
      ok: true,
      source: 'official_source_service',
    });

    expect(getSecFilingsForTicker).toHaveBeenCalledWith('AAPL');
    expect(getOfficialSourcesForTicker).toHaveBeenCalledWith('AAPL');
  });
});
