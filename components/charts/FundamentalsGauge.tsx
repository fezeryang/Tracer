import React from 'react';
import { ArrowDown, ArrowUp, Building2, DollarSign, TrendingUp, Zap } from 'lucide-react';
import { Language, t } from '../../i18n';
import { theme } from '../../designTokens';

export interface FundamentalsData {
  marketCap?: number;
  peRatio?: number;
  beta?: number;
  eps?: number;
  revenue?: number;
  sector?: string;
  industry?: string;
}

interface FundamentalsGaugeProps {
  data: FundamentalsData;
  language: Language;
}

const panelStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
};

const formatMarketCap = (value: number | undefined, language: Language): string => {
  if (!value || !Number.isFinite(value)) return t(language, 'evidence.unavailable');
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  return `$${value.toLocaleString()}`;
};

const getPERating = (pe: number | undefined): { color: string; label: string } => {
  if (pe === undefined || !Number.isFinite(pe)) {
    return { color: theme.colors.textMuted, label: 'N/A' };
  }
  if (pe < 0) return { color: theme.colors.down, label: 'Negative' };
  if (pe < 10) return { color: theme.colors.warn, label: 'Low' };
  if (pe <= 25) return { color: theme.colors.up, label: 'Normal' };
  return { color: theme.colors.down, label: 'High' };
};

const getBetaRating = (beta: number | undefined): { color: string; icon: React.ReactNode } => {
  if (beta === undefined || !Number.isFinite(beta)) {
    return { color: theme.colors.textMuted, icon: null };
  }
  if (beta > 1) return { color: theme.colors.chart.orange, icon: <ArrowUp className="h-3 w-3" /> };
  if (beta < 1) return { color: theme.colors.chart.cyan, icon: <ArrowDown className="h-3 w-3" /> };
  return { color: theme.colors.chart.gold, icon: <Zap className="h-3 w-3" /> };
};

const getEPSRating = (eps: number | undefined): { color: string } => {
  if (eps === undefined || !Number.isFinite(eps)) {
    return { color: theme.colors.textMuted };
  }
  if (eps > 0) return { color: theme.colors.up };
  if (eps < 0) return { color: theme.colors.down };
  return { color: theme.colors.textMuted };
};

const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
  color?: string;
  subtitle?: string;
  rating?: { color: string; label?: string; icon?: React.ReactNode };
}> = ({ icon, label, value, color, subtitle, rating }) => (
  <div className="rounded-[14px] border p-3 transition-all hover:shadow-lg" style={{ borderColor: theme.colors.borderSubtle }}>
    <div className="flex items-start justify-between gap-2">
      <div className="flex items-center gap-2">
        <div className="flex-shrink-0" style={{ color: theme.colors.accentSoft }}>
          {icon}
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.12em]" style={{ color: theme.colors.textMuted }}>
            {label}
          </div>
          <div className="mt-1 text-sm font-semibold" style={{ color: color || theme.colors.textPrimary }}>
            {value}
          </div>
          {subtitle && (
            <div className="text-[10px]" style={{ color: theme.colors.textMuted }}>
              {subtitle}
            </div>
          )}
        </div>
      </div>
      {rating && (
        <div className="flex flex-col items-end gap-1">
          {rating.icon && <div style={{ color: rating.color }}>{rating.icon}</div>}
          {rating.label && (
            <div className="text-[10px] font-medium uppercase" style={{ color: rating.color }}>
              {rating.label}
            </div>
          )}
        </div>
      )}
    </div>
  </div>
);

const FundamentalsGauge: React.FC<FundamentalsGaugeProps> = ({ data, language }) => {
  const peRating = getPERating(data.peRatio);
  const betaRating = getBetaRating(data.beta);
  const epsRating = getEPSRating(data.eps);

  const metrics = [
    {
      icon: <Building2 className="h-4 w-4" />,
      label: t(language, 'evidence.marketCap'),
      value: formatMarketCap(data.marketCap, language),
      subtitle: data.sector,
    },
    {
      icon: <TrendingUp className="h-4 w-4" />,
      label: t(language, 'evidence.peRatio'),
      value: typeof data.peRatio === 'number' && Number.isFinite(data.peRatio) ? data.peRatio.toFixed(1) : 'N/A',
      rating: peRating,
    },
    {
      icon: <Zap className="h-4 w-4" />,
      label: t(language, 'evidence.beta'),
      value: typeof data.beta === 'number' && Number.isFinite(data.beta) ? data.beta.toFixed(2) : 'N/A',
      rating: betaRating,
    },
    {
      icon: <DollarSign className="h-4 w-4" />,
      label: t(language, 'evidence.eps'),
      value: typeof data.eps === 'number' && Number.isFinite(data.eps) ? `$${data.eps.toFixed(2)}` : 'N/A',
      subtitle: data.industry,
      rating: epsRating,
    },
    {
      icon: <DollarSign className="h-4 w-4" />,
      label: t(language, 'evidence.revenue'),
      value: formatMarketCap(data.revenue, language),
    },
  ];

  return (
    <div className="rounded-[20px] border p-4" style={panelStyle}>
      <div className="mb-3 flex items-center gap-3">
        <Building2 className="h-4 w-4" style={{ color: theme.colors.accentSoft }} />
        <h4 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
          {t(language, 'evidence.fundamentalsSnapshot')}
        </h4>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </div>
    </div>
  );
};

export default FundamentalsGauge;
