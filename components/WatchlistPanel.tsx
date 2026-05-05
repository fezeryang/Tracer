import React from 'react';
import { StockQuote } from '../types';
import { theme } from '../designTokens';
import { Language, t } from '../i18n';

interface WatchlistPanelProps {
  language: Language;
  quotes: StockQuote[];
}

const WatchlistPanel: React.FC<WatchlistPanelProps> = ({ language, quotes }) => {
  return (
    <div
      className="rounded-[24px] border p-5"
      style={{
        backgroundColor: theme.colors.cardBg,
        borderColor: theme.colors.borderSubtle,
        boxShadow: theme.colors.shadowCard,
      }}
    >
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold" style={{ color: theme.colors.textPrimary }}>
            {t(language, 'overview.watchlist')}
          </h3>
          <p className="mt-1 text-sm" style={{ color: theme.colors.textMuted }}>
            {t(language, 'overview.watchlistSubtitle')}
          </p>
        </div>
        <button className="text-sm" style={{ color: theme.colors.accentSoft }}>
          {t(language, 'overview.customize')}
        </button>
      </div>

      <div className="space-y-3">
        {quotes.map((quote) => {
          const up = quote.changePercent >= 0;
          return (
            <div
              key={quote.symbol}
              className="flex items-center justify-between rounded-[16px] border px-4 py-3"
              style={{ borderColor: theme.colors.borderSubtle, backgroundColor: 'rgba(255,255,255,0.02)' }}
            >
              <div>
                <div className="font-semibold" style={{ color: theme.colors.textPrimary }}>
                  {quote.symbol}
                </div>
                <div className="text-xs" style={{ color: theme.colors.textMuted }}>
                  {quote.source || t(language, 'common.unavailable')}
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold" style={{ color: theme.colors.textPrimary }}>
                  {quote.price > 0 ? `$${quote.price.toFixed(2)}` : '--'}
                </div>
                <div className="text-sm font-medium" style={{ color: up ? theme.colors.up : theme.colors.down }}>
                  {quote.change > 0 ? '+' : ''}
                  {quote.change.toFixed(2)} / {quote.changePercent.toFixed(2)}%
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default WatchlistPanel;
