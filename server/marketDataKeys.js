export const getPolygonCompatibleKey = () => process.env.MASSIVE_API_KEY || process.env.POLYGON_KEY || '';

export const getPolygonCompatibleBaseUrl = () => {
  if (process.env.MASSIVE_API_KEY) {
    return process.env.MASSIVE_BASE_URL || 'https://api.massive.com';
  }
  return process.env.POLYGON_BASE_URL || 'https://api.polygon.io';
};

export const getPolygonCompatibleProviderName = () => (
  process.env.MASSIVE_API_KEY ? 'Massive.com' : 'Polygon.io'
);

export const withCacheSourceLabel = (source, cached) => (
  cached ? `${source} Cached` : source
);
