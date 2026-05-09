
import React from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Language, t } from '../../i18n';

export interface ChartPoint {
  label: string;
  value: number;
  secondary?: number;
}

interface ChartBlockProps {
  language: Language;
  title?: string;
  data: ChartPoint[];
  type?: 'line' | 'bar';
  color?: string;
  secondaryColor?: string;
  yAxisLabel?: string;
}

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

const ChartBlock: React.FC<ChartBlockProps> = ({
  language,
  title,
  data,
  type = 'line',
  color = '#818cf8',
  secondaryColor = '#34d399',
  yAxisLabel,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
        <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
          <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
          {title || t(language, 'chat.blocks.chart')}
        </h4>
        <p className="mt-3 text-xs text-slate-500 italic">{t(language, 'chat.blocks.chartNoData')}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
      <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
        {title || t(language, 'chat.blocks.chart')}
      </h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          {type === 'bar' ? (
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: '#1e293b' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: '#1e293b' }}
                tickLine={false}
                label={yAxisLabel ? { value: yAxisLabel, angle: -90, fill: '#64748b', fontSize: 10 } : undefined}
              />
              <Tooltip content={<TooltipContent />} />
              <Bar dataKey="value" fill={color} fillOpacity={0.8} name="Value" />
              {data[0]?.secondary !== undefined && (
                <Bar dataKey="secondary" fill={secondaryColor} fillOpacity={0.8} name="Secondary" />
              )}
            </BarChart>
          ) : (
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis
                dataKey="label"
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: '#1e293b' }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: '#64748b', fontSize: 10 }}
                axisLine={{ stroke: '#1e293b' }}
                tickLine={false}
                label={yAxisLabel ? { value: yAxisLabel, angle: -90, fill: '#64748b', fontSize: 10 } : undefined}
              />
              <Tooltip content={<TooltipContent />} />
              <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} name="Value" />
              {data[0]?.secondary !== undefined && (
                <Line type="monotone" dataKey="secondary" stroke={secondaryColor} strokeWidth={2} dot={false} strokeDasharray="4 4" name="Secondary" />
              )}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ChartBlock;
