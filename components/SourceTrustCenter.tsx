import React from 'react';
import { AlertTriangle, CheckCircle2, Gauge, ShieldCheck } from 'lucide-react';
import { theme } from '../designTokens';
import { Language, t } from '../i18n';
import {
  OfficialSourceVerification,
  SecFilingVerification,
  SourceTrustLevel,
  SourceTrustSummary,
  VerifiedNewsItem,
} from '../types';
import { NuxNotice } from './NuxPage';
import OfficialFilingsPanel from './OfficialFilingsPanel';
import OfficialSourcesPanel from './OfficialSourcesPanel';
import VerifiedNewsPanel from './VerifiedNewsPanel';

interface SourceTrustCenterProps {
  ticker: string;
  summary: SourceTrustSummary;
  verifiedNews?: VerifiedNewsItem[];
  officialFilings?: SecFilingVerification;
  officialSources?: OfficialSourceVerification;
  language: Language;
}

const panelStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
};

const getLevelColor = (level: SourceTrustLevel) => {
  if (level === 'high') return theme.colors.up;
  if (level === 'medium') return theme.colors.warn;
  if (level === 'low') return theme.colors.down;
  return theme.colors.textMuted;
};

const formatSignal = (language: Language, value: string) => {
  const translated = t(language, `sourceTrust.signals.${value}`);
  return translated === `sourceTrust.signals.${value}` ? t(language, 'sourceTrust.signals.unknownSignal') : translated;
};

const SourceTrustCenter: React.FC<SourceTrustCenterProps> = ({
  ticker,
  summary,
  verifiedNews,
  officialFilings,
  officialSources,
  language,
}) => {
  const levelColor = getLevelColor(summary.confidenceLevel);
  const hasAnyData = summary.officialSourceCount + summary.secFilingCount + summary.verifiedNewsCount > 0;

  const metrics = [
    { label: t(language, 'sourceTrust.officialSources'), value: summary.officialSourceCount },
    { label: t(language, 'sourceTrust.secFilings'), value: summary.secFilingCount },
    { label: t(language, 'sourceTrust.verifiedNews'), value: summary.verifiedNewsCount },
    { label: t(language, 'sourceTrust.highConfidenceNews'), value: summary.highConfidenceNewsCount },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-[24px] border p-5" style={panelStyle}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: theme.colors.textMuted }}>
              {ticker} / {t(language, 'sourceTrust.title')}
            </div>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="text-5xl font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
                {summary.overallScore}
              </div>
              <div className="pb-1 text-sm" style={{ color: theme.colors.textMuted }}>
                / 100 {t(language, 'sourceTrust.overallScore')}
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${summary.overallScore}%`, backgroundColor: levelColor }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
            <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5" style={{ borderColor: levelColor, color: levelColor }}>
              <Gauge className="h-3.5 w-3.5" />
              {t(language, `sourceTrust.${summary.confidenceLevel}`)}
            </span>
            <span className="rounded-full border px-3 py-1.5" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.accentSoft }}>
              {t(language, 'sourceTrust.mode')}: {summary.mode === 'rule_plus_ai' ? t(language, 'sourceTrust.rulePlusAi') : t(language, 'sourceTrust.ruleOnly')}
            </span>
          </div>
        </div>

        {!hasAnyData && (
          <div className="mt-5 rounded-[18px] border border-dashed p-4 text-sm" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textMuted }}>
            {t(language, 'sourceTrust.noData')}
          </div>
        )}

        <div className="mt-5 grid gap-3 md:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="rounded-[18px] border p-4" style={panelStyle}>
              <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: theme.colors.textMuted }}>
                {metric.label}
              </div>
              <div className="mt-2 text-2xl font-semibold" style={{ color: theme.colors.textPrimary }}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <NuxNotice tone="info">{t(language, 'sourceTrust.researchOnlyNotice')}</NuxNotice>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-[18px] border p-4" style={panelStyle}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
            <CheckCircle2 className="h-4 w-4" style={{ color: theme.colors.up }} />
            {t(language, 'sourceTrust.strengths')}
          </div>
          <ul className="space-y-1.5 pl-4 text-xs leading-5" style={{ color: theme.colors.textSecondary }}>
            {summary.strengths.length > 0 ? (
              summary.strengths.map((item) => (
                <li key={item} className="list-disc">
                  {formatSignal(language, item)}
                </li>
              ))
            ) : (
              <li className="list-disc">{t(language, 'sourceTrust.noStrengthSignal')}</li>
            )}
          </ul>
        </div>

        <div className="rounded-[18px] border p-4" style={panelStyle}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
            <AlertTriangle className="h-4 w-4" style={{ color: theme.colors.warn }} />
            {t(language, 'sourceTrust.warnings')}
          </div>
          <ul className="space-y-1.5 pl-4 text-xs leading-5" style={{ color: theme.colors.textSecondary }}>
            {summary.warnings.length > 0 ? (
              summary.warnings.map((item) => (
                <li key={item} className="list-disc">
                  {formatSignal(language, item)}
                </li>
              ))
            ) : (
              <li className="list-disc">{t(language, 'sourceTrust.noWarningSignal')}</li>
            )}
          </ul>
        </div>

        <div className="rounded-[18px] border p-4" style={panelStyle}>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
            <ShieldCheck className="h-4 w-4" style={{ color: theme.colors.accentSoft }} />
            {t(language, 'sourceTrust.notes')}
          </div>
          <ul className="space-y-1.5 pl-4 text-xs leading-5" style={{ color: theme.colors.textSecondary }}>
            {summary.notes.map((item) => (
              <li key={item} className="list-disc">
                {formatSignal(language, item)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-5">
        <OfficialSourcesPanel verification={officialSources} language={language} />
        <OfficialFilingsPanel verification={officialFilings} language={language} />
        <VerifiedNewsPanel items={verifiedNews || []} language={language} />
      </div>
    </div>
  );
};

export default SourceTrustCenter;
