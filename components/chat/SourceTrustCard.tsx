
import React from 'react';
import { Shield, ShieldCheck, ShieldAlert, ShieldQuestion, AlertTriangle, CheckCircle, FileText, Newspaper, BrainCircuit } from 'lucide-react';
import { Language, t } from '../../i18n';
import { SourceTrustSummary } from '../../types';

interface SourceTrustCardProps {
  language: Language;
  summary?: SourceTrustSummary | null;
}

const LEVEL_CONFIG: Record<string, { icon: React.ReactNode; color: string; barColor: string }> = {
  high: {
    icon: <ShieldCheck className="w-5 h-5 text-emerald-400" />,
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/5',
    barColor: 'bg-emerald-500',
  },
  medium: {
    icon: <Shield className="w-5 h-5 text-amber-400" />,
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/5',
    barColor: 'bg-amber-500',
  },
  low: {
    icon: <ShieldAlert className="w-5 h-5 text-rose-400" />,
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/5',
    barColor: 'bg-rose-500',
  },
  unknown: {
    icon: <ShieldQuestion className="w-5 h-5 text-slate-500" />,
    color: 'text-slate-400 border-slate-500/30 bg-slate-500/5',
    barColor: 'bg-slate-600',
  },
};

const SourceTrustCard: React.FC<SourceTrustCardProps> = ({ language, summary }) => {
  // Empty state
  if (!summary) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
        <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          <Shield className="w-3.5 h-3.5 text-indigo-400" />
          {t(language, 'chat.blocks.sourceTrust')}
        </h4>
        <p className="text-xs text-slate-500 italic">{t(language, 'chat.blocks.sourceTrustEmpty')}</p>
      </div>
    );
  }

  const config = LEVEL_CONFIG[summary.confidenceLevel] || LEVEL_CONFIG.unknown;
  const strengthCount = summary.strengths?.length || 0;
  const warningCount = summary.warnings?.length || 0;

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
      <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        <Shield className="w-3.5 h-3.5 text-indigo-400" />
        {t(language, 'chat.blocks.sourceTrust')}
      </h4>

      {/* Score + Level */}
      <div className={`flex items-center justify-between p-3 rounded-xl border mb-3 ${config.color}`}>
        <div className="flex items-center gap-2">
          {config.icon}
          <span className="text-sm font-bold capitalize">{summary.confidenceLevel}</span>
        </div>
        <span className="text-2xl font-mono font-black">{summary.overallScore}</span>
      </div>

      {/* Score Bar */}
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-700 ${config.barColor}`}
          style={{ width: `${summary.overallScore}%` }}
        />
      </div>

      {/* Counts */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {summary.officialSourceCount > 0 && (
          <div className="bg-slate-950/50 p-2 rounded-lg border border-white/5 text-center">
            <FileText className="w-3 h-3 text-indigo-400 mx-auto mb-1" />
            <div className="text-xs font-mono font-bold text-white">{summary.officialSourceCount}</div>
            <div className="text-[9px] text-slate-500">Sources</div>
          </div>
        )}
        {summary.secFilingCount > 0 && (
          <div className="bg-slate-950/50 p-2 rounded-lg border border-white/5 text-center">
            <Newspaper className="w-3 h-3 text-cyan-400 mx-auto mb-1" />
            <div className="text-xs font-mono font-bold text-white">{summary.secFilingCount}</div>
            <div className="text-[9px] text-slate-500">SEC</div>
          </div>
        )}
        {summary.aiReviewed && (
          <div className="bg-slate-950/50 p-2 rounded-lg border border-white/5 text-center">
            <BrainCircuit className="w-3 h-3 text-violet-400 mx-auto mb-1" />
            <div className="text-xs font-mono font-bold text-white">AI</div>
            <div className="text-[9px] text-slate-500">Reviewed</div>
          </div>
        )}
      </div>

      {/* Strengths */}
      {strengthCount > 0 && (
        <div className="space-y-1 mb-2">
          {summary.strengths.slice(0, 3).map((s, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-emerald-400">
              <CheckCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings */}
      {warningCount > 0 && (
        <div className="space-y-1">
          {summary.warnings.slice(0, 2).map((w, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-amber-400">
              <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SourceTrustCard;
