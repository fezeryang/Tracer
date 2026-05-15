import React from 'react';
import { Table2, ExternalLink } from 'lucide-react';
import { Language, t } from '../../i18n';
import { ChatTableColumn, ChatTableRow } from '../../types';

interface DataTableBlockProps {
  title?: string;
  columns: ChatTableColumn[];
  rows: ChatTableRow[];
  caption?: string;
  source?: string;
  sourceUrl?: string;
  dataQuality?: 'available' | 'limited' | 'simulation' | 'unavailable' | 'fallback';
  emptyState?: string;
  compact?: boolean;
  language: Language;
}

const qualityBadge = (
  quality: DataTableBlockProps['dataQuality'],
  language: Language,
): React.ReactNode => {
  const config: Record<string, { label: string; cls: string }> = {
    available: {
      label: t(language, 'chat.table.dataQualityAvailable'),
      cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    },
    limited: {
      label: t(language, 'chat.table.dataQualityLimited'),
      cls: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    },
    simulation: {
      label: t(language, 'chat.table.dataQualitySimulation'),
      cls: 'bg-rose-500/15 text-rose-400 border-rose-500/20',
    },
    unavailable: {
      label: t(language, 'chat.table.dataQualityUnavailable'),
      cls: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
    },
    fallback: {
      label: t(language, 'chat.table.dataQualityFallback'),
      cls: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    },
  };

  if (!quality || !config[quality]) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${config[quality].cls}`}>
      {config[quality].label}
    </span>
  );
};

const DataTableBlock: React.FC<DataTableBlockProps> = ({
  title,
  columns,
  rows,
  caption,
  source,
  sourceUrl,
  dataQuality,
  emptyState,
  compact = false,
  language,
}) => {
  const headerPad = compact ? 'px-3 py-2' : 'px-4 py-3';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const headerSize = compact ? 'text-[10px]' : 'text-xs';

  const alignClass = (align?: string) => {
    if (align === 'center') return 'text-center';
    if (align === 'right') return 'text-right';
    return 'text-left';
  };

  const formatCell = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined || value === '') return 'N/A';
    return String(value);
  };

  const renderLabel = (label: string) => {
    const translated = t(language, label);
    return translated === label ? label : translated;
  };

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden animate-fade-in">
      {/* Header */}
      <div className={`${headerPad} border-b border-white/5 flex items-center justify-between gap-3 flex-wrap`}>
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          {title && (
            <h4 className={`${headerSize} font-bold text-slate-300 uppercase tracking-wider truncate`}>
              {title}
            </h4>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {qualityBadge(dataQuality, language)}
          {source && (
            sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
              >
                {t(language, 'chat.table.source')}: {source}
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            ) : (
              <span className="text-[10px] text-slate-500">
                {t(language, 'chat.table.source')}: {source}
              </span>
            )
          )}
        </div>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className={`${headerPad} text-center`}>
          <p className={`${textSize} text-slate-500 italic`}>
            {emptyState || t(language, 'chat.table.noData')}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className={`w-full ${textSize}`}>
            <thead>
              <tr className="border-b border-white/5">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`${headerPad} font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap ${alignClass(col.align)}`}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {renderLabel(col.label)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`${headerPad} text-slate-300 whitespace-nowrap ${alignClass(col.align)}`}
                    >
                      {formatCell(row[col.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Caption */}
      {caption && (
        <div className={`${headerPad} border-t border-white/5`}>
          <p className={`${compact ? 'text-[10px]' : 'text-xs'} text-slate-500 italic`}>{caption}</p>
        </div>
      )}
    </div>
  );
};

export default DataTableBlock;
