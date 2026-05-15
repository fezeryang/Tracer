const MAX_TRACE_STEPS = 20;
const MAX_EVIDENCE_ITEMS = 8;
const MAX_NOTES = 6;

const safeText = (value, maxLength = 200) => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
};

const nowIso = () => new Date().toISOString();

const safeMetadata = (metadata) => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  const entries = Object.entries(metadata)
    .filter(([key]) => !/stack|raw|secret|token|api[_-]?key|password/i.test(key))
    .map(([key, value]) => {
      if (typeof value === 'string') return [safeText(key, 60), safeText(value, 120)];
      if (typeof value === 'number' || typeof value === 'boolean') return [safeText(key, 60), value];
      return [safeText(key, 60), safeText(String(value ?? ''), 120)];
    })
    .filter(([key]) => key);
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const sanitizeEvidenceItems = (items) => (
  Array.isArray(items)
    ? items.filter(Boolean).slice(0, MAX_EVIDENCE_ITEMS).map((item) => ({
      id: safeText(item?.id, 120) || `evidence:${Date.now()}`,
      type: safeText(item?.type, 40) || 'other',
      title: safeText(item?.title, 180) || 'Evidence item',
      ...(safeText(item?.source, 80) ? { source: safeText(item.source, 80) } : {}),
      ...(safeText(item?.url, 500) ? { url: safeText(item.url, 500) } : {}),
      ...(Number.isFinite(Number(item?.confidence)) ? { confidence: Number(item.confidence) } : {}),
      ...(safeText(item?.note, 180) ? { note: safeText(item.note, 180) } : {}),
      ...(safeText(item?.timestamp, 60) ? { timestamp: safeText(item.timestamp, 60) } : {}),
    }))
    : []
);

const buildTraceStep = (step = {}) => {
  const timestamp = nowIso();
  return {
    id: safeText(step.id, 120) || `backend-step-${Date.now()}`,
    type: safeText(step.type, 40) || 'tool_call',
    label: safeText(step.label, 120) || 'backend_tool_step',
    status: safeText(step.status, 20) || 'pending',
    startedAt: safeText(step.startedAt, 60) || timestamp,
    ...(step.status !== 'pending' ? { endedAt: safeText(step.endedAt, 60) || timestamp } : {}),
    ...(Number.isFinite(Number(step.durationMs)) ? { durationMs: Number(step.durationMs) } : {}),
    ...(safeText(step.message, 200) ? { message: safeText(step.message, 200) } : {}),
    ...(safeMetadata(step.metadata) ? { metadata: safeMetadata(step.metadata) } : {}),
  };
};

export const createBackendToolTrace = ({
  command,
  ticker,
  intent,
  steps = [],
  evidenceItems = [],
  dataQualityNotes = [],
} = {}) => {
  const timestamp = nowIso();
  return {
    id: `backend-tool-trace-${Date.now()}`,
    command: safeText(command, 40) || undefined,
    ticker: safeText(ticker, 16) || undefined,
    intent: safeText(intent, 40) || undefined,
    steps: steps.map(buildTraceStep).slice(0, MAX_TRACE_STEPS),
    evidenceItems: sanitizeEvidenceItems(evidenceItems),
    dataQualityNotes: Array.isArray(dataQualityNotes)
      ? dataQualityNotes.map((note) => safeText(note, 180)).filter(Boolean).slice(0, MAX_NOTES)
      : [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

export const addBackendTraceStep = (trace, step) => {
  const safeTrace = trace || createBackendToolTrace();
  if (safeTrace.steps.length >= MAX_TRACE_STEPS) return safeTrace;
  return {
    ...safeTrace,
    steps: [...safeTrace.steps, buildTraceStep(step)],
    updatedAt: nowIso(),
  };
};

export const completeBackendTraceStep = (trace, stepType, status, message) => {
  const safeTrace = trace || createBackendToolTrace();
  let completed = false;
  const updatedSteps = safeTrace.steps.map((step) => {
    if (!completed && step.type === stepType && step.status === 'pending') {
      completed = true;
      const endedAt = nowIso();
      const durationMs = step.startedAt ? new Date(endedAt).getTime() - new Date(step.startedAt).getTime() : undefined;
      return {
        ...step,
        status: safeText(status, 20) || 'success',
        endedAt,
        ...(Number.isFinite(durationMs) ? { durationMs } : {}),
        ...(safeText(message, 200) ? { message: safeText(message, 200) } : {}),
      };
    }
    return step;
  });
  return {
    ...safeTrace,
    steps: updatedSteps,
    updatedAt: nowIso(),
  };
};

export const finalizeBackendToolTrace = (trace, input = {}) => {
  const safeTrace = trace || createBackendToolTrace(input);
  const notes = [
    ...(Array.isArray(safeTrace.dataQualityNotes) ? safeTrace.dataQualityNotes : []),
    ...(Array.isArray(input.dataQualityNotes) ? input.dataQualityNotes : []),
    ...(Array.isArray(input.warnings) ? input.warnings : []),
  ].map((note) => safeText(note, 180)).filter(Boolean);

  return {
    ...safeTrace,
    evidenceItems: sanitizeEvidenceItems([
      ...(Array.isArray(safeTrace.evidenceItems) ? safeTrace.evidenceItems : []),
      ...(Array.isArray(input.evidenceItems) ? input.evidenceItems : []),
    ]),
    dataQualityNotes: Array.from(new Set(notes)).slice(0, MAX_NOTES),
    updatedAt: nowIso(),
  };
};

export const createDefaultBackendToolTrace = ({
  command,
  ticker,
  parseStatus = 'success',
  executeStatus = 'success',
  qualityStatus = 'success',
  responseStatus = 'success',
  evidenceItems = [],
  dataQualityNotes = [],
} = {}) => createBackendToolTrace({
  command,
  ticker,
  evidenceItems,
  dataQualityNotes,
  steps: [
    { id: 'backend-tool-user-input', type: 'user_input', label: 'user_input', status: 'success' },
    { id: 'backend-command-parse', type: 'command_execute', label: 'backend_command_parse', status: parseStatus, metadata: { command, ticker } },
    { id: 'backend-tool-execute', type: 'tool_call', label: 'backend_tool_execute', status: executeStatus, metadata: { command, ticker } },
    { id: 'backend-data-quality', type: 'data_quality', label: 'backend_data_quality', status: qualityStatus },
    { id: 'backend-response-build', type: 'fallback', label: 'backend_response_build', status: responseStatus },
  ],
});
