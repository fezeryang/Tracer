import { StockAnalysisReport } from '../types';

const LAST_REPORT_KEY = 'nux:lastReport';
const SELECTED_TICKER_KEY = 'nux:selectedTicker';

const canUseSessionStorage = () => typeof window !== 'undefined' && Boolean(window.sessionStorage);

const safeParseReport = (raw: string | null): StockAnalysisReport | null => {
  if (!raw) return null;

  try {
    const value = JSON.parse(raw) as StockAnalysisReport;
    if (!value || typeof value !== 'object' || typeof value.ticker !== 'string') return null;

    return {
      ...value,
      isCached: true,
      cachedAt: value.cachedAt || value.generatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

export const saveCachedReport = (report: StockAnalysisReport) => {
  if (!canUseSessionStorage()) return;

  const cachedAt = new Date().toISOString();
  const cacheableReport: StockAnalysisReport = {
    ...report,
    isCached: true,
    cachedAt,
  };

  try {
    window.sessionStorage.setItem(LAST_REPORT_KEY, JSON.stringify(cacheableReport));
  } catch {
    // Ignore quota and storage access failures.
  }
};

export const loadCachedReport = (): StockAnalysisReport | null => {
  if (!canUseSessionStorage()) return null;

  try {
    return safeParseReport(window.sessionStorage.getItem(LAST_REPORT_KEY));
  } catch {
    return null;
  }
};

export const clearCachedReport = () => {
  if (!canUseSessionStorage()) return;

  try {
    window.sessionStorage.removeItem(LAST_REPORT_KEY);
  } catch {
    // Ignore storage access failures.
  }
};

export const saveSelectedTicker = (ticker: string) => {
  if (!canUseSessionStorage()) return;

  const normalized = ticker.trim().toUpperCase();
  if (!normalized) return;

  try {
    window.sessionStorage.setItem(SELECTED_TICKER_KEY, normalized);
  } catch {
    // Ignore storage access failures.
  }
};

export const loadSelectedTicker = () => {
  if (!canUseSessionStorage()) return null;

  try {
    const value = window.sessionStorage.getItem(SELECTED_TICKER_KEY);
    return value ? value.trim().toUpperCase() : null;
  } catch {
    return null;
  }
};
