import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
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
import { CompanyFundamentals, NewsItem, StockAnalysisReport, StockQuote, WhisperData } from '../types';

const glassCardClass =
  'rounded-[24px] border border-white/70 bg-white/65 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl';

const SectionCard = ({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) => (
  <section className={`${glassCardClass} overflow-hidden`}>
    <div className="flex items-center gap-3 border-b border-slate-200/70 bg-white/55 px-6 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      </div>
    </div>
    <div className="p-6">{children}</div>
  </section>
);

const InfoPill = ({ children }: { children: React.ReactNode }) => (
  <div className="rounded-full border border-slate-300/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-slate-600 shadow-sm">
    {children}
  </div>
);

const MarketSnapshot = ({ quote }: { quote: StockQuote | null }) => {
  if (!quote) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-500">
        Quote data is currently unavailable.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr_1fr]">
      <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-700 p-6 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <div className="text-[11px] uppercase tracking-[0.2em] text-slate-300">Market Snapshot</div>
        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <div className="text-3xl font-semibold tracking-tight">{quote.symbol}</div>
            <div className="mt-1 text-sm text-slate-300">Source: {quote.source || 'Unknown'}</div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold">${quote.price.toFixed(2)}</div>
            <div className={`mt-1 text-sm font-medium ${quote.change >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
              {quote.change > 0 ? '+' : ''}
              {quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/85 p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Estimated IV</div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">{(quote.volatility * 100).toFixed(1)}%</div>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">Heuristic volatility estimate from the current quote service.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/85 p-5">
        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Feed Quality</div>
        <div className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          {quote.source?.includes('Simulation') ? 'Limited' : 'Available'}
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Simulated or fallback quotes should be treated as research context only.
        </p>
      </div>
    </div>
  );
};

const FundamentalsSnapshot = ({ fundamentals }: { fundamentals: CompanyFundamentals | null }) => {
  if (!fundamentals) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-500">
        Company fundamentals are unavailable for this report run.
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
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white/90 p-6 md:flex-row">
        <div>
          <h4 className="text-2xl font-semibold tracking-tight text-slate-900">{fundamentals.companyName}</h4>
          <p className="mt-1 text-sm font-medium text-slate-500">{fundamentals.symbol}</p>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{fundamentals.description || 'No company description available.'}</p>
        </div>
        {fundamentals.website && (
          <a
            href={fundamentals.website}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Company Website
          </a>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: 'Market Cap', value: formatMarketCap(fundamentals.marketCap) },
          { label: 'Sector', value: fundamentals.sector || 'N/A' },
          { label: 'Industry', value: fundamentals.industry || 'N/A' },
          { label: 'Beta / P-E', value: `${fundamentals.beta ? fundamentals.beta.toFixed(2) : 'N/A'} / ${fundamentals.peRatio ? fundamentals.peRatio.toFixed(1) : 'N/A'}` },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-slate-200 bg-white/85 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
            <div className="mt-2 text-base font-semibold text-slate-900">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const NewsList = ({ news }: { news: NewsItem[] }) => {
  if (news.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-5 text-sm text-slate-500">
        No recent news items were available from the current feed.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm leading-relaxed text-amber-900">
        News sentiment is automatically estimated from available headlines/summaries and may be incomplete.
      </div>

      <div className="space-y-3">
        {news.map((item, index) => (
          <article key={`${item.url}-${index}`} className="rounded-2xl border border-slate-200 bg-white/85 p-5">
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500">
              <span>{item.site}</span>
              <span>•</span>
              <span>{new Date(item.publishedDate).toLocaleString()}</span>
              <span>•</span>
              <span>{item.sentiment}</span>
            </div>
            <h4 className="mt-3 text-lg font-semibold tracking-tight text-slate-900">{item.title}</h4>
            <p className="mt-2 text-sm leading-7 text-slate-600">{item.text || 'No summary text available.'}</p>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-500">Source: {item.site}</div>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
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

const DataAvailability = ({ notes }: { notes: string[] | undefined }) => {
  if (!notes || notes.length === 0) return null;

  return (
    <div className="rounded-2xl border border-sky-200 bg-sky-50/90 p-4 text-sm text-sky-900">
      <div className="mb-2 font-semibold">Data Availability Notes</div>
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

const ReportSections = ({ report }: { report: StockAnalysisReport }) => {
  const sections = [
    { title: 'Executive Summary', icon: Sparkles, body: report.summary },
    { title: 'Price Analysis', icon: BarChart3, body: report.priceAnalysis },
    { title: 'News & Sentiment', icon: Newspaper, body: report.newsAnalysis },
    { title: 'Fundamentals Analysis', icon: Building2, body: report.fundamentalsAnalysis },
    { title: 'Volatility & Options', icon: Waves, body: `${report.volatilityAnalysis}\n\n${report.optionsEducation}` },
    { title: 'Conclusion', icon: FileText, body: report.conclusion },
  ];

  return (
    <div className="space-y-4">
      <DataAvailability notes={report.dataAvailability} />
      <div className="grid gap-4 xl:grid-cols-2">
        {sections.map((section) => (
          <div key={section.title} className="rounded-3xl border border-slate-200 bg-white/90 p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-900 text-white">
                <section.icon className="h-4 w-4" />
              </div>
              <h4 className="text-sm font-semibold tracking-tight text-slate-900">{section.title}</h4>
            </div>
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{section.body}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-rose-200 bg-rose-50/90 p-5">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-600 text-white">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <h4 className="text-sm font-semibold tracking-tight text-rose-950">Risks</h4>
        </div>
        <ul className="space-y-2 pl-5 text-sm leading-7 text-rose-950">
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

const WhisperSummary = ({ whisper }: { whisper: WhisperData | null }) => (
  <div className="rounded-2xl border border-slate-200 bg-white/85 p-5">
    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Whisper Context</div>
    <p className="mt-3 text-sm leading-7 text-slate-600">
      {whisper
        ? `${whisper.summary} This is experimental, simulated-style alternative signal data and not a complete or verified social media dataset.`
        : 'Whisper data was unavailable for this run. When present, it is experimental, simulated-style alternative signal data rather than a complete or verified social media dataset.'}
    </p>
  </div>
);

const ReportView: React.FC = () => {
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
      setError('Report generation failed. Please try again in a moment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full rounded-[36px] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.95),_rgba(241,245,249,0.92)_35%,_rgba(226,232,240,0.85)_100%)] p-4 text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] md:p-6">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <section className={`${glassCardClass} overflow-hidden`}>
          <div className="relative px-6 py-6 md:px-8">
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-slate-200/70 via-white/60 to-blue-100/60" />
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-rose-400 shadow-sm" />
                  <span className="h-3 w-3 rounded-full bg-amber-400 shadow-sm" />
                  <span className="h-3 w-3 rounded-full bg-emerald-400 shadow-sm" />
                </div>
                <h2 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">AI Stock Analysis Report</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
                  A research-oriented workspace for quote context, company fundamentals, headline review, and a structured AI-generated summary.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <InfoPill>macOS-inspired light workspace</InfoPill>
                  <InfoPill>Structured Gemini summary</InfoPill>
                  <InfoPill>{REPORT_DISCLAIMER}</InfoPill>
                </div>
              </div>

              <div className="flex w-full flex-col gap-3 rounded-[28px] border border-white/80 bg-white/80 p-3 shadow-sm lg:w-auto lg:min-w-[420px]">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Ticker Symbol</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          void loadReport();
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-11 py-3 text-base font-semibold tracking-wide text-slate-900 outline-none transition focus:border-slate-400"
                      placeholder="NVDA"
                    />
                  </div>
                  <button
                    onClick={() => void loadReport()}
                    disabled={loading}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    Generate Report
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-900">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div>{error}</div>
            </div>
          </div>
        )}

        {!report && !loading && !error && (
          <section className={`${glassCardClass} overflow-hidden`}>
            <div className="p-8">
              <div className="max-w-3xl rounded-3xl border border-dashed border-slate-300 bg-white/75 p-6">
                <h3 className="text-lg font-semibold tracking-tight text-slate-900">Ready to generate a report</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Enter a ticker such as NVDA, AAPL, or TSLA and click <strong>Generate Report</strong>. If AI or market data keys are unavailable,
                  the page will stay visible and the report will fall back to available data or clear unavailable states.
                </p>
              </div>
            </div>
          </section>
        )}

        {report && (
          <>
            <SectionCard icon={BarChart3} title="Market Snapshot">
              <MarketSnapshot quote={report.quote} />
            </SectionCard>

            <SectionCard icon={Building2} title="Company Fundamentals">
              <FundamentalsSnapshot fundamentals={report.fundamentals} />
            </SectionCard>

            <SectionCard icon={Newspaper} title="Latest News">
              <div className="space-y-4">
                <NewsList news={report.news} />
                <WhisperSummary whisper={report.whisper} />
              </div>
            </SectionCard>

            <SectionCard icon={BookOpen} title="AI Generated Report">
              <ReportSections report={report} />
            </SectionCard>

            <SectionCard icon={AlertTriangle} title="Risk Disclaimer">
              <div className="space-y-3 text-sm leading-7 text-slate-700">
                <p className="font-semibold text-slate-900">{report.disclaimer}</p>
                <p>
                  News sentiment is automatically estimated from available headlines and summaries and may be incomplete.
                </p>
                <p>
                  Whisper data, when present, is experimental and simulated-style alternative signal data. It should not be treated as a complete or verified social media dataset.
                </p>
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
};

const REPORT_DISCLAIMER = 'For educational and research use only. Not financial advice.';

export default ReportView;
