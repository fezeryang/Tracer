import React from 'react';
import { Database, ShieldCheck } from 'lucide-react';
import { Language, t } from '../i18n';
import { theme } from '../designTokens';
import { DataSourceHealth, DataSourceStatus, ReportEvidencePack, StockAnalysisReport } from '../types';
import { buildSourceTrustSummary } from '../services/sourceTrustService';
import { CandlestickChart, SentimentDonut, FundamentalsGauge } from './charts';

const panelStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
};

const statusColor = (status: DataSourceStatus | ReportEvidencePack['priceHistoryStatus']) => {
  if (status === 'success' || status === 'available') return theme.colors.up;
  if (status === 'simulation' || status === 'fallback' || status === 'timeout' || status === 'rate_limited') return theme.colors.warn;
  return theme.colors.down;
};

const getEvidenceStatusLabel = (
  language: Language,
  status: DataSourceStatus | ReportEvidencePack['priceHistoryStatus']
) => {
  const keyByStatus: Record<string, string> = {
    success: 'evidence.available',
    available: 'evidence.available',
    unavailable: 'evidence.unavailable',
    timeout: 'evidence.error',
    rate_limited: 'evidence.error',
    forbidden: 'evidence.error',
    error: 'evidence.error',
    simulation: 'evidence.simulation',
    fallback: 'evidence.fallback',
  };

  return t(language, keyByStatus[status] || 'evidence.unavailable');
};

const findHealth = (items: DataSourceHealth[] | undefined, key: string) => items?.find((item) => item.key === key);

const buildDataAvailabilityRows = (report: StockAnalysisReport, language: Language) => {
  const health = report.dataSourceHealth || [];
  const rows = [
    { key: 'quote', label: t(language, 'report.data.quote'), health: findHealth(health, 'quote') },
    { key: 'fundamentals', label: t(language, 'report.data.fundamentals'), health: findHealth(health, 'fundamentals') },
    { key: 'news', label: t(language, 'report.data.news'), health: findHealth(health, 'news') },
    { key: 'verifiedNews', label: t(language, 'report.data.verifiedNews'), health: findHealth(health, 'verifiedNews') },
    { key: 'officialFilings', label: t(language, 'report.data.officialFilings'), health: findHealth(health, 'officialFilings') },
    { key: 'officialSources', label: t(language, 'report.data.officialSources'), health: findHealth(health, 'officialSources') },
    { key: 'ai', label: t(language, 'report.aiProvider'), health: findHealth(health, 'ai') },
  ];

  return rows.map((row) => ({
    ...row,
    status: row.health?.status || 'unavailable',
  }));
};

const buildSentimentFallback = (report: StockAnalysisReport) => {
  const positive = report.news.filter((item) => item.sentiment === 'Positive').length;
  const neutral = report.news.filter((item) => item.sentiment === 'Neutral').length;
  const negative = report.news.filter((item) => item.sentiment === 'Negative').length;
  return { positive, neutral, negative, total: positive + neutral + negative };
};

const EvidenceHeader = ({ language }: { language: Language }) => (
  <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
    <div>
      <div className="text-[11px] uppercase tracking-[0.2em]" style={{ color: theme.colors.accentSoft }}>
        {t(language, 'evidence.title')}
      </div>
      <p className="mt-2 max-w-3xl text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
        {t(language, 'evidence.subtitle')}
      </p>
    </div>
    <div className="rounded-full border px-3 py-1.5 text-xs font-medium" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
      {t(language, 'evidence.researchOnlyNotice')}
    </div>
  </div>
);

const PriceTrend = ({ evidencePack, language }: { evidencePack?: ReportEvidencePack; language: Language }) => {
  const history = evidencePack?.priceHistoryStatus === 'available' ? evidencePack.priceHistory || [] : [];

  return <CandlestickChart data={history} language={language} height={280} />;
};

const SentimentDistribution = ({ report, evidencePack, language }: { report: StockAnalysisReport; evidencePack?: ReportEvidencePack; language: Language }) => {
  const summary = evidencePack?.sentimentSummary || buildSentimentFallback(report);

  return <SentimentDonut data={summary} language={language} height={280} />;
};

const DataAvailability = ({ report, language }: { report: StockAnalysisReport; language: Language }) => (
  <div className="rounded-[20px] border p-4" style={panelStyle}>
    <div className="mb-4 flex items-center gap-3">
      <Database className="h-4 w-4" style={{ color: theme.colors.accentSoft }} />
      <h4 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
        {t(language, 'evidence.dataAvailability')}
      </h4>
    </div>
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {buildDataAvailabilityRows(report, language).map((row) => {
        const color = statusColor(row.status);
        return (
          <div key={row.key} className="rounded-[14px] border p-3" style={panelStyle}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: theme.colors.textMuted }}>
                  {row.label}
                </div>
                <div className="mt-1 text-sm font-semibold" style={{ color }}>
                  {getEvidenceStatusLabel(language, row.status)}
                </div>
              </div>
              <span className="mt-1 h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

const FundamentalsSnapshot = ({ report, evidencePack, language }: { report: StockAnalysisReport; evidencePack?: ReportEvidencePack; language: Language }) => {
  const snapshot = evidencePack?.fundamentalsSnapshot || report.fundamentals || undefined;

  return <FundamentalsGauge data={snapshot || {}} language={language} />;
};

const SourceTrustSummary = ({ report, evidencePack, language }: { report: StockAnalysisReport; evidencePack?: ReportEvidencePack; language: Language }) => {
  const summary = buildSourceTrustSummary({
    ticker: report.ticker,
    verifiedNews: report.verifiedNews,
    officialFilings: report.officialFilings,
    officialSources: report.officialSources,
  });
  const score = evidencePack?.sourceTrustScore ?? summary.overallScore;
  const level = evidencePack?.sourceTrustLevel || summary.confidenceLevel;

  const items = [
    { label: t(language, 'sourceTrust.overallScore'), value: `${score}/100` },
    { label: t(language, 'sourceTrust.confidenceLevel'), value: t(language, `sourceTrust.${level}`) },
    { label: t(language, 'sourceTrust.officialSources'), value: summary.officialSourceCount.toLocaleString() },
    { label: t(language, 'sourceTrust.verifiedNews'), value: summary.verifiedNewsCount.toLocaleString() },
    { label: t(language, 'sourceTrust.secFilings'), value: summary.secFilingCount.toLocaleString() },
  ];

  return (
    <div className="rounded-[20px] border p-4" style={panelStyle}>
      <div className="mb-3 flex items-center gap-3">
        <ShieldCheck className="h-4 w-4" style={{ color: theme.colors.semantic.up }} />
        <h4 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
          {t(language, 'evidence.sourceTrustSummary')}
        </h4>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-[14px] border p-3" style={panelStyle}>
            <div className="text-[11px] uppercase tracking-[0.16em]" style={{ color: theme.colors.textMuted }}>
              {item.label}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ReportEvidencePanel = ({ report, language }: { report: StockAnalysisReport; language: Language }) => {
  const evidencePack = report.evidencePack;

  return (
    <div className="space-y-4">
      <EvidenceHeader language={language} />
      <div className="grid gap-4 xl:grid-cols-2">
        <PriceTrend evidencePack={evidencePack} language={language} />
        <SentimentDistribution report={report} evidencePack={evidencePack} language={language} />
      </div>
      <DataAvailability report={report} language={language} />
      <FundamentalsSnapshot report={report} evidencePack={evidencePack} language={language} />
      <SourceTrustSummary report={report} evidencePack={evidencePack} language={language} />
    </div>
  );
};

export default ReportEvidencePanel;
