import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { Language, t } from '../i18n';

interface ExpirationCalendarProps {
  expirations: string[];
  selectedExpiration: string;
  onSelect: (expiration: string) => void;
  language: Language;
}

type ExpirationGroup = 'weekly' | 'monthly' | 'quarterly' | 'leaps';

interface GroupedExpiration {
  date: string;
  dte: number;
  group: ExpirationGroup;
  label: string;
}

function isThirdFriday(date: Date): boolean {
  return date.getDay() === 5 && date.getDate() >= 15 && date.getDate() <= 21;
}

function getExpirationGroup(dte: number, date: Date): ExpirationGroup {
  if (dte <= 9) return 'weekly';
  if (isThirdFriday(date) && dte <= 45) return 'monthly';
  if (dte <= 100) return 'quarterly';
  return 'leaps';
}

const groupOrder: ExpirationGroup[] = ['weekly', 'monthly', 'quarterly', 'leaps'];

const groupColors: Record<ExpirationGroup, string> = {
  weekly: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  monthly: 'border-blue-500/50 bg-blue-500/10 text-blue-300',
  quarterly: 'border-purple-500/50 bg-purple-500/10 text-purple-300',
  leaps: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
};

const groupActiveColors: Record<ExpirationGroup, string> = {
  weekly: 'border-amber-400 bg-amber-500/30 text-amber-100',
  monthly: 'border-blue-400 bg-blue-500/30 text-blue-100',
  quarterly: 'border-purple-400 bg-purple-500/30 text-purple-100',
  leaps: 'border-emerald-400 bg-emerald-500/30 text-emerald-100',
};

const ExpirationCalendar: React.FC<ExpirationCalendarProps> = ({
  expirations,
  selectedExpiration,
  onSelect,
  language,
}) => {
  const grouped = useMemo(() => {
    const now = new Date();
    const results: GroupedExpiration[] = [];

    expirations.forEach((dateStr) => {
      const expDate = new Date(dateStr + 'T12:00:00Z');
      const dte = Math.max(0, Math.ceil((expDate.getTime() - now.getTime()) / 86400000));
      const group = getExpirationGroup(dte, expDate);
      const monthShort = expDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      results.push({
        date: dateStr,
        dte,
        group,
        label: monthShort,
      });
    });

    return results;
  }, [expirations]);

  const nearestWeekly = useMemo(() => {
    return grouped.find((g) => g.group === 'weekly');
  }, [grouped]);

  const nextMonthly = useMemo(() => {
    return grouped.find((g) => g.group === 'monthly');
  }, [grouped]);

  const groupedByType = useMemo(() => {
    const map: Record<ExpirationGroup, GroupedExpiration[]> = {
      weekly: [],
      monthly: [],
      quarterly: [],
      leaps: [],
    };
    grouped.forEach((g) => {
      map[g.group].push(g);
    });
    return map;
  }, [grouped]);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -200 : 200,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Quick-jump buttons */}
      {nearestWeekly && nearestWeekly.date !== selectedExpiration && (
        <button
          onClick={() => onSelect(nearestWeekly.date)}
          className="flex-shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold text-amber-300 hover:bg-amber-500/20 transition-colors"
          title={t(language, 'chain.nearestWeekly')}
        >
          {t(language, 'chain.nearestWeekly')}
        </button>
      )}
      {nextMonthly && nextMonthly.date !== selectedExpiration && (
        <button
          onClick={() => onSelect(nextMonthly.date)}
          className="flex-shrink-0 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1.5 text-[10px] font-semibold text-blue-300 hover:bg-blue-500/20 transition-colors"
          title={t(language, 'chain.nextMonthly')}
        >
          {t(language, 'chain.nextMonthly')}
        </button>
      )}

      {/* Scrollable chip strip */}
      <div className="relative flex-1 min-w-0">
        <button
          onClick={() => scroll('left')}
          className="absolute left-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-slate-800/90 p-0.5 text-slate-400 hover:text-white border border-white/10"
        >
          <ChevronLeft className="h-3 w-3" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-1.5 overflow-x-auto px-6 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {groupOrder.map((group) => {
            const items = groupedByType[group];
            if (items.length === 0) return null;

            return (
              <React.Fragment key={group}>
                {items.map((item) => {
                  const isSelected = item.date === selectedExpiration;
                  const colors = isSelected ? groupActiveColors[group] : groupColors[group];

                  return (
                    <button
                      key={item.date}
                      onClick={() => onSelect(item.date)}
                      className={`flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all hover:scale-105 ${colors}`}
                    >
                      <Calendar className="h-3 w-3 opacity-70" />
                      <span>{item.label}</span>
                      <span className={`text-[10px] font-mono opacity-70 ${isSelected ? '' : 'text-slate-500'}`}>
                        {item.dte}{t(language, 'chain.dte').charAt(0)}
                      </span>
                    </button>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>

        <button
          onClick={() => scroll('right')}
          className="absolute right-0 top-1/2 z-10 -translate-y-1/2 rounded-full bg-slate-800/90 p-0.5 text-slate-400 hover:text-white border border-white/10"
        >
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default ExpirationCalendar;
