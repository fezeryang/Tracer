import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  Database,
  ExternalLink,
  FileText,
  Globe2,
  Newspaper,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Waves,
} from 'lucide-react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { generateStockAnalysisReport } from '../services/reportService';
import { assessQuoteQuality, getDataAvailability, getSentimentCounts } from '../services/reportQualityService';
import { buildSourceTrustSummary } from '../services/sourceTrustService';
import {
  CompanyFundamentals,
  DataSourceHealth,
  DataSourceStatus,
  NewsItem,
  ReportGenerationStage,
  ShellViewMode,
  StockAnalysisReport,
  StockQuote,
  WhisperData,
} from '../types';
import { Language, t } from '../i18n';
import { theme } from '../designTokens';
import { NuxButton, NuxNotice } from './NuxPage';
import SourceTrustCenter from './SourceTrustCenter';
import ReportEvidencePanel from './ReportEvidencePanel';
import AiResearchReportPanel from './AiResearchReportPanel';

const shellCardStyle = {
  backgroundColor: theme.colors.card.bg,
  borderColor: theme.colors.card.border,
  boxShadow: '0 18px 44px var(--shadow-soft)',
};

const panelStyle = {
  backgroundColor: theme.colors.card.bgAlt,
  borderColor: theme.colors.card.border,
};

const reportHeroStyle = {
  background:
    'linear-gradient(135deg, var(--background-elevated), var(--background) 58%, var(--background-soft))',
  borderColor: theme.colors.card.borderStrong,
  boxShadow: '0 22px 54px var(--shadow-soft)',
};

const getQualityColor = (quality: ReturnType<typeof assessQuoteQuality>) => {
  if (quality === 'realtime' || quality === 'delayed') return theme.colors.up;
  if (quality === 'fallback' || quality === 'simulation') return theme.colors.warn;
  return theme.colors.down;
};

const formatMarketCapValue = (num?: number) => {
  if (!num || !Number.isFinite(num)) return 'N/A';
  if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  return `$${num.toLocaleString()}`;
};

const getSourceTrustLevelColor = (level: string | undefined) => {
  if (level === 'high') return theme.colors.up;
  if (level === 'medium') return theme.colors.warn;
  if (level === 'low') return theme.colors.down;
  return theme.colors.textMuted;
};

const getSentimentLabel = (language: Language, sentiment: NewsItem['sentiment']) => {
  if (sentiment === 'Positive') return t(language, 'report.sentimentPositive');
  if (sentiment === 'Negative') return t(language, 'report.sentimentNegative');
  return t(language, 'report.sentimentNeutral');
};

const generationStageOrder: ReportGenerationStage[] = ['quote', 'fundamentals', 'news', 'trust', 'ai', 'finalizing'];

const getGenerationStageLabel = (language: Language, stage: ReportGenerationStage) => {
  const keyByStage: Partial<Record<ReportGenerationStage, string>> = {
    quote: 'report.generationStageQuote',
    fundamentals: 'report.generationStageFundamentals',
    news: 'report.generationStageNews',
    trust: 'report.generationStageTrust',
    ai: 'report.generationStageAi',
    finalizing: 'report.generationStageFinalizing',
  };

  return keyByStage[stage] ? t(language, keyByStage[stage]!) : '';
};

const getDataSourceStatusLabel = (language: Language, status: DataSourceStatus) => {
  const keyByStatus: Record<DataSourceStatus, string> = {
    success: 'report.dataSourceSuccess',
    unavailable: 'report.dataSourceUnavailable',
    timeout: 'report.dataSourceTimeout',
    rate_limited: 'report.dataSourceRateLimited',
    forbidden: 'report.dataSourceForbidden',
    error: 'report.dataSourceError',
    simulation: 'report.dataSourceSimulation',
    fallback: 'report.dataSourceFallback',
  };
  const key = keyByStatus[status] || 'report.dataSourceSuccess';
  const result = t(language, key);
  return result;
};

const getDataSourceStatusColor = (status: DataSourceStatus) => {
  if (status === 'success') return theme.colors.up;
  if (status === 'simulation' || status === 'fallback' || status === 'rate_limited' || status === 'timeout') return theme.colors.warn;
  return theme.colors.down;
};

const getDataSourceStatusMessage = (language: Language, item: DataSourceHealth) => {
  if (item.status === 'rate_limited') {
    return language === 'zh'
      ? '数据源请求过于频繁，已触发限流。请稍后重试。'
      : 'Market data provider is rate limited. Please retry later.';
  }
  return item.message;
};

const formatReportDateTime = (value: string | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

const formatAvailabilityNote = (language: Language, note: string) => {
  if (note.includes('simulation or fallback')) return t(language, 'report.availabilityNotes.quoteSimulation');
  if (note.includes('Live quote data was unavailable')) return t(language, 'report.availabilityNotes.quoteUnavailable');
  if (note.includes('Company fundamentals')) return t(language, 'report.availabilityNotes.fundamentalsUnavailable');
  if (note.includes('No recent news')) return t(language, 'report.availabilityNotes.newsUnavailable');
  if (note.includes('SEC EDGAR')) return t(language, 'report.availabilityNotes.secUnavailable');
  if (note.includes('Official source discovery')) return t(language, 'report.availabilityNotes.officialSourcesUnavailable');
  if (note.includes('Whisper signals')) return t(language, 'report.availabilityNotes.whisperExperimental');
  if (note.includes('Whisper alternative signal data was unavailable')) return t(language, 'report.availabilityNotes.whisperUnavailable');
  if (note.includes('Data source issues detected')) return t(language, 'report.availabilityNotes.dataSourceIssues', { sources: note.replace(/^Data source issues detected: /, '').replace(/\.$/, '') });
  return note;
};

const SectionCard = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="overflow-hidden rounded-[24px] border" style={shellCardStyle}>
    <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: theme.colors.card.border }}>
      <div
        className="flex h-9 w-9 items-center justify-center rounded-[12px]"
        style={{ backgroundColor: theme.colors.primary.muted, color: theme.colors.accentSoft }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <h3 className="text-sm font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
        {title}
      </h3>
    </div>
    <div className="p-6">{children}</div>
  </section>
);

const ResearchBadge = ({ label, color }: { label: string; color: string }) => (
  <span
    className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"
    style={{ borderColor: color, color, backgroundColor: theme.colors.card.bgAlt }}
  >
    {label}
  </span>
);

const SummaryMetricCard = ({
  label,
  value,
  detail,
  color = theme.colors.textPrimary,
}: {
  label: string;
  value: string;
  detail: string;
  color?: string;
}) => (
  <div className="rounded-[18px] border p-5" style={panelStyle}>
    <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
      {label}
    </div>
    <div className="mt-3 truncate text-2xl font-semibold tracking-tight" style={{ color }}>
      {value}
    </div>
    <p className="mt-2 line-clamp-2 text-sm leading-6" style={{ color: theme.colors.textSecondary }}>
      {detail}
    </p>
  </div>
);

const ReportSummaryGrid = ({ report, language }: { report: StockAnalysisReport; language: Language }) => {
  const quality = assessQuoteQuality(report.quote);
  const qualityColor = getQualityColor(quality);
  const trustSummary = buildSourceTrustSummary({
    ticker: report.ticker,
    verifiedNews: report.verifiedNews,
    officialFilings: report.officialFilings,
    officialSources: report.officialSources,
  });
  const health = report.dataSourceHealth || [];
  const successCount = health.filter((item) => item.status === 'success').length;
  const limitedCount = health.filter((item) => item.status !== 'success').length;
  const trustColor = getSourceTrustLevelColor(trustSummary.confidenceLevel);

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <SummaryMetricCard
        label={t(language, 'report.marketSnapshot')}
        value={report.quote ? `$${report.quote.price.toFixed(2)}` : t(language, 'common.unavailable')}
        detail={report.quote ? `${report.quote.symbol} / ${t(language, `report.quality.${quality}`)}` : t(language, 'report.unavailableQuote')}
        color={qualityColor}
      />
      <SummaryMetricCard
        label={t(language, 'report.fundamentals')}
        value={formatMarketCapValue(report.fundamentals?.marketCap)}
        detail={report.fundamentals?.sector || t(language, 'report.unavailableFundamentals')}
      />
      <SummaryMetricCard
        label={t(language, 'sourceTrust.title')}
        value={`${trustSummary.overallScore}/100`}
        detail={t(language, `sourceTrust.${trustSummary.confidenceLevel}`)}
        color={trustColor}
      />
      <SummaryMetricCard
        label={t(language, 'report.dataSourceStatus')}
        value={`${successCount}/${health.length || 0}`}
        detail={limitedCount > 0 ? t(language, 'report.dataSourceLimitedSummary') : t(language, 'report.dataSourceHealthySummary')}
        color={limitedCount > 0 ? theme.colors.warn : theme.colors.up}
      />
    </div>
  );
};

const MarketSnapshot = ({ quote, language }: { quote: StockQuote | null; language: Language }) => {
  if (!quote) {
    return (
      <div className="rounded-[18px] border border-dashed p-5 text-sm" style={{ ...panelStyle, color: theme.colors.textMuted }}>
        {t(language, 'report.unavailableQuote')}
      </div>
    );
  }

  const up = quote.changePercent >= 0;
  const quality = assessQuoteQuality(quote);
  const qualityColor = getQualityColor(quality);
  const isSimulatedOrFallback = quality === 'simulation' || quality === 'fallback';

  return (
    <div className="space-y-4">
      {isSimulatedOrFallback && (
        <div className="rounded-[18px] border p-4 text-sm leading-6" style={{ ...panelStyle, backgroundColor: theme.colors.warning.soft, borderColor: theme.colors.warning.default, color: theme.colors.warn }}>
          {t(language, 'report.simulatedQuoteWarning')}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
      <div className="rounded-[20px] border p-6" style={panelStyle}>
        <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: theme.colors.textMuted }}>
          {t(language, 'report.marketSnapshot')}
        </div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
              {quote.symbol}
            </div>
            <div className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>
              {t(language, 'report.source')}: {quote.source || t(language, 'common.unavailable')}
            </div>
            <div className="mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ borderColor: qualityColor, color: qualityColor }}>
              {t(language, `report.quality.${quality}`)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold" style={{ color: theme.colors.textPrimary }}>
              ${quote.price.toFixed(2)}
            </div>
            <div className="mt-1 text-sm font-medium" style={{ color: up ? theme.colors.up : theme.colors.down }}>
              {quote.change > 0 ? '+' : ''}
              {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-[20px] border p-5" style={panelStyle}>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
          {t(language, 'report.estimatedIv')}
        </div>
        <div className="mt-3 text-3xl font-semibold" style={{ color: theme.colors.textPrimary }}>
          {(quote.volatility * 100).toFixed(1)}%
        </div>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.colors.textSecondary }}>
          {t(language, 'report.estimatedIvNotice')}
        </p>
      </div>

      <div className="rounded-[20px] border p-5" style={panelStyle}>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
          {t(language, 'report.feedQuality')}
        </div>
        <div className="mt-3 text-3xl font-semibold" style={{ color: theme.colors.textPrimary }}>
          {t(language, `report.quality.${quality}`)}
        </div>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.colors.textSecondary }}>
          {isSimulatedOrFallback ? t(language, 'report.quoteCheckTicker') : t(language, 'report.realQuoteNotice')}
        </p>
      </div>
      </div>
    </div>
  );
};

const FundamentalsSnapshot = ({
  fundamentals,
  language,
}: {
  fundamentals: CompanyFundamentals | null;
  language: Language;
}) => {
  if (!fundamentals) {
    return (
      <div className="flex flex-col justify-between gap-4 rounded-[18px] border border-dashed p-5 text-sm md:flex-row md:items-center" style={{ ...panelStyle, color: theme.colors.textMuted }}>
        <span>{t(language, 'report.unavailableFundamentals')}</span>
        <button
          disabled
          className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-[14px] border px-4 text-sm font-medium opacity-60"
          style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textMuted }}
        >
          <Globe2 className="h-4 w-4" />
          {t(language, 'report.noCompanyWebsite')}
        </button>
      </div>
    );
  }

  const formatMarketCap = (num: number) => {
    if (!num) return 'N/A';
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-4 rounded-[20px] border p-6 md:flex-row" style={panelStyle}>
        <div>
          <h4 className="text-2xl font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
            {fundamentals.companyName}
          </h4>
          <p className="mt-1 text-sm font-medium" style={{ color: theme.colors.textMuted }}>
            {fundamentals.symbol}
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
            {fundamentals.description || t(language, 'report.noDescription')}
          </p>
        </div>
        {fundamentals.website ? (
          <a
            href={fundamentals.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-[14px] border px-4 text-sm font-medium transition"
            style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.accentSoft }}
          >
            <Globe2 className="h-4 w-4" />
            {t(language, 'report.companyWebsite')}
          </a>
        ) : (
          <button
            disabled
            className="inline-flex h-11 cursor-not-allowed items-center justify-center gap-2 rounded-[14px] border px-4 text-sm font-medium opacity-60"
            style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textMuted }}
          >
            <Globe2 className="h-4 w-4" />
            {t(language, 'report.noCompanyWebsite')}
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: t(language, 'report.marketCap'), value: formatMarketCap(fundamentals.marketCap) },
          { label: t(language, 'report.sector'), value: fundamentals.sector || 'N/A' },
          { label: t(language, 'report.industry'), value: fundamentals.industry || 'N/A' },
          {
            label: t(language, 'report.betaPe'),
            value: `${fundamentals.beta ? fundamentals.beta.toFixed(2) : 'N/A'} / ${fundamentals.peRatio ? fundamentals.peRatio.toFixed(1) : 'N/A'}`,
          },
          ...(fundamentals.eps ? [{ label: t(language, 'report.eps'), value: `$${fundamentals.eps.toFixed(2)}` }] : []),
          ...(fundamentals.revenue ? [{ label: t(language, 'report.revenue'), value: formatMarketCap(fundamentals.revenue) }] : []),
        ].map((item) => (
          <div key={item.label} className="rounded-[18px] border p-4" style={panelStyle}>
            <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
              {item.label}
            </div>
            <div className="mt-2 text-base font-semibold" style={{ color: theme.colors.textPrimary }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const NewsSentimentChart = ({ news, language }: { news: NewsItem[]; language: Language }) => {
  const counts = getSentimentCounts(news);
  const data = [
    { label: t(language, 'report.sentimentPositive'), value: counts.Positive, color: theme.colors.chart.green },
    { label: t(language, 'report.sentimentNeutral'), value: counts.Neutral, color: theme.colors.chart.gold },
    { label: t(language, 'report.sentimentNegative'), value: counts.Negative, color: theme.colors.chart.red },
  ];

  return (
    <div className="rounded-[18px] border p-4" style={panelStyle}>
      <div className="mb-3 text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
        {t(language, 'report.sentimentDistribution')}
      </div>
      <div className="h-40">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <XAxis dataKey="label" tick={{ fill: theme.colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: theme.colors.textMuted, fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: theme.colors.card.hover }}
              contentStyle={{ backgroundColor: theme.colors.cardBg, border: `1px solid ${theme.colors.borderSubtle}`, borderRadius: 12, color: theme.colors.textPrimary }}
            />
            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const NewsList = ({ news, language }: { news: NewsItem[]; language: Language }) => {
  if (news.length === 0) {
    return (
      <div className="rounded-[18px] border border-dashed p-5 text-sm" style={{ ...panelStyle, color: theme.colors.textMuted }}>
        {t(language, 'report.unavailableNews')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[18px] border px-4 py-3 text-sm leading-relaxed" style={{ ...panelStyle, color: theme.colors.warn }}>
        {t(language, 'report.newsSentimentNotice')}
      </div>
      <NewsSentimentChart news={news} language={language} />

      <div className="space-y-3">
        {news.map((item, index) => (
          <article key={`${item.url}-${index}`} className="rounded-[18px] border p-5" style={panelStyle}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium" style={{ color: theme.colors.textMuted }}>
              <span>{item.site}</span>
              <span>•</span>
              <span>{new Date(item.publishedDate).toLocaleString()}</span>
              <span>•</span>
              <span>{getSentimentLabel(language, item.sentiment)}</span>
            </div>
            <div className="mt-3 text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.colors.textMuted }}>
              {t(language, 'report.originalTitle')}
            </div>
            <h4 className="mt-3 text-lg font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
              {item.title}
            </h4>
            {language === 'zh' && (
              <p className="mt-2 text-xs leading-5" style={{ color: theme.colors.textMuted }}>
                {t(language, 'report.englishSummaryNotice')}
              </p>
            )}
            <p className="mt-2 text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
              {item.text || t(language, 'report.noNewsSummary')}
            </p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                {t(language, 'report.source')}: {item.site}
              </div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border px-3 py-1.5 text-xs font-medium transition"
                style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.accentSoft }}
              >
                {t(language, 'report.openArticle')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

const DataAvailability = ({ notes, language }: { notes: string[] | undefined; language: Language }) => {
  if (!notes || notes.length === 0) return null;

  return (
    <div className="rounded-[18px] border p-4 text-sm" style={{ ...panelStyle, color: theme.colors.textSecondary }}>
      <div className="mb-2 font-semibold" style={{ color: theme.colors.textPrimary }}>
        {t(language, 'report.dataNotes')}
      </div>
      <ul className="space-y-1.5 pl-5 text-sm leading-6">
        {notes.map((note) => (
          <li key={note} className="list-disc">
            {formatAvailabilityNote(language, note)}
          </li>
        ))}
      </ul>
    </div>
  );
};

const DataAvailabilityCards = ({ report, language }: { report: StockAnalysisReport; language: Language }) => {
  const items = getDataAvailability({
    quote: report.quote,
    fundamentals: report.fundamentals,
    news: report.news,
    verifiedNews: report.verifiedNews,
    officialFilings: report.officialFilings,
    officialSources: report.officialSources,
  });

  const statusColor = (status: string) => {
    if (status === 'available') return theme.colors.up;
    if (status === 'limited') return theme.colors.warn;
    return theme.colors.down;
  };

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {items.map((item) => (
        <div key={item.key} className="rounded-[18px] border p-4" style={panelStyle}>
          <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: theme.colors.textMuted }}>
            {t(language, `report.data.${item.key}`)}
          </div>
          <div className="mt-2 text-sm font-semibold" style={{ color: statusColor(item.status) }}>
            {t(language, `report.dataStatus.${item.status}`)}
          </div>
        </div>
      ))}
    </div>
  );
};

const GenerationProgress = ({ stage, language }: { stage: ReportGenerationStage; language: Language }) => {
  if (stage === 'idle' || stage === 'done') return null;

  const activeIndex = generationStageOrder.indexOf(stage);

  return (
    <div className="rounded-[20px] border p-5" style={panelStyle}>
      <div className="mb-4 flex items-center gap-3 text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
        <RefreshCw className="h-4 w-4 animate-spin" style={{ color: theme.colors.accentSoft }} />
        {getGenerationStageLabel(language, stage)}
      </div>
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
        {generationStageOrder.map((item, index) => {
          const complete = activeIndex >= index;
          return (
            <div
              key={item}
              className="rounded-[14px] border px-3 py-2 text-[11px] font-semibold"
              style={{
                borderColor: complete ? theme.colors.accentSoft : theme.colors.borderSubtle,
                color: complete ? theme.colors.accentSoft : theme.colors.textMuted,
                backgroundColor: complete ? theme.colors.accentBg : theme.colors.cardAltBg,
              }}
            >
              {getGenerationStageLabel(language, item)}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DataSourceStatusPanel = ({ items, language }: { items: DataSourceHealth[] | undefined; language: Language }) => {
  if (!items || items.length === 0) return null;

  return (
    <div className="rounded-[20px] border p-5" style={panelStyle}>
      <div className="mb-4 text-sm font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
        {t(language, 'report.dataSourceStatus')}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const color = getDataSourceStatusColor(item.status);
          const message = getDataSourceStatusMessage(language, item);
          return (
            <div key={`${item.key}-${item.updatedAt}`} className="rounded-[16px] border p-4" style={panelStyle}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: theme.colors.textMuted }}>
                    {item.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold" style={{ color }}>
                    {getDataSourceStatusLabel(language, item.status)}
                  </div>
                </div>
                <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
              </div>
              {message && (
                <p className="mt-3 line-clamp-2 text-xs leading-5" style={{ color: theme.colors.textMuted }}>
                  {message}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AiProviderNotice = ({ report, language }: { report: StockAnalysisReport; language: Language }) => {
  const isDeepSeek = report.aiProvider === 'deepseek';
  const badge = isDeepSeek ? t(language, 'report.deepSeekBadge') : t(language, 'report.fallbackBadge');
  const message = isDeepSeek ? t(language, 'report.generatedByDeepSeek') : t(language, 'report.aiEngineUnavailable');
  const color = isDeepSeek ? theme.colors.up : theme.colors.warn;

  return (
    <div className="rounded-[18px] border p-4" style={panelStyle}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
            {t(language, 'report.aiProvider')}
          </div>
          <p className="mt-2 text-sm leading-6" style={{ color: theme.colors.textSecondary }}>
            {message}
          </p>
        </div>
        <div className="inline-flex w-fit items-center rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em]" style={{ borderColor: color, color }}>
          {badge}
          {report.aiModel ? ` / ${report.aiModel}` : ''}
        </div>
      </div>
    </div>
  );
};

const ReportSections = ({ report, language }: { report: StockAnalysisReport; language: Language }) => {
  const sections = [
    { title: t(language, 'report.executiveSummary'), icon: Sparkles, body: report.summary },
    { title: t(language, 'report.dataAvailabilityAnalysis'), icon: Database, body: report.dataAvailabilityAnalysis || t(language, 'report.sourceTrustAnalysisUnavailable') },
    { title: t(language, 'report.priceAnalysis'), icon: BarChart3, body: report.priceAnalysis },
    { title: t(language, 'report.newsAnalysis'), icon: Newspaper, body: report.newsAnalysis },
    { title: t(language, 'report.fundamentalsAnalysis'), icon: Building2, body: report.fundamentalsAnalysis },
    { title: t(language, 'report.sourceTrustAnalysis'), icon: ShieldCheck, body: report.sourceTrustAnalysis || t(language, 'report.sourceTrustAnalysisUnavailable') },
    { title: t(language, 'report.volatilityOptions'), icon: Waves, body: `${report.volatilityAnalysis}\n\n${report.optionsEducation}` },
    { title: t(language, 'report.conclusion'), icon: FileText, body: report.conclusion },
  ];

  return (
    <div className="space-y-4">
      <AiProviderNotice report={report} language={language} />
      <DataAvailabilityCards report={report} language={language} />
      <DataAvailability notes={report.dataAvailability} language={language} />
      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="rounded-[20px] border p-5" style={panelStyle}>
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[12px]"
                style={{ backgroundColor: theme.colors.accentBgSoft, color: theme.colors.accentSoft }}
              >
                <section.icon className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
                {section.title}
              </h4>
            </div>
            <p className="whitespace-pre-line text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
              {section.body}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-[20px] border p-5" style={{ ...panelStyle, borderColor: theme.colors.warning.default }}>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: theme.colors.warning.soft, color: theme.colors.warn }}>
            <ShieldAlert className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
            {t(language, 'report.risks')}
          </h4>
        </div>
        <ul className="space-y-2 pl-5 text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
          {report.risks.map((risk) => (
            <li key={risk} className="list-disc">
              {risk}
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-[20px] border p-5" style={panelStyle}>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: theme.colors.accentBgSoft, color: theme.colors.accentSoft }}>
            <ArrowRight className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
            {t(language, 'report.followUpChecklist')}
          </h4>
        </div>
        <ul className="space-y-2 pl-5 text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
          {(report.followUpChecklist && report.followUpChecklist.length > 0 ? report.followUpChecklist : [t(language, 'report.followUpUnavailable')]).map((item) => (
            <li key={item} className="list-disc">
              {item}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

const WhisperSummary = ({ whisper, language }: { whisper: WhisperData | null; language: Language }) => (
  <div className="rounded-[18px] border p-5" style={panelStyle}>
    <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
      {t(language, 'report.whisperContext')}
    </div>
    <p className="mt-3 text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
      {whisper ? `${whisper.summary} ${t(language, 'report.whisperNotice')}` : t(language, 'report.whisperNotice')}
    </p>
  </div>
);

interface ReportViewProps {
  language: Language;
  selectedTicker: string;
  onTickerChange: (ticker: string) => void;
  cachedReport?: StockAnalysisReport | null;
  onReportGenerated: (report: StockAnalysisReport) => void;
  onNavigate?: (view: ShellViewMode) => void;
}

const normalizeReportTicker = (value: string) => (value || 'NVDA').trim().toUpperCase();

const ReportView: React.FC<ReportViewProps> = ({
  language,
  selectedTicker,
  onTickerChange,
  cachedReport,
  onReportGenerated,
  onNavigate,
}) => {
  const [ticker, setTicker] = useState(() => normalizeReportTicker(cachedReport?.ticker || selectedTicker));
  const [loading, setLoading] = useState(false);
  const [generationStage, setGenerationStage] = useState<ReportGenerationStage>('idle');
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<StockAnalysisReport | null>(() => cachedReport || null);

  useEffect(() => {
    if (cachedReport) {
      setReport(cachedReport);
      setTicker(normalizeReportTicker(cachedReport.ticker));
      return;
    }

    if (!report) {
      setTicker(normalizeReportTicker(selectedTicker));
    }
  }, [cachedReport, report, selectedTicker]);

  const loadReport = async (targetTicker?: string) => {
    const symbol = normalizeReportTicker(targetTicker || ticker);
    if (!symbol) return;

    setLoading(true);
    setGenerationStage('quote');
    setError(null);

    try {
      const result = await generateStockAnalysisReport(symbol, language, setGenerationStage);
      setGenerationStage('finalizing');
      setReport(result);
      setTicker(result.ticker);
      onTickerChange(result.ticker);
      onReportGenerated(result);
      setGenerationStage('done');
    } catch (err) {
      console.error(err);
      setGenerationStage('error');
      setError(t(language, 'report.configHint'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[24px] border" style={shellCardStyle}>
        <div className="px-6 py-6 md:px-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              {/* NUX wordmark accent line */}
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px flex-1 max-w-[48px]" style={{ backgroundColor: theme.colors.accentSoft }} />
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em]" style={{ color: theme.colors.accentSoft }}>
                  NUX
                </span>
              </div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: theme.colors.textPrimary }}>
                {t(language, 'report.title')}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
                {t(language, 'report.subtitle')}
              </p>
              {/* Badges row */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {report && (
                  <>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                      style={{
                        borderColor: report.aiProvider === 'deepseek' ? theme.colors.up : theme.colors.warn,
                        color: report.aiProvider === 'deepseek' ? theme.colors.up : theme.colors.warn,
                        backgroundColor: report.aiProvider === 'deepseek' ? theme.colors.success.soft : theme.colors.warning.soft,
                      }}
                    >
                      {report.aiProvider === 'deepseek' ? t(language, 'report.deepSeekBadge') : t(language, 'report.fallbackBadge')}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em]"
                      style={{
                        borderColor: theme.colors.borderSubtle,
                        color: theme.colors.textSecondary,
                      }}
                    >
                      {report.ticker} {t(language, 'common.currentResearchTarget')}
                    </span>
                  </>
                )}
                <div className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
                  {t(language, 'common.disclaimer')}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 rounded-[20px] border p-3 shadow-sm lg:w-auto lg:min-w-[420px]" style={panelStyle}>
              {/* Cached notice above input */}
              {report && report.isCached && !loading && (
                <div className="text-[11px]" style={{ color: theme.colors.warn }}>
                  {t(language, 'report.cachedReport')}
                </div>
              )}
              <label className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: theme.colors.textMuted }}>
                {t(language, 'report.tickerLabel')}
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: theme.colors.textMuted }} />
                  <input
                    type="text"
                    value={ticker}
                    onChange={(e) => setTicker(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void loadReport();
                      }
                    }}
                    className="w-full rounded-[14px] border px-11 py-3 text-base font-semibold tracking-wide outline-none transition"
                    style={{
                      backgroundColor: theme.colors.input.bg,
                      borderColor: theme.colors.input.border,
                      color: theme.colors.textPrimary,
                      boxShadow: '0 0 0 1px var(--primary-glow)',
                    }}
                    placeholder="NVDA"
                  />
                </div>
                <button
                  onClick={() => void loadReport()}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] px-6 py-3 text-sm font-semibold shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: theme.colors.primary.default, color: theme.colors.textPrimary, boxShadow: '0 10px 28px var(--blue-glow-shadow)' }}
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {report ? t(language, 'report.regenerateReport') : t(language, 'common.generateReport')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[20px] border px-5 py-4 text-sm" style={{ ...panelStyle, backgroundColor: theme.colors.danger.soft, borderColor: theme.colors.danger.default, color: theme.colors.down }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        </div>
      )}

      <GenerationProgress stage={generationStage} language={language} />

      {!report && !error && <NuxNotice tone="info">{t(language, 'report.configHint')}</NuxNotice>}
      {report && report.isCached && !loading && !error && (
        <NuxNotice tone="warning">
          {t(language, 'report.cachedReportNotice', { time: formatReportDateTime(report.cachedAt || report.generatedAt) })}
        </NuxNotice>
      )}

      {!report && !loading && !error && (
        <section className="overflow-hidden rounded-[24px] border" style={shellCardStyle}>
          <div className="p-8">
            <div className="max-w-3xl rounded-[20px] border border-dashed p-6" style={{ ...panelStyle, color: theme.colors.textSecondary }}>
              <h3 className="text-lg font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
                {t(language, 'report.emptyTitle')}
              </h3>
              <p className="mt-3 text-sm leading-7">{t(language, 'report.emptyBody')}</p>
            </div>
          </div>
        </section>
      )}

      {report && (
        <>
          <SectionCard icon={ArrowRight} title={t(language, 'report.relatedActions')}>
            <div className="flex flex-wrap gap-3">
              {[
                { view: 'chain' as ShellViewMode, label: t(language, 'report.viewOptionsChain') },
                { view: 'backtest' as ShellViewMode, label: t(language, 'report.runBacktest') },
                { view: 'news-impact' as ShellViewMode, label: t(language, 'report.analyzeNewsImpact') },
                { view: 'macro' as ShellViewMode, label: t(language, 'report.openMacroView') },
                { view: 'chat' as ShellViewMode, label: t(language, 'report.askInChat') },
              ].map((item) => (
                <NuxButton
                  key={item.view}
                  variant="secondary"
                  disabled={loading}
                  onClick={() => {
                    onTickerChange(report.ticker);
                    onNavigate?.(item.view);
                  }}
                >
                  {item.label}
                </NuxButton>
              ))}
            </div>
          </SectionCard>

          <DataSourceStatusPanel items={report.dataSourceHealth} language={language} />

          <SectionCard icon={BarChart3} title={t(language, 'report.marketSnapshot')}>
            <MarketSnapshot quote={report.quote} language={language} />
          </SectionCard>

          <SectionCard icon={Building2} title={t(language, 'report.fundamentals')}>
            <FundamentalsSnapshot fundamentals={report.fundamentals} language={language} />
          </SectionCard>

          <SectionCard icon={Newspaper} title={t(language, 'report.latestNews')}>
            <div className="space-y-4">
              <NewsList news={report.news} language={language} />
              <WhisperSummary whisper={report.whisper} language={language} />
            </div>
          </SectionCard>

          <SectionCard icon={ShieldCheck} title={t(language, 'sourceTrust.title')}>
            <SourceTrustCenter
              ticker={report.ticker}
              summary={buildSourceTrustSummary({
                ticker: report.ticker,
                verifiedNews: report.verifiedNews,
                officialFilings: report.officialFilings,
                officialSources: report.officialSources,
              })}
              verifiedNews={report.verifiedNews}
              officialFilings={report.officialFilings}
              officialSources={report.officialSources}
              language={language}
            />
          </SectionCard>

          <SectionCard icon={BarChart3} title={t(language, 'evidence.title')}>
            <ReportEvidencePanel report={report} language={language} />
          </SectionCard>

          <AiResearchReportPanel report={report} language={language} />

          <SectionCard icon={AlertTriangle} title={t(language, 'report.riskDisclaimer')}>
            <div className="space-y-3 text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
              <p className="font-semibold" style={{ color: theme.colors.textPrimary }}>
                {report.disclaimer || t(language, 'common.disclaimer')}
              </p>
              <p>{t(language, 'report.newsSentimentNotice')}</p>
              <p>{t(language, 'report.whisperNotice')}</p>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
};

export default ReportView;
