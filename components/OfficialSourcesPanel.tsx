import React from 'react';
import { ExternalLink, ShieldCheck, Sparkles } from 'lucide-react';
import { theme } from '../designTokens';
import { Language, t } from '../i18n';
import { OfficialCompanySource, OfficialSourceVerification } from '../types';
import { NuxNotice } from './NuxPage';

interface OfficialSourcesPanelProps {
  verification?: OfficialSourceVerification;
  language: Language;
}

const panelStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
};

const getScoreColor = (score: number) => {
  if (score >= 80) return theme.colors.up;
  if (score >= 55) return theme.colors.warn;
  return theme.colors.down;
};

const translateToken = (language: Language, namespace: string, value?: string) => {
  if (!value) return t(language, 'common.unavailable');
  const key = `${namespace}.${value}`;
  const translated = t(language, key);
  return translated === key ? value.replace(/_/g, ' ') : translated;
};

const statusLabel = (verification: OfficialSourceVerification | undefined, language: Language) => {
  if (!verification) return t(language, 'officialSources.unavailable');
  if (verification.status === 'not_found') return t(language, 'officialSources.notFound');
  if (verification.status === 'error' || verification.status === 'unsupported') return t(language, 'officialSources.unavailable');
  return verification.status;
};

const SourceCard = ({ source, language }: { source: OfficialCompanySource; language: Language }) => {
  const scoreColor = getScoreColor(source.authorityScore);

  return (
    <article className="rounded-[20px] border p-5" style={panelStyle}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
        <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.colors.accentSoft, color: theme.colors.accentSoft }}>
          {translateToken(language, 'officialSources.types', source.type)}
        </span>
        <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
          {translateToken(language, 'officialSources.tiers', source.sourceTier)}
        </span>
        {source.aiReviewed && (
          <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.warn }}>
            <Sparkles className="h-3 w-3" />
            AI
          </span>
        )}
      </div>

      <h4 className="text-base font-semibold leading-6" style={{ color: theme.colors.textPrimary }}>
        {source.name}
      </h4>
      <p className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>
        {source.domain || source.url}
      </p>

      <div className="mt-4 grid gap-3 text-xs md:grid-cols-2" style={{ color: theme.colors.textSecondary }}>
        <div>
          <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
            {t(language, 'officialSources.authorityScore')}
          </div>
          <span className="inline-flex items-center gap-1.5 font-mono" style={{ color: scoreColor }}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {source.authorityScore}/100
          </span>
        </div>
        <div>
          <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
            {t(language, 'officialSources.aiAssessment')}
          </div>
          <span>{translateToken(language, 'officialSources.assessments', source.aiAssessment)}</span>
        </div>
        {source.aiConfidence !== undefined && (
          <div>
            <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
              {t(language, 'officialSources.aiConfidence')}
            </div>
            <span className="font-mono">{source.aiConfidence}/100</span>
          </div>
        )}
        <div>
          <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
            {t(language, 'officialSources.aiReviewed')}
          </div>
          <span>{source.aiReviewed ? t(language, 'common.yes') : t(language, 'common.no')}</span>
        </div>
      </div>

      {source.aiReasoning && (
        <div className="mt-4 rounded-[14px] border p-3 text-xs leading-5" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
          <div className="mb-1 font-semibold uppercase tracking-[0.16em]" style={{ color: theme.colors.textMuted }}>
            {t(language, 'officialSources.aiReasoning')}
          </div>
          {language === 'zh' ? t(language, 'officialSources.aiReasoningSummary') : source.aiReasoning}
        </div>
      )}

      {source.warnings && source.warnings.length > 0 && (
        <div className="mt-4 rounded-[14px] border p-3" style={{ borderColor: 'rgba(243,182,63,0.24)', color: theme.colors.warn }}>
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]">
            {t(language, 'officialSources.warnings')}
          </div>
          <ul className="space-y-1 pl-4 text-xs leading-5">
            {source.warnings.map((warning) => (
              <li key={warning} className="list-disc">
                {warning}
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
        style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.accentSoft }}
      >
        {t(language, 'officialSources.openSource')}
        <ExternalLink className="h-3.5 w-3.5" />
      </a>
    </article>
  );
};

const OfficialSourcesPanel: React.FC<OfficialSourcesPanelProps> = ({ verification, language }) => {
  if (!verification || verification.sources.length === 0) {
    return (
      <div className="space-y-4">
        <NuxNotice tone="info">{t(language, 'officialSources.subtitle')}</NuxNotice>
        <div className="rounded-[18px] border border-dashed p-5 text-sm" style={{ ...panelStyle, color: theme.colors.textMuted }}>
          {statusLabel(verification, language)}
        </div>
        <p className="text-xs leading-5" style={{ color: theme.colors.textMuted }}>
          {t(language, 'officialSources.researchOnlyNotice')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NuxNotice tone="info">{t(language, 'officialSources.researchOnlyNotice')}</NuxNotice>
      <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
        <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
          {t(language, 'officialSources.status')}: {verification.status}
        </span>
        <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.accentSoft }}>
          {t(language, 'officialSources.mode')}: {verification.mode === 'rule_plus_ai' ? t(language, 'officialSources.rulePlusAi') : t(language, 'officialSources.ruleOnly')}
        </span>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {verification.sources.map((source) => (
          <SourceCard key={`${source.type}-${source.url}`} source={source} language={language} />
        ))}
      </div>
    </div>
  );
};

export default OfficialSourcesPanel;
