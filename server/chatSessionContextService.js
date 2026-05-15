const DEFAULT_TTL_MS = 30 * 60 * 1000;
const MAX_CONTEXT_TEXT_LENGTH = 160;
const MAX_CONTEXT_ITEMS = 8;
const MAX_CONTEXT_NOTES = 3;
const MAX_OBJECT_DEPTH = 4;
const FORBIDDEN_KEY_PATTERN = /stack|raw|secret|token|api[_-]?key|password|authorization|bearer|cookie|provider[_-]?response|response[_-]?body|body/i;

const DEFAULT_SESSION_STORE = new Map();

const nowMs = () => Date.now();

const safeText = (value, maxLength = MAX_CONTEXT_TEXT_LENGTH) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
);

const normalizeTicker = (value) => {
  const text = safeText(value, 16).replace(/^\$/, '').toUpperCase();
  return text || undefined;
};

const sanitizeArray = (value, mapper = (item) => safeText(item), limit = MAX_CONTEXT_ITEMS) => (
  Array.isArray(value)
    ? value.map(mapper).filter(Boolean).slice(0, limit)
    : undefined
);

const sanitizeValue = (value, depth = MAX_OBJECT_DEPTH) => {
  if (typeof value === 'string') return safeText(value, 500);
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean' || value === null) return value;
  if (depth <= 0) return undefined;

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_CONTEXT_ITEMS)
      .map((item) => sanitizeValue(item, depth - 1))
      .filter((item) => item !== undefined);
    return items.length > 0 ? items : undefined;
  }

  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .filter(([key]) => !FORBIDDEN_KEY_PATTERN.test(key))
      .map(([key, item]) => [
        safeText(key, 80),
        sanitizeValue(item, depth - 1),
      ])
      .filter(([key, item]) => key && item !== undefined);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }

  return undefined;
};

const sanitizeClientContext = (clientContext) => {
  if (!isPlainObject(clientContext)) return {};

  const next = {};
  const currentTicker = normalizeTicker(clientContext.currentTicker);
  const lastCommand = safeText(clientContext.lastCommand);
  const lastIntent = safeText(clientContext.lastIntent);
  const lastDataQualityNotes = sanitizeArray(clientContext.lastDataQualityNotes, (item) => safeText(item), MAX_CONTEXT_NOTES);

  if (currentTicker) next.currentTicker = currentTicker;
  if (lastCommand) next.lastCommand = lastCommand;
  if (lastIntent) next.lastIntent = lastIntent;
  if (lastDataQualityNotes?.length) next.lastDataQualityNotes = lastDataQualityNotes;

  return next;
};

const sanitizeContextUpdate = (contextUpdate) => {
  if (!isPlainObject(contextUpdate)) return {};

  const next = {};
  const currentTicker = normalizeTicker(contextUpdate.currentTicker);
  const lastCommand = safeText(contextUpdate.lastCommand);
  const lastIntent = safeText(contextUpdate.lastIntent);
  const lastDataQualityNotes = sanitizeArray(contextUpdate.lastDataQualityNotes, (item) => safeText(item), MAX_CONTEXT_NOTES);
  const lastEvidenceBundle = sanitizeValue(contextUpdate.lastEvidenceBundle);
  const lastSourceTrust = sanitizeValue(contextUpdate.lastSourceTrust);

  if (currentTicker) next.currentTicker = currentTicker;
  if (lastCommand) next.lastCommand = lastCommand;
  if (lastIntent) next.lastIntent = lastIntent;
  if (lastDataQualityNotes?.length) next.lastDataQualityNotes = lastDataQualityNotes;
  if (lastEvidenceBundle !== undefined) next.lastEvidenceBundle = lastEvidenceBundle;
  if (lastSourceTrust !== undefined) next.lastSourceTrust = lastSourceTrust;

  return next;
};

const sanitizeModelRoute = (modelRoute) => {
  if (!isPlainObject(modelRoute)) return undefined;

  const next = {};
  const provider = safeText(modelRoute.provider, 40);
  const model = safeText(modelRoute.model, 80);
  const role = safeText(modelRoute.role, 80);
  const reason = safeText(modelRoute.reason, 160);

  if (provider) next.provider = provider;
  if (model) next.model = model;
  if (role) next.role = role;
  if (reason) next.reason = reason;
  if (typeof modelRoute.requiresApiKey === 'boolean') next.requiresApiKey = modelRoute.requiresApiKey;

  return Object.keys(next).length > 0 ? next : undefined;
};

const sessionStoreFromOptions = (options = {}) => options.store || DEFAULT_SESSION_STORE;
const sessionNowFromOptions = (options = {}) => (
  typeof options.nowMs === 'function' ? options.nowMs() : nowMs()
);

export const createServerChatSessionStore = () => new Map();

export const resolveServerChatConversationId = (value) => {
  const candidate = safeText(value, 120);
  if (candidate && /^[A-Za-z0-9._:-]+$/.test(candidate)) return candidate;
  return `chat-session-${nowMs()}-${Math.random().toString(36).slice(2, 8)}`;
};

export const getServerChatSessionContext = (conversationId, options = {}) => {
  const id = safeText(conversationId, 120);
  if (!id) return undefined;

  const store = sessionStoreFromOptions(options);
  const entry = store.get(id);
  if (!entry) return undefined;

  if (Number.isFinite(entry.expiresAt) && entry.expiresAt <= sessionNowFromOptions(options)) {
    store.delete(id);
    return undefined;
  }

  return isPlainObject(entry.context) ? { ...entry.context } : undefined;
};

export const updateServerChatSessionContext = (conversationId, input = {}, options = {}) => {
  const id = safeText(conversationId, 120);
  if (!id) return {};

  const store = sessionStoreFromOptions(options);
  const current = getServerChatSessionContext(id, options) || {};
  const modelRoute = sanitizeModelRoute(input.modelRoute);
  const next = {
    ...current,
    ...sanitizeClientContext(input.clientContext),
    ...sanitizeContextUpdate(input.contextUpdate),
    ...(modelRoute ? { lastModelRoute: modelRoute } : {}),
  };

  const ttlMs = Number.isFinite(Number(options.ttlMs)) ? Number(options.ttlMs) : DEFAULT_TTL_MS;
  store.set(id, {
    context: next,
    expiresAt: sessionNowFromOptions(options) + Math.max(1, ttlMs),
  });

  return { ...next };
};

export const mergeClientContextWithSession = (clientContext, sessionContext) => {
  const safeSession = isPlainObject(sessionContext) ? sanitizeClientContext(sessionContext) : {};
  const safeClient = isPlainObject(clientContext) ? sanitizeClientContext(clientContext) : {};
  const merged = { ...safeSession, ...safeClient };
  return Object.keys(merged).length > 0 ? merged : undefined;
};
