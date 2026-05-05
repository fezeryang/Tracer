import React from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { theme } from '../designTokens';
import { Language, t } from '../i18n';
import { VerifiedNewsItem } from '../types';
import { NuxNotice } from './NuxPage';

interface VerifiedNewsPanelProps {
  items: VerifiedNewsItem[];
  language: Language;
}

const getConfidenceKey = (score: number) => {
  if (score >= 75) return 'news.highConfidence';
  if (score >= 50) return 'news.mediumConfidence';
  return 'news.lowConfidence';
};

const getConfidenceColor = (score: number) => {
  if (score >= 75) return theme.colors.up;
  if (score >= 50) return theme.colors.warn;
  return theme.colors.down;
};

const formatSourceTier = (sourceTier: VerifiedNewsItem['sourceTier']) => sourceTier.replace(/_/g, ' ');

const VerifiedNewsPanel: React.FC<VerifiedNewsPanelProps> = ({ items, language }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="space-y-4">
      <NuxNotice tone="info">{t(language, 'news.researchOnlyNotice')}</NuxNotice>

      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((item, index) => {
          const confidenceColor = getConfidenceColor(item.confidenceScore);

          return (
            <article
              key={`${item.url || item.title}-${index}`}
              className="rounded-[20px] border p-5"
              style={{ backgroundColor: theme.colors.cardAltBg, borderColor: theme.colors.borderSubtle }}
            >
              <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em]">
                <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
                  {item.source}
                </span>
                <span className="rounded-full border px-2 py-1" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.accentSoft }}>
                  {t(language, 'news.sourceTier')}: {formatSourceTier(item.sourceTier)}
                </span>
                <span className="rounded-full border px-2 py-1" style={{ borderColor: confidenceColor, color: confidenceColor }}>
                  {t(language, getConfidenceKey(item.confidenceScore))}
                </span>
              </div>

              <h4 className="text-base font-semibold leading-6" style={{ color: theme.colors.textPrimary }}>
                {item.title}
              </h4>

              {item.text && (
                <p className="mt-3 line-clamp-3 text-sm leading-6" style={{ color: theme.colors.textSecondary }}>
                  {item.text}
                </p>
              )}

              <div className="mt-4 grid gap-3 text-xs md:grid-cols-2" style={{ color: theme.colors.textSecondary }}>
                <div>
                  <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                    {t(language, 'news.confidence')}
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" style={{ color: confidenceColor }} />
                    <span className="font-mono" style={{ color: confidenceColor }}>
                      {item.confidenceScore}/100
                    </span>
                  </div>
                </div>
                <div>
                  <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                    {t(language, 'news.duplicateCount')}
                  </div>
                  <span className="font-mono">{item.duplicateCount}</span>
                </div>
                <div>
                  <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                    {t(language, 'report.newsAnalysis')}
                  </div>
                  <span>{item.sentiment}</span>
                </div>
                <div>
                  <div className="mb-1 font-semibold" style={{ color: theme.colors.textMuted }}>
                    {t(language, 'news.verifiedBy')}
                  </div>
                  <span>{item.verifiedBySources.join(', ') || item.source}</span>
                </div>
              </div>

              {item.reliabilityNotes && item.reliabilityNotes.length > 0 && (
                <div className="mt-4 rounded-[14px] border p-3" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textMuted }}>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em]">
                    {t(language, 'news.reliabilityNotes')}
                  </div>
                  <ul className="space-y-1 pl-4 text-xs leading-5">
                    {item.reliabilityNotes.map((note) => (
                      <li key={note} className="list-disc">
                        {note}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                  style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.accentSoft }}
                >
                  {t(language, 'news.openOriginal')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
};

export default VerifiedNewsPanel;
