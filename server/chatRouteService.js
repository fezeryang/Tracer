import { callChatModelProvider as defaultCallChatModelProvider } from './modelProviderService.js';
import { executeBackendChatTool as defaultExecuteBackendChatTool } from './chatToolExecutorService.js';
import {
  getServerChatSessionContext,
  mergeClientContextWithSession,
  resolveServerChatConversationId,
  updateServerChatSessionContext,
} from './chatSessionContextService.js';

const VALID_MODES = new Set(['auto', 'command', 'analysis']);
const MAX_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_TEXT_LENGTH = 120;
const MAX_CONTEXT_NOTES = 3;

const nowIso = () => new Date().toISOString();

const isPlainObject = (value) => (
  value !== null
  && typeof value === 'object'
  && !Array.isArray(value)
);

const safeText = (value, maxLength = MAX_MESSAGE_LENGTH) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const normalizeLanguage = (value) => (value === 'zh' ? 'zh' : 'en');

const normalizeMode = (value) => (VALID_MODES.has(value) ? value : 'auto');

const normalizeTicker = (value) => {
  const text = safeText(value, 16).replace(/^\$/, '').toUpperCase();
  return text || undefined;
};

const createServerChatTrace = ({ message, mode, warning, language }) => {
  const timestamp = nowIso();
  return {
    id: `server-chat-${Date.now()}`,
    steps: [
      {
        id: 'server-chat-user-input',
        type: 'user_input',
        label: 'user_input',
        status: message ? 'success' : 'error',
        startedAt: timestamp,
        endedAt: timestamp,
      },
      {
        id: 'server-chat-route',
        type: 'model_route',
        label: 'POST /api/chat',
        status: 'success',
        startedAt: timestamp,
        endedAt: timestamp,
        metadata: { mode, language },
      },
      {
        id: 'server-chat-fallback',
        type: 'fallback',
        label: warning || 'server_chat_completed',
        status: warning ? 'warning' : 'success',
        startedAt: timestamp,
        endedAt: timestamp,
      },
    ],
    evidenceItems: [],
    dataQualityNotes: warning ? [warning] : [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const createAssistantMessage = ({ text, provider = 'none', model }) => ({
  id: `server-chat-message-${Date.now()}`,
  role: 'assistant',
  text,
  provider,
  ...(model ? { model } : {}),
  createdAt: nowIso(),
});

const buildSafeContextUpdate = (clientContext) => {
  if (!isPlainObject(clientContext)) return undefined;

  const contextUpdate = {};
  const currentTicker = normalizeTicker(clientContext.currentTicker);
  const lastCommand = safeText(clientContext.lastCommand, MAX_CONTEXT_TEXT_LENGTH);
  const lastIntent = safeText(clientContext.lastIntent, MAX_CONTEXT_TEXT_LENGTH);

  if (currentTicker) contextUpdate.currentTicker = currentTicker;
  if (lastCommand) contextUpdate.lastCommand = lastCommand;
  if (lastIntent) contextUpdate.lastIntent = lastIntent;

  if (Array.isArray(clientContext.lastDataQualityNotes)) {
    const notes = clientContext.lastDataQualityNotes
      .map((item) => safeText(item, MAX_CONTEXT_TEXT_LENGTH))
      .filter(Boolean)
      .slice(0, MAX_CONTEXT_NOTES);
    if (notes.length > 0) contextUpdate.lastDataQualityNotes = notes;
  }

  return Object.keys(contextUpdate).length > 0 ? contextUpdate : undefined;
};

export function validateChatRequest(body) {
  const source = isPlainObject(body) ? body : {};
  const message = safeText(source.message);
  const language = normalizeLanguage(source.language);
  const mode = normalizeMode(source.mode);

  if (!message) {
    return {
      ok: false,
      error: 'missing_message',
      value: {
        message: '',
        language,
        mode,
      },
    };
  }

  return {
    ok: true,
    value: {
      clientMessageId: safeText(source.clientMessageId, MAX_CONTEXT_TEXT_LENGTH) || undefined,
      conversationId: safeText(source.conversationId, MAX_CONTEXT_TEXT_LENGTH) || undefined,
      message,
      language,
      selectedTicker: normalizeTicker(source.selectedTicker),
      clientContext: isPlainObject(source.clientContext) ? source.clientContext : undefined,
      mode,
    },
  };
}

export async function handleServerChat(body, deps = {}) {
  const validation = validateChatRequest(body);

  if (!validation.ok) {
    return {
      ok: false,
      messages: [],
      trace: createServerChatTrace({
        message: '',
        mode: validation.value.mode,
        language: validation.value.language,
        warning: 'missing_message',
      }),
      warnings: ['missing_message'],
      error: validation.error,
    };
  }

  const input = validation.value;
  const conversationId = resolveServerChatConversationId(input.conversationId);
  const sessionDeps = deps.sessionDeps || {};
  const sessionContext = getServerChatSessionContext(conversationId, sessionDeps);
  const mergedClientContext = mergeClientContextWithSession(input.clientContext, sessionContext);
  const isCommand = input.mode === 'command' || (input.mode === 'auto' && input.message.startsWith('/'));

  if (isCommand) {
    const executeBackendChatTool = deps.executeBackendChatTool || defaultExecuteBackendChatTool;
    const commandResult = await executeBackendChatTool({
      message: input.message,
      language: input.language,
      selectedTicker: input.selectedTicker,
      clientContext: mergedClientContext,
    }, deps.executorDeps || {});
    const modelRoute = {
      provider: 'local',
      model: 'backend-tool-executor',
      role: 'command_executor',
      reason: commandResult.ok ? 'backend_tool_executor' : (commandResult.error || 'backend_tool_executor_error'),
      requiresApiKey: false,
    };
    const contextUpdate = commandResult.contextUpdate || buildSafeContextUpdate(mergedClientContext);

    updateServerChatSessionContext(conversationId, {
      clientContext: mergedClientContext,
      contextUpdate,
      modelRoute,
    }, sessionDeps);

    return {
      ok: Boolean(commandResult.ok),
      conversationId,
      messages: commandResult.message ? [commandResult.message] : [],
      trace: commandResult.trace || createServerChatTrace({
        message: input.message,
        mode: input.mode,
        language: input.language,
        warning: commandResult.error || commandResult.warnings?.[0] || 'backend_tool_executor',
      }),
      contextUpdate,
      evidenceItems: Array.isArray(commandResult.evidenceItems) ? commandResult.evidenceItems : [],
      modelRoute,
      warnings: Array.isArray(commandResult.warnings) ? commandResult.warnings : [],
      ...(commandResult.error ? { error: commandResult.error } : {}),
    };
  }

  const callChatModelProvider = deps.callChatModelProvider || defaultCallChatModelProvider;
  const providerResult = await callChatModelProvider({
    purpose: input.mode === 'analysis' ? 'analysis' : 'general_chat',
    message: input.message,
    language: input.language,
    selectedTicker: input.selectedTicker,
    clientContext: mergedClientContext,
    preferredProvider: 'auto',
  }, deps.providerDeps || {});

  const warnings = Array.isArray(providerResult.warnings) ? providerResult.warnings : [];
  const warning = warnings[0] || (providerResult.ok ? 'server_model_provider' : 'model_provider_not_connected');

  const modelRoute = {
    provider: providerResult.provider || 'none',
    ...(providerResult.model ? { model: providerResult.model } : {}),
    role: 'answer_composer',
    reason: providerResult.ok ? 'server_model_provider' : warning,
    requiresApiKey: providerResult.provider !== 'none',
    ...(Number.isFinite(providerResult.latencyMs) ? { latencyMs: providerResult.latencyMs } : {}),
  };
  const contextUpdate = buildSafeContextUpdate(mergedClientContext);

  updateServerChatSessionContext(conversationId, {
    clientContext: mergedClientContext,
    contextUpdate,
    modelRoute,
  }, sessionDeps);

  return {
    ok: true,
    conversationId,
    messages: [
      createAssistantMessage({
        text: providerResult.text,
        provider: providerResult.provider || 'none',
        model: providerResult.model,
      }),
    ],
    trace: createServerChatTrace({
      message: input.message,
      mode: input.mode,
      language: input.language,
      warning,
    }),
    contextUpdate,
    evidenceItems: [],
    modelRoute,
    warnings,
  };
}
