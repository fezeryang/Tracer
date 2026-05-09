import React, { useRef, useEffect } from 'react';
import { TrendingUp, Newspaper, HelpCircle, Radio, AlertCircle } from 'lucide-react';
import { NuxPage, NuxPageHeader, NuxNotice } from '../NuxPage';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { ShellViewMode } from '../../types';
import { Language } from '../../i18n';
import { t } from '../../i18n';

interface QuickChipProps {
  icon: any;
  label: string;
  onClick: () => void;
}

const QuickChip: React.FC<QuickChipProps> = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-300 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white"
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </button>
);

interface ChatViewProps {
  language: Language;
  selectedTicker: string;
  messages: any[];
  isTyping: boolean;
  isSpeaking: string | null;
  isAiConfigured: boolean;
  inputValue: string;
  isListening: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  messagesEndRef: React.RefObject<HTMLDivElement>;

  // Callbacks
  onSend: (text: string) => Promise<void>;
  onInputChange: (value: string) => void;
  onToggleListening: () => void;
  onSpeakText: (text: string, id: string) => void;
  onNavigateToView: (view: ShellViewMode) => void;
}

/**
 * ChatView is the main chat interface component.
 *
 * Features:
 * - Message list with markdown rendering
 * - Syntax-highlighted code blocks
 * - Mermaid diagrams
 * - Data cards (quote, fundamentals, news, strategy)
 * - Voice input/output
 * - Quick action chips
 */
export const ChatView: React.FC<ChatViewProps> = ({
  language,
  selectedTicker,
  messages,
  isTyping,
  isSpeaking,
  isAiConfigured,
  inputValue,
  isListening,
  inputRef,
  messagesEndRef,
  onSend,
  onInputChange,
  onToggleListening,
  onSpeakText,
  onNavigateToView,
}) => {
  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, messagesEndRef]);

  // Focus input after typing completes
  useEffect(() => {
    if (!isTyping) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isTyping, inputRef]);

  // Handle send with auto-clear of input
  const handleSend = async (text: string = inputValue) => {
    if (!text.trim() || isTyping) return;
    await onSend(text);
  };

  const quickChips = [
    {
      icon: TrendingUp,
      label: t(language, 'chat.quickMoonshot') || 'Bullish Play',
      onClick: () => handleSend(`I'm extremely bullish on ${selectedTicker}, what's a high upside play?`),
    },
    {
      icon: Newspaper,
      label: t(language, 'chat.quickNews') || 'News Scan',
      onClick: () => handleSend(`Scan the news for ${selectedTicker} and analyze sentiment.`),
    },
    {
      icon: HelpCircle,
      label: t(language, 'chat.quickTheta') || 'Theta Income',
      onClick: () => handleSend('I want to profit from time decay (Theta) on a tech stock.'),
    },
    {
      icon: Radio,
      label: t(language, 'chat.quickImpact') || 'News Impact',
      onClick: () => onNavigateToView('news-impact'),
    },
  ];

  return (
    <NuxPage>
      {/* Header */}
      <NuxPageHeader
        eyebrow={t(language, 'common.nuxEyebrow') || 'NUX Terminal'}
        title={t(language, 'chat.title') || 'AI Chat Analysis'}
        subtitle={t(language, 'chat.subtitle') || 'AI-powered financial research assistant'}
      />

      {/* Research Target Notice */}
      <NuxNotice tone="info">
        {t(language, 'common.currentResearchTarget') || 'Current Research Target'}: {selectedTicker}
      </NuxNotice>

      {/* API Key Warning */}
      {!isAiConfigured && (
        <NuxNotice tone="warning">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {t(language, 'common.configGeminiHint') || 'Configure Gemini API key to enable AI features.'}
          </div>
        </NuxNotice>
      )}

      {/* Quick Action Chips (show only when few messages) */}
      {messages.length <= 2 && (
        <div className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-4 animate-fade-in-up">
          {quickChips.map((chip, index) => (
            <QuickChip key={index} icon={chip.icon} label={chip.label} onClick={chip.onClick} />
          ))}
        </div>
      )}

      {/* Messages List */}
      <MessageList
        messages={messages}
        language={language}
        isSpeaking={isSpeaking}
        onSpeakText={onSpeakText}
        onNavigateToView={onNavigateToView}
      />

      {/* Typing Indicator */}
      {isTyping && (
        <div className="flex justify-start">
          <div className="mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800">
            <div className="h-4 w-4 animate-pulse rounded-full bg-blue-400" />
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/5 bg-slate-900/50 px-4 py-3">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            <div className="delay-75 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            <div className="delay-150 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
          </div>
        </div>
      )}

      {/* Scroll Anchor */}
      <div ref={messagesEndRef} />
    </NuxPage>
  );
};

/**
 * ChatFooter is the input area that should be rendered in the AppShell footer.
 */
interface ChatFooterProps {
  inputValue: string;
  isListening: boolean;
  isTyping: boolean;
  language: Language;
  inputRef: React.RefObject<HTMLTextAreaElement>;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onToggleListening: () => void;
}

export const ChatFooter: React.FC<ChatFooterProps> = ({
  inputValue,
  isListening,
  isTyping,
  language,
  inputRef,
  onInputChange,
  onSend,
  onToggleListening,
}) => {
  return (
    <footer className="border-t border-white/5 bg-[#081423]/90 p-4 pb-6 backdrop-blur-xl">
      <ChatInput
        value={inputValue}
        onChange={onInputChange}
        onSend={onSend}
        onToggleListening={onToggleListening}
        isListening={isListening}
        isTyping={isTyping}
        language={language}
        inputRef={inputRef}
      />
    </footer>
  );
};

export default ChatView;
