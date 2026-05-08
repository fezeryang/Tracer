import { DataSourceHealth, DataSourceStatus } from '../types';

export interface ClassifiedSourceError {
  status: DataSourceStatus;
  message: string;
  reason?: string;
}

export interface SafeSourceResult<T> {
  value: T | null;
  health: DataSourceHealth;
  error?: unknown;
}

const TIMEOUT_CODE = 'NUX_TIMEOUT';

export const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const error = new Error(`${label} timed out after ${ms}ms`);
      (error as Error & { code?: string; status?: number }).code = TIMEOUT_CODE;
      reject(error);
    }, ms);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

const getErrorText = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown data source error.';
  }
};

const getStatusCode = (error: unknown) => {
  const value = error as { status?: unknown; code?: unknown; response?: { status?: unknown } };
  const candidates = [value?.status, value?.response?.status, value?.code];
  for (const candidate of candidates) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return numeric;
  }
  return undefined;
};

const getErrorReason = (error: unknown) => {
  const reason = (error as { reason?: unknown })?.reason;
  return typeof reason === 'string' && reason.trim() ? reason : undefined;
};

export const classifyError = (error: unknown): ClassifiedSourceError => {
  const message = getErrorText(error);
  const statusCode = getStatusCode(error);
  const reason = getErrorReason(error);
  const normalized = message.toLowerCase();

  if ((error as { code?: string })?.code === TIMEOUT_CODE || normalized.includes('timeout') || normalized.includes('timed out')) {
    return { status: 'timeout', message, reason };
  }
  if (statusCode === 429 || normalized.includes('429') || normalized.includes('rate limit')) {
    return { status: 'rate_limited', message: 'Market data provider is rate limited. Please retry later.', reason };
  }
  if (statusCode === 401 || statusCode === 403 || normalized.includes('403') || normalized.includes('forbidden')) {
    return { status: 'forbidden', message, reason };
  }
  if (statusCode === 502 || statusCode === 503 || statusCode === 504 || normalized.includes('network')) {
    return { status: 'unavailable', message, reason };
  }

  return { status: 'error', message, reason };
};

export const buildDataSourceHealth = ({
  key,
  label,
  status,
  message,
  reason,
}: {
  key: string;
  label: string;
  status: DataSourceStatus;
  message?: string;
  reason?: string;
}): DataSourceHealth => ({
  key,
  label,
  status,
  message,
  reason,
  updatedAt: new Date().toISOString(),
});

export const safeResolveSource = async <T>({
  key,
  label,
  promise,
  timeoutMs,
  successStatus = 'success',
  getSuccessMessage,
  isUnavailableValue,
  getUnavailableMessage,
  getUnavailableReason,
}: {
  key: string;
  label: string;
  promise: Promise<T>;
  timeoutMs: number;
  successStatus?: DataSourceStatus;
  getSuccessMessage?: (value: T) => string | undefined;
  isUnavailableValue?: (value: T) => boolean;
  getUnavailableMessage?: (value: T) => string | undefined;
  getUnavailableReason?: (value: T) => string | undefined;
}): Promise<SafeSourceResult<T>> => {
  try {
    const value = await withTimeout(promise, timeoutMs, label);
    if (isUnavailableValue?.(value)) {
      return {
        value: null,
        health: buildDataSourceHealth({
          key,
          label,
          status: 'unavailable',
          message: getUnavailableMessage?.(value) || `${label} unavailable.`,
          reason: getUnavailableReason?.(value),
        }),
      };
    }

    return {
      value,
      health: buildDataSourceHealth({
        key,
        label,
        status: successStatus,
        message: getSuccessMessage?.(value),
      }),
    };
  } catch (error) {
    const classified = classifyError(error);
    return {
      value: null,
      error,
      health: buildDataSourceHealth({
        key,
        label,
        status: classified.status,
        message: classified.message,
        reason: classified.reason,
      }),
    };
  }
};
