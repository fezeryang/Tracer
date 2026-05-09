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
import { Message, OptionContract, StockAnalysisReport, UserSession, ChatIntent } from './types';
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
import { executeCommand, CommandExecutorContext } from './services/chatCommandExecutor';
import { parseChatCommand } from './services/chatCommandRegistry';
import { ChatGoal, compileChatGoal } from './services/chatGoalCompiler';
import { classifyChatIntentWithDeepSeek, DeepSeekIntentResult } from './services/chatIntentClassifierService';
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

interface CommandRouteMeta {
  ticker?: string;
  command?: string;
  intent?: string;
  deepSeekIntentResult?: DeepSeekIntentResult;
}

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

const getBlockData = (message: Message, blockType: string) => {
  return message.blocks?.find((block) => block.type === blockType)?.data;
};

const extractDataQualityNotes = (message: Message): string[] | undefined => {
  const notes = message.blocks
    ?.filter((block) => block.type === 'disclaimer' && block.content)
    .map((block) => String(block.content))
    .slice(0, 4);
  return notes && notes.length > 0 ? notes : undefined;
};

const extractHistorySummary = (message: Message, ticker?: string): ChatContext['lastHistorySummary'] => {
  const chartData = getBlockData(message, 'chart')?.chartData;
  if (!ticker || !Array.isArray(chartData) || chartData.length === 0) return undefined;
  const latest = chartData[chartData.length - 1];
  return {
    ticker,
    points: chartData.length,
    startDate: String(chartData[0]?.label || ''),
    endDate: String(latest?.label || ''),
    latestClose: Number.isFinite(Number(latest?.value)) ? Number(latest.value) : undefined,
  };
};

const extractContextUpdateFromMessage = (message: Message, meta: CommandRouteMeta) => {
  const evidence = getBlockData(message, 'evidence_list')?.evidence;
  const trustSummary = getBlockData(message, 'source_trust')?.trustSummary;
  const ticker = meta.ticker || message.quote?.symbol;
  const command = meta.command;

  return {
    ticker,
    command,
    intent: meta.intent,
    quote: message.quote,
    fundamentals: message.fundamentals,
    news: message.news,
    verifiedNews: command === 'verified-news' && Array.isArray(evidence) ? evidence : undefined,
    historySummary: command === 'history' || command === 'chart' ? extractHistorySummary(message, ticker) : undefined,
    secFilings: command === 'sec' && Array.isArray(evidence) ? evidence : undefined,
    officialSources: command === 'official' && Array.isArray(evidence) ? evidence : undefined,
    sourceTrust: trustSummary,
    evidenceBundle: command === 'evidence' && Array.isArray(evidence) ? evidence : undefined,
    dataQualityNotes: extractDataQualityNotes(message),
    deepSeekIntentResult: meta.deepSeekIntentResult,
  };
};

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

  const buildExecutorContext = (meta: CommandRouteMeta = {}, currentTrace?: ChatTrace): CommandExecutorContext => ({
    language,
    t: (key, vars) => t(language, key, vars),
    addMessage: (msg: Message) => {
      setMessages((prev) => [...prev, msg]);
      setChatContext((prev) => updateContextFromCommandResult(
        prev,
        extractContextUpdateFromMessage(msg, meta),
      ));

      // C-4: Extract evidence and link trace to message
      if (currentTrace) {
        try {
          const evidence = extractEvidenceFromCommandResult(msg, meta.command);
          const dataQualityNotes = extractDataQualityNotes(msg);

          let updatedTrace = addEvidenceItems(currentTrace, evidence);
          if (dataQualityNotes) {
            updatedTrace = addDataQualityNotes(updatedTrace, dataQualityNotes);
          }

          const linkedTrace = linkTraceToMessage(updatedTrace, msg.id);
          setChatTraces((prev) => {
            const filtered = prev.filter((t) => t.id !== linkedTrace.id);
            return [...filtered, linkedTrace].slice(-50); // Keep max 50 traces
          });

          // Update the message with traceId
          setMessages((prev) => prev.map((m) =>
            m.id === msg.id ? { ...m, traceId: linkedTrace.id } : m
          ));
        } catch (e) {
          console.warn('[App] Trace update failed:', e);
        }
      }
    },
    setTyping: setIsTyping,
    navigate: setView,
    setTicker: (ticker: string) => {
      const normTicker = (ticker || 'NVDA').trim().toUpperCase();
      setSelectedTicker(normTicker);
      saveSelectedTicker(normTicker);
      setChatContext((prev) => updateContextFromCommandResult(prev, {
        ticker: normTicker,
        command: meta.command,
        intent: meta.intent,
        deepSeekIntentResult: meta.deepSeekIntentResult,
      }));
    },
    resetMessages: (welcomeText: string) => {
      setMessages([{ id: 'welcome', role: 'model', text: welcomeText }]);
      setChatContext(createEmptyChatContext());
    },
  });

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
      const contextTicker = shouldUseContextForFollowup(text, chatContext)
        ? resolveContextTicker({ selectedTicker, context: chatContext })
        : undefined;
      const goal = !compiledGoal.ticker && contextTicker
        ? createContextAwareGoal(compiledGoal, contextTicker)
        : compiledGoal;

      if (goal.source === 'slash') {
        currentTrace = addTraceStep(currentTrace, 'slash_command', `/${goal.command} ${goal.ticker || ''}`, 'pending');
        await executeCommand(toExecutableIntent(goal), buildExecutorContext({
          ticker: goal.ticker,
          command: goal.command,
          intent: goal.intent,
        }, currentTrace));
        return;
      }

      if (goal.source === 'local_rule' && goal.confidence >= 0.80 && goal.command) {
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
        await executeCommand(toExecutableIntent(goal), buildExecutorContext({
          ticker: goal.ticker,
          command: goal.command,
          intent: goal.intent,
        }, currentTrace));
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
            await executeCommand(executableIntent, buildExecutorContext({
              ticker: executableIntent.ticker,
              command: executableIntent.command,
              intent: executableIntent.name,
              deepSeekIntentResult: llmIntent,
            }, currentTrace));
            return;
          }
        }
      }

      if (goal.requiresTicker && !goal.ticker) {
        currentTrace = addTraceStep(currentTrace, 'fallback', 'Missing ticker', 'warning');
        setMessages((prev) => [
          ...prev,
          { id: createMessageId('goal-missing'), role: 'model', text: t(language, 'chat.goal.missingTicker') },
        ]);
        setIsTyping(false);
        return;
      }

      // Gemini fallback remains for open-ended analysis and low-confidence inputs.
      currentTrace = addTraceStep(currentTrace, 'fallback', 'Gemini AI', 'pending');
      try {
        if (!chatSessionRef.current) {
          throw new Error(GEMINI_KEY_MISSING_MESSAGE);
        }

        const contextSummary = buildContextSummaryForPrompt(chatContext, language);
        const promptWithContext = contextSummary
          ? `${contextSummary}\n\n${language === 'zh' ? '用户问题：' : 'User question:'}\n${text}`
          : text;
        const response = await chatSessionRef.current.sendMessage(promptWithContext);

        currentTrace = completeTraceStep(currentTrace, 'fallback', 'success');

        const geminiMsgId = createMessageId('gemini');
        setMessages((prev) => [
          ...prev,
          {
            id: geminiMsgId,
            role: 'model',
            text: response.text,
            strategy: response.strategy,
            fundamentals: response.fundamentals,
            news: response.news,
            whisper: response.whisper,
            impactAnalysis: response.impactAnalysis,
            quote: response.quote,
            ragContext: response.ragContext,
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
          { id: createMessageId('gemini-error'), role: 'model', text: errorText },
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
        <div className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-4 animate-fade-in-up">
          <QuickChip icon={TrendingUp} label={t(language, 'chat.quickMoonshot')} onClick={() => void handleSend(`I'm extremely bullish on ${quickTicker}, what's a high upside play?`)} />
          <QuickChip icon={Newspaper} label={t(language, 'chat.quickNews')} onClick={() => void handleSend(`Scan the news for ${quickTicker} and analyze sentiment.`)} />
          <QuickChip icon={HelpCircle} label={t(language, 'chat.quickTheta')} onClick={() => void handleSend('I want to profit from time decay (Theta) on a tech stock.')} />
          <QuickChip icon={Radio} label={t(language, 'chat.quickImpact')} onClick={() => setView('news-impact')} />
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
              placeholder={isListening ? t(language, 'common.listening') : t(language, 'common.chatPlaceholder')}
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
