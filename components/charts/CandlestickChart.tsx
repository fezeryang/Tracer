import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calendar } from 'lucide-react';
import { Language, t } from '../../i18n';
import { theme } from '../../designTokens';
import { PriceHistoryPoint } from '../../types';

interface CandlestickChartProps {
  data: PriceHistoryPoint[];
  language: Language;
  height?: number;
}

type DateRange = '1M' | '3M' | '6M' | 'MAX';

const panelStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
};

const formatAxisTick = (value: number) => {
  if (!Number.isFinite(value)) return '';
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (absValue >= 10_000) return `${Math.round(value / 1_000)}K`;
  if (absValue >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  if (absValue >= 100) return value.toFixed(0);
  return value.toFixed(2);
};

// Calculate Simple Moving Average
const calculateSMA = (data: PriceHistoryPoint[], period: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += data[i - j].close;
    }
    result.push(sum / period);
  }
  return result;
};

// Filter data by date range
const filterByDateRange = (data: PriceHistoryPoint[], range: DateRange): PriceHistoryPoint[] => {
  if (range === 'MAX') return data;
  const now = new Date();
  const daysAgo = range === '1M' ? 30 : range === '3M' ? 90 : 180;
  const cutoff = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  return data.filter((d) => d.date >= cutoffStr);
};

// Custom tooltip for OHLCV
const CustomTooltip = ({ active, payload, label, language }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const hasOHLC = typeof data.open === 'number' && typeof data.high === 'number' && typeof data.low === 'number';

  const change = data.close && data.open
    ? ((data.close - data.open) / data.open) * 100
    : null;
  const changeColor = change && change >= 0 ? theme.colors.up : theme.colors.down;

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: theme.colors.card.bg,
        borderColor: theme.colors.borderSubtle,
      }}
    >
      <div className="mb-2 text-xs font-medium" style={{ color: theme.colors.textMuted }}>
        {label}
      </div>
      {hasOHLC ? (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span style={{ color: theme.colors.textMuted }}>O:</span>
          <span className="font-medium" style={{ color: theme.colors.textPrimary }}>
            ${typeof data.open === 'number' ? data.open.toFixed(2) : 'N/A'}
          </span>
          <span style={{ color: theme.colors.textMuted }}>H:</span>
          <span className="font-medium" style={{ color: theme.colors.textPrimary }}>
            ${typeof data.high === 'number' ? data.high.toFixed(2) : 'N/A'}
          </span>
          <span style={{ color: theme.colors.textMuted }}>L:</span>
          <span className="font-medium" style={{ color: theme.colors.textPrimary }}>
            ${typeof data.low === 'number' ? data.low.toFixed(2) : 'N/A'}
          </span>
          <span style={{ color: theme.colors.textMuted }}>C:</span>
          <span className="font-medium" style={{ color: theme.colors.textPrimary }}>
            ${typeof data.close === 'number' ? data.close.toFixed(2) : 'N/A'}
          </span>
          <span style={{ color: theme.colors.textMuted }}>Vol:</span>
          <span className="font-medium" style={{ color: theme.colors.textPrimary }}>
            {typeof data.volume === 'number'
              ? (data.volume / 1000000).toFixed(2) + 'M'
              : 'N/A'}
          </span>
          {change !== null && (
            <>
              <span style={{ color: theme.colors.textMuted }}>Chg:</span>
              <span className="font-medium" style={{ color: changeColor }}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            </>
          )}
        </div>
      ) : (
        <div className="text-xs">
          <span style={{ color: theme.colors.textMuted }}>Close: </span>
          <span className="font-medium" style={{ color: theme.colors.textPrimary }}>
            ${typeof data.close === 'number' ? data.close.toFixed(2) : 'N/A'}
          </span>
        </div>
      )}
    </div>
  );
};

const DateRangeSelector = ({
  currentRange,
  onRangeChange,
  language,
}: {
  currentRange: DateRange;
  onRangeChange: (range: DateRange) => void;
  language: Language;
}) => {
  const ranges: DateRange[] = ['1M', '3M', '6M', 'MAX'];

  return (
    <div className="flex items-center gap-2 rounded-full border px-1.5 py-1" style={{ borderColor: theme.colors.borderSubtle }}>
      <Calendar className="h-3.5 w-3.5" style={{ color: theme.colors.textMuted }} />
      {ranges.map((range) => (
        <button
          key={range}
          onClick={() => onRangeChange(range)}
          className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors"
          style={{
            backgroundColor: currentRange === range ? theme.colors.accent : 'transparent',
            color: currentRange === range ? 'white' : theme.colors.textMuted,
          }}
        >
          {range}
        </button>
      ))}
    </div>
  );
};

const CandlestickChart: React.FC<CandlestickChartProps> = ({ data, language, height = 320 }) => {
  const [dateRange, setDateRange] = useState<DateRange>('MAX');

  const chartData = useMemo(() => {
    const filtered = filterByDateRange(data, dateRange);
    const hasOHLC = filtered.some((d) => typeof d.open === 'number' && typeof d.high === 'number');

    if (!hasOHLC || filtered.length === 0) return filtered;

    // Add SMA values
    const sma5 = calculateSMA(filtered, 5);
    const sma20 = calculateSMA(filtered, 20);

    return filtered.map((d, i) => ({
      ...d,
      sma5: sma5[i] || NaN,
      sma20: sma20[i] || NaN,
    }));
  }, [data, dateRange]);

  const hasOHLC = chartData.some((d) => typeof d.open === 'number' && typeof d.high === 'number');

  // Domain for price axis
  const allPrices = chartData.flatMap((d) => [
    d.close,
    d.open,
    d.high,
    d.low,
  ].filter((v): v is number => typeof v === 'number'));
  const minPrice = allPrices.length > 0 ? Math.min(...allPrices) * 0.995 : 0;
  const maxPrice = allPrices.length > 0 ? Math.max(...allPrices) * 1.005 : 100;

  if (chartData.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-[18px] border border-dashed px-5 text-center text-sm" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textMuted }}>
        {t(language, 'evidence.noPriceHistory')}
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border p-4" style={panelStyle}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
          {t(language, 'evidence.priceTrend')}
        </h4>
        <DateRangeSelector
          currentRange={dateRange}
          onRangeChange={setDateRange}
          language={language}
        />
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
          >
            <XAxis
              dataKey="date"
              tick={{ fill: theme.colors.textMuted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={30}
            />
            <YAxis
              yAxisId="price"
              domain={[minPrice, maxPrice]}
              tick={{ fill: theme.colors.textMuted, fontSize: 11 }}
              tickFormatter={formatAxisTick}
              tickMargin={10}
              axisLine={false}
              tickLine={false}
              width={68}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              tick={{ fill: theme.colors.textMuted, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={40}
              hide
            />

            <Tooltip content={<CustomTooltip language={language} />} />

            {/* Volume bars at bottom */}
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill={theme.colors.chart.blue}
              opacity={0.2}
              radius={[0, 0, 0, 0]}
              maxBarSize={20}
            />

            {hasOHLC ? (
              <>
                {/* Line chart for close price when OHLC is available */}
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  stroke={theme.colors.chart.blue}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                {/* SMA-5 Line */}
                <Line
                  yAxisId="price"
                  dataKey="sma5"
                  stroke={theme.colors.chart.cyan}
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 4"
                  name="SMA 5"
                />
                {/* SMA-20 Line */}
                <Line
                  yAxisId="price"
                  dataKey="sma20"
                  stroke={theme.colors.chart.orange}
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="4 4"
                  name="SMA 20"
                />
              </>
            ) : (
              /* Fallback to simple line chart */
              <>
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  stroke={theme.colors.chart.blue}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                {/* Area fill under line */}
                <Area
                  yAxisId="price"
                  type="monotone"
                  dataKey="close"
                  fill={theme.colors.chart.blue}
                  opacity={0.1}
                  stroke="none"
                />
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-[11px]" style={{ color: theme.colors.textMuted }}>
        <div className="flex items-center gap-1.5">
          <div className="h-0.5 w-6" style={{ backgroundColor: theme.colors.chart.blue }} />
          <span>{t(language, 'evidence.chartClose')}</span>
        </div>
        {hasOHLC && (
          <>
            <div className="flex items-center gap-1.5">
              <div
                className="h-0.5 w-6"
                style={{
                  backgroundImage: `linear-gradient(to right, ${theme.colors.chart.cyan} 50%, transparent 50%)`,
                  backgroundSize: '4px 1px',
                  backgroundRepeat: 'repeat-x',
                }}
              />
              <span>{t(language, 'evidence.chartSma5')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div
                className="h-0.5 w-6"
                style={{
                  backgroundImage: `linear-gradient(to right, ${theme.colors.chart.orange} 50%, transparent 50%)`,
                  backgroundSize: '4px 1px',
                  backgroundRepeat: 'repeat-x',
                }}
              />
              <span>{t(language, 'evidence.chartSma20')}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CandlestickChart;
