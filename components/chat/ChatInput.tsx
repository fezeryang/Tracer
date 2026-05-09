import React from 'react';
import { MessageSquare, Mic } from 'lucide-react';
import { Language } from '../../i18n';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onToggleListening: () => void;
  isListening: boolean;
  isTyping: boolean;
  language: Language;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  placeholder?: string;
}

/**
 * ChatInput provides the message input area with voice control.
 */
export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onSend,
  onToggleListening,
  isListening,
  isTyping,
  language,
  inputRef,
  placeholder,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    onChange(target.value);

    // Auto-resize textarea
    target.style.height = 'auto';
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    if (isListening) {
      return language === 'zh' ? '正在听...' : 'Listening...';
    }
    return language === 'zh'
      ? '询问股票、期权策略、市场分析...'
      : 'Ask about stocks, options strategies, market analysis...';
  };

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-1.5 shadow-xl">
        {/* Voice Input Button */}
        <button
          onClick={onToggleListening}
          className={`mb-0.5 flex-shrink-0 rounded-xl p-3 transition-all ${
            isListening ? 'animate-pulse bg-rose-500/20 text-rose-500' : 'text-slate-400 hover:bg-white/5 hover:text-white'
          }`}
          title={language === 'zh' ? '语音输入' : 'Voice input'}
        >
          <Mic className="h-5 w-5" />
        </button>

        {/* Text Input */}
        <textarea
          ref={inputRef}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={getPlaceholder()}
          className="min-h-[50px] max-h-[120px] w-full resize-none bg-transparent p-3 text-sm text-white placeholder-slate-500 outline-none"
          rows={1}
          style={{ height: 'auto', minHeight: '50px' }}
        />

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={!value.trim() || isTyping}
          className="mb-0.5 flex-shrink-0 rounded-xl bg-blue-600 p-3 text-white transition-all disabled:cursor-not-allowed disabled:opacity-50 hover:bg-blue-700"
          title={language === 'zh' ? '发送' : 'Send'}
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      </div>

      {/* Disclaimer */}
      <div className="mt-3 text-center opacity-60">
        <p className="text-[10px] font-medium text-slate-500">
          {language === 'zh'
            ? 'AI 响应仅供学习研究使用，不构成投资建议。'
            : 'AI responses are for educational purposes only and do not constitute investment advice.'}
        </p>
      </div>
    </div>
  );
};

export default ChatInput;
