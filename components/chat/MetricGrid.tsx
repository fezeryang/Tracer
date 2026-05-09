
import React from 'react';
import { ChatMetricItem } from '../../types';

interface MetricGridProps {
  metrics: ChatMetricItem[];
  columns?: 2 | 3 | 4;
}

const TONE_COLORS: Record<string, { value: string; label: string }> = {
  positive: { value: 'text-emerald-400', label: 'text-emerald-300' },
  negative: { value: 'text-rose-400', label: 'text-rose-300' },
  warning: { value: 'text-amber-400', label: 'text-amber-300' },
  info: { value: 'text-blue-400', label: 'text-blue-300' },
  neutral: { value: 'text-white', label: 'text-slate-300' },
};

const COLUMN_MAP = {
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
};

const MetricGrid: React.FC<MetricGridProps> = ({ metrics, columns = 3 }) => {
  if (!metrics || metrics.length === 0) return null;

  return (
    <div className={`grid ${COLUMN_MAP[columns]} gap-3`}>
      {metrics.map((metric, idx) => {
        const tone = metric.tone || 'neutral';
        const colors = TONE_COLORS[tone] || TONE_COLORS.neutral;
        return (
          <div
            key={idx}
            className="bg-slate-950/50 p-3 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
          >
            <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1">
              {metric.label}
            </div>
            <div className={`text-lg font-mono font-bold ${colors.value}`}>
              {metric.value}
            </div>
            {metric.helper && (
              <div className={`text-[10px] mt-0.5 ${colors.label}`}>
                {metric.helper}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MetricGrid;
