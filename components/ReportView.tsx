import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  FileText,
  Newspaper,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Waves,
} from 'lucide-react';
import { generateStockAnalysisReport } from '../services/reportService';
import { CompanyFundamentals, NewsItem, ShellViewMode, StockAnalysisReport, StockQuote, WhisperData } from '../types';
import { Language, t } from '../i18n';
import { theme } from '../designTokens';
import { NuxButton, NuxNotice } from './NuxPage';

const shellCardStyle = {
  backgroundColor: theme.colors.cardBg,
  borderColor: theme.colors.borderSubtle,
  boxShadow: theme.colors.shadowCard,
};

const panelStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
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
    <div className="flex items-center gap-3 border-b px-6 py-4" style={{ borderColor: theme.colors.borderSubtle }}>
      <div
        className="flex h-10 w-10 items-center justify-center rounded-[14px]"
        style={{ backgroundColor: 'rgba(47,107,255,0.14)', color: theme.colors.accentSoft }}
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

const MarketSnapshot = ({ quote, language }: { quote: StockQuote | null; language: Language }) => {
  if (!quote) {
    return (
      <div className="rounded-[18px] border border-dashed p-5 text-sm" style={{ ...panelStyle, color: theme.colors.textMuted }}>
        {t(language, 'report.unavailableQuote')}
      </div>
    );
  }

  const up = quote.changePercent >= 0;

  return (
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
          Heuristic volatility estimate from the current quote service.
        </p>
      </div>

      <div className="rounded-[20px] border p-5" style={panelStyle}>
        <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
          {t(language, 'report.feedQuality')}
        </div>
        <div className="mt-3 text-3xl font-semibold" style={{ color: theme.colors.textPrimary }}>
          {quote.source?.includes('Simulation') ? t(language, 'report.limited') : t(language, 'report.available')}
        </div>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: theme.colors.textSecondary }}>
          Simulated or fallback quotes should be treated as research context only.
        </p>
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
      <div className="rounded-[18px] border border-dashed p-5 text-sm" style={{ ...panelStyle, color: theme.colors.textMuted }}>
        {t(language, 'report.unavailableFundamentals')}
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
            {fundamentals.description || 'No company description available.'}
          </p>
        </div>
        {fundamentals.website && (
          <a
            href={fundamentals.website}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-[14px] border px-4 py-3 text-sm font-medium transition"
            style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}
          >
            {t(language, 'report.companyWebsite')}
          </a>
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

      <div className="space-y-3">
        {news.map((item, index) => (
          <article key={`${item.url}-${index}`} className="rounded-[18px] border p-5" style={panelStyle}>
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium" style={{ color: theme.colors.textMuted }}>
              <span>{item.site}</span>
              <span>•</span>
              <span>{new Date(item.publishedDate).toLocaleString()}</span>
              <span>•</span>
              <span>{item.sentiment}</span>
            </div>
            <h4 className="mt-3 text-lg font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
              {item.title}
            </h4>
            <p className="mt-2 text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
              {item.text || 'No summary text available.'}
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
                Open Article
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
            {note}
          </li>
        ))}
      </ul>
    </div>
  );
};

const ReportSections = ({ report, language }: { report: StockAnalysisReport; language: Language }) => {
  const sections = [
    { title: t(language, 'report.executiveSummary'), icon: Sparkles, body: report.summary },
    { title: t(language, 'report.priceAnalysis'), icon: BarChart3, body: report.priceAnalysis },
    { title: t(language, 'report.newsAnalysis'), icon: Newspaper, body: report.newsAnalysis },
    { title: t(language, 'report.fundamentalsAnalysis'), icon: Building2, body: report.fundamentalsAnalysis },
    { title: t(language, 'report.volatilityOptions'), icon: Waves, body: `${report.volatilityAnalysis}\n\n${report.optionsEducation}` },
    { title: t(language, 'report.conclusion'), icon: FileText, body: report.conclusion },
  ];

  return (
    <div className="space-y-4">
      <DataAvailability notes={report.dataAvailability} language={language} />
      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="rounded-[20px] border p-5" style={panelStyle}>
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[12px]"
                style={{ backgroundColor: 'rgba(47,107,255,0.14)', color: theme.colors.accentSoft }}
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

      <div className="rounded-[20px] border p-5" style={{ ...panelStyle, borderColor: 'rgba(243,182,63,0.24)' }}>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ backgroundColor: 'rgba(243,182,63,0.14)', color: theme.colors.warn }}>
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
  onNavigate?: (view: ShellViewMode) => void;
}

const ReportView: React.FC<ReportViewProps> = ({ language, onNavigate }) => {
  const [ticker, setTicker] = useState('NVDA');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<StockAnalysisReport | null>(null);

  const loadReport = async (targetTicker?: string) => {
    const symbol = (targetTicker || ticker).trim().toUpperCase();
    if (!symbol) return;

    setLoading(true);
    setError(null);

    try {
      const result = await generateStockAnalysisReport(symbol);
      setReport(result);
      setTicker(symbol);
    } catch (err) {
      console.error(err);
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
              <div className="mb-3 flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.colors.down }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.colors.warn }} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.colors.up }} />
              </div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: theme.colors.textPrimary }}>
                {t(language, 'report.title')}
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
                {t(language, 'report.subtitle')}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <div className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
                  premium dark fintech dashboard
                </div>
                <div className="rounded-full border px-3 py-1 text-[11px] font-medium" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}>
                  {t(language, 'common.disclaimer')}
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3 rounded-[20px] border p-3 shadow-sm lg:w-auto lg:min-w-[420px]" style={panelStyle}>
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
                    style={{ ...panelStyle, color: theme.colors.textPrimary }}
                    placeholder="NVDA"
                  />
                </div>
                <button
                  onClick={() => void loadReport()}
                  disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-[14px] px-5 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: theme.colors.accent, boxShadow: theme.colors.shadowGlow }}
                >
                  {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  {t(language, 'common.generateReport')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-[20px] border px-5 py-4 text-sm" style={{ ...panelStyle, borderColor: 'rgba(255,92,122,0.24)', color: theme.colors.down }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div>{error}</div>
          </div>
        </div>
      )}

      {!report && !error && <NuxNotice tone="info">{t(language, 'report.configHint')}</NuxNotice>}

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
                  onClick={() => {
                    // TODO: pass report ticker when shared ticker state exists.
                    onNavigate?.(item.view);
                  }}
                >
                  {item.label}
                </NuxButton>
              ))}
            </div>
          </SectionCard>

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

          <SectionCard icon={BookOpen} title={t(language, 'report.aiReport')}>
            <ReportSections report={report} language={language} />
          </SectionCard>

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
