import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { theme } from '../designTokens';
import { Language, t } from '../i18n';

export const nuxPanelStyle = {
  backgroundColor: theme.colors.cardBg,
  borderColor: theme.colors.borderSubtle,
  boxShadow: theme.colors.shadowCard,
};

export const nuxInsetStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
};

export const NuxPage = ({ children }: { children: React.ReactNode }) => (
  <div className="space-y-6 pb-10 animate-fade-in">{children}</div>
);

export const NuxPageHeader = ({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) => (
  <section className="overflow-hidden rounded-[24px] border px-6 py-6 md:px-8" style={nuxPanelStyle}>
    <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        {eyebrow && (
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.24em]" style={{ color: theme.colors.accentSoft }}>
            {eyebrow}
          </div>
        )}
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: theme.colors.textPrimary }}>
          {title}
        </h1>
        {subtitle && (
          <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  </section>
);

export const NuxCard = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section className={`rounded-[24px] border ${className}`} style={nuxPanelStyle}>
    {children}
  </section>
);

export const NuxButton = ({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  className?: string;
}) => {
  const variantClass =
    variant === 'primary'
      ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'
      : variant === 'danger'
        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
        : 'bg-slate-900/70 hover:bg-slate-800 text-slate-200 border border-white/10';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 ${variantClass} ${className}`}
    >
      {children}
    </button>
  );
};

export const NuxNotice = ({
  children,
  tone = 'info',
}: {
  children: React.ReactNode;
  tone?: 'info' | 'warning' | 'danger' | 'success';
}) => {
  const toneStyle =
    tone === 'danger'
      ? { borderColor: 'rgba(255,92,122,0.28)', color: theme.colors.down }
      : tone === 'warning'
        ? { borderColor: 'rgba(243,182,63,0.28)', color: theme.colors.warn }
        : tone === 'success'
          ? { borderColor: 'rgba(31,209,138,0.28)', color: theme.colors.up }
          : { borderColor: 'rgba(76,141,255,0.28)', color: theme.colors.accentSoft };

  return (
    <div className="rounded-[18px] border px-4 py-3 text-sm leading-6" style={{ ...nuxInsetStyle, ...toneStyle }}>
      {children}
    </div>
  );
};

export const RiskDisclaimer = ({ language }: { language: Language }) => (
  <NuxNotice tone="warning">
    <div className="flex items-start gap-3">
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <span>{t(language, 'common.disclaimer')}</span>
    </div>
  </NuxNotice>
);
