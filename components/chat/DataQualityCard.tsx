
import React from 'react';
import { Database, AlertTriangle, Activity, BarChart3 } from 'lucide-react';
import { Language, t } from '../../i18n';
import { StockQuote, CompanyFundamentals, NewsItem } from '../../types';

interface DataQualityCardProps {
  language: Language;
  quote?: StockQuote | null;
  fundamentals?: CompanyFundamentals | null;
  news?: NewsItem[];
}

interface QualityItem {
  label: string;
  status: 'available' | 'limited' | 'unavailable' | 'simulation';
  detail: string;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  available: <Activity className="w-3 h-3 text-emerald-400" />,
  limited: <AlertTriangle className="w-3 h-3 text-amber-400" />,
  simulation: <AlertTriangle className="w-3 h-3 text-rose-400" />,
  unavailable: <Database className="w-3 h-3 text-slate-600" />,
};

const STATUS_COLORS: Record<string, string> = {
  available: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300',
  limited: 'bg-amber-500/10 border-amber-500/20 text-amber-300',
  simulation: 'bg-rose-500/10 border-rose-500/20 text-rose-300',
  unavailable: 'bg-slate-800 border-slate-700/50 text-slate-500',
};

const DataQualityCard: React.FC<DataQualityCardProps> = ({ language, quote, fundamentals, news }) => {
  const items: QualityItem[] = [];

  // Quote quality
  if (quote) {
    const isSim = quote.source?.includes('Simulation');
    items.push({
      label: t(language, 'chat.blocks.quote'),
      status: isSim ? 'simulation' : 'available',
      detail: isSim
        ? t(language, 'chat.blocks.simulationFallback')
        : `${t(language, 'chat.blocks.realOrProviderData')}: ${quote.source || 'Unknown'}`,
    });
  } else {
    items.push({
      label: t(language, 'chat.blocks.quote'),
      status: 'unavailable',
      detail: t(language, 'chat.blocks.unavailable'),
    });
  }

  // Fundamentals quality
  if (fundamentals) {
    items.push({
      label: t(language, 'chat.blocks.fundamentals'),
      status: 'available',
      detail: `${fundamentals.sector} / ${fundamentals.industry}`,
    });
  } else {
    items.push({
      label: t(language, 'chat.blocks.fundamentals'),
      status: 'unavailable',
      detail: t(language, 'chat.blocks.unavailable'),
    });
  }

  // News quality
  if (news && news.length > 0) {
    const simNews = news.filter((n) => n.site?.includes('Simulated') || n.site?.includes('(Simulated)'));
    const realNews = news.filter((n) => !n.site?.includes('Simulated') && !n.site?.includes('(Simulated)'));
    items.push({
      label: t(language, 'chat.blocks.news'),
      status: realNews.length > 0 ? 'available' : simNews.length > 0 ? 'simulation' : 'limited',
      detail: `${news.length} items${realNews.length > 0 ? ` (${realNews.length} real)` : ''}`,
    });
  } else {
    items.push({
      label: t(language, 'chat.blocks.news'),
      status: 'unavailable',
      detail: t(language, 'chat.blocks.unavailable'),
    });
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
      <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
        {t(language, 'chat.blocks.dataQuality')}
      </h4>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-2 rounded-lg border text-xs ${
              STATUS_COLORS[item.status] || STATUS_COLORS.unavailable
            }`}
          >
            <div className="flex items-center gap-2">
              {STATUS_ICONS[item.status] || STATUS_ICONS.unavailable}
              <span className="font-medium">{item.label}</span>
            </div>
            <span className="text-[10px] opacity-80">{item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DataQualityCard;
