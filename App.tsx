import React, { Component, useEffect, useRef, useState } from 'react';
import { Mic, X, AlertCircle } from 'lucide-react';
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
import MacroView from './components/MacroView';
import TradingView from './components/TradingView';
import ReportView from './components/ReportView';
import OverviewView from './components/OverviewView';
import AppShell from './components/AppShell';
import { ChatView, ChatFooter } from './components/chat/ChatView';
import { loadCachedReport, loadSelectedTicker, saveCachedReport, saveSelectedTicker } from './services/reportCacheService';
import { getInitialLanguage, LANGUAGE_STORAGE_KEY, Language, t } from './i18n';
import { ShellViewMode } from './types';
import { detectLanguage } from './utils/languageDetection';

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

    try {
      if (!chatSessionRef.current) {
        throw new Error(GEMINI_KEY_MISSING_MESSAGE);
      }

      // Auto-detect language from user input
      const detectedLanguage = detectLanguage(text);

      const response = await chatSessionRef.current.sendMessage(text, detectedLanguage);

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

  const handleContractSelect = (ticker: string, expiration: string, contract: OptionContract) => {
    const normalizedTicker = normalizeResearchTicker(ticker);
    setSelectedTicker(normalizedTicker);
    saveSelectedTicker(normalizedTicker);
    setView('chat');
    const type = contract.type.toUpperCase();
    const prompt = `Analyze this option contract: ${ticker} $${contract.strike} ${type} expiring ${expiration}. It is currently trading at ~$${contract.ask.toFixed(2)}. What are the risks and is this a good entry point?`;
    setInputValue(prompt);
  };

  const renderChatContent = () => (
    <ChatView
      language={language}
      selectedTicker={selectedTicker}
      messages={messages}
      isTyping={isTyping}
      isSpeaking={isSpeaking}
      isAiConfigured={isAiConfigured}
      inputValue={inputValue}
      isListening={isListening}
      inputRef={inputRef}
      messagesEndRef={messagesEndRef}
      onSend={handleSend}
      onInputChange={setInputValue}
      onToggleListening={toggleListening}
      onSpeakText={speakText}
      onNavigateToView={setView}
    />
  );

  const renderContent = () => {
    return (
      <>
        <div style={{ display: view === 'chain' ? 'contents' : 'none' }}>
          <OptionsChainView language={language} initialTicker={selectedTicker} onSelectContract={handleContractSelect} />
        </div>
        {(() => {
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
        })()}
      </>
    );
  };

  const chatFooter =
    view === 'chat' ? (
      <ChatFooter
        inputValue={inputValue}
        isListening={isListening}
        isTyping={isTyping}
        language={language}
        inputRef={inputRef}
        onInputChange={setInputValue}
        onSend={() => void handleSend()}
        onToggleListening={toggleListening}
      />
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
