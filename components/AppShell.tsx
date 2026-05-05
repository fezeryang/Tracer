import React from 'react';
import {
  FileText,
  Globe,
  GraduationCap,
  History,
  LayoutDashboard,
  Layers,
  MessageCircle,
  MessageSquare,
  Radio,
  ShieldCheck,
  ShoppingCart,
  Users,
  Clock3,
} from 'lucide-react';
import TopBar from './TopBar';
import { Language, t } from '../i18n';
import { theme } from '../designTokens';
import { ShellViewMode } from '../types';

interface AppShellProps {
  language: Language;
  currentView: ShellViewMode;
  onChangeView: (view: ShellViewMode) => void;
  onToggleLanguage: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const navItems: Array<{
  view: ShellViewMode;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { view: 'overview', labelKey: 'nav.overview', icon: LayoutDashboard },
  { view: 'report', labelKey: 'nav.report', icon: FileText },
  { view: 'chat', labelKey: 'nav.chat', icon: MessageSquare },
  { view: 'chain', labelKey: 'nav.chain', icon: Layers },
  { view: 'backtest', labelKey: 'nav.backtest', icon: History },
  { view: 'news-impact', labelKey: 'nav.impact', icon: Radio },
  { view: 'macro', labelKey: 'nav.macro', icon: Globe },
  { view: 'trading', labelKey: 'nav.trade', icon: ShoppingCart },
  { view: 'timemachine', labelKey: 'nav.timemachine', icon: Clock3 },
  { view: 'whisper', labelKey: 'nav.whisper', icon: Users },
  { view: 'academy', labelKey: 'nav.academy', icon: GraduationCap },
  { view: 'feedback', labelKey: 'nav.feedback', icon: MessageCircle },
  { view: 'admin', labelKey: 'nav.admin', icon: ShieldCheck },
];

const AppShell: React.FC<AppShellProps> = ({
  language,
  currentView,
  onChangeView,
  onToggleLanguage,
  children,
  footer,
}) => {
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{
        background: `radial-gradient(circle at top left, rgba(47,107,255,0.12), transparent 24%), ${theme.colors.appBg}`,
        color: theme.colors.textPrimary,
      }}
    >
      <aside
        className="flex w-[250px] flex-shrink-0 flex-col overflow-y-auto border-r p-4"
        style={{ backgroundColor: theme.colors.shellBg, borderColor: theme.colors.borderSubtle }}
      >
        <div className="mb-6 flex items-center gap-3 px-2">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-[16px] text-xl font-bold"
            style={{ background: `linear-gradient(135deg, ${theme.colors.warn}, ${theme.colors.accent})`, color: theme.colors.textPrimary }}
          >
            N
          </div>
          <div>
            <div className="text-lg font-semibold tracking-[0.08em]">NUX</div>
            <div className="text-[11px] uppercase tracking-[0.24em]" style={{ color: theme.colors.textMuted }}>
              AI Research Terminal
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const active = currentView === item.view;
            const Icon = item.icon;
            return (
              <button
                key={item.view}
                onClick={() => onChangeView(item.view)}
                className="flex w-full items-center gap-3 rounded-[16px] px-4 py-3 text-left text-sm font-medium transition-all"
                style={{
                  backgroundColor: active ? 'rgba(47,107,255,0.16)' : 'transparent',
                  color: active ? theme.colors.textPrimary : theme.colors.textSecondary,
                  boxShadow: active ? theme.colors.shadowGlow : 'none',
                  border: active ? `1px solid rgba(76,141,255,0.22)` : '1px solid transparent',
                }}
              >
                <Icon className="h-4 w-4" />
                {t(language, item.labelKey)}
              </button>
            );
          })}
        </nav>

        <div
          className="mt-6 rounded-[20px] border p-4"
          style={{ borderColor: theme.colors.borderSubtle, backgroundColor: theme.colors.cardAltBg }}
        >
          <div className="text-sm" style={{ color: theme.colors.textMuted }}>
            {t(language, 'overview.riskOverview')}
          </div>
          <div className="mt-2 text-2xl font-semibold" style={{ color: theme.colors.textPrimary }}>
            42
          </div>
          <div className="mt-1 text-sm" style={{ color: theme.colors.warn }}>
            {t(language, 'overview.riskStatus')}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-6">
            <TopBar language={language} onToggleLanguage={onToggleLanguage} />
            <div className="min-h-0">{children}</div>
          </div>
        </div>
        {footer}
      </div>
    </div>
  );
};

export default AppShell;
