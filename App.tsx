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
import { Message, OptionContract, StockAnalysisReport, UserSession } from './types';
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
import { parseChatCommand, getCommandSpec, COMMANDS } from './services/chatCommandRegistry';
import { fetchStockQuote, fetchStockNews, fetchCompanyFundamentals, fetchInsiderTrading, fetchEarningsCalendar, fetchDividends, fetchHistoricalPrices } from './services/marketDataService';
import { fetchVerifiedStockNews } from './services/newsVerificationService';
import { fetchSecFilingsForTicker } from './services/secFilingService';
import { fetchOfficialSources } from './services/officialSourceService';
import { buildSourceTrustSummary } from './services/sourceTrustService';
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
  const [selectedTicker, setSelectedTicker] = useState(() => loadSelectedTicker() || 'NVDA');
  const [lastReport, setLastReport] = useState<StockAnalysisReport | null>(() => loadCachedReport());

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<ReturnType<typeof createChatSession> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSend = async (text: string = inputValue) => {
    if (!text.trim() || isTyping) return;

    setInputValue('');
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        role: 'user',
        text,
      },
    ]);
    setIsTyping(true);

    // Intercept slash commands before calling Gemini
    const command = parseChatCommand(text);
    if (command) {
      const spec = getCommandSpec(command.name);
      if (!spec) {
        setIsTyping(false);
        return;
      }

      const ticker = command.args[0]?.toUpperCase();

      switch (spec.action) {
        case 'help': {
          const helpLines = [
            `## ${t(language, 'chat.commands.title')}`,
            '',
            `| ${t(language, 'chat.commands.help')} | Description |`,
            '|---|---|',
          ];
          for (const cmd of COMMANDS) {
            const desc = t(language, cmd.descriptionKey);
            helpLines.push(`| \`/${cmd.usage}\` | ${desc} |`);
          }
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: helpLines.join('\n'),
            },
          ]);
          setIsTyping(false);
          return;
        }

        case 'fetch_quote': {
          if (!ticker) {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.missingTicker'),
              },
            ]);
            setIsTyping(false);
            return;
          }
          try {
            const quote = await fetchStockQuote(ticker);
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.quoteResult', { ticker }),
                quote,
              } as any,
            ]);
          } catch (error: any) {
            const errorMsg = error?.status === 429
              ? t(language, 'chat.commands.rateLimited')
              : t(language, 'chat.commands.fetchFailed');
            console.warn('[Command] Quote fetch failed:', error);
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: errorMsg,
              },
            ]);
          }
          setIsTyping(false);
          return;
        }

        case 'fetch_news': {
          if (!ticker) {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.missingTicker'),
              },
            ]);
            setIsTyping(false);
            return;
          }
          try {
            const news = await fetchStockNews(ticker);
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.newsResult', { ticker }),
                news,
              } as any,
            ]);
          } catch (error: any) {
            const errorMsg = error?.status === 429
              ? t(language, 'chat.commands.rateLimited')
              : t(language, 'chat.commands.fetchFailed');
            console.warn('[Command] News fetch failed:', error);
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: errorMsg,
              },
            ]);
          }
          setIsTyping(false);
          return;
        }

        case 'fetch_fundamentals': {
          if (!ticker) {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.missingTicker'),
              },
            ]);
            setIsTyping(false);
            return;
          }
          try {
            const fundamentals = await fetchCompanyFundamentals(ticker);
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.fundamentalsResult', { ticker }),
                fundamentals,
              } as any,
            ]);
          } catch (error: any) {
            const errorMsg = error?.status === 429
              ? t(language, 'chat.commands.rateLimited')
              : t(language, 'chat.commands.fetchFailed');
            console.warn('[Command] Fundamentals fetch failed:', error);
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: errorMsg,
              },
            ]);
          }
          setIsTyping(false);
          return;
        }

        case 'navigate': {
          const targetView = spec.targetView;
          if (!ticker || !targetView) {
            setIsTyping(false);
            return;
          }
          const normTicker = normalizeResearchTicker(ticker);
          setSelectedTicker(normTicker);
          saveSelectedTicker(normTicker);

          const navKey = targetView === 'report' ? 'openingReport'
            : targetView === 'chain' ? 'openingChain'
            : targetView === 'backtest' ? 'openingBacktest'
            : targetView === 'news-impact' ? 'openingImpact'
            : 'openingMacro';

          const navText = t(language, `chat.commands.${navKey}`, { ticker: normTicker });
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: navText,
            },
          ]);

          // Navigate after a brief delay so the message renders
          setTimeout(() => setView(targetView), 100);
          setIsTyping(false);
          return;
        }

        case 'clear': {
          setMessages([
            {
              id: 'welcome',
              role: 'model',
              text: t(language, 'chat.welcome'),
            },
          ]);
          setIsTyping(false);
          return;
        }

        // --- fetch_history: /history and /chart ---
        case 'fetch_history': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const history = await fetchHistoricalPrices(ticker, 252);
            if (history.length === 0) throw new Error('No data');
            const count = history.length;
            const prices = history.map(h => h.close);
            const dates = history.map(h => h.date);
            const latestClose = prices[prices.length - 1];
            const highestClose = Math.max(...prices);
            const lowestClose = Math.min(...prices);
            const chartData = history.map(h => ({ label: h.date, value: h.close }));

            setMessages((prev) => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: t(language, 'chat.commands.historyResult', { ticker, count: String(count) }),
              blocks: [
                {
                  type: 'data_quality',
                  data: { quote: undefined, fundamentals: undefined, news: undefined },
                },
                {
                  type: 'chart',
                  title: `${ticker} ${t(language, 'chat.blocks.chart')}`,
                  data: { chartData, chartType: 'line', chartColor: '#818cf8', yAxisLabel: 'Price' },
                },
                {
                  type: 'metric_grid',
                  metrics: [
                    { label: t(language, 'history.dataPoints'), value: count },
                    { label: t(language, 'history.startDate'), value: dates[0] || 'N/A' },
                    { label: t(language, 'history.endDate'), value: dates[dates.length - 1] || 'N/A' },
                    { label: t(language, 'history.latestClose'), value: `$${latestClose.toFixed(2)}` },
                    { label: t(language, 'history.highestClose'), value: `$${highestClose.toFixed(2)}` },
                    { label: t(language, 'history.lowestClose'), value: `$${lowestClose.toFixed(2)}` },
                  ],
                },
                {
                  type: 'disclaimer',
                  content: t(language, 'history.researchOnly'),
                  tone: 'info',
                },
              ],
            } as any]);
          } catch (error: any) {
            const errorMsg = error?.status === 429 ? t(language, 'chat.commands.rateLimited') : t(language, 'chat.commands.fetchFailed');
            console.warn('[Command] History fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: errorMsg }]);
          }
          setIsTyping(false);
          return;
        }

        // --- fetch_verified_news: /verified-news ---
        case 'fetch_verified_news': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const verifiedNews = await fetchVerifiedStockNews(ticker);
            const items = (verifiedNews || []).map((n: any) => ({
              label: `[${n.confidenceScore || '?'}%] ${n.title}${n.source ? ' — ' + n.source : ''}`,
              source: n.source,
              url: n.url,
            }));

            setMessages((prev) => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: t(language, 'chat.commands.verifiedNewsResult', { ticker }),
              blocks: [
                {
                  type: 'evidence_list',
                  data: { evidence: items.length > 0 ? items : [{ label: t(language, 'evidence.noEvidence'), source: undefined, url: undefined }] },
                },
                {
                  type: 'data_quality',
                  data: { quote: undefined, fundamentals: undefined, news: undefined },
                },
              ],
            } as any]);
          } catch (error: any) {
            console.warn('[Command] Verified news fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.fetchFailed') }]);
          }
          setIsTyping(false);
          return;
        }

        // --- fetch_sec: /sec ---
        case 'fetch_sec': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const secData = await fetchSecFilingsForTicker(ticker);
            const filings = secData?.filings || [];
            const items = filings.map((f: any) => ({
              label: `${f.form || 'N/A'} | ${f.filingDate || 'N/A'}${f.description ? ': ' + f.description : ''}`,
              source: 'SEC EDGAR',
              url: f.url,
            }));

            if (secData?.status === 'unavailable') {
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.secResult', { ticker }),
                blocks: [
                  { type: 'evidence_list', data: { evidence: [{ label: t(language, 'sec.unavailable'), source: undefined, url: undefined }] } },
                ],
              } as any]);
            } else {
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.secResult', { ticker }),
                blocks: [
                  { type: 'evidence_list', data: { evidence: items } },
                  { type: 'disclaimer', content: t(language, 'sec.officialDisclosureNotice'), tone: 'info' },
                ],
              } as any]);
            }
          } catch (error: any) {
            console.warn('[Command] SEC fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.fetchFailed') }]);
          }
          setIsTyping(false);
          return;
        }

        // --- fetch_official: /official ---
        case 'fetch_official': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const officialData = await fetchOfficialSources(ticker);
            const sources = officialData?.sources || [];
            const items = sources.map((s: any) => ({
              label: `${s.name || 'N/A'}${s.aiReviewed ? ' [' + t(language, 'evidence.aiVerified') + ']' : ' [' + t(language, 'evidence.requiresManualConfirmation') + ']'}`,
              source: s.type || 'N/A',
              url: s.url,
            }));

            if (officialData?.status === 'error' || officialData?.status === 'not_found') {
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.fetchFailed'),
              }]);
            } else {
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.officialResult', { ticker }),
                blocks: [
                  { type: 'evidence_list', data: { evidence: items.length > 0 ? items : [{ label: t(language, 'evidence.noEvidence'), source: undefined, url: undefined }] } },
                ],
              } as any]);
            }
          } catch (error: any) {
            console.warn('[Command] Official sources fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.fetchFailed') }]);
          }
          setIsTyping(false);
          return;
        }

        // --- fetch_trust: /trust ---
        case 'fetch_trust': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const [verifiedNews, secData, officialData] = await Promise.all([
              fetchVerifiedStockNews(ticker),
              fetchSecFilingsForTicker(ticker),
              fetchOfficialSources(ticker),
            ]);
            const trustSummary = buildSourceTrustSummary({ ticker, verifiedNews, officialFilings: secData, officialSources: officialData });

            setMessages((prev) => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: t(language, 'chat.commands.trustResult', { ticker }),
              blocks: [
                {
                  type: 'source_trust',
                  data: { trustSummary },
                },
                {
                  type: 'metric_grid',
                  metrics: [
                    { label: t(language, 'sourceTrust.overallScore'), value: `${trustSummary.overallScore}/100` },
                    { label: t(language, 'sourceTrust.confidenceLevel'), value: trustSummary.confidenceLevel },
                    { label: t(language, 'sourceTrust.officialSources'), value: trustSummary.officialSourceCount },
                    { label: t(language, 'sourceTrust.secFilings'), value: trustSummary.secFilingCount },
                    { label: t(language, 'sourceTrust.verifiedNews'), value: trustSummary.verifiedNewsCount },
                  ],
                },
              ],
            } as any]);
          } catch (error: any) {
            console.warn('[Command] Trust fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.fetchFailed') }]);
          }
          setIsTyping(false);
          return;
        }

        // --- fetch_evidence: /evidence ---
        case 'fetch_evidence': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const [quote, verifiedNews, secData, officialData] = await Promise.all([
              fetchStockQuote(ticker),
              fetchVerifiedStockNews(ticker).catch(() => []),
              fetchSecFilingsForTicker(ticker).catch(() => undefined),
              fetchOfficialSources(ticker).catch(() => undefined),
            ]);
            const trustSummary = buildSourceTrustSummary({ ticker, verifiedNews, officialFilings: secData, officialSources: officialData });

            const newsItems = (verifiedNews || []).map((n: any) => ({
              label: `[${n.confidenceScore || '?'}% ${t(language, 'evidence.verifiedNews')}] ${n.title}`,
              source: n.source,
              url: n.url,
            }));
            const secItems = (secData?.filings || []).map((f: any) => ({
              label: `${f.form || 'N/A'} (${f.filingDate || 'N/A'})`,
              source: 'SEC',
              url: f.url,
            }));
            const officialItems = (officialData?.sources || []).map((s: any) => ({
              label: s.name || 'N/A',
              source: s.type || 'N/A',
              url: s.url,
            }));
            const allEvidence = [...newsItems, ...secItems, ...officialItems];

            setMessages((prev) => [...prev, {
              id: (Date.now() + 1).toString(),
              role: 'model',
              text: t(language, 'chat.commands.evidenceResult', { ticker }),
              blocks: [
                {
                  type: 'data_quality',
                  data: { quote: quote || undefined, fundamentals: undefined, news: undefined },
                },
                {
                  type: 'source_trust',
                  data: { trustSummary },
                },
                {
                  type: 'evidence_list',
                  data: { evidence: allEvidence.length > 0 ? allEvidence : [{ label: t(language, 'evidence.noEvidence'), source: undefined, url: undefined }] },
                },
                {
                  type: 'action_buttons',
                  actions: [
                    { label: t(language, 'chat.actions.generateReport'), view: 'report', ticker },
                    { label: t(language, 'chat.actions.analyzeNewsImpact'), view: 'news-impact', ticker },
                    { label: t(language, 'chat.actions.viewMacro'), view: 'macro', ticker },
                  ],
                },
              ],
            } as any]);
          } catch (error: any) {
            console.warn('[Command] Evidence fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.fetchFailed') }]);
          }
          setIsTyping(false);
          return;
        }

        // --- fetch_insiders: /insiders ---
        case 'fetch_insiders': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const data = await fetchInsiderTrading(ticker);
            if (data.status === 'unavailable') {
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.insidersResult', { ticker }),
                blocks: [
                  {
                    type: 'evidence_list',
                    data: { evidence: [{ label: t(language, 'insiders.unavailable'), source: undefined, url: undefined }] },
                  },
                ],
              } as any]);
            } else {
              const tradeItems = (data.trades || []).slice(0, 20).map((t: any) => ({
                label: `${t.name || 'N/A'} — ${t.transactionType === 'buy' ? 'Buy' : 'Sell'} ${t.shares} shares @ $${t.price || 'N/A'}`,
                source: t.date || 'N/A',
                url: undefined,
              }));

              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.insidersResult', { ticker }),
                blocks: [
                  {
                    type: 'metric_grid',
                    metrics: [
                      { label: t(language, 'insiders.totalBuys'), value: data.totalBuys, tone: data.totalBuys > data.totalSells ? 'positive' : 'neutral' },
                      { label: t(language, 'insiders.totalSells'), value: data.totalSells, tone: data.totalSells > data.totalBuys ? 'negative' : 'neutral' },
                      { label: t(language, 'insiders.transactionCount'), value: data.trades.length },
                      { label: t(language, 'insiders.netShares'), value: data.netShares, helper: data.sentiment },
                    ],
                  },
                  {
                    type: 'evidence_list',
                    data: { evidence: tradeItems.length > 0 ? tradeItems : [{ label: 'No recent insider trades.', source: undefined, url: undefined }] },
                  },
                ],
              } as any]);
            }
          } catch (error: any) {
            console.warn('[Command] Insiders fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.fetchFailed') }]);
          }
          setIsTyping(false);
          return;
        }

        // --- fetch_earnings: /earnings ---
        case 'fetch_earnings': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const earnings = await fetchEarningsCalendar(ticker);
            if (!earnings || earnings.length === 0) {
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.earningsResult', { ticker }),
                blocks: [
                  { type: 'evidence_list', data: { evidence: [{ label: t(language, 'earnings.unavailable'), source: undefined, url: undefined }] } },
                ],
              } as any]);
            } else {
              const latest = earnings[0];
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.earningsResult', { ticker }),
                blocks: [
                  {
                    type: 'metric_grid',
                    metrics: [
                      { label: t(language, 'earnings.date'), value: latest.date || 'N/A' },
                      { label: t(language, 'earnings.epsEstimate'), value: latest.epsEstimate != null ? `$${latest.epsEstimate}` : 'N/A' },
                      { label: t(language, 'earnings.epsActual'), value: latest.epsActual != null ? `$${latest.epsActual}` : 'N/A' },
                      { label: t(language, 'earnings.surprise'), value: latest.surprise || 'N/A' },
                    ],
                  },
                ],
              } as any]);
            }
          } catch (error: any) {
            console.warn('[Command] Earnings fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.fetchFailed') }]);
          }
          setIsTyping(false);
          return;
        }

        // --- fetch_dividends: /dividends ---
        case 'fetch_dividends': {
          if (!ticker) {
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.missingTicker') }]);
            setIsTyping(false);
            return;
          }
          try {
            const dividends = await fetchDividends(ticker);
            if (!dividends || dividends.length === 0) {
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.dividendsResult', { ticker }),
                blocks: [
                  { type: 'evidence_list', data: { evidence: [{ label: t(language, 'dividends.unavailable'), source: undefined, url: undefined }] } },
                ],
              } as any]);
            } else {
              const items = dividends.slice(0, 20).map((d: any) => ({
                label: `${d.date || 'N/A'} — $${d.amount != null ? d.amount.toFixed(4) : 'N/A'}${d.paymentDate ? ' (Pay: ' + d.paymentDate + ')' : ''}`,
                source: 'Dividend',
                url: undefined,
              }));
              setMessages((prev) => [...prev, {
                id: (Date.now() + 1).toString(),
                role: 'model',
                text: t(language, 'chat.commands.dividendsResult', { ticker }),
                blocks: [
                  { type: 'evidence_list', data: { evidence: items } },
                ],
              } as any]);
            }
          } catch (error: any) {
            console.warn('[Command] Dividends fetch failed:', error);
            setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: t(language, 'chat.commands.fetchFailed') }]);
          }
          setIsTyping(false);
          return;
        }

        default:
          setIsTyping(false);
          return;
      }
    }

    // --- Existing Gemini flow (unchanged) ---
    try {
      if (!chatSessionRef.current) {
        throw new Error(GEMINI_KEY_MISSING_MESSAGE);
      }

      const response = await chatSessionRef.current.sendMessage(text);

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
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
    } catch (error: any) {
      console.error('Error:', error);

      let errorText = t(language, 'chat.connectionInterrupted');
      if (error?.message?.includes(GEMINI_KEY_MISSING_MESSAGE)) {
        errorText = t(language, 'chat.keyMissing');
      } else if (error?.message?.includes('429') || error?.status === 429 || error?.code === 429) {
        errorText = t(language, 'chat.quotaExceeded');
      } else if (error?.message?.includes('503') || error?.status === 503) {
        errorText = t(language, 'chat.serviceOverloaded');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          role: 'model',
          text: errorText,
        },
      ]);
    } finally {
      setIsTyping(false);
    }
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

  const renderChatContent = () => (
    <NuxPage>
      <NuxPageHeader
        eyebrow={t(language, 'common.nuxEyebrow')}
        title={t(language, 'chat.title')}
        subtitle={t(language, 'chat.subtitle')}
      />
      <NuxNotice tone="info">
        {t(language, 'common.currentResearchTarget')}: {selectedTicker}
      </NuxNotice>
      {!isAiConfigured && <NuxNotice tone="warning">{t(language, 'common.configGeminiHint')}</NuxNotice>}
      {messages.length <= 2 && (
        <div className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-4 animate-fade-in-up">
          <QuickChip icon={TrendingUp} label={t(language, 'chat.quickMoonshot')} onClick={() => void handleSend(`I'm extremely bullish on ${selectedTicker}, what's a high upside play?`)} />
          <QuickChip icon={Newspaper} label={t(language, 'chat.quickNews')} onClick={() => void handleSend(`Scan the news for ${selectedTicker} and analyze sentiment.`)} />
          <QuickChip icon={HelpCircle} label={t(language, 'chat.quickTheta')} onClick={() => void handleSend('I want to profit from time decay (Theta) on a tech stock.')} />
          <QuickChip icon={Radio} label={t(language, 'chat.quickImpact')} onClick={() => setView('news-impact')} />
        </div>
      )}

      {messages.map((msg: any) => (
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
          />
        </div>
      ))}

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
    </div>
    </ErrorBoundary>
  );
};

export default App;
