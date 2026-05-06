const DEFAULT_DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';
const VALID_ASSESSMENTS = new Set(['likely_official', 'possibly_official', 'third_party', 'unknown']);

export const isDeepSeekConfigured = () => Boolean(process.env.DEEPSEEK_API_KEY);

const extractJsonCandidate = (rawText) => {
  const trimmed = String(rawText || '').trim();
  if (!trimmed) return null;

  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // Continue with tolerant extraction.
  }

  const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i);
  if (codeBlockMatch?.[1]) return codeBlockMatch[1].trim();

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return null;
};

const normalizeReview = (value) => {
  const assessment = VALID_ASSESSMENTS.has(value?.assessment) ? value.assessment : 'unknown';
  const confidence = Number.isFinite(Number(value?.confidence))
    ? Math.max(0, Math.min(100, Math.round(Number(value.confidence))))
    : 0;

  return {
    assessment,
    confidence,
    reasoning: typeof value?.reasoning === 'string' ? value.reasoning.slice(0, 700) : '',
    warnings: Array.isArray(value?.warnings)
      ? value.warnings.map((item) => String(item).trim()).filter(Boolean).slice(0, 5)
      : [],
  };
};

export const reviewOfficialSourceAuthority = async (source) => {
  if (!isDeepSeekConfigured()) return null;

  const baseUrl = process.env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL;
  const model = process.env.DEEPSEEK_MODEL || DEFAULT_DEEPSEEK_MODEL;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content:
              'You review whether an existing company source candidate appears authoritative. Do not generate URLs. Do not browse. Do not judge whether any news is true. Return JSON only.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              instruction:
                'Assess only whether this candidate URL/name/domain/type looks like an official or authoritative company source. Return {"assessment":"likely_official|possibly_official|third_party|unknown","confidence":number,"reasoning":string,"warnings":string[]}.',
              candidate: {
                ticker: source.ticker,
                companyName: source.companyName,
                type: source.type,
                name: source.name,
                url: source.url,
                domain: source.domain,
                sourceTier: source.sourceTier,
                authorityScore: source.authorityScore,
              },
            }),
          },
        ],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content;
    const candidate = extractJsonCandidate(text);
    if (!candidate) return null;

    return normalizeReview(JSON.parse(candidate));
  } catch (error) {
    console.warn(`[DeepSeek] Official source review skipped: ${error.message}`);
    return null;
  }
};
