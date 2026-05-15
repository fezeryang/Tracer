export interface BackendTraceStep {
  id: string;
  type: string;
  label: string;
  status: 'pending' | 'success' | 'warning' | 'error' | 'skipped' | string;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface BackendEvidenceItem {
  id: string;
  type: string;
  title: string;
  source?: string;
  url?: string;
  confidence?: number;
  note?: string;
  timestamp?: string;
}

export interface BackendToolTrace {
  id: string;
  command?: string;
  ticker?: string;
  intent?: string;
  steps: BackendTraceStep[];
  evidenceItems: BackendEvidenceItem[];
  dataQualityNotes: string[];
  createdAt: string;
  updatedAt: string;
}

export function createBackendToolTrace(input?: Record<string, unknown>): BackendToolTrace;
export function addBackendTraceStep(trace: BackendToolTrace, step: Record<string, unknown>): BackendToolTrace;
export function completeBackendTraceStep(
  trace: BackendToolTrace,
  stepType: string,
  status: string,
  message?: string
): BackendToolTrace;
export function finalizeBackendToolTrace(
  trace: BackendToolTrace,
  input?: Record<string, unknown>
): BackendToolTrace;
export function createDefaultBackendToolTrace(input?: Record<string, unknown>): BackendToolTrace;
