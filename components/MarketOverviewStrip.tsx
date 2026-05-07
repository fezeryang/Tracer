import React, { useEffect, useState } from 'react';
import { StockQuote } from '../types';
import { fetchStockQuote } from '../services/marketDataService';
import { theme } from '../designTokens';
import { Language } from '../i18n';

const symbols = ['SPY', 'QQQ', 'DIA'];
const deferredSymbols = ['GLD', 'USO', 'BTC'];
const quoteLoadDelayMs = 500;

const labelMap: Record<string, string> = {
  SPY: 'S&P 500',
  QQQ: 'NASDAQ 100',
  DIA: 'DOW JONES',
  GLD: 'GOLD',
  USO: 'OIL',
  BTC: 'BTC',
};

const buildSparkline = (seed: number, isPositive: boolean) => {
  const points = Array.from({ length: 9 }, (_, index) => {
    const x = index * 14;
    const variance = Math.sin(seed + index * 0.9) * 8;
    const baseline = isPositive ? 34 - index * 1.4 : 16 + index * 1.4;
    const y = Math.max(6, Math.min(42, baseline + variance));
    return `${x},${y.toFixed(1)}`;
  });
  return points.join(' ');
};

const MarketOverviewStrip: React.FC<{ language: Language }> = () => {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);

  useEffect(() => {
    let active = true;
    let deferredTimer: number | undefined;

    const load = async (targetSymbols = symbols) => {
      const results = [];
      for (const symbol of targetSymbols) {
        try {
          results.push({ status: 'fulfilled' as const, value: await fetchStockQuote(symbol) });
        } catch (reason) {
          results.push({ status: 'rejected' as const, reason });
        }
        await new Promise((resolve) => window.setTimeout(resolve, quoteLoadDelayMs));
      }
      if (!active) return;

      setQuotes(
        results.flatMap((result, index) =>
          result.status === 'fulfilled'
            ? [result.value]
            : [
                {
                  symbol: targetSymbols[index],
                  price: 0,
                  change: 0,
                  changePercent: 0,
                  volatility: 0,
                  source: 'Unavailable',
                },
              ]
        )
      );
    };

    void load();
    deferredTimer = window.setTimeout(() => {
      void (async () => {
        await load([...symbols, ...deferredSymbols]);
      })();
    }, 300000);
    const interval = window.setInterval(load, 120000);
    return () => {
      active = false;
      if (deferredTimer) window.clearTimeout(deferredTimer);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {quotes.map((quote, index) => {
        const up = quote.changePercent >= 0;
        const sparkline = buildSparkline(index + quote.symbol.length, up);
        return (
          <div
            key={quote.symbol}
            className="rounded-[20px] border p-4"
            style={{
              backgroundColor: theme.colors.cardBg,
              borderColor: theme.colors.borderSubtle,
              boxShadow: theme.colors.shadowCard,
            }}
          >
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: theme.colors.textMuted }}>
              {labelMap[quote.symbol] || quote.symbol}
            </div>
            <div className="mt-2 flex items-end justify-between gap-3">
              <div>
                <div className="text-xl font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
                  {quote.price > 0 ? quote.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '--'}
                </div>
                <div className="mt-1 text-sm font-medium" style={{ color: up ? theme.colors.up : theme.colors.down }}>
                  {quote.changePercent > 0 ? '+' : ''}
                  {quote.changePercent.toFixed(2)}%
                </div>
              </div>
              <svg width="120" height="46" viewBox="0 0 120 46" fill="none">
                <polyline
                  points={sparkline}
                  fill="none"
                  stroke={up ? theme.colors.up : theme.colors.down}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default MarketOverviewStrip;
