import React from 'react';
import { FunctionSquare, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { Language, t } from '../../i18n';
import { getFinanceFormula, isValidFinanceFormulaId } from '../../services/financeFormulaRegistry';

interface FormulaBlockProps {
  language: Language;
  formula?: string;
  description?: string;
  /** Optional: registry formula ID for enriched display */
  formulaId?: string;
  /** Optional: explicit variables list (overrides registry) */
  variables?: { symbol: string; value: string }[];
  /** Optional: data quality badge */
  dataQuality?: 'available' | 'limited' | 'simulation' | 'unavailable' | 'fallback';
  /** Optional: source label */
  source?: string;
  /** Compact layout */
  compact?: boolean;
}

const FormulaBlock: React.FC<FormulaBlockProps> = ({
  language,
  formula,
  description,
  formulaId,
  variables,
  dataQuality,
  source,
  compact = false,
}) => {
  const padding = compact ? 'p-3' : 'p-4';
  const textSize = compact ? 'text-xs' : 'text-sm';

  // Try registry lookup first
  const registryFormula = formulaId && isValidFinanceFormulaId(formulaId)
    ? getFinanceFormula(formulaId)
    : undefined;

  // Determine display mode
  const isVerified = !!registryFormula;
  const displayFormula = registryFormula?.formulaText || formula || '';
  const displayTitle = registryFormula
    ? t(language, registryFormula.titleKey)
    : description;

  const limitationKey = registryFormula?.limitationKey || 'financeFormula.limitation';

  const qualityBadge = () => {
    if (!dataQuality) return null;
    const config: Record<string, { label: string; cls: string }> = {
      available: { label: t(language, 'chat.formula.verified'), cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
      limited: { label: t(language, 'chat.formula.limited'), cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20' },
      simulation: { label: t(language, 'chat.formula.simulation'), cls: 'bg-rose-500/15 text-rose-400 border-rose-500/20' },
      unavailable: { label: t(language, 'chat.formula.unavailable'), cls: 'bg-slate-500/15 text-slate-400 border-slate-500/20' },
      fallback: { label: t(language, 'chat.formula.fallback'), cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
    };
    const cfg = config[dataQuality];
    if (!cfg) return null;
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cfg.cls}`}>
        <ShieldCheck className="w-2.5 h-2.5" />
        {cfg.label}
      </span>
    );
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className={`${padding} border-b border-white/5 flex items-center justify-between gap-3 flex-wrap`}>
        <div className="flex items-center gap-2 min-w-0">
          <FunctionSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <h4 className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold text-slate-400 uppercase tracking-wider`}>
            {t(language, 'chat.blocks.formula')}
          </h4>
          {displayTitle && (
            <span className={`${compact ? 'text-[10px]' : 'text-xs'} font-medium text-slate-300 truncate`}>
              {displayTitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {qualityBadge()}
          {!isVerified && displayFormula && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium bg-slate-500/15 text-slate-400 border-slate-500/20`}>
              <ShieldQuestion className="w-2.5 h-2.5" />
              {t(language, 'chat.formula.unverified')}
            </span>
          )}
          {source && (
            <span className="text-[10px] text-slate-500">
              {t(language, 'chat.formula.source')}: {source}
            </span>
          )}
        </div>
      </div>

      {/* Formula Display */}
      {displayFormula && (
        <div className={`${padding} bg-slate-950 border-b border-white/5`}>
          <pre className={`${textSize} font-mono text-cyan-300 whitespace-pre-wrap break-all`}>
            {displayFormula}
          </pre>
        </div>
      )}

      {/* Variables */}
      {(registryFormula?.variables || variables) && (
        <div className={`${padding} border-b border-white/5`}>
          <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} font-semibold text-slate-500 uppercase tracking-wider mb-2`}>
            {t(language, 'chat.formula.variables')}
          </p>
          <div className="flex flex-wrap gap-2">
            {registryFormula
              ? registryFormula.variables.map((v, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-lg px-2 py-1">
                    <code className="text-cyan-400 font-mono text-xs">{v.symbol}</code>
                    <span className="text-slate-500 text-[10px]">=</span>
                    <span className="text-slate-300 text-[10px]">{t(language, v.meaningKey)}</span>
                  </span>
                ))
              : variables!.map((v, idx) => (
                  <span key={idx} className="inline-flex items-center gap-1.5 bg-white/5 border border-white/5 rounded-lg px-2 py-1">
                    <code className="text-cyan-400 font-mono text-xs">{v.symbol}</code>
                    <span className="text-slate-500 text-[10px]">=</span>
                    <span className="text-slate-300 text-[10px]">{v.value}</span>
                  </span>
                ))}
          </div>
        </div>
      )}

      {/* Limitation Notice */}
      <div className={`${padding} bg-slate-950/50`}>
        <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-slate-500`}>
          {t(language, limitationKey)}
        </p>
      </div>
    </div>
  );
};

export default FormulaBlock;
