import { OfficialSourceVerification } from '../types';

const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase();

const buildErrorResult = (ticker: string, error?: string): OfficialSourceVerification => ({
  ticker,
  generatedAt: new Date().toISOString(),
  status: 'error',
  sources: [],
  notes: [error || 'Official source discovery is currently unavailable.'],
  mode: 'rule_only',
});

export const fetchOfficialSources = async (tickerInput: string): Promise<OfficialSourceVerification> => {
  const ticker = normalizeTicker(tickerInput);
  if (!ticker) return buildErrorResult(ticker, 'Ticker is required.');

  try {
    const response = await fetch(`/api/official-sources/${encodeURIComponent(ticker)}`);
    if (!response.ok) {
      return buildErrorResult(ticker, `Official source request failed with status ${response.status}.`);
    }

    return (await response.json()) as OfficialSourceVerification;
  } catch (error) {
    return buildErrorResult(ticker, error instanceof Error ? error.message : 'Unknown official source request error.');
  }
};
