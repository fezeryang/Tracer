
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Database, Radio, TrendingUp, Users, Volume2, BarChart3, Shield, FunctionSquare, Code, FileText } from 'lucide-react';
import { Language, t } from '../../i18n';
import { Message, ShellViewMode } from '../../types';
import StrategyCard from '../StrategyCard';
import FundamentalsCard from '../FundamentalsCard';
import NewsFeed from '../NewsFeed';
import QuoteCard from '../QuoteCard';
import DisclaimerBlock from './DisclaimerBlock';
import MetricGrid from './MetricGrid';
import DataQualityCard from './DataQualityCard';
import SourceTrustCard from './SourceTrustCard';
import FormulaBlock from './FormulaBlock';
import ChartBlock from './ChartBlock';
import MermaidBlock from './MermaidBlock';
import ActionButtonRow from './ActionButtonRow';
import EvidenceList from './EvidenceList';

interface ChatMessageRendererProps {
  message: Message;
  language: Language;
  onNavigate: (view: ShellViewMode) => void;
  onPrompt?: (prompt: string) => void;
  isSpeaking?: string | null;
  onSpeak?: (text: string, id: string) => void;
}

const ChatMessageRenderer: React.FC<ChatMessageRendererProps> = ({
  message,
  language,
  onNavigate,
  onPrompt,
  isSpeaking,
  onSpeak,
}) => {
  return (
    <div className="max-w-[95%] sm:max-w-[85%]">
      {message.role === 'model' && message.ragContext && (
        <div className="mb-2 flex w-fit items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] text-emerald-400">
          <Database className="h-3 w-3" />
          <span>{t(language, 'chat.memoryActive', { count: message.ragContext.length })}</span>
        </div>
      )}

      {message.text && (
        <div className="relative max-w-none rounded-2xl px-6 py-4 prose prose-invert prose-sm shadow-sm transition-all rounded-bl-none border border-white/5 bg-slate-900/60 text-slate-300">
          <ReactMarkdown
            components={{
              p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
              strong: ({ node, ...props }) => <strong className="font-bold text-white" {...props} />,
              ul: ({ node, ...props }) => <ul className="mb-2 list-disc space-y-1 pl-4 marker:text-blue-400" {...props} />,
            }}
          >
            {message.text}
          </ReactMarkdown>

          {message.role === 'model' && message.text && onSpeak && (
            <button
              onClick={() => onSpeak(message.text!, message.id)}
              className={`absolute -bottom-6 left-0 rounded-full p-1.5 transition-colors hover:bg-white/10 ${
                isSpeaking === message.id ? 'animate-pulse text-blue-400' : 'text-slate-500 opacity-0 group-hover:opacity-100'
              }`}
              title={t(language, 'common.readAloud')}
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}

      {message.quote && <QuoteCard quote={message.quote} />}
      {message.fundamentals && <FundamentalsCard data={message.fundamentals} />}
      {message.news && <NewsFeed news={message.news} />}

      {message.impactAnalysis && (
        <div className="mt-4 rounded-r-lg border-l-2 border-rose-500 bg-rose-500/5 py-2 pl-4">
          <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-rose-400">
            <Radio className="h-4 w-4" />
            {t(language, 'chat.impactTitle')}: {t(language, `chat.impact.${message.impactAnalysis.verdict.toLowerCase().replace(/\s+/g, '_')}`)}
          </h4>
          <div className="mt-2 flex items-center gap-4 text-xs text-slate-300">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-slate-500">{t(language, 'chat.current')}</span>
              <span className="font-mono">
                {message.impactAnalysis.currentMove > 0 ? '+' : ''}
                {message.impactAnalysis.currentMove}%
              </span>
            </div>
            <TrendingUp className="h-3 w-3 text-slate-500" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase text-slate-500">{t(language, 'chat.target')}</span>
              <span className="font-mono text-blue-400">
                {message.impactAnalysis.predictedMoveLow}% - {message.impactAnalysis.predictedMoveHigh}%
              </span>
            </div>
          </div>
          <button onClick={() => onNavigate('news-impact')} className="mt-3 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-300 hover:text-white">
            {t(language, 'chat.viewFullAnalysis')} <TrendingUp className="h-3 w-3" />
          </button>
          <div className="mt-2">
            <DisclaimerBlock language={language} type="general" tone="info" />
          </div>
        </div>
      )}

      {message.whisper && (
        <div className="mt-4 rounded-r-lg border-l-2 border-blue-500 bg-blue-500/5 py-2 pl-4">
          <h4 className="mb-1 flex items-center gap-2 text-sm font-bold text-blue-400">
            <Users className="h-4 w-4" /> {t(language, 'chat.whisperSignal')}: {t(language, `chat.sentiment.${message.whisper.sentimentLabel.toLowerCase().replace(/\s+/g, '_')}`)}
          </h4>
          <p className="text-xs italic text-slate-400">&ldquo;{message.whisper.summary}&rdquo;</p>
          <button onClick={() => onNavigate('whisper')} className="mt-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-300 hover:text-white">
            {t(language, 'chat.viewFullAggregation')} <TrendingUp className="h-3 w-3" />
          </button>
          <div className="mt-2">
            <DisclaimerBlock language={language} type="general" tone="info" />
          </div>
        </div>
      )}

      {message.strategy && (
        <>
          <StrategyCard strategy={message.strategy} />
          <div className="mt-2">
            <DisclaimerBlock language={language} type="options" tone="warning" />
          </div>
        </>
      )}

      {/* Auto-generated DataQualityCard for legacy messages without explicit blocks */}
      {!message.blocks && (message.quote || message.fundamentals || message.news) && message.role === 'model' && (
        <div className="mt-4">
          <DataQualityCard
            language={language}
            quote={message.quote}
            fundamentals={message.fundamentals}
            news={message.news}
          />
        </div>
      )}

      {/* Structured Financial Blocks */}
      {message.blocks && message.blocks.length > 0 && (
        <div className="mt-4 space-y-4">
          {message.blocks.map((block, idx) => {
            switch (block.type) {
              case 'metric_grid':
                return <MetricGrid key={idx} metrics={block.metrics || []} />;

              case 'data_quality':
                return (
                  <DataQualityCard
                    key={idx}
                    language={language}
                    quote={block.data?.quote}
                    fundamentals={block.data?.fundamentals}
                    news={block.data?.news}
                  />
                );

              case 'source_trust':
                return <SourceTrustCard key={idx} language={language} summary={block.data?.trustSummary} />;

              case 'formula':
                return (
                  <FormulaBlock
                    key={idx}
                    language={language}
                    formula={block.content || ''}
                    description={block.title}
                  />
                );

              case 'chart':
                return (
                  <ChartBlock
                    key={idx}
                    language={language}
                    title={block.title}
                    data={block.data?.chartData || []}
                    type={block.data?.chartType || 'line'}
                    color={block.data?.chartColor}
                    yAxisLabel={block.data?.yAxisLabel}
                  />
                );

              case 'mermaid':
                return <MermaidBlock key={idx} language={language} code={block.content || ''} />;

              case 'action_buttons':
                return (
                  <ActionButtonRow
                    key={idx}
                    actions={block.actions || []}
                    onNavigate={onNavigate}
                    onPrompt={onPrompt}
                  />
                );

              case 'evidence_list':
                return (
                  <EvidenceList
                    key={idx}
                    language={language}
                    items={block.data?.evidence || []}
                  />
                );

              case 'disclaimer':
                return (
                  <div key={idx}>
                    <DisclaimerBlock
                      language={language}
                      type={block.data?.disclaimerType || 'general'}
                      tone={block.tone === 'success' || block.tone === 'neutral' ? 'info' : (block.tone as 'info' | 'warning' | 'danger')}
                      title={block.title}
                      message={block.content}
                    />
                  </div>
                );

              default:
                return null;
            }
          })}
        </div>
      )}
    </div>
  );
};

export default ChatMessageRenderer;
