import React from 'react';
import type { ChatSuggestion } from '../../services/chatSuggestionService';

interface PromptSuggestionChipsProps {
  suggestions: ChatSuggestion[];
  language: 'zh' | 'en';
  onSelect: (suggestion: ChatSuggestion) => void;
  compact?: boolean;
}

const PromptSuggestionChips: React.FC<PromptSuggestionChipsProps> = ({
  suggestions,
  language,
  onSelect,
  compact = false,
}) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap gap-2 animate-fade-in-up">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.id}
          onClick={() => onSelect(suggestion)}
          className={
            compact
              ? 'rounded-full border border-white/10 bg-slate-800/60 px-3 py-1.5 text-[11px] font-medium text-slate-300 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white'
              : 'rounded-full border border-white/10 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-300 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white'
          }
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
};

export default PromptSuggestionChips;