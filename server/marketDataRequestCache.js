import axios from 'axios';

const cache = new Map();
const inFlight = new Map();
const queue = [];

const MAX_CONCURRENCY = 1;
const MIN_REQUEST_SPACING_MS = 300;
const ERROR_TTL_MS = 45 * 1000;

let activeCount = 0;
let lastStartedAt = 0;
let providerCooldown = null;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getStatusCode = (error) => Number(error?.response?.status || error?.status || error?.code);

const classifyMarketDataError = (error) => {
  const statusCode = getStatusCode(error);
  const message = String(error?.message || 'Market data provider unavailable.');
  const normalized = message.toLowerCase();

  if (statusCode === 429 || normalized.includes('429') || normalized.includes('rate limit')) {
    return {
      statusCode: 429,
      status: 'rate_limited',
      message: 'Market data provider is rate limited. Please retry later.',
    };
  }

  if (
    statusCode === 401 ||
    statusCode === 403 ||
    normalized.includes('403') ||
    normalized.includes('forbidden') ||
    normalized.includes('authorization') ||
    normalized.includes('invalid key')
  ) {
    return {
      statusCode: statusCode === 401 ? 401 : 403,
      status: 'forbidden',
      message: 'Market data provider authorization failed.',
    };
  }

  if (statusCode === 502 || statusCode === 503 || statusCode === 504 || normalized.includes('network')) {
    return {
      statusCode: 503,
      status: 'unavailable',
      message: 'Market data provider is temporarily unavailable.',
    };
  }

  return {
    statusCode: Number.isFinite(statusCode) ? statusCode : 500,
    status: 'error',
    message,
  };
};

const createClassifiedError = (classified) => {
  const error = new Error(classified.message);
  error.status = classified.statusCode;
  error.providerStatus = classified.status;
  return error;
};

const runNext = () => {
  if (activeCount >= MAX_CONCURRENCY || queue.length === 0) return;

  const item = queue.shift();
  activeCount += 1;

  void (async () => {
    const elapsed = Date.now() - lastStartedAt;
    if (elapsed < MIN_REQUEST_SPACING_MS) {
      await wait(MIN_REQUEST_SPACING_MS - elapsed);
    }
    lastStartedAt = Date.now();

    try {
      const value = await item.task();
      item.resolve(value);
    } catch (error) {
      item.reject(error);
    } finally {
      activeCount -= 1;
      runNext();
    }
  })();
};

const enqueueMarketDataRequest = (task) => new Promise((resolve, reject) => {
  queue.push({ task, resolve, reject });
  runNext();
});

const readCache = (cacheKey) => {
  const entry = cache.get(cacheKey);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(cacheKey);
    return null;
  }

  return entry;
};

export const cachedMarketDataGet = async ({ cacheKey, ttlMs, url, timeout }) => {
  const cached = readCache(cacheKey);
  if (cached?.error) throw createClassifiedError(cached.error);
  if (cached) return { data: cached.data, cached: true };

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  if (providerCooldown?.expiresAt > Date.now()) {
    throw createClassifiedError(providerCooldown.error);
  }
  if (providerCooldown) providerCooldown = null;

  const promise = enqueueMarketDataRequest(async () => {
    try {
      if (providerCooldown?.expiresAt > Date.now()) {
        throw createClassifiedError(providerCooldown.error);
      }
      if (providerCooldown) providerCooldown = null;

      const response = await axios.get(url, { timeout });
      cache.set(cacheKey, {
        data: response.data,
        expiresAt: Date.now() + ttlMs,
      });
      return { data: response.data, cached: false };
    } catch (error) {
      const classified = classifyMarketDataError(error);
      if (classified.status === 'rate_limited' || classified.status === 'forbidden') {
        cache.set(cacheKey, {
          error: classified,
          expiresAt: Date.now() + ERROR_TTL_MS,
        });
      }
      if (classified.status === 'rate_limited') {
        providerCooldown = {
          error: classified,
          expiresAt: Date.now() + ERROR_TTL_MS,
        };
      }
      throw createClassifiedError(classified);
    } finally {
      inFlight.delete(cacheKey);
    }
  });

  inFlight.set(cacheKey, promise);
  return promise;
};

export const sendMarketDataError = (res, error) => {
  res.json({
    error: error?.message || 'Market data provider unavailable.',
    status: error?.providerStatus || 'error',
  });
};
