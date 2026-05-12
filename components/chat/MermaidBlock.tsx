
import React from 'react';
import { AlertTriangle, CheckCircle2, Code } from 'lucide-react';
import { Language, t } from '../../i18n';
import { ChatRenderBlock } from '../../types';
import { MermaidDiagramType, validateMermaidSource } from '../../services/mermaidValidator';

interface MermaidBlockProps {
  language: Language;
  title?: string;
  code: string;
  description?: string;
  source?: string;
  dataQuality?: ChatRenderBlock['dataQuality'];
  validationStatus?: ChatRenderBlock['validationStatus'];
  diagramType?: MermaidDiagramType;
  validated?: boolean;
  validationMessage?: string;
  compact?: boolean;
}

const qualityClass = (quality?: ChatRenderBlock['dataQuality']): string => {
  switch (quality) {
    case 'available':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300';
    case 'limited':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-300';
    case 'simulation':
      return 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300';
    case 'fallback':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-300';
    case 'unavailable':
    default:
      return 'border-slate-500/30 bg-slate-500/10 text-slate-300';
  }
};

const reasonLabel = (language: Language, reason: string): string => {
  if (reason === 'empty') return t(language, 'chat.mermaid.empty');
  if (reason === 'too_long') return t(language, 'chat.mermaid.tooLong');
  if (reason === 'valid') return t(language, 'chat.mermaid.validated');
  return reason;
};

const MermaidBlock: React.FC<MermaidBlockProps> = ({
  language,
  title,
  code,
  description,
  source,
  dataQuality,
  diagramType,
  validated,
  validationMessage,
  compact,
}) => {
  const validation = validateMermaidSource(code || '');
  const isValid = Boolean(validated && validation.valid) || (!validated && validation.valid);
  const displayCode = validation.normalizedCode || code || '';
  const displayType = diagramType || validation.diagramType;
  const statusLabel = isValid ? t(language, 'chat.mermaid.validated') : t(language, 'chat.mermaid.unvalidated');

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <Code className="w-3.5 h-3.5 text-indigo-400" />
            {title || t(language, 'chat.mermaid.title')}
          </h4>
          {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
            isValid
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : 'border-amber-400/30 bg-amber-400/10 text-amber-300'
          }`}>
            {isValid ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
            {statusLabel}
          </span>
          <span className="rounded-full border border-indigo-400/30 bg-indigo-400/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300">
            {t(language, 'chat.mermaid.diagramType')}: {displayType}
          </span>
          {dataQuality && (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${qualityClass(dataQuality)}`}>
              {dataQuality}
            </span>
          )}
        </div>
      </div>

      {(source || !isValid) && (
        <div className="mb-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
          {source && <span>{t(language, 'chat.chart.source')}: {source}</span>}
          {!isValid && (
            <span className="text-amber-300">
              {t(language, 'chat.mermaid.validationFailed')}: {reasonLabel(language, validationMessage || validation.reason)}
            </span>
          )}
        </div>
      )}

      <div className={`bg-slate-950 rounded-xl border border-white/5 p-4 overflow-auto ${compact ? 'max-h-48' : 'max-h-80'}`}>
        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-words">
          {displayCode}
        </pre>
      </div>

      <p className="mt-2 text-[10px] text-slate-500">
        {t(language, 'chat.mermaid.sourceOnly')} {t(language, 'chat.mermaid.renderLater')}
      </p>
      <p className="mt-1 text-[10px] text-slate-500 italic">
        {t(language, 'chat.mermaid.researchOnly')}
      </p>
    </div>
  );
};

export default MermaidBlock;
