import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import { Language, t } from '../../i18n';
import { theme } from '../../designTokens';

export interface SentimentData {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
}

interface SentimentDonutProps {
  data: SentimentData;
  language: Language;
  height?: number;
  title?: string;
}

const panelStyle = {
  backgroundColor: theme.colors.cardAltBg,
  borderColor: theme.colors.borderSubtle,
};

const COLORS = {
  positive: theme.colors.chart.green,
  neutral: theme.colors.chart.gold,
  negative: theme.colors.chart.red,
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;
  const percentage = data.total > 0 ? ((data.value / data.total) * 100).toFixed(1) : '0.0';

  return (
    <div
      className="rounded-lg border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: theme.colors.card.bg,
        borderColor: theme.colors.borderSubtle,
      }}
    >
      <div className="text-xs font-medium" style={{ color: theme.colors.textPrimary }}>
        {data.name}
      </div>
      <div className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>
        {data.value} ({percentage}%)
      </div>
    </div>
  );
};

const SentimentDonut: React.FC<SentimentDonutProps> = ({
  data,
  language,
  height = 280,
  title,
}) => {
  const chartData = [
    {
      name: t(language, 'evidence.positive'),
      value: data.positive,
      color: COLORS.positive,
      total: data.total,
    },
    {
      name: t(language, 'evidence.neutral'),
      value: data.neutral,
      color: COLORS.neutral,
      total: data.total,
    },
    {
      name: t(language, 'evidence.negative'),
      value: data.negative,
      color: COLORS.negative,
      total: data.total,
    },
  ].filter((d) => d.value > 0);

  const hasData = data.total > 0;

  // Calculate percentages for labels
  const getPercentage = (value: number) =>
    data.total > 0 ? ((value / data.total) * 100).toFixed(1) : '0.0';

  if (!hasData) {
    return (
      <div className="rounded-[20px] border p-4" style={panelStyle}>
        <div className="mb-4 flex items-center gap-3">
          <PieChartIcon className="h-4 w-4" style={{ color: theme.colors.accentSoft }} />
          <h4 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
            {title || t(language, 'evidence.sentimentDistribution')}
          </h4>
        </div>
        <div className="flex h-48 items-center justify-center rounded-[18px] border border-dashed px-5 text-center text-sm" style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textMuted }}>
          {t(language, 'report.unavailableNews')}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[20px] border p-4" style={panelStyle}>
      <div className="mb-4 flex items-center gap-3">
        <PieChartIcon className="h-4 w-4" style={{ color: theme.colors.accentSoft }} />
        <h4 className="text-sm font-semibold" style={{ color: theme.colors.textPrimary }}>
          {title || t(language, 'evidence.sentimentDistribution')}
        </h4>
      </div>

      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={chartData.length > 1 ? 2 : 0}
              dataKey="value"
              cornerRadius={6}
              labelLine={false}
              label={(entry) => `${getPercentage(entry.value)}%`}
              fontSize={11}
              fontWeight={500}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Center label showing total */}
      <div className="mt-2 text-center">
        <div className="text-2xl font-semibold" style={{ color: theme.colors.textPrimary }}>
          {data.total}
        </div>
        <div className="text-[11px] uppercase tracking-wider" style={{ color: theme.colors.textMuted }}>
          {t(language, 'evidence.sentimentDistribution')}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        {data.positive > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: theme.colors.textMuted }}>
              {t(language, 'evidence.positive')}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.positive }}>
              {getPercentage(data.positive)}%
            </div>
          </div>
        )}
        {data.neutral > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: theme.colors.textMuted }}>
              {t(language, 'evidence.neutral')}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.neutral }}>
              {getPercentage(data.neutral)}%
            </div>
          </div>
        )}
        {data.negative > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: theme.colors.textMuted }}>
              {t(language, 'evidence.negative')}
            </div>
            <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.negative }}>
              {getPercentage(data.negative)}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SentimentDonut;
