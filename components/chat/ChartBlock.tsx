
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Language, t } from '../../i18n';
import { ChatChartPoint, ChatChartType } from '../../types';

export type ChartPoint = ChatChartPoint;

interface ChartBlockProps {
  language: Language;
  title?: string;
  description?: string;
  data: ChartPoint[];
  type?: ChatChartType;
  color?: string;
  secondaryColor?: string;
  source?: string;
  sourceUrl?: string;
  dataQuality?: 'available' | 'limited' | 'simulation' | 'unavailable' | 'fallback';
  xAxisLabel?: string;
  yAxisLabel?: string;
  secondaryYAxisLabel?: string;
  legend?: string[];
  compact?: boolean;
  validationStatus?: 'valid' | 'limited' | 'unavailable' | 'fallback';
}

const PIE_COLORS = ['#818cf8', '#34d399', '#f59e0b', '#f472b6', '#38bdf8', '#a78bfa'];

const normalizeType = (type?: ChatChartType): ChatChartType => {
  return type === 'bar' || type === 'area' || type === 'pie' || type === 'line' ? type : 'line';
};

const normalizeData = (data: ChartPoint[] | unknown): ChartPoint[] => {
  if (!Array.isArray(data)) return [];
  return data
    .filter((point: any) => (
      point
      && typeof point.label === 'string'
      && typeof point.value === 'number'
      && Number.isFinite(point.value)
      && (point.secondary === undefined || (typeof point.secondary === 'number' && Number.isFinite(point.secondary)))
    ))
    .map((point: ChatChartPoint) => ({
      label: point.label,
      value: point.value,
      secondary: point.secondary,
      category: point.category,
      source: point.source,
    }));
};

const qualityBadge = (
  language: Language,
  dataQuality?: ChartBlockProps['dataQuality'],
  validationStatus?: ChartBlockProps['validationStatus'],
) => {
  const quality = dataQuality || (validationStatus === 'unavailable' ? 'unavailable' : undefined);
  if (!quality) return null;

  const config: Record<NonNullable<ChartBlockProps['dataQuality']>, string> = {
    available: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    limited: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    simulation: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300',
    fallback: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    unavailable: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  };

  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${config[quality]}`}>
      {t(language, `chat.chart.${quality}`)}
    </span>
  );
};

const TooltipContent: React.FC<{ active?: boolean; payload?: any[]; label?: string }> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-lg p-2 text-xs shadow-xl">
      <p className="text-slate-400 font-medium mb-1">{label}</p>
      {payload.map((entry: any, idx: number) => (
        <p key={idx} className="font-mono text-white">
          {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(2) : entry.value}
        </p>
      ))}
    </div>
  );
};

const EmptyState: React.FC<{
  language: Language;
  title?: string;
  source?: string;
  dataQuality?: ChartBlockProps['dataQuality'];
  validationStatus?: ChartBlockProps['validationStatus'];
}> = ({ language, title, source, dataQuality, validationStatus }) => (
  <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
        <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
        {title || t(language, 'chat.blocks.chart')}
      </h4>
      <div className="flex items-center gap-2">
        {source && <span className="text-[10px] text-slate-500">{t(language, 'chat.chart.source')}: {source}</span>}
        {qualityBadge(language, dataQuality || 'unavailable', validationStatus)}
      </div>
    </div>
    <p className="mt-3 text-xs text-slate-500 italic">{t(language, 'chat.chart.noData')}</p>
    <p className="mt-2 text-[11px] text-slate-500">{t(language, 'chat.chart.researchOnly')}</p>
  </div>
);

const ChartBlock: React.FC<ChartBlockProps> = ({
  language,
  title,
  description,
  data,
  type = 'line',
  color = '#818cf8',
  secondaryColor = '#34d399',
  source,
  sourceUrl,
  dataQuality,
  xAxisLabel,
  yAxisLabel,
  secondaryYAxisLabel,
  legend,
  compact,
  validationStatus,
}) => {
  const chartType = normalizeType(type);
  const chartData = normalizeData(data);
  const hasEnoughData = chartType === 'pie' ? chartData.length > 0 : chartData.length >= 2;
  const hasSecondary = chartData.some((point) => point.secondary !== undefined);
  const chartHeight = compact ? 'h-48' : 'h-64';
  const primaryLabel = legend?.[0] || yAxisLabel || 'Value';
  const secondaryLabel = legend?.[1] || secondaryYAxisLabel || 'Secondary';

  if (!hasEnoughData) {
    return (
      <EmptyState
        language={language}
        title={title}
        source={source}
        dataQuality={dataQuality || 'unavailable'}
        validationStatus={validationStatus}
      />
    );
  }

  const commonAxis = {
    tick: { fill: '#64748b', fontSize: 10 },
    axisLine: { stroke: '#1e293b' },
    tickLine: false,
  };

  const renderCartesianChart = () => {
    if (chartType === 'bar') {
      return (
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="label"
            {...commonAxis}
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 } : undefined}
          />
          <YAxis
            {...commonAxis}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, fill: '#64748b', fontSize: 10 } : undefined}
          />
          <Tooltip content={<TooltipContent />} />
          <Bar dataKey="value" fill={color} fillOpacity={0.8} name={primaryLabel} />
          {hasSecondary && (
            <Bar dataKey="secondary" fill={secondaryColor} fillOpacity={0.8} name={secondaryLabel} />
          )}
        </BarChart>
      );
    }

    if (chartType === 'area') {
      return (
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="label"
            {...commonAxis}
            label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 } : undefined}
          />
          <YAxis
            {...commonAxis}
            label={yAxisLabel ? { value: yAxisLabel, angle: -90, fill: '#64748b', fontSize: 10 } : undefined}
          />
          <Tooltip content={<TooltipContent />} />
          <Area type="monotone" dataKey="value" stroke={color} fill={color} fillOpacity={0.18} strokeWidth={2} name={primaryLabel} />
          {hasSecondary && (
            <Area type="monotone" dataKey="secondary" stroke={secondaryColor} fill={secondaryColor} fillOpacity={0.1} strokeWidth={2} name={secondaryLabel} />
          )}
        </AreaChart>
      );
    }

    return (
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="label"
          {...commonAxis}
          label={xAxisLabel ? { value: xAxisLabel, position: 'insideBottom', offset: -2, fill: '#64748b', fontSize: 10 } : undefined}
        />
        <YAxis
          {...commonAxis}
          label={yAxisLabel ? { value: yAxisLabel, angle: -90, fill: '#64748b', fontSize: 10 } : undefined}
        />
        <Tooltip content={<TooltipContent />} />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} name={primaryLabel} />
        {hasSecondary && (
          <Line type="monotone" dataKey="secondary" stroke={secondaryColor} strokeWidth={2} dot={false} strokeDasharray="4 4" name={secondaryLabel} />
        )}
      </LineChart>
    );
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            {title || t(language, 'chat.blocks.chart')}
          </h4>
          {description && <p className="mt-1 text-xs text-slate-400">{description}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {source && (
            sourceUrl ? (
              <a className="text-[10px] text-slate-400 underline-offset-2 hover:text-indigo-300 hover:underline" href={sourceUrl} target="_blank" rel="noreferrer">
                {t(language, 'chat.chart.source')}: {source}
              </a>
            ) : (
              <span className="text-[10px] text-slate-500">{t(language, 'chat.chart.source')}: {source}</span>
            )
          )}
          {qualityBadge(language, dataQuality, validationStatus)}
        </div>
      </div>
      {legend && legend.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-3 text-[10px] text-slate-400">
          {legend.map((item, idx) => (
            <span key={item} className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: idx === 1 ? secondaryColor : color }} />
              {item}
            </span>
          ))}
        </div>
      )}
      <div className={chartHeight}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart>
              <Tooltip content={<TooltipContent />} />
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="label"
                innerRadius={compact ? 34 : 48}
                outerRadius={compact ? 72 : 96}
                paddingAngle={2}
                label={({ label, value }) => `${label}: ${value}`}
              >
                {chartData.map((entry, idx) => (
                  <Cell key={entry.label} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          ) : (
            renderCartesianChart()
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-3 text-[11px] text-slate-500">{t(language, 'chat.chart.researchOnly')}</p>
    </div>
  );
};

export default ChartBlock;
