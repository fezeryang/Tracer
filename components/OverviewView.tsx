import React, { useEffect, useState } from 'react';
import { Activity, Newspaper, ShieldAlert, Sparkles } from 'lucide-react';
import { Language, t } from '../i18n';
import { theme } from '../designTokens';
import { fetchStockQuote, fetchStockNews } from '../services/marketDataService';
import { NewsItem, StockQuote } from '../types';
import MarketOverviewStrip from './MarketOverviewStrip';
import WatchlistPanel from './WatchlistPanel';

const overviewSymbols = ['AAPL', 'NVDA'];
const deferredOverviewSymbols = ['MSFT', 'GOOGL', 'AMZN'];
const quoteLoadDelayMs = 500;

const Card = ({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) => (
  <section
    className="rounded-[24px] border p-5"
    style={{
      backgroundColor: theme.colors.cardBg,
      borderColor: theme.colors.borderSubtle,
      boxShadow: theme.colors.shadowCard,
    }}
  >
    <div className="mb-5">
      <h3 className="text-lg font-semibold" style={{ color: theme.colors.textPrimary }}>
        {title}
      </h3>
      {subtitle && (
        <p className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>
          {subtitle}
        </p>
      )}
    </div>
    {children}
  </section>
);

const OverviewView: React.FC<{ language: Language }> = ({ language }) => {
  const [watchlist, setWatchlist] = useState<StockQuote[]>([]);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    let active = true;
    let deferredTimer: number | undefined;

    const load = async () => {
      const newsPromise = fetchStockNews('SPY');
      const quotes: StockQuote[] = [];

      for (const symbol of overviewSymbols) {
        try {
          quotes.push(await fetchStockQuote(symbol));
        } catch (error) {
          console.warn(`[Overview] Quote unavailable for ${symbol}`, error);
        }
        await new Promise((resolve) => window.setTimeout(resolve, quoteLoadDelayMs));
      }

      const newsResults = await Promise.allSettled([newsPromise]);

      if (!active) return;

      setWatchlist(quotes);

      const firstNews = newsResults[0];
      setNews(firstNews.status === 'fulfilled' ? firstNews.value.slice(0, 3) : []);

      deferredTimer = window.setTimeout(() => {
        void (async () => {
          if (!active) return;
          const deferredQuotes: StockQuote[] = [];
          for (const symbol of deferredOverviewSymbols) {
            try {
              deferredQuotes.push(await fetchStockQuote(symbol));
            } catch (error) {
              console.warn(`[Overview] Deferred quote unavailable for ${symbol}`, error);
            }
            await new Promise((resolve) => window.setTimeout(resolve, quoteLoadDelayMs));
          }
          if (active && deferredQuotes.length > 0) {
            setWatchlist((current) => [...current, ...deferredQuotes]);
          }
        })();
      }, 300000);
    };

    void load();
    return () => {
      active = false;
      if (deferredTimer) window.clearTimeout(deferredTimer);
    };
  }, []);

  const now = new Date();
  const performanceSeries = [24, 31, 36, 41, 38, 46, 43, 48, 55, 61, 58, 66];
  const chartHeights = [78, 56, 62, 48, 72, 44, 50, 38, 59, 31, 43, 24];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
            {t(language, 'overview.title')}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
            {t(language, 'overview.subtitle')}
          </p>
        </div>
        <div
          className="rounded-[18px] border px-4 py-3 text-sm"
          style={{ borderColor: theme.colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.02)', color: theme.colors.textSecondary }}
        >
          {t(language, 'overview.generated')}: {t(language, 'overview.generatedValue')} · {now.toLocaleDateString()}
        </div>
      </div>

      <MarketOverviewStrip language={language} />

      <div className="grid gap-6 xl:grid-cols-[1.7fr_0.9fr_1fr]">
        <Card title={t(language, 'overview.performance')}>
          <div className="space-y-4">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-4xl font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
                  $2,847,632.18
                </div>
                <div className="mt-2 text-sm" style={{ color: theme.colors.up }}>
                  +24,729.18 (0.88%)
                </div>
              </div>
              <div className="text-sm" style={{ color: theme.colors.textMuted }}>
                1D · 1W · 1M · YTD
              </div>
            </div>

            <div
              className="relative overflow-hidden rounded-[18px] border p-4"
              style={{ borderColor: theme.colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.02)' }}
            >
              <svg viewBox="0 0 480 220" className="h-[260px] w-full">
                <defs>
                  <linearGradient id="overviewLineFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={theme.colors.accentFillStart} />
                    <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                  </linearGradient>
                </defs>
                <path d="M0 200 H480" stroke="rgba(255,255,255,0.06)" strokeDasharray="4 6" />
                <polyline
                  fill="none"
                  stroke={theme.colors.accentSoft}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={performanceSeries.map((value, index) => `${index * 42},${220 - value * 3}`).join(' ')}
                />
                <polygon
                  fill="url(#overviewLineFill)"
                  points={`0,220 ${performanceSeries.map((value, index) => `${index * 42},${220 - value * 3}`).join(' ')} 462,220`}
                />
              </svg>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={t(language, 'overview.allocation')}>
            <div className="flex items-center justify-center">
              <div
                className="relative flex h-44 w-44 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(${theme.colors.accent} 0 58%, ${theme.colors.accentSoft} 58% 74%, ${theme.colors.up} 74% 84%, ${theme.colors.warn} 84% 92%, ${theme.colors.textMuted} 92% 100%)`,
                }}
              >
                <div
                  className="flex h-24 w-24 flex-col items-center justify-center rounded-full"
                  style={{ backgroundColor: theme.colors.cardAltBg, color: theme.colors.textPrimary }}
                >
                  <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                    Assets
                  </div>
                  <div className="text-2xl font-semibold">$2.85M</div>
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-2 text-sm" style={{ color: theme.colors.textSecondary }}>
              {[
                ['Equities', '58.0%'],
                ['Fixed Income', '16.0%'],
                ['Alternatives', '10.0%'],
                ['Commodities', '8.0%'],
                ['Cash', '8.0%'],
              ].map(([name, value]) => (
                <div key={name} className="flex items-center justify-between">
                  <span>{name}</span>
                  <span>{value}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title={t(language, 'overview.riskOverview')}>
            <div className="space-y-4">
              <div className="flex items-end justify-between">
                <div className="text-4xl font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
                  42
                </div>
                <div className="text-sm font-medium" style={{ color: theme.colors.warn }}>
                  {t(language, 'overview.riskStatus')}
                </div>
              </div>
              <div className="h-2 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: '42%',
                    background: `linear-gradient(90deg, ${theme.colors.up}, ${theme.colors.warn}, ${theme.colors.down})`,
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                {[
                  ['Volatility', '12.45%'],
                  ['VaR (95%)', '-$78,430'],
                  ['Max DD', '-12.32%'],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ color: theme.colors.textMuted }}>{label}</div>
                    <div className="mt-1 font-medium" style={{ color: theme.colors.textPrimary }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <WatchlistPanel language={language} quotes={watchlist} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card title={t(language, 'overview.chartTitle')} subtitle={t(language, 'overview.chartSubtitle')}>
          <div
            className="rounded-[18px] border p-4"
            style={{ borderColor: theme.colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.02)' }}
          >
            <div className="mb-4 flex items-center justify-between text-sm" style={{ color: theme.colors.textSecondary }}>
              <div>AAPL · 1D · NASDAQ</div>
              <div style={{ color: theme.colors.up }}>193.92 → 195.89</div>
            </div>
            <div className="flex h-[290px] items-end gap-2 rounded-[16px] border p-4" style={{ borderColor: theme.colors.borderSubtle }}>
              {chartHeights.map((height, index) => (
                <div key={index} className="flex flex-1 flex-col justify-end gap-2">
                  <div
                    className="rounded-t-[10px]"
                    style={{
                      height: `${height + 70}px`,
                      backgroundColor: index % 3 === 0 ? theme.colors.down : theme.colors.up,
                      opacity: 0.9,
                    }}
                  />
                  <div
                    className="rounded-t-[6px]"
                    style={{
                      height: `${Math.max(16, height / 2)}px`,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card title={t(language, 'overview.aiInsight')}>
            <div className="flex items-start gap-3">
              <div className="rounded-[16px] p-3" style={{ backgroundColor: theme.colors.accentBgSoft, color: theme.colors.accentSoft }}>
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em]" style={{ color: theme.colors.textMuted }}>
                  AI
                </div>
                <p className="mt-2 text-sm leading-7" style={{ color: theme.colors.textSecondary }}>
                  {t(language, 'overview.aiInsightBody')}
                </p>
              </div>
            </div>
          </Card>

          <Card title={t(language, 'overview.marketNews')} subtitle={t(language, 'overview.marketNewsSubtitle')}>
            <div className="space-y-4">
              {(news.length > 0
                ? news
                : [
                    {
                      title: 'Fed signals policy flexibility as inflation cools',
                      text: 'A placeholder headline is shown when the live news feed is unavailable.',
                      site: 'Market Feed',
                      url: '#',
                      image: '',
                      publishedDate: new Date().toISOString(),
                      sentiment: 'Neutral' as const,
                      sentimentScore: 0,
                    },
                  ]
              ).map((item, index) => (
                <div
                  key={`${item.title}-${index}`}
                  className="rounded-[18px] border p-4"
                  style={{ borderColor: theme.colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="mb-2 flex items-center gap-2 text-xs" style={{ color: theme.colors.textMuted }}>
                    <Newspaper className="h-3.5 w-3.5" />
                    {item.site}
                  </div>
                  <div className="font-medium leading-6" style={{ color: theme.colors.textPrimary }}>
                    {item.title}
                  </div>
                  <div className="mt-2 text-sm leading-6" style={{ color: theme.colors.textSecondary }}>
                    {item.text}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default OverviewView;
