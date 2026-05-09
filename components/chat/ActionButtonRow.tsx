
import React from 'react';
import { ArrowRight, FileText, CandlestickChart, Backpack, Radio, Globe, MessageSquare } from 'lucide-react';
import { ChatAction, ShellViewMode } from '../../types';

interface ActionButtonRowProps {
  actions: ChatAction[];
  onNavigate?: (view: ShellViewMode) => void;
  onPrompt?: (prompt: string) => void;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  generateReport: <FileText className="w-3.5 h-3.5" />,
  viewOptionsChain: <CandlestickChart className="w-3.5 h-3.5" />,
  runBacktest: <Backpack className="w-3.5 h-3.5" />,
  analyzeNewsImpact: <Radio className="w-3.5 h-3.5" />,
  viewMacro: <Globe className="w-3.5 h-3.5" />,
  askFollowUp: <MessageSquare className="w-3.5 h-3.5" />,
};

const TONE_CLASSES: Record<string, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500/30',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-white/10',
  warning: 'bg-amber-600/80 hover:bg-amber-500 text-white border-amber-500/30',
};

const ActionButtonRow: React.FC<ActionButtonRowProps> = ({ actions, onNavigate, onPrompt }) => {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, idx) => {
        const iconKey = action.prompt ? 'askFollowUp' : (action.view || '');
        const icon = ICON_MAP[iconKey] || <ArrowRight className="w-3.5 h-3.5" />;
        const toneClass = TONE_CLASSES[action.tone || 'secondary'] || TONE_CLASSES.secondary;

        return (
          <button
            key={idx}
            onClick={() => {
              if (action.view && onNavigate) {
                onNavigate(action.view);
              } else if (action.prompt && onPrompt) {
                onPrompt(action.prompt);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${toneClass}`}
          >
            {icon}
            {action.label}
          </button>
        );
      })}
    </div>
  );
};

export default ActionButtonRow;
