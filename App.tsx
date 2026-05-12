import React, { Component, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  HelpCircle,
  MessageSquare,
  Mic,
  Newspaper,
  Radio,
  TrendingUp,
  X,
} from 'lucide-react';
import { createChatSession, GEMINI_KEY_MISSING_MESSAGE } from './services/geminiService';
import { ChatRenderBlock, Message, OptionContract, StockAnalysisReport, UserSession, ChatIntent } from './types';
import EducationView from './components/EducationView';
import OptionsChainView from './components/OptionsChainView';
import BacktestView from './components/BacktestView';
import FeedbackView from './components/FeedbackView';
import AdminDashboard from './components/AdminDashboard';
import LoginOverlay from './components/LoginOverlay';
import TimeMachineView from './components/TimeMachineView';
import WhisperView from './components/WhisperView';
import NewsImpactView from './components/NewsImpactView';
import ChatMessageRenderer from './components/chat/ChatMessageRenderer';
import EvidenceDrawer from './components/chat/EvidenceDrawer';
import PromptSuggestionChips from './components/chat/PromptSuggestionChips';
import ContextualPromptPanel from './components/chat/ContextualPromptPanel';
import {
  getStarterSuggestions,
  getContextualSuggestions,
  getDynamicPlaceholder,
  ChatSuggestion,
} from './services/chatSuggestionService';
import { executeChatCommand, ChatCommandExecutionResult } from './services/chatCommandExecutor';
import { parseChatCommand } from './services/chatCommandRegistry';
import { ChatGoal, compileChatGoal } from './services/chatGoalCompiler';
import { classifyChatIntentWithDeepSeek, DeepSeekIntentResult } from './services/chatIntentClassifierService';
import { routeChatModel } from './services/chatModelRouter';
import { composeFinancialChatAnswer, planRichAnswer, sanitizeFinancialSafetyText } from './services/chatAnswerComposer';
import { buildRichBlocksForAnswer } from './services/richAnswerBlockRules';
import { planRichBlocksForAnswer } from './services/richBlockPlanner';
import {
  buildContextSummaryForPrompt,
  ChatContext,
  createEmptyChatContext,
  resolveContextTicker,
  shouldUseContextForFollowup,
  updateContextFromCommandResult,
} from './services/chatContextService';
import {
  createChatTrace,
  addTraceStep,
  completeTraceStep,
  addEvidenceItems,
  addDataQualityNotes,
  extractEvidenceFromCommandResult,
  linkTraceToMessage,
  ChatTrace,
} from './services/chatTraceService';
import MacroView from './components/MacroView';
import TradingView from './components/TradingView';
import ReportView from './components/ReportView';
import OverviewView from './components/OverviewView';
import AppShell from './components/AppShell';
import { NuxPage, NuxPageHeader, NuxNotice } from './components/NuxPage';
import { loadCachedReport, loadSelectedTicker, saveCachedReport, saveSelectedTicker } from './services/reportCacheService';
import { getInitialLanguage, LANGUAGE_STORAGE_KEY, Language, t } from './i18n';
import { ShellViewMode } from './types';

const SESSION_STORAGE_KEY = 'nux-session';
const createMessageId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

const blockSignature = (block: ChatRenderBlock): string => {
  if (block.type === 'action_buttons') {
    return `${block.type}:${(block.actions || []).map((action) => action.prompt || action.label).join('|')}`;
  }
  if (block.type === 'formula') return `${block.type}:${block.formulaId}`;
  if (block.type === 'chart') {
    const ticker = block.data?.ticker || block.data?.symbol || block.title;
    return `${block.type}:${ticker}`;
  }
  if (block.type === 'mermaid') return `${block.type}:${block.data?.kind || block.content}`;
  if (block.type === 'data_table') return `${block.type}:${block.title}:${block.rows?.length || 0}`;
  if (block.type === 'disclaimer') return `${block.type}:${block.data?.disclaimerType || block.content}`;
  return `${block.type}:${block.title || block.content || JSON.stringify(block.data || {})}`;
};

const mergeChatBlocks = (
  existingBlocks: ChatRenderBlock[] | undefined,
  attachedBlocks: ChatRenderBlock[],
): ChatRenderBlock[] | undefined => {
  const merged: ChatRenderBlock[] = [];
  for (const block of [...(existingBlocks || []), ...attachedBlocks]) {
    const signature = blockSignature(block);
    if (!merged.some((candidate) => blockSignature(candidate) === signature)) {
      merged.push(block);
    }
  }
  return merged.length > 0 ? merged.slice(0, 5) : undefined;
};

const sanitizeGeminiNews = (news: any[] | undefined): any[] | undefined => {
  if (!Array.isArray(news)) return news;
  return news.map((item) => ({
    ...item,
    title: typeof item?.title === 'string' ? sanitizeFinancialSafetyText(item.title) : item?.title,
    text: typeof item?.text === 'string' ? sanitizeFinancialSafetyText(item.text) : item?.text,
  }));
};

interface DeepSeekCallMemo {
  normalizedInput: string;
  ticker?: string;
  at: number;
}

// Error Boundary to catch crashes
class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('App crashed:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-slate-950 p-4">
          <div className="max-w-md text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-4" />
            <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-slate-400 mb-4">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const QuickChip = ({ icon: Icon, label, onClick }: { icon: any; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 rounded-full border border-white/5 bg-slate-800/50 px-4 py-2 text-xs font-medium text-slate-300 transition-all hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-white"
  >
    <Icon className="h-3.5 w-3.5" />
    {label}
  </button>
);

const normalizeResearchTicker = (ticker: string) => (ticker || 'NVDA').trim().toUpperCase();

const toIntentLabelKey = (intent: ChatGoal['intent'] | DeepSeekIntentResult['intent']) => {
  if (intent === 'verified_news') return 'verifiedNews';
  return intent;
};

const commandNameToIntent = (commandName: string): ChatIntent['name'] => {
  if (commandName === 'verified-news') return 'verified_news';
  if (commandName === 'general_analysis' || commandName === 'none') return 'unknown';
  return commandName as ChatIntent['name'];
};

const toExecutableIntent = (goal: ChatGoal): ChatIntent => ({
  name: goal.intent === 'general_analysis' ? 'unknown' : goal.intent,
  ticker: goal.ticker,
  confidence: goal.confidence,
  source: goal.source,
  command: goal.command,
  reason: goal.reason,
});

const toClassifierExecutableIntent = (result: DeepSeekIntentResult): ChatIntent | null => {
  if (!result.command) return null;
  const parsed = parseChatCommand(result.command);
  if (!parsed) return null;

  return {
    name: commandNameToIntent(parsed.name),
    ticker: parsed.args[0]?.toUpperCase(),
    confidence: result.confidence,
    source: 'llm_classifier',
    command: parsed.name,
    reason: result.reason || 'DeepSeek intent classifier',
  };
};

const normalizeInputForDedupe = (text: string) => text.trim().toLowerCase().replace(/\s+/g, ' ');

const createContextAwareGoal = (goal: ChatGoal, ticker: string): ChatGoal => ({
  ...goal,
  ticker,
  confidence: Math.max(goal.confidence, 0.85),
  reason: `${goal.reason}:context_ticker`,
  safetyNotes: Array.from(new Set([...goal.safetyNotes, 'using_current_ticker'])),
});

const VoiceVisualizer = ({ active, onClose, language }: { active: boolean; onClose: () => void; language: Language }) => {
  if (!active) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="relative flex w-full max-w-sm flex-col items-center gap-6 overflow-hidden rounded-3xl border border-white/10 bg-slate-900 p-8 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-500 transition-colors hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-xl" />
          <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-500/20">
            <Mic className="h-8 w-8 text-white" />
          </div>
        </div>

        <div className="flex h-8 items-center justify-center gap-1.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[10px] w-1.5 animate-wave rounded-full bg-blue-400" style={{ animationDelay: `${i * 0.1}s` }} />
          ))}
        </div>

        <div className="text-center">
          <h3 className="mb-1 text-lg font-bold text-white">{t(language, 'common.voiceCommand')}</h3>
          <p className="text-xs text-slate-400">{t(language, 'common.listening')}</p>
        </div>
      </div>
      <style>{`
        @keyframes wave {
          0%, 100% { height: 10px; opacity: 0.5; }
          50% { height: 24px; opacity: 1; }
        }
        .animate-wave {
          animation: wave 1s ease-in-out infinite;
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

type ViewMode = ShellViewMode;

const App: React.FC = () => {
  const [language, setLanguage] = useState<Language>(() => getInitialLanguage());

  // Load session from localStorage on initialization
  const loadSession = (): UserSession | null => {
    try {
      const saved = window.localStorage.getItem(SESSION_STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load session from localStorage', e);
    }
    return null;
  };

  const [userSession, setUserSession] = useState<UserSession | null>(() => loadSession());
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      id: 'welcome',
      role: 'model',
      text: t(getInitialLanguage(), 'chat.welcome'),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [view, setView] = useState<ViewMode>('overview');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);
  const [isAiConfigured, setIsAiConfigured] = useState(true);
  const [selectedTicker, setSelectedTicker] = useState(() => loadSelectedTicker() || '');
  const [lastReport, setLastReport] = useState<StockAnalysisReport | null>(() => loadCachedReport());
  const [chatContext, setChatContext] = useState<ChatContext>(() => createEmptyChatContext());

  // C-4: Trace & Evidence Drawer state
  const [chatTraces, setChatTraces] = useState<ChatTrace[]>([]);
  const [activeTraceId, setActiveTraceId] = useState<string | null>(null);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<ReturnType<typeof createChatSession> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastDeepSeekCallRef = useRef<DeepSeekCallMemo | null>(null);

  useEffect(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  // Persist session to localStorage
  useEffect(() => {
    if (userSession) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(userSession));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }, [userSession]);

  useEffect(() => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id === 'welcome') {
          return { ...message, text: t(language, 'chat.welcome') };
        }
        if (message.id === 'gemini-key-missing') {
          return { ...message, text: t(language, 'chat.keyMissing') };
        }
        return message;
      })
    );
  }, [language]);

  useEffect(() => {
    if (!userSession) return;

    const interval = setInterval(() => {
      fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: userSession.sessionId,
          username: userSession.username,
        }),
      }).catch((e) => console.error('Heartbeat failed', e));
    }, 60000);

    return () => clearInterval(interval);
  }, [userSession]);

  useEffect(() => {
    try {
      chatSessionRef.current = createChatSession();
    } catch (error: any) {
      console.warn('[App] Chat session unavailable during initialization.', error);
      chatSessionRef.current = null;
      setIsAiConfigured(false);
      setMessages((prev) => {
        if (prev.some((message) => message.id === 'gemini-key-missing')) {
          return prev;
        }

        return [
          ...prev,
          {
            id: 'gemini-key-missing',
            role: 'model',
            text: t(language, 'chat.keyMissing'),
          },
        ];
      });
    }
  }, []);

  useEffect(() => {
    if (view === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, view]);

  useEffect(() => {
    if (!isTyping && view === 'chat') {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isTyping, view]);

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsListening(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.lang = language === 'zh' ? 'zh-CN' : 'en-US';
      recognition.interimResults = true;

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputValue(transcript);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } else {
      alert('Voice recognition not supported in this browser.');
    }
  };

  const speakText = (text: string, id: string) => {
    if (isSpeaking === id) {
      window.speechSynthesis.cancel();
      setIsSpeaking(null);
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = text.replace(/\*\*/g, '').replace(/#/g, '').replace(/\[.*?\]/g, '').replace(/`/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.rate = 1.0;
    utterance.pitch = 0.9;
    utterance.lang = language === 'zh' ? 'zh-CN' : 'en-US';
    utterance.onend = () => setIsSpeaking(null);

    setIsSpeaking(id);
    window.speechSynthesis.speak(utterance);
  };

  // Helper to handle command execution result (new pattern)
  const handleCommandResult = (
    result: ChatCommandExecutionResult,
    currentTrace: ChatTrace,
    commandName: string,
  ) => {
    // Complete the command_execute trace step
    let updatedTrace = completeTraceStep(
      currentTrace,
      'command_execute',
      result.ok ? 'success' : 'error',
      result.ok ? `${commandName} completed` : result.error,
    );

    // Handle clear
    if (result.shouldClearMessages) {
      const welcomeText = t(language, 'chat.welcome');
      setMessages([{ id: 'welcome', role: 'model', text: welcomeText }]);
      setChatContext(createEmptyChatContext());
      setIsTyping(false);
      return;
    }

    // Handle error
    if (!result.ok) {
      const errorMsg = result.text || result.error || t(language, 'chat.commands.fetchFailed');
      setMessages((prev) => [...prev, {
        id: createMessageId('cmd-error'),
        role: 'model',
        text: errorMsg,
      }]);
      setIsTyping(false);
      return;
    }

    // Success: create message
    const messageId = createMessageId('cmd');
    const message: Message = {
      id: messageId,
      role: 'model',
      text: result.text,
      ...result.messagePatch,
    };
    setMessages((prev) => [...prev, message]);

    // Update context
    const contextUpdate = result.contextUpdate;
    if (contextUpdate) {
      setChatContext((prev) => updateContextFromCommandResult(prev, contextUpdate));
    }

    // Update trace with evidence + quality notes
    updatedTrace = addEvidenceItems(updatedTrace, result.evidenceItems);
    if (result.dataQualityNotes?.length) {
      updatedTrace = addDataQualityNotes(updatedTrace, result.dataQualityNotes);
    }
    const linkedTrace = linkTraceToMessage(updatedTrace, messageId);
    setChatTraces((prev) => {
      const filtered = prev.filter((t) => t.id !== linkedTrace.id);
      return [...filtered, linkedTrace].slice(-50);
    });

    // Link trace to message
    setMessages((prev) => prev.map((m) =>
      m.id === messageId ? { ...m, traceId: linkedTrace.id } : m
    ));

    // Navigate
    if (result.navigateTo) {
      setTimeout(() => setView(result.navigateTo!), 100);
    }

    // Set ticker
    if (result.ticker) {
      setSelectedTicker(result.ticker);
      saveSelectedTicker(result.ticker);
    }

    setIsTyping(false);
  };


  const handleSend = async (text: string = inputValue) => {
    if (!text.trim() || isTyping) return;

    setInputValue('');
    const userId = createMessageId('user');
    setMessages((prev) => [
      ...prev,
      { id: userId, role: 'user', text },
    ]);
    setIsTyping(true);

    // C-4: Create initial trace
    let currentTrace = createChatTrace({
      userInput: text,
    });

    try {
      // Add user input step
      currentTrace = addTraceStep(currentTrace, 'user_input', text.slice(0, 100), 'success');

      // ── Phase C-3: Context-aware Goal Compiler routing ──
      const compiledGoal = compileChatGoal(text, { selectedTicker, language });
      const recentMessagesForPlanner: Message[] = [
        ...messages,
        { id: userId, role: 'user', text },
      ];
      const contextTicker = shouldUseContextForFollowup(text, chatContext)
        ? resolveContextTicker({ selectedTicker, context: chatContext })
        : undefined;
      const goal = !compiledGoal.ticker && contextTicker
        ? createContextAwareGoal(compiledGoal, contextTicker)
        : compiledGoal;
      const shouldUsePlannerForChartExplanation = goal.source !== 'slash'
        && goal.intent === 'chart'
        && /解释|说明|怎么看|explain this move|explain.*trend|what.*trend|price action/i.test(text);
      const richAnswerPlanForInput = planRichAnswer({
        userText: text,
        language,
        context: chatContext,
        selectedTicker,
      });
      const shouldPreferGeminiRichAnswer = Boolean(chatSessionRef.current)
        && richAnswerPlanForInput.purpose === 'explain_formula';

      if (goal.source === 'slash') {
        currentTrace = addTraceStep(currentTrace, 'slash_command', `/${goal.command} ${goal.ticker || ''}`, 'success');
        currentTrace = addTraceStep(currentTrace, 'command_execute', goal.command || 'unknown', 'pending');
        const intent = toExecutableIntent(goal);
        const result = await executeChatCommand({
          command: intent.command || intent.name,
          args: intent.ticker ? [intent.ticker] : [],
          rawInput: `/${goal.command} ${goal.ticker || ''}`.trim(),
          ticker: intent.ticker,
          selectedTicker,
          language,
        });
        handleCommandResult(result, currentTrace, goal.command || 'unknown');
        return;
      }

      const deterministicRichBlockPlan = planRichBlocksForAnswer({
        language,
        userText: text,
        context: chatContext,
        recentMessages: recentMessagesForPlanner,
        selectedTicker,
      });
      if (!shouldPreferGeminiRichAnswer && deterministicRichBlockPlan.reason.startsWith('mermaid_') && deterministicRichBlockPlan.blocks.length > 0) {
        const firstBlock = deterministicRichBlockPlan.blocks[0];
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('mermaid-planner'),
            role: 'model',
            text: firstBlock.data?.description || firstBlock.title || t(language, 'chat.mermaid.title'),
            blocks: deterministicRichBlockPlan.blocks,
          },
        ]);
        setIsTyping(false);
        return;
      }

      if (goal.source === 'local_rule' && goal.confidence >= 0.80 && goal.command && !shouldUsePlannerForChartExplanation && !shouldPreferGeminiRichAnswer) {
        currentTrace = addTraceStep(currentTrace, 'local_intent', `${goal.intent} (${(goal.confidence * 100).toFixed(0)}%)`, 'success');
        currentTrace = addTraceStep(currentTrace, 'command_execute', goal.command || 'unknown', 'pending');

        const intentLabel = t(language, `chat.goal.${toIntentLabelKey(goal.intent)}`);
        const detectedText = t(language, 'chat.goal.detected', { intent: intentLabel });
        const tickerFallbackText = goal.safetyNotes.includes('using_current_ticker') && goal.ticker
          ? `\n${t(language, 'chat.goal.usingCurrentTicker', { ticker: goal.ticker })}`
          : '';

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('goal-detected'),
            role: 'model',
            text: `${detectedText}${tickerFallbackText}`,
          },
        ]);
        const localIntent = toExecutableIntent(goal);
        const localResult = await executeChatCommand({
          command: localIntent.command || localIntent.name,
          args: localIntent.ticker ? [localIntent.ticker] : [],
          rawInput: text,
          ticker: localIntent.ticker,
          selectedTicker,
          language,
        });
        handleCommandResult(localResult, currentTrace, goal.command || 'unknown');
        return;
      }

      if (goal.source === 'local_rule' && goal.confidence >= 0.45 && goal.confidence < 0.80) {
        currentTrace = addTraceStep(currentTrace, 'local_intent', `${goal.intent} (${(goal.confidence * 100).toFixed(0)}%)`, 'warning');

        const normalizedInput = normalizeInputForDedupe(text);
        const dedupeTicker = resolveContextTicker({ explicitTicker: goal.ticker, selectedTicker, context: chatContext });
        const recentDeepSeekCall = lastDeepSeekCallRef.current;
        const skipDeepSeek = Boolean(
          recentDeepSeekCall
          && recentDeepSeekCall.normalizedInput === normalizedInput
          && recentDeepSeekCall.ticker === dedupeTicker
          && Date.now() - recentDeepSeekCall.at < 30_000,
        );

        // Add DeepSeek step
        currentTrace = addTraceStep(currentTrace, 'deepseek_intent', 'DeepSeek classifier', 'pending');

        const llmIntent = skipDeepSeek ? null : await classifyChatIntentWithDeepSeek({
          text,
          selectedTicker: dedupeTicker || selectedTicker,
          language,
          localGoal: goal,
        });

        if (!skipDeepSeek) {
          lastDeepSeekCallRef.current = { normalizedInput, ticker: dedupeTicker, at: Date.now() };
          // Complete DeepSeek step
          if (llmIntent) {
            currentTrace = completeTraceStep(currentTrace, 'deepseek_intent', 'success', llmIntent.reason);
          } else {
            currentTrace = completeTraceStep(currentTrace, 'deepseek_intent', 'skipped', 'No result');
          }
        } else {
          currentTrace = completeTraceStep(currentTrace, 'deepseek_intent', 'skipped', 'Deduped');
        }

        if (llmIntent) {
          setChatContext((prev) => updateContextFromCommandResult(prev, {
            ticker: llmIntent.ticker || dedupeTicker,
            intent: llmIntent.intent,
            command: llmIntent.command?.replace(/^\//, '').split(/\s+/)[0],
            deepSeekIntentResult: llmIntent,
          }));
        }

        if (llmIntent?.needsClarification) {
          currentTrace = addTraceStep(currentTrace, 'fallback', 'Needs clarification', 'warning');
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId('intent-clarification'),
              role: 'model',
              text: t(language, 'chat.intentClassifier.needsClarification'),
            },
          ]);
          setIsTyping(false);
          return;
        }

        if (llmIntent?.shouldExecute && llmIntent.command && llmIntent.confidence >= 0.75) {
          currentTrace = addTraceStep(currentTrace, 'command_execute', llmIntent.command, 'pending');
          const executableIntent = toClassifierExecutableIntent(llmIntent);
          if (executableIntent) {
            const intentLabel = t(language, `chat.goal.${toIntentLabelKey(llmIntent.intent)}`);
            const detectedText = t(language, 'chat.intentClassifier.detectedByDeepSeek', { intent: intentLabel });
            const tickerFallbackText = !goal.ticker && executableIntent.ticker
              ? `\n${t(language, 'chat.intentClassifier.usingSelectedTicker', { ticker: executableIntent.ticker })}`
              : '';

            setMessages((prev) => [
              ...prev,
              {
                id: createMessageId('intent-detected'),
                role: 'model',
                text: `${detectedText}${tickerFallbackText}`,
              },
            ]);
            const dsResult = await executeChatCommand({
              command: executableIntent.command || executableIntent.name,
              args: executableIntent.ticker ? [executableIntent.ticker] : [],
              rawInput: text,
              ticker: executableIntent.ticker,
              selectedTicker,
              language,
            });
            handleCommandResult(dsResult, currentTrace, executableIntent.command || 'unknown');
            return;
          }
        }
      }

      if (shouldUsePlannerForChartExplanation) {
        const richBlockPlan = planRichBlocksForAnswer({
          language,
          userText: text,
          context: chatContext,
          recentMessages: recentMessagesForPlanner,
          selectedTicker,
        });
        if (richBlockPlan.blocks.length > 0 && richBlockPlan.reason !== 'reused_recent_chart_block') {
          setMessages((prev) => [
            ...prev,
            {
              id: createMessageId('chart-planner'),
              role: 'model',
              text: richBlockPlan.blocks[0].content || t(language, 'chat.chart.noReusableChart'),
              blocks: richBlockPlan.blocks,
            },
          ]);
          setIsTyping(false);
          return;
        }
      }

      if (goal.requiresTicker && !goal.ticker && !shouldPreferGeminiRichAnswer) {
        currentTrace = addTraceStep(currentTrace, 'fallback', 'Missing ticker', 'warning');
        const richBlockPlan = planRichBlocksForAnswer({
          language,
          userText: text,
          context: chatContext,
          recentMessages: recentMessagesForPlanner,
          selectedTicker,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('goal-missing'),
            role: 'model',
            text: t(language, 'chat.goal.missingTicker'),
            blocks: richBlockPlan.blocks.length > 0 ? richBlockPlan.blocks : undefined,
          },
        ]);
        setIsTyping(false);
        return;
      }

      // Gemini fallback for open-ended analysis and low-confidence inputs.
      // C-6: Model router + answer composer integration.

      // 1. Detect complex financial question
      const isComplexFinancialQuestion =
        goal.confidence < 0.45
        && /分析|explain|why|risk|competitive|long.?term|business model|thesis|framework|compare|outlook|prospect|战略|优势|风险|前景|模型/i.test(text);
      const shouldUseAnswerComposer = isComplexFinancialQuestion
        || richAnswerPlanForInput.purpose === 'analyze_risk';

      // 2. Route model
      const modelRoute = routeChatModel({
        purpose: isComplexFinancialQuestion
          ? 'complex_financial_question'
          : 'general_chat',
        hasGeminiKey: Boolean(chatSessionRef.current),
      });

      // 3. Handle unavailable
      if (modelRoute.provider === 'none') {
        currentTrace = addTraceStep(currentTrace, 'model_route', t(language, 'chat.modelRouter.unavailable'), 'error');
        currentTrace = addTraceStep(currentTrace, 'error', 'No API key', 'error');
        const richAnswerPlan = planRichAnswer({
          userText: text,
          language,
          context: chatContext,
          selectedTicker,
        });
        const richBlockPlan = buildRichBlocksForAnswer({
          plan: richAnswerPlan,
          language,
          userText: text,
          context: chatContext,
          recentMessages: recentMessagesForPlanner,
          selectedTicker,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('no-key'),
            role: 'model',
            text: t(language, 'chat.answerComposer.noApiKey'),
            blocks: mergeChatBlocks(undefined, richBlockPlan.blocks),
          },
        ]);
        setIsTyping(false);
        return;
      }

      // 4. Add trace step for model routing
      currentTrace = addTraceStep(currentTrace, 'model_route',
        `${modelRoute.provider}:${modelRoute.role}`, 'success');
      currentTrace = addTraceStep(currentTrace, 'fallback', 'Gemini AI', 'pending');

      try {
        if (!chatSessionRef.current) {
          throw new Error(GEMINI_KEY_MISSING_MESSAGE);
        }

        // 5. Build prompt
        const prompt = shouldUseAnswerComposer
          ? (() => {
              const comp = composeFinancialChatAnswer({ userText: text, context: chatContext, language });
              return `${comp.systemPrefix}\n\n${comp.contextSummary}\n\n${comp.userPrompt}\n\n${comp.safetyInstructions}`;
            })()
          : (() => {
              const ctx = buildContextSummaryForPrompt(chatContext, language);
              const safety = language === 'zh'
                ? '安全要求：仅做研究解释，不给出方向性交易评级、目标、点位或操作指令。'
                : 'Safety: research explanation only; do not provide directional ratings, targets, levels, or action instructions.';
              const promptText = ctx
                ? `${ctx}\n\n${language === 'zh' ? '用户问题：' : 'User question:'}\n${text}`
                : text;
              return `${promptText}\n\n${safety}`;
            })();

        const response = await chatSessionRef.current.sendMessage(prompt);

        currentTrace = completeTraceStep(currentTrace, 'fallback', 'success');

        const geminiMsgId = createMessageId('gemini');
        const richAnswerPlan = planRichAnswer({
          userText: text,
          language,
          context: chatContext,
          selectedTicker,
        });
        const richBlockPlan = buildRichBlocksForAnswer({
          plan: richAnswerPlan,
          language,
          userText: text,
          context: chatContext,
          recentMessages: recentMessagesForPlanner,
          selectedTicker,
        });
        setMessages((prev) => [
          ...prev,
          {
            id: geminiMsgId,
            role: 'model',
            text: sanitizeFinancialSafetyText(response.text),
            strategy: response.strategy,
            fundamentals: response.fundamentals,
            news: sanitizeGeminiNews(response.news),
            whisper: response.whisper,
            impactAnalysis: response.impactAnalysis,
            quote: response.quote,
            ragContext: response.ragContext,
            blocks: mergeChatBlocks(undefined, richBlockPlan.blocks),
          } as any,
        ]);

        // Link trace to Gemini message
        const evidence = extractEvidenceFromCommandResult({
          quote: response.quote,
          fundamentals: response.fundamentals,
          news: response.news,
        } as Message, 'gemini');
        if (evidence.length > 0) {
          currentTrace = addEvidenceItems(currentTrace, evidence);
        }
        const linkedTrace = linkTraceToMessage(currentTrace, geminiMsgId);
        setChatTraces((prev) => [...prev, linkedTrace].slice(-50));
        setMessages((prev) => prev.map((m) =>
          m.id === geminiMsgId ? { ...m, traceId: linkedTrace.id } : m
        ));
      } catch (error: any) {
        currentTrace = completeTraceStep(currentTrace, 'fallback', 'error', error?.message);
        let errorText = t(language, 'chat.connectionInterrupted');
        if (error?.message?.includes(GEMINI_KEY_MISSING_MESSAGE)) {
          errorText = t(language, 'chat.keyMissing');
        } else if (error?.message?.includes('429') || error?.status === 429) {
          errorText = t(language, 'chat.quotaExceeded');
        } else if (error?.message?.includes('503') || error?.status === 503) {
          errorText = t(language, 'chat.serviceOverloaded');
        }

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId('gemini-error'),
            role: 'model',
            text: errorText,
            blocks: mergeChatBlocks(undefined, buildRichBlocksForAnswer({
              plan: planRichAnswer({
                userText: text,
                language,
                context: chatContext,
                selectedTicker,
              }),
              language,
              userText: text,
              context: chatContext,
              recentMessages: recentMessagesForPlanner,
              selectedTicker,
            }).blocks),
          },
        ]);
      } finally {
        setIsTyping(false);
      }
    } catch (error) {
      console.warn('[App] Trace or execution error:', error);
      setIsTyping(false);
    }
  };

  const getContextLastViewedLabel = () => {
    const command = chatContext.lastCommand || 'unknown';
    const key = command === 'verified-news' ? 'news' : command;
    return t(language, `chat.context.${key}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleContractSelect = (ticker: string, expiration: string, contract: OptionContract) => {
    const normalizedTicker = normalizeResearchTicker(ticker);
    setSelectedTicker(normalizedTicker);
    saveSelectedTicker(normalizedTicker);
    setView('chat');
    const type = contract.type.toUpperCase();
    const prompt = `Analyze this option contract for educational research: ${ticker} $${contract.strike} ${type} expiring ${expiration} (mid ~$${contract.ask.toFixed(2)}). Explain payoff structure, key risks, and how price, time decay, and heuristic volatility affect it. This is not a trading recommendation.`;
    setInputValue(prompt);
  };

  const handleSuggestionSelect = (suggestion: ChatSuggestion) => {
    if (suggestion.command) {
      void handleSend(
        suggestion.command
          ? `/${suggestion.command}${suggestion.requiresTicker && chatContext.currentTicker ? ` ${chatContext.currentTicker}` : ''}`
          : suggestion.prompt.replace('{ticker}', chatContext.currentTicker || ''),
      );
    } else {
      const prompt = suggestion.prompt.replace('{ticker}', chatContext.currentTicker || '');
      void handleSend(prompt);
    }
  };

  const renderChatContent = () => {
    const quickTicker = selectedTicker || 'NVDA';

    return (
      <NuxPage>
      <NuxPageHeader
        eyebrow={t(language, 'common.nuxEyebrow')}
        title={t(language, 'chat.title')}
        subtitle={t(language, 'chat.subtitle')}
      />
      <NuxNotice tone="info">
        {t(language, 'common.currentResearchTarget')}: {selectedTicker || '—'}
      </NuxNotice>
      {chatContext.currentTicker && (
        <NuxNotice tone="info">
          {t(language, 'chat.context.title')}: {chatContext.currentTicker}
          {chatContext.lastCommand ? ` · ${t(language, 'chat.context.lastViewed')}: ${getContextLastViewedLabel()}` : ''}
        </NuxNotice>
      )}
      {!isAiConfigured && <NuxNotice tone="warning">{t(language, 'common.configGeminiHint')}</NuxNotice>}
      {messages.length <= 2 && (
        <div className="mb-8 animate-fade-in-up">
          <PromptSuggestionChips
            suggestions={getStarterSuggestions({ language, selectedTicker, contextTicker: chatContext.currentTicker })}
            language={language}
            onSelect={handleSuggestionSelect}
          />
          {chatContext.currentTicker && (
            <ContextualPromptPanel
              context={chatContext}
              suggestions={getContextualSuggestions({ language, context: chatContext, lastCommand: chatContext.lastCommand, lastIntent: chatContext.lastIntent })}
              language={language}
              onSelect={handleSuggestionSelect}
            />
          )}
        </div>
      )}

      {messages.map((msg: any) => {
        // C-4: Find trace for this message
        const msgTrace = msg.traceId ? chatTraces.find((t) => t.id === msg.traceId) : undefined;
        return (
          <div key={msg.id} className={`group flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}>
            {msg.role === 'model' && (
              <div className="mr-3 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800">
                <Activity className="h-4 w-4 text-blue-400" />
              </div>
            )}
            <ChatMessageRenderer
              message={msg}
              language={language}
              onNavigate={setView}
              onPrompt={(prompt) => {
                setInputValue(prompt);
                setTimeout(() => handleSend(prompt), 50);
              }}
              isSpeaking={isSpeaking}
              onSpeak={speakText}
              trace={msgTrace}
              onOpenEvidence={() => {
                if (msgTrace) {
                  setActiveTraceId(msgTrace.id);
                  setEvidenceDrawerOpen(true);
                }
              }}
            />
          </div>
        );
      })}

      {isTyping && (
        <div className="flex justify-start">
          <div className="mr-3 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800">
            <Activity className="h-4 w-4 text-blue-400" />
          </div>
          <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/5 bg-slate-900/50 px-4 py-3">
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            <div className="delay-75 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
            <div className="delay-150 h-1.5 w-1.5 animate-pulse rounded-full bg-blue-400" />
          </div>
        </div>
      )}
      <div ref={messagesEndRef} />
      </NuxPage>
    );
  };

  const renderContent = () => {
    switch (view) {
      case 'overview':
        return <OverviewView language={language} />;
      case 'report':
        return (
          <ReportView
            language={language}
            selectedTicker={selectedTicker}
            onTickerChange={(ticker) => {
              const normalizedTicker = normalizeResearchTicker(ticker);
              setSelectedTicker(normalizedTicker);
              saveSelectedTicker(normalizedTicker);
            }}
            cachedReport={lastReport}
            onReportGenerated={(report) => {
              setLastReport(report);
              saveCachedReport(report);
              saveSelectedTicker(report.ticker);
            }}
            onNavigate={setView}
          />
        );
      case 'chain':
        return <OptionsChainView language={language} initialTicker={selectedTicker} onSelectContract={handleContractSelect} />;
      case 'academy':
        return <EducationView language={language} />;
      case 'backtest':
        return <BacktestView language={language} selectedTicker={selectedTicker} />;
      case 'timemachine':
        return <TimeMachineView language={language} />;
      case 'whisper':
        return <WhisperView language={language} />;
      case 'news-impact':
        return <NewsImpactView language={language} selectedTicker={selectedTicker} />;
      case 'macro':
        return <MacroView language={language} selectedTicker={selectedTicker} />;
      case 'trading':
        return <TradingView language={language} selectedTicker={selectedTicker} />;
      case 'feedback':
        return <FeedbackView language={language} />;
      case 'admin':
        return <AdminDashboard language={language} />;
      case 'chat':
      default:
        return renderChatContent();
    }
  };

  const chatFooter =
    view === 'chat' ? (
      <footer className="border-t border-white/5 bg-[#081423]/90 p-4 pb-6 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-1.5 shadow-xl">
            <button
              onClick={toggleListening}
              className={`mb-0.5 flex-shrink-0 rounded-xl p-3 transition-all ${
                isListening ? 'animate-pulse bg-rose-500/20 text-rose-500' : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
              title={t(language, 'common.voiceCommand')}
            >
              <Mic className="h-5 w-5" />
            </button>

            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? t(language, 'common.listening') : getDynamicPlaceholder({ language, context: chatContext, selectedTicker })}
              className="min-h-[50px] max-h-[120px] w-full resize-none bg-transparent p-3 text-sm text-white placeholder-slate-500 outline-none"
              rows={1}
              style={{ height: 'auto', minHeight: '50px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
              }}
            />
            <button
              onClick={() => void handleSend()}
              disabled={!inputValue.trim() || isTyping}
              className="mb-0.5 flex-shrink-0 rounded-xl bg-blue-600 p-3 text-white transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-3 text-center opacity-60">
            <p className="text-[10px] font-medium text-slate-500">{t(language, 'chat.experimentDisclaimer')}</p>
          </div>
        </div>
      </footer>
    ) : undefined;

  return (
    <ErrorBoundary>
      <div className="relative h-screen overflow-hidden">
        {!userSession && <LoginOverlay onLogin={setUserSession} />}
      <VoiceVisualizer active={isListening} onClose={() => setIsListening(false)} language={language} />

      <AppShell
        language={language}
        currentView={view}
        onChangeView={setView}
        onToggleLanguage={() => setLanguage((prev) => (prev === 'zh' ? 'en' : 'zh'))}
        footer={chatFooter}
      >
        {renderContent()}
      </AppShell>

      {/* C-4: Evidence Drawer */}
      <EvidenceDrawer
        open={evidenceDrawerOpen}
        trace={chatTraces.find((t) => t.id === activeTraceId)}
        language={language}
        onClose={() => setEvidenceDrawerOpen(false)}
      />
    </div>
    </ErrorBoundary>
  );
};

export default App;
