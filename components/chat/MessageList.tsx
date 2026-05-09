import React from 'react';
import { Activity, ArrowRight, Database, Radio, TrendingUp, Users, Volume2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { CodeBlock } from './CodeBlock';
import { MermaidDiagram } from './MermaidDiagram';
import { Message, ShellViewMode } from '../../types';
import { Language } from '../../i18n';
import QuoteCard from '../QuoteCard';
import FundamentalsCard from '../FundamentalsCard';
import NewsFeed from '../NewsFeed';
import StrategyCard from '../StrategyCard';

interface MessageListProps {
  messages: Message[];
  language: Language;
  isSpeaking: string | null;
  onSpeakText: (text: string, id: string) => void;
  onNavigateToView: (view: ShellViewMode) => void;
}

/**
 * MessageList renders the chat message history with all data cards.
 */
export const MessageList: React.FC<MessageListProps> = ({
  messages,
  language,
  isSpeaking,
  onSpeakText,
  onNavigateToView,
}) => {
  const t = (key: string) => {
    // Simple translation function - will be replaced with proper i18n
    const translations: Record<string, Record<Language, string>> = {
      'chat.memoryActive': { zh: '记忆激活', en: 'Memory Active' },
      'chat.current': { zh: '当前', en: 'Current' },
      'chat.target': { zh: '目标', en: 'Target' },
      'chat.viewFullAnalysis': { zh: '查看完整分析', en: 'View Full Analysis' },
      'chat.whisperSignal': { zh: '市场情绪信号', en: 'Whisper Signal' },
      'chat.viewFullAggregation': { zh: '查看完整聚合', en: 'View Full Aggregation' },
    };
    return translations[key]?.[language] || key;
  };

  return (
    <>
      {messages.map((msg: Message) => (
        <div key={msg.id} className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
          {msg.role === 'model' && (
            <div className="mr-3 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800">
              <Activity className="h-4 w-4 text-blue-400" />
            </div>
          )}

          <div className={`max-w-[95%] sm:max-w-[85%] ${msg.role === 'user' ? 'flex flex-col items-end' : ''}`}>
            {/* RAG Context Badge */}
            {msg.role === 'model' && msg.ragContext && msg.ragContext.length > 0 && (
              <div className="mb-2 flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400">
                <Database className="h-3 w-3" />
                <span>{t('chat.memoryActive')}: {msg.ragContext.length}</span>
              </div>
            )}

            {/* Text Content with Markdown */}
            {msg.text && (
              <div
                className={`relative max-w-none rounded-2xl px-6 py-4 prose prose-invert prose-sm shadow-sm transition-all ${
                  msg.role === 'user'
                    ? 'rounded-br-none bg-blue-600 text-white'
                    : 'rounded-bl-none border border-white/5 bg-slate-900/60 text-slate-300'
                }`}
              >
                <ReactMarkdown
                  components={{
                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                    strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
                    ul: ({ node, ...props }) => <ul className="mb-2 list-disc space-y-1 pl-4 marker:text-blue-400" {...props} />,
                    ol: ({ node, ...props }) => <ol className="mb-2 list-decimal space-y-1 pl-4 marker:text-blue-400" {...props} />,
                    // Code blocks with syntax highlighting
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || '');
                      const language = match ? match[1] : '';

                      if (!inline && language) {
                        return <CodeBlock language={language} code={String(children).replace(/\n$/, '')} />;
                      }

                      // Inline code
                      return (
                        <code
                          className="rounded bg-white/10 px-1.5 py-0.5 text-sm font-mono text-blue-300"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                    // Mermaid diagrams
                    pre({ node, children, ...props }: any) {
                      const child = children?.[0] as any;
                      if (child?.props?.className?.includes('language-mermaid')) {
                        const code = child.props.children;
                        return <MermaidDiagram chart={code} />;
                      }
                      return <pre {...props}>{children}</pre>;
                    },
                  }}
                >
                  {msg.text}
                </ReactMarkdown>

                {/* Read Aloud Button */}
                {msg.role === 'model' && msg.text && (
                  <button
                    onClick={() => onSpeakText(msg.text!, msg.id)}
                    className={`absolute -bottom-6 left-0 rounded-full p-1.5 transition-colors hover:bg-white/10 ${
                      isSpeaking === msg.id ? 'animate-pulse text-blue-400' : 'text-slate-500 opacity-0 group-hover:opacity-100'
                    }`}
                    title={language === 'zh' ? '朗读' : 'Read aloud'}
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Data Cards */}
            {msg.quote && <QuoteCard quote={msg.quote} />}
            {msg.fundamentals && <FundamentalsCard data={msg.fundamentals} />}
            {msg.news && <NewsFeed news={msg.news} />}

            {/* News Impact Analysis Card */}
            {msg.impactAnalysis && (
              <div className="mt-4 rounded-r-lg border-l-2 border-rose-500 bg-rose-500/5 py-2 pl-4">
                <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-rose-400">
                  <Radio className="h-4 w-4" /> Impact Predicted: {msg.impactAnalysis.verdict}
                </h4>
                <div className="mt-2 flex items-center gap-4 text-xs text-slate-300">
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-slate-500">{t('chat.current')}</span>
                    <span className="font-mono">
                      {msg.impactAnalysis.currentMove > 0 ? '+' : ''}
                      {msg.impactAnalysis.currentMove}%
                    </span>
                  </div>
                  <ArrowRight className="h-3 w-3 text-slate-500" />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase text-slate-500">{t('chat.target')}</span>
                    <span className="font-mono text-blue-400">
                      {msg.impactAnalysis.predictedMoveLow}% - {msg.impactAnalysis.predictedMoveHigh}%
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigateToView('news-impact')}
                  className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-300 hover:text-white"
                >
                  {t('chat.viewFullAnalysis')} <TrendingUp className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Whisper Data Card */}
            {msg.whisper && (
              <div className="mt-4 rounded-r-lg border-l-2 border-blue-500 bg-blue-500/5 py-2 pl-4">
                <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-blue-400">
                  <Users className="h-4 w-4" /> {t('chat.whisperSignal')}: {msg.whisper.sentimentLabel}
                </h4>
                <p className="text-xs italic text-slate-400">"{msg.whisper.summary}"</p>
                <button
                  onClick={() => onNavigateToView('whisper')}
                  className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-300 hover:text-white"
                >
                  {t('chat.viewFullAggregation')} <TrendingUp className="h-3 w-3" />
                </button>
              </div>
            )}

            {/* Strategy Card */}
            {msg.strategy && <StrategyCard strategy={msg.strategy} />}
          </div>
        </div>
      ))}
    </>
  );
};

export default MessageList;
