import React from 'react';
import { ExternalLink, FileCheck2 } from 'lucide-react';
import { theme } from '../designTokens';
import { Language, t } from '../i18n';
import { SecFilingVerification } from '../types';
import { NuxNotice } from './NuxPage';

interface OfficialFilingsPanelProps {
  verification?: SecFilingVerification;
  language: Language;
}

const statusKeyMap: Record<SecFilingVerification['status'], string> = {
  available: 'report.available',
  unavailable: 'sec.unavailable',
  not_found: 'sec.notFound',
  error: 'sec.error',
};

const panelStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
};

const OfficialFilingsPanel: React.FC<OfficialFilingsPanelProps> = ({ verification, language }) => {
  if (!verification || verification.status !== 'available' || verification.filings.length === 0) {
    const statusKey = verification ? statusKeyMap[verification.status] : 'sec.unavailable';

    return (
      <div className="space-y-4">
        <NuxNotice tone="info">{t(language, 'sec.subtitle')}</NuxNotice>
        <div className="rounded-[18px] border border-dashed p-5 text-sm" style={{ ...panelStyle, color: theme.colors.textMuted }}>
          {t(language, statusKey)}
          {verification?.error ? ` ${verification.error}` : ''}
        </div>
        <p className="text-xs leading-5" style={{ color: theme.colors.textMuted }}>
          {t(language, 'sec.researchOnlyNotice')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <NuxNotice tone="info">{t(language, 'sec.subtitle')}</NuxNotice>

      <div className="grid gap-4 xl:grid-cols-2">
        {verification.filings.map((filing) => (
          <article key={filing.accessionNumber} className="rounded-[20px] border p-5" style={panelStyle}>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.colors.accentSoft, color: theme.colors.accentSoft }}>
                {filing.form}
              </span>
              <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
                {t(language, 'sec.officialBadge')}
              </span>
            </div>

            <h4 className="text-base font-semibold leading-6" style={{ color: theme.colors.textPrimary }}>
              {filing.description || filing.primaryDocument || filing.accessionNumber}
            </h4>

            <div className="mt-4 grid gap-3 text-xs md:grid-cols-2" style={{ color: theme.colors.textSecondary }}>
              <div>
                <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                  {t(language, 'sec.filingDate')}
                </div>
                <span>{filing.filingDate}</span>
              </div>
              <div>
                <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                  {t(language, 'sec.reportDate')}
                </div>
                <span>{filing.reportDate || t(language, 'common.unavailable')}</span>
              </div>
              <div className="md:col-span-2">
                <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                  {t(language, 'sec.accessionNumber')}
                </div>
                <span className="font-mono">{filing.accessionNumber}</span>
              </div>
              <div>
                <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                  {t(language, 'sec.source')}
                </div>
                <span className="inline-flex items-center gap-1.5">
                  <FileCheck2 className="h-3.5 w-3.5" style={{ color: theme.colors.up }} />
                  {filing.source}
                </span>
              </div>
            </div>

            {filing.url && (
              <a
                href={filing.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.accentSoft }}
              >
                {t(language, 'sec.openFiling')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </article>
        ))}
      </div>

      <p className="text-xs leading-5" style={{ color: theme.colors.textMuted }}>
        {t(language, 'sec.researchOnlyNotice')}
      </p>
    </div>
  );
};

export default OfficialFilingsPanel;
