import { callChatModelProvider as defaultCallChatModelProvider } from './modelProviderService.js';

const MAX_MESSAGE_LENGTH = 2000;
const MAX_STREAM_TEXT_LENGTH = 6000;
const STREAM_CHUNK_SIZE = 96;
const VALID_MODES = new Set(['auto', 'analysis']);
const SECRET_TEXT_PATTERNS = [
  /sk-[a-zA-Z0-9_-]{8,}/g,
  /AIza[a-zA-Z0-9_-]{20,}/g,
  /(?:api[_-]?key|token|secret|password)\s*[:=]\s*[^\s,;]+/gi,
  /Bearer\s+[a-zA-Z0-9._-]+/g,
];

const safeText = (value, maxLength = MAX_MESSAGE_LENGTH) => {
  if (typeof value !== 'string') return '';
  return SECRET_TEXT_PATTERNS
    .reduce((text, pattern) => text.replace(pattern, '[redacted]'), value)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const normalizeLanguage = (value) => (value === 'zh' ? 'zh' : 'en');

const normalizeMode = (value) => (VALID_MODES.has(value) ? value : 'auto');

const chunkText = (text, size = STREAM_CHUNK_SIZE) => {
  const chunks = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [''];
};

const createEvent = (event, data) => ({ event, data });

export const formatSseEvent = ({ event, data }) => [
  `event: ${safeText(event, 80) || 'message'}`,
  `data: ${JSON.stringify(data ?? {})}`,
  '',
].join('\n');

export async function buildServerChatSseEvents(body, deps = {}) {
  const source = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const message = safeText(source.message);
  const language = normalizeLanguage(source.language);
  const mode = normalizeMode(source.mode);

  if (!message) {
    return [createEvent('error', { error: 'missing_message' })];
  }

  if (mode === 'command' || message.startsWith('/')) {
    return [createEvent('error', { error: 'streaming_command_mode_not_supported' })];
  }

  const callChatModelProvider = deps.callChatModelProvider || defaultCallChatModelProvider;
  const providerResult = await callChatModelProvider({
    purpose: mode === 'analysis' ? 'analysis' : 'general_chat',
    message,
    language,
    selectedTicker: safeText(source.selectedTicker, 16).replace(/^\$/, '').toUpperCase() || undefined,
    clientContext: source.clientContext && typeof source.clientContext === 'object' && !Array.isArray(source.clientContext)
      ? source.clientContext
      : undefined,
    preferredProvider: 'auto',
  }, deps.providerDeps || {});

  const text = safeText(providerResult?.text, MAX_STREAM_TEXT_LENGTH);
  const warnings = Array.isArray(providerResult?.warnings)
    ? providerResult.warnings.map((warning) => safeText(warning, 120)).filter(Boolean).slice(0, 6)
    : [];
  const provider = safeText(providerResult?.provider, 40) || 'none';
  const model = safeText(providerResult?.model, 80) || undefined;

  return [
    createEvent('message.start', {
      provider,
      ...(model ? { model } : {}),
      warnings,
    }),
    ...chunkText(text).map((chunk) => createEvent('message.delta', { text: chunk })),
    createEvent('message.done', {
      provider,
      ...(model ? { model } : {}),
      warnings,
    }),
  ];
}
