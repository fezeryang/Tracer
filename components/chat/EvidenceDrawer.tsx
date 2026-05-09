import React, { useEffect } from 'react';
import { X, ExternalLink, Clock, CheckCircle, AlertTriangle, XCircle, HelpCircle, Shield, FileText, Database } from 'lucide-react';
import { Language } from '../../i18n';
import { ChatTrace, getStepLabel, getEvidenceTypeLabel, summarizeTraceForUI } from '../../services/chatTraceService';

interface EvidenceDrawerProps {
  open: boolean;
  trace?: ChatTrace;
  language: Language;
  onClose: () => void;
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  error: {
    icon: XCircle,
    color: 'text-rose-400',
    bgColor: 'bg-rose-500/10',
  },
  pending: {
    icon: Clock,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  skipped: {
    icon: HelpCircle,
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10',
  },
};

const EvidenceDrawer: React.FC<EvidenceDrawerProps> = ({ open, trace, language, onClose }) => {
  // Handle ESC key to close
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!trace) return null;

  const summary = summarizeTraceForUI(trace, language);

  const labels = {
    zh: {
      title: '证据抽屉',
      close: '关闭',
      summary: '摘要',
      toolSteps: '工具步骤',
      evidence: '证据',
      dataQuality: '数据质量',
      safety: '安全提示',
      noEvidence: '暂无证据',
      openUrl: '打开链接',
      researchOnly: '仅供学习研究使用，不构成投资建议。',
      dataMayBeLimited: '数据可能存在延迟、回退、模拟或不可用。',
      command: '命令',
      intent: '意图',
      ticker: '股票代码',
      createdAt: '创建时间',
      noSteps: '无轨迹记录',
      step: '步骤',
      status: '状态',
      duration: '耗时',
      source: '来源',
      confidence: '置信度',
    },
    en: {
      title: 'Evidence Drawer',
      close: 'Close',
      summary: 'Summary',
      toolSteps: 'Tool Steps',
      evidence: 'Evidence',
      dataQuality: 'Data Quality',
      safety: 'Safety',
      noEvidence: 'No evidence available',
      openUrl: 'Open URL',
      researchOnly: 'For learning and research purposes only, not investment advice.',
      dataMayBeLimited: 'Data may be delayed, fallback, simulated, or unavailable.',
      command: 'Command',
      intent: 'Intent',
      ticker: 'Ticker',
      createdAt: 'Created',
      noSteps: 'No trace recorded',
      step: 'Step',
      status: 'Status',
      duration: 'Duration',
      source: 'Source',
      confidence: 'Confidence',
    },
  }[language];

  const statusLabels = {
    zh: {
      success: '成功',
      warning: '警告',
      error: '失败',
      pending: '进行中',
      skipped: '跳过',
    },
    en: {
      success: 'Success',
      warning: 'Warning',
      error: 'Error',
      pending: 'Pending',
      skipped: 'Skipped',
    },
  }[language];

  const formatDuration = (ms?: number): string => {
    if (!ms) return '—';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return language === 'zh' ? `${minutes}分${seconds}秒` : `${minutes}m ${seconds}s`;
  };

  const formatTime = (isoString?: string): string => {
    if (!isoString) return '—';
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString(language === 'zh' ? 'zh-CN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return '—';
    }
  };

  // Group evidence by type
  const groupedEvidence = trace.evidenceItems.reduce((acc, item) => {
    if (!acc[item.type]) acc[item.type] = [];
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, typeof trace.evidenceItems>);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 shadow-2xl transition-transform">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20">
                <FileText className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">{labels.title}</h2>
                {trace.command && (
                  <p className="text-xs text-slate-400">{trace.command}</p>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              aria-label={labels.close}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {/* Summary Section */}
            <section className="mb-6">
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                {labels.summary}
              </h3>
              <div className="rounded-lg border border-white/10 bg-slate-800/50 p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {trace.ticker && (
                    <div>
                      <span className="text-slate-500">{labels.ticker}:</span>
                      <span className="ml-2 font-mono text-white">{trace.ticker}</span>
                    </div>
                  )}
                  {trace.command && (
                    <div>
                      <span className="text-slate-500">{labels.command}:</span>
                      <span className="ml-2 text-white">{trace.command}</span>
                    </div>
                  )}
                  {trace.intent && (
                    <div>
                      <span className="text-slate-500">{labels.intent}:</span>
                      <span className="ml-2 text-white">{trace.intent}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">{labels.createdAt}:</span>
                    <span className="ml-2 text-white">{formatTime(trace.createdAt)}</span>
                  </div>
                </div>

                {/* Overall Status Badge */}
                <div className={`mt-3 flex items-center gap-2 rounded-md ${statusConfig[summary.status].bgColor} px-3 py-2`}>
                  {React.createElement(statusConfig[summary.status].icon, {
                    className: `h-4 w-4 ${statusConfig[summary.status].color}`,
                  })}
                  <span className={`text-sm font-medium ${statusConfig[summary.status].color}`}>
                    {statusLabels[summary.status]}
                  </span>
                  {summary.totalDuration > 0 && (
                    <span className="ml-auto text-xs text-slate-400">
                      {formatDuration(summary.totalDuration)}
                    </span>
                  )}
                </div>
              </div>
            </section>

            {/* Data Quality Notes */}
            {trace.dataQualityNotes.length > 0 && (
              <section className="mb-6">
                <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {labels.dataQuality}
                </h3>
                <div className="space-y-2">
                  {trace.dataQualityNotes.map((note, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-200"
                    >
                      {note}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Tool Steps */}
            <section className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <Database className="h-3.5 w-3.5" />
                {labels.toolSteps}
              </h3>
              {trace.steps.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-slate-800/30 px-4 py-6 text-center text-sm text-slate-500">
                  {labels.noSteps}
                </div>
              ) : (
                <div className="space-y-2">
                  {trace.steps.map((step) => {
                    const stepStatus = step.status;
                    const stepConfig = statusConfig[stepStatus];
                    const StepIcon = stepConfig.icon;

                    return (
                      <div
                        key={step.id}
                        className="flex items-start gap-3 rounded-lg border border-white/5 bg-slate-800/30 px-3 py-2.5"
                      >
                        <div className={`flex-shrink-0 rounded-full p-1 ${stepConfig.bgColor}`}>
                          <StepIcon className={`h-3 w-3 ${stepConfig.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-white">
                              {step.label || getStepLabel(step.type, language)}
                            </span>
                            <span className={`text-xs ${stepConfig.color}`}>
                              {statusLabels[stepStatus]}
                            </span>
                          </div>
                          {step.message && (
                            <p className="mt-1 text-xs text-slate-400">{step.message}</p>
                          )}
                          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                            <span>{formatTime(step.startedAt)}</span>
                            {step.durationMs !== undefined && (
                              <span>{formatDuration(step.durationMs)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Evidence */}
            <section className="mb-6">
              <h3 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <FileText className="h-3.5 w-3.5" />
                {labels.evidence}
              </h3>
              {trace.evidenceItems.length === 0 ? (
                <div className="rounded-lg border border-white/10 bg-slate-800/30 px-4 py-6 text-center text-sm text-slate-500">
                  {labels.noEvidence}
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedEvidence).map(([type, items]) => (
                    <div key={type}>
                      <h4 className="mb-2 text-xs font-medium text-slate-400">
                        {getEvidenceTypeLabel(type as any, language)}
                      </h4>
                      <div className="space-y-2">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="group rounded-lg border border-white/5 bg-slate-800/30 px-3 py-2.5 transition-colors hover:bg-slate-800/50"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white break-words">{item.title}</p>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                  {item.source && (
                                    <span className="rounded bg-white/5 px-1.5 py-0.5">
                                      {item.source}
                                    </span>
                                  )}
                                  {item.confidence !== undefined && (
                                    <span>
                                      {labels.confidence}: {item.confidence}%
                                    </span>
                                  )}
                                  {item.timestamp && (
                                    <span>{formatTime(item.timestamp)}</span>
                                  )}
                                </div>
                                {item.note && (
                                  <p className="mt-1 text-xs text-slate-400 italic">{item.note}</p>
                                )}
                              </div>
                              {item.url && (
                                <a
                                  href={item.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="flex-shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-blue-400"
                                  title={labels.openUrl}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Footer - Safety Notice */}
          <div className="border-t border-white/10 bg-slate-900/50 px-6 py-4">
            <div className="flex items-start gap-3 rounded-lg border border-rose-500/20 bg-rose-500/5 px-4 py-3">
              <Shield className="h-5 w-5 flex-shrink-0 text-rose-400 mt-0.5" />
              <div className="text-xs">
                <p className="font-medium text-rose-300">{labels.safety}</p>
                <p className="mt-1 text-rose-200/80">{labels.researchOnly}</p>
                <p className="mt-1 text-rose-200/60">{labels.dataMayBeLimited}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default EvidenceDrawer;
