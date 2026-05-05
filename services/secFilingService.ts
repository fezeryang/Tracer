import { SecFilingVerification } from '../types';

const normalizeTicker = (ticker: string) => ticker.trim().toUpperCase();

const buildUnavailableResult = (ticker: string, error?: string): SecFilingVerification => ({
  ticker,
  generatedAt: new Date().toISOString(),
  filings: [],
  formsIncluded: [],
  status: 'unavailable',
  error,
  notes: ['SEC EDGAR filings are currently unavailable.'],
});

export const fetchSecFilingsForTicker = async (tickerInput: string): Promise<SecFilingVerification> => {
  const ticker = normalizeTicker(tickerInput);
  if (!ticker) return buildUnavailableResult(ticker, 'Ticker is required.');

  try {
    const response = await fetch(`/api/sec/filings/${encodeURIComponent(ticker)}`);
    if (!response.ok) {
      return buildUnavailableResult(ticker, `SEC request failed with status ${response.status}.`);
    }

    return (await response.json()) as SecFilingVerification;
  } catch (error) {
    return buildUnavailableResult(ticker, error instanceof Error ? error.message : 'Unknown SEC request error.');
  }
};
