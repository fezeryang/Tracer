
import React from 'react';
import { Language, t } from '../../i18n';
import { AlertTriangle, Info, AlertCircle } from 'lucide-react';

interface DisclaimerBlockProps {
  language: Language;
  tone?: 'info' | 'warning' | 'danger';
  title?: string;
  message?: string;
  type?: 'simulation' | 'options' | 'volatility' | 'general';
}

const ICON_MAP = {
  info: Info,
  warning: AlertTriangle,
  danger: AlertCircle,
};

const COLOR_MAP = {
  info: {
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/5',
    text: 'text-blue-300',
    icon: 'text-blue-400',
  },
  warning: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/5',
    text: 'text-amber-300',
    icon: 'text-amber-400',
  },
  danger: {
    border: 'border-rose-500/30',
    bg: 'bg-rose-500/5',
    text: 'text-rose-300',
    icon: 'text-rose-400',
  },
};

const DEFAULT_TITLE_KEYS: Record<string, string> = {
  simulation: 'chat.disclaimer.simulationWarning',
  options: 'chat.disclaimer.optionsResearchOnly',
  volatility: 'chat.disclaimer.heuristicVolatility',
  general: 'chat.disclaimer.notFinancialAdvice',
};

const DEFAULT_MESSAGE_KEYS: Record<string, string> = {
  simulation: 'chat.disclaimer.simulationWarning',
  options: 'chat.disclaimer.optionsResearchOnly',
  volatility: 'chat.disclaimer.heuristicVolatility',
  general: 'chat.disclaimer.notFinancialAdvice',
};

export const DisclaimerBlock: React.FC<DisclaimerBlockProps> = ({
  language,
  tone = 'info',
  title,
  message,
  type = 'general',
}) => {
  const Icon = ICON_MAP[tone];
  const colors = COLOR_MAP[tone];

  const displayTitle = title || t(language, DEFAULT_TITLE_KEYS[type]);
  const displayMessage = message || t(language, DEFAULT_MESSAGE_KEYS[type]);

  return (
    <div className={`flex items-start gap-3 rounded-lg border ${colors.border} ${colors.bg} p-3 text-xs`}>
      <Icon className={`h-4 w-4 flex-shrink-0 mt-0.5 ${colors.icon}`} />
      <div>
        <p className={`font-semibold ${colors.text}`}>{displayTitle}</p>
        <p className="mt-0.5 text-slate-400">{displayMessage}</p>
      </div>
    </div>
  );
};

export default DisclaimerBlock;
