import React from 'react';
import { Clock, CheckCircle, AlertTriangle, XCircle, ChevronRight, FileText } from 'lucide-react';
import { Language } from '../../i18n';
import { ChatTrace, summarizeTraceForUI } from '../../services/chatTraceService';

interface ToolTracePanelProps {
  trace?: ChatTrace;
  language: Language;
  onOpenEvidence?: () => void;
}

const statusConfig = {
  success: {
    icon: CheckCircle,
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/20',
    textColor: 'text-emerald-400',
    dotColor: 'bg-emerald-400',
  },
  warning: {
    icon: AlertTriangle,
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/20',
    textColor: 'text-amber-400',
    dotColor: 'bg-amber-400',
  },
  error: {
    icon: XCircle,
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    textColor: 'text-rose-400',
    dotColor: 'bg-rose-400',
  },
};

const ToolTracePanel: React.FC<ToolTracePanelProps> = ({ trace, language, onOpenEvidence }) => {
  if (!trace) return null;

  const summary = summarizeTraceForUI(trace, language);
  const status = statusConfig[summary.status];
  const StatusIcon = status.icon;

  const labels = {
    zh: {
      steps: '步骤',
      duration: '耗时',
      viewEvidence: '查看证据',
      trace: '工具轨迹',
    },
    en: {
      steps: 'steps',
      duration: 'duration',
      viewEvidence: 'View Evidence',
      trace: 'Tool Trace',
    },
  }[language];

  return (
    <div className={`mt-2 flex items-center gap-2 rounded-lg border ${status.borderColor} ${status.bgColor} px-3 py-2 text-xs`}>
      {/* Status Icon */}
      <StatusIcon className={`h-3.5 w-3.5 flex-shrink-0 ${status.textColor}`} />

      {/* Summary */}
      <span className={`font-medium ${status.textColor}`}>
        {summary.summaryLabel}
      </span>

      {/* Step Count */}
      <span className="text-slate-400">
        · {summary.stepCount} {labels.steps}
      </span>

      {/* Duration */}
      {summary.totalDuration > 0 && (
        <span className="flex items-center gap-1 text-slate-400">
          <Clock className="h-3 w-3" />
          {summary.durationLabel}
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* View Evidence Button */}
      {(summary.evidenceCount > 0 || trace.dataQualityNotes.length > 0) && onOpenEvidence && (
        <button
          onClick={onOpenEvidence}
          className="flex items-center gap-1 rounded-md bg-white/5 px-2 py-1 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          <FileText className="h-3 w-3" />
          {labels.viewEvidence}
          <ChevronRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export default ToolTracePanel;
