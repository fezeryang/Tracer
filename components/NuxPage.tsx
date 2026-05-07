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
      ? 'bg-[var(--primary)] text-[var(--foreground)] shadow-[0_10px_28px_var(--blue-glow-shadow)] hover:bg-[var(--primary-hover)]'
      : variant === 'danger'
        ? 'bg-[var(--danger)] text-[var(--foreground)] shadow-[0_10px_28px_var(--danger-glow)]'
        : 'border bg-[var(--button-secondary)] text-[var(--foreground-soft)] hover:bg-[var(--button-secondary-hover)]';

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
      ? { backgroundColor: theme.colors.danger.soft, borderColor: theme.colors.danger.default, color: theme.colors.down }
      : tone === 'warning'
        ? { backgroundColor: theme.colors.warning.soft, borderColor: theme.colors.warning.default, color: theme.colors.warn }
        : tone === 'success'
          ? { backgroundColor: theme.colors.success.soft, borderColor: theme.colors.success.default, color: theme.colors.up }
          : { backgroundColor: theme.colors.primary.muted, borderColor: theme.colors.primary.default, color: theme.colors.accentSoft };

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
