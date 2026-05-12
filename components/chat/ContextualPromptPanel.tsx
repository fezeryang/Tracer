import React from 'react';
import { t as i18nT } from '../../i18n';
import type { ChatSuggestion } from '../../services/chatSuggestionService';
import PromptSuggestionChips from './PromptSuggestionChips';

interface ContextualPromptPanelProps {
  context?: {
    currentTicker?: string;
    lastCommand?: string;
  };
  suggestions: ChatSuggestion[];
  language: 'zh' | 'en';
  onSelect: (suggestion: ChatSuggestion) => void;
}

const ContextualPromptPanel: React.FC<ContextualPromptPanelProps> = ({
  context,
  suggestions,
  language,
  onSelect,
}) => {
  if (suggestions.length === 0) return null;

  const ticker = context?.currentTicker;

  return (
    <div className="mb-4 animate-fade-in-up">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
          {i18nT(language, 'chat.suggestions.continueTitle')}
        </span>
        {ticker && (
          <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400">
            {ticker}
          </span>
        )}
      </div>
      <PromptSuggestionChips
        suggestions={suggestions}
        language={language}
        onSelect={onSelect}
        compact={true}
      />
    </div>
  );
};

export default ContextualPromptPanel;