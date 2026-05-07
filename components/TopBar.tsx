import React, { useEffect, useState } from 'react';
import { Bell, Globe2, Search, Settings, UserCircle2 } from 'lucide-react';
import { Language, t } from '../i18n';
import { theme } from '../designTokens';

interface TopBarProps {
  language: Language;
  onToggleLanguage: () => void;
}

const formatClock = () =>
  new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

const getMarketStatus = () => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const totalMinutes = hour * 60 + minute;
  const openMinutes = 21 * 60 + 30;
  const closeMinutes = 4 * 60;
  const isOpen = totalMinutes >= openMinutes || totalMinutes <= closeMinutes;
  return { isOpen, clock: formatClock() };
};

const TopBar: React.FC<TopBarProps> = ({ language, onToggleLanguage }) => {
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());

  useEffect(() => {
    const interval = window.setInterval(() => {
      setMarketStatus(getMarketStatus());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <div
      className="flex flex-col gap-3 rounded-[24px] border p-4 lg:flex-row lg:items-center lg:justify-between"
      style={{
        backgroundColor: theme.colors.cardAltBg,
        borderColor: theme.colors.borderSubtle,
        boxShadow: theme.colors.shadowCard,
      }}
    >
      <div className="relative w-full lg:max-w-xl">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: theme.colors.textMuted }} />
        <input
          type="text"
          readOnly
          value=""
          placeholder={t(language, 'topbar.searchPlaceholder')}
          className="w-full rounded-[14px] border bg-transparent py-3 pl-11 pr-4 text-sm outline-none"
          style={{
            color: theme.colors.textPrimary,
            borderColor: theme.colors.borderSubtle,
            backgroundColor: theme.colors.input.bg,
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 lg:justify-end">
        <div
          className="flex items-center gap-3 rounded-[14px] border px-4 py-2"
          style={{ borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.background.elevated }}
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: marketStatus.isOpen ? theme.colors.success.default : theme.colors.danger.default }}
          />
          <div className="text-xs leading-tight">
            <div style={{ color: theme.colors.textPrimary }}>
              {marketStatus.isOpen ? t(language, 'topbar.marketOpen') : t(language, 'topbar.marketClosed')}
            </div>
            <div style={{ color: theme.colors.textMuted }}>
              {t(language, 'common.currentTime')}: {marketStatus.clock}
            </div>
          </div>
        </div>

        <button
          onClick={onToggleLanguage}
          className="flex items-center gap-2 rounded-[14px] border px-3 py-2 text-sm"
          style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}
          title={t(language, 'topbar.language')}
        >
          <Globe2 className="h-4 w-4" />
          {language === 'zh' ? t(language, 'common.languageEnglish') : t(language, 'common.languageChinese')}
        </button>

        {[Bell, Settings, UserCircle2].map((Icon, index) => (
          <button
            key={index}
            className="rounded-[14px] border p-2.5"
            style={{ borderColor: theme.colors.borderSubtle, color: theme.colors.textSecondary }}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default TopBar;
