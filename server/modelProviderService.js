import {
  buildResearchOnlySystemPrompt,
  buildUnavailableModelMessage,
  scrubModelText,
} from './modelSafetyService.js';
import https from 'node:https';
import { HttpsProxyAgent } from 'https-proxy-agent';

const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_PROMPT_MESSAGE_LENGTH = 2000;
const MAX_CONTEXT_TEXT_LENGTH = 160;

const normalizeLanguage = (language) => (language === 'zh' ? 'zh' : 'en');

const normalizePreferredProvider = (value) => (
  value === 'gemini' || value === 'deepseek' || value === 'auto' ? value : 'auto'
);

const safeText = (value, maxLength = MAX_PROMPT_MESSAGE_LENGTH) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const getGeminiKeyStatus = (env) => {
  if (env.GEMINI_API_KEY) return { available: true, warning: null };
  if (env.GOOGLE_API_KEY) return { available: true, warning: null };
  if (env.VITE_GEMINI_API_KEY) return { available: true, warning: 'server_using_vite_key_fallback' };
  return { available: false, warning: null };
};

const getGeminiApiKey = (env) => (
  env.GEMINI_API_KEY || env.GOOGLE_API_KEY || env.VITE_GEMINI_API_KEY || ''
);

const getProxyUrl = (env) => (
  env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy || ''
);

const getDeepSeekKeyStatus = (env) => ({ available: Boolean(env.DEEPSEEK_API_KEY) });

const createProviderResult = ({
  ok,
  provider,
  model,
  text,
  warnings = [],
  error,
  latencyMs,
}) => ({
  ok,
  provider,
  ...(model ? { model } : {}),
  text,
  warnings,
  ...(error ? { error } : {}),
  ...(Number.isFinite(latencyMs) ? { latencyMs } : {}),
});

const uniqueWarnings = (warnings) => Array.from(new Set(warnings.filter(Boolean)));

const sanitizeProviderError = (provider, error) => {
  const message = error instanceof Error ? error.message : String(error || '');
  if (message.includes(`${provider}_timeout`)) return `${provider}_timeout`;
  if (message.includes(`${provider}_http_429`)) return `${provider}_rate_limited`;
  if (message.includes(`${provider}_http_`)) return `${provider}_http_error`;
  if (message.includes(`${provider}_invalid_json`)) return `${provider}_invalid_response`;
  return `${provider}_unavailable`;
};

export function selectServerChatProvider(input = {}, env = process.env) {
  const preferredProvider = normalizePreferredProvider(input.preferredProvider);
  const gemini = getGeminiKeyStatus(env);
  const deepseek = getDeepSeekKeyStatus(env);
  const geminiWarnings = gemini.warning ? [gemini.warning] : [];

  if (preferredProvider === 'gemini') {
    return gemini.available
      ? { provider: 'gemini', model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, warnings: geminiWarnings }
      : { provider: 'none', warnings: ['gemini_unavailable'] };
  }

  if (preferredProvider === 'deepseek') {
    return deepseek.available
      ? { provider: 'deepseek', model: env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL, warnings: [] }
      : { provider: 'none', warnings: ['deepseek_unavailable'] };
  }

  if (gemini.available) {
    return { provider: 'gemini', model: env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, warnings: geminiWarnings };
  }

  if (deepseek.available) {
    return { provider: 'deepseek', model: env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL, warnings: [] };
  }

  return { provider: 'none', warnings: [] };
}

const buildSafeContextSummary = (clientContext) => {
  if (!clientContext || typeof clientContext !== 'object' || Array.isArray(clientContext)) return '';

  const fields = [
    ['currentTicker', safeText(clientContext.currentTicker, 16)],
    ['lastCommand', safeText(clientContext.lastCommand, MAX_CONTEXT_TEXT_LENGTH)],
    ['lastIntent', safeText(clientContext.lastIntent, MAX_CONTEXT_TEXT_LENGTH)],
  ].filter(([, value]) => value);

  if (fields.length === 0) return '';
  return fields.map(([key, value]) => `${key}: ${value}`).join('\n');
};

const buildProviderPrompt = (input) => {
  const language = normalizeLanguage(input.language);
  const selectedTicker = safeText(input.selectedTicker, 16);
  const contextSummary = buildSafeContextSummary(input.clientContext);
  const sections = [
    buildResearchOnlySystemPrompt(language),
    language === 'zh'
      ? '用户请求：'
      : 'User request:',
    safeText(input.message),
  ];

  if (selectedTicker) {
    sections.push(language === 'zh' ? `当前股票代码：${selectedTicker}` : `Selected ticker: ${selectedTicker}`);
  }

  if (contextSummary) {
    sections.push(language === 'zh' ? `安全上下文摘要：\n${contextSummary}` : `Safe client context summary:\n${contextSummary}`);
  }

  sections.push(language === 'zh'
    ? '请直接回答概念或研究问题；如果需要实时行情或工具数据，请说明当前回答没有可用的实时工具结果。'
    : 'Answer the concept or research question directly; if live market data or tool results are needed, say that this answer does not have live tool results available.');

  return sections.join('\n\n');
};

const extractProviderText = (value) => {
  if (typeof value?.text === 'string') return value.text;
  if (typeof value?.response?.text === 'string') return value.response.text;
  if (Array.isArray(value?.candidates)) {
    const parts = value.candidates[0]?.content?.parts;
    const text = Array.isArray(parts)
      ? parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).filter(Boolean).join('\n').trim()
      : '';
    if (text) return text;
  }
  if (typeof value?.choices?.[0]?.message?.content === 'string') return value.choices[0].message.content;
  return '';
};

const withTimeout = async (promise, timeoutMs, errorCode) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const performHttpsJsonRequest = ({ url, body, timeoutMs, proxyUrl }) => new Promise((resolve, reject) => {
  const target = new URL(url);
  const request = https.request(target, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
    agent: proxyUrl ? new HttpsProxyAgent(proxyUrl) : undefined,
  }, (response) => {
    const chunks = [];
    response.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))));
    response.on('end', () => {
      const statusCode = response.statusCode || 500;
      const rawText = Buffer.concat(chunks).toString('utf8');
      if (statusCode < 200 || statusCode >= 300) {
        reject(new Error(`gemini_http_${statusCode}`));
        return;
      }

      try {
        resolve(JSON.parse(rawText));
      } catch {
        reject(new Error('gemini_invalid_json'));
      }
    });
  });

  request.on('error', (error) => reject(error));
  request.setTimeout(timeoutMs, () => {
    request.destroy(new Error('gemini_timeout'));
  });
  request.write(body);
  request.end();
});

const callGeminiProvider = async ({ input, route, env, GoogleGenAIClass }) => {
  const apiKey = getGeminiApiKey(env);
  if (!apiKey) {
    return { ok: false, error: 'gemini_unavailable', text: '', warnings: ['gemini_unavailable'] };
  }

  try {
    let response;
    if (GoogleGenAIClass) {
      const ai = new GoogleGenAIClass({ apiKey });
      response = await withTimeout(
        ai.models.generateContent({
          model: route.model,
          contents: buildProviderPrompt(input),
        }),
        input.timeoutMs || DEFAULT_TIMEOUT_MS,
        'gemini_timeout',
      );
    } else {
      const requestUrl = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(route.model)}:generateContent`);
      requestUrl.searchParams.set('key', apiKey);
      const body = JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: buildProviderPrompt(input) }],
          },
        ],
        generationConfig: {
          temperature: 0.2,
        },
      });

      response = await performHttpsJsonRequest({
        url: requestUrl.toString(),
        body,
        timeoutMs: input.timeoutMs || DEFAULT_TIMEOUT_MS,
        proxyUrl: getProxyUrl(env),
      });
    }

    return {
      ok: true,
      text: extractProviderText(response),
      warnings: [],
    };
  } catch (error) {
    const sanitizedError = sanitizeProviderError('gemini', error);
    return {
      ok: false,
      error: sanitizedError,
      text: '',
      warnings: [sanitizedError],
    };
  }
};

const callDeepSeekProvider = async ({ input, route, env, fetchImpl }) => {
  const apiKey = env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { ok: false, error: 'deepseek_unavailable', text: '', warnings: ['deepseek_unavailable'] };
  }

  try {
    const baseUrl = env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
    const response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: route.model,
        messages: [
          { role: 'system', content: buildResearchOnlySystemPrompt(input.language) },
          { role: 'user', content: buildProviderPrompt(input) },
        ],
        temperature: 0.2,
      }),
      signal: AbortSignal.timeout(input.timeoutMs || DEFAULT_TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`deepseek_http_${response.status || 500}`);
    }

    const data = await response.json();
    return {
      ok: true,
      text: extractProviderText(data),
      warnings: [],
    };
  } catch (error) {
    const sanitizedError = sanitizeProviderError('deepseek', error);
    return {
      ok: false,
      error: sanitizedError,
      text: '',
      warnings: [sanitizedError],
    };
  }
};

const buildUnavailableProviderResult = ({ provider, model, language, warnings, error, startedAt }) => createProviderResult({
  ok: false,
  provider,
  model,
  text: buildUnavailableModelMessage(language),
  warnings: uniqueWarnings([...warnings, 'model_provider_not_connected']),
  error,
  latencyMs: Date.now() - startedAt,
});

export async function callChatModelProvider(input = {}, deps = {}) {
  const startedAt = Date.now();
  const env = deps.env || process.env;
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const route = selectServerChatProvider(input, env);
  const language = normalizeLanguage(input.language);

  if (route.provider === 'none') {
    return buildUnavailableProviderResult({
      provider: 'none',
      language,
      warnings: route.warnings,
      error: route.warnings[0] || 'model_provider_not_connected',
      startedAt,
    });
  }

  const providerResult = route.provider === 'gemini'
    ? await callGeminiProvider({
        input: { ...input, language },
        route,
        env,
        GoogleGenAIClass: deps.GoogleGenAIClass,
      })
    : await callDeepSeekProvider({
        input: { ...input, language },
        route,
        env,
        fetchImpl,
      });

  if (!providerResult.ok && normalizePreferredProvider(input.preferredProvider) === 'auto' && route.provider === 'gemini' && getDeepSeekKeyStatus(env).available) {
    const fallbackRoute = {
      provider: 'deepseek',
      model: env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL,
      warnings: [],
    };
    const fallbackResult = await callDeepSeekProvider({
      input: { ...input, language },
      route: fallbackRoute,
      env,
      fetchImpl,
    });

    if (fallbackResult.ok) {
      const scrubbed = scrubModelText(fallbackResult.text, language);
      return createProviderResult({
        ok: true,
        provider: fallbackRoute.provider,
        model: fallbackRoute.model,
        text: scrubbed.text,
        warnings: uniqueWarnings([...route.warnings, ...providerResult.warnings, 'gemini_runtime_fallback_to_deepseek', ...fallbackResult.warnings, ...scrubbed.warnings]),
        latencyMs: Date.now() - startedAt,
      });
    }

    return buildUnavailableProviderResult({
      provider: fallbackRoute.provider,
      model: fallbackRoute.model,
      language,
      warnings: [...route.warnings, ...providerResult.warnings, 'gemini_runtime_fallback_to_deepseek', ...fallbackResult.warnings],
      error: fallbackResult.error || providerResult.error || 'model_provider_not_connected',
      startedAt,
    });
  }

  if (!providerResult.ok) {
    return buildUnavailableProviderResult({
      provider: route.provider,
      model: route.model,
      language,
      warnings: [...route.warnings, ...providerResult.warnings],
      error: providerResult.error || `${route.provider}_unavailable`,
      startedAt,
    });
  }

  const scrubbed = scrubModelText(providerResult.text, language);
  return createProviderResult({
    ok: true,
    provider: route.provider,
    model: route.model,
    text: scrubbed.text,
    warnings: uniqueWarnings([...route.warnings, ...providerResult.warnings, ...scrubbed.warnings]),
    latencyMs: Date.now() - startedAt,
  });
}
