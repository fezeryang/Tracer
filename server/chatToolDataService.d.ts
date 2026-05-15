export type BackendToolDataQuality =
  | 'available'
  | 'limited'
  | 'fallback'
  | 'simulation'
  | 'unavailable';

export interface BackendToolDataResult<T = unknown> {
  ok: boolean;
  data: T | null;
  warning?: string;
  error?: string;
  source?: string;
  dataQuality?: BackendToolDataQuality;
  latencyMs?: number;
}

export function fetchBackendQuote<T = unknown>(ticker: string, options?: Record<string, unknown>): Promise<BackendToolDataResult<T>>;
export function fetchBackendNews<T = unknown>(ticker: string, options?: Record<string, unknown>): Promise<BackendToolDataResult<T>>;
export function fetchBackendFundamentals<T = unknown>(ticker: string, options?: Record<string, unknown>): Promise<BackendToolDataResult<T>>;
export function fetchBackendHistory<T = unknown>(ticker: string, options?: Record<string, unknown>): Promise<BackendToolDataResult<T>>;
export function fetchBackendSecFilings<T = unknown>(ticker: string, options?: Record<string, unknown>): Promise<BackendToolDataResult<T>>;
export function fetchBackendOfficialSources<T = unknown>(ticker: string, options?: Record<string, unknown>): Promise<BackendToolDataResult<T>>;
