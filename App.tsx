
import React, { useState, useEffect, useRef } from 'react';
import { Send, Activity, Info, Zap, Radio, TrendingUp, Shield, HelpCircle, GraduationCap, MessageSquare, Mic, Volume2, X, Layers, Newspaper, History, MessageCircle, Database, ShieldCheck, Clock, Users, ArrowRight, AlertTriangle, Globe, ShoppingCart, FileText } from 'lucide-react';
import { createChatSession, GEMINI_KEY_MISSING_MESSAGE } from './services/geminiService';
import { Message, OptionContract, StockQuote, UserSession } from './types';
import { fetchStockQuote } from './services/marketDataService';
import StrategyCard from './components/StrategyCard';
import FundamentalsCard from './components/FundamentalsCard';
import NewsFeed from './components/NewsFeed';
import ReactMarkdown from 'react-markdown';
import EducationView from './components/EducationView';
import OptionsChainView from './components/OptionsChainView';
import BacktestView from './components/BacktestView';
import FeedbackView from './components/FeedbackView';
import AdminDashboard from './components/AdminDashboard';
import LoginOverlay from './components/LoginOverlay';
import TimeMachineView from './components/TimeMachineView';
import WhisperView from './components/WhisperView';
import NewsImpactView from './components/NewsImpactView';
import QuoteCard from './components/QuoteCard';
import MacroView from './components/MacroView';
import TradingView from './components/TradingView';
import ReportView from './components/ReportView';

const TickerTape = () => {
  const [quotes, setQuotes] = useState<StockQuote[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const tickers = ['SPY', 'QQQ', 'IWM', 'NVDA', 'TSLA', 'AAPL', 'AMD', 'MSFT', 'AMZN', 'GOOGL'];

  useEffect(() => {
    const loadQuotes = async () => {
      const promises = tickers.map(t => fetchStockQuote(t));
      try {
        const results = await Promise.all(promises);
        setQuotes(results);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (error) {
        console.error("Failed to load ticker tape data", error);
      }
    };

    loadQuotes();
    const interval = setInterval(loadQuotes, 10000);
    return () => clearInterval(interval);
  }, []);

  const displayItems = quotes.length > 0 ? quotes : tickers.map(t => ({ 
      symbol: t, 
      price: 0, 
      changePercent: 0 
  } as StockQuote));

  return (
    <div className="w-full bg-slate-950 border-b border-white/5 overflow-hidden py-1.5 flex items-center h-[34px] relative group">
      <div className="absolute left-4 z-20 flex items-center gap-2 bg-slate-950 pr-4 shadow-[10px_0_15px_-5px_rgba(2,6,23,1)]">
         <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Live Feed</span>
         </div>
      </div>

      <div className="whitespace-nowrap animate-marquee flex items-center gap-8 text-xs font-mono font-medium opacity-70 pl-24">
         {/* Original List */}
         {displayItems.map((item, i) => (
           <span key={i} className="flex items-center gap-2 text-slate-400 group/item relative">
             <span className="text-white font-bold">{item.symbol}</span>
             <span>${item.price > 0 ? item.price.toFixed(2) : '---'}</span>
             <span className={item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
               {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
             </span>
             {item.source && (
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[8px] px-1.5 py-0.5 rounded border border-white/10 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                   Source: {item.source}
                 </div>
             )}
             {item.source?.includes('Simulation') && (
                 <span title="Simulated Data - Network Error">
                   <AlertTriangle className="w-3 h-3 text-rose-500 animate-pulse" />
                 </span>
             )}
           </span>
         ))}
         {/* Duplicate for seamless loop */}
         {displayItems.map((item, i) => (
           <span key={`dup-${i}`} className="flex items-center gap-2 text-slate-400 group/item relative">
             <span className="text-white font-bold">{item.symbol}</span>
             <span>${item.price > 0 ? item.price.toFixed(2) : '---'}</span>
             <span className={item.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
               {item.changePercent > 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
             </span>
             {item.source && (
                 <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-[8px] px-1.5 py-0.5 rounded border border-white/10 opacity-0 group-hover/item:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
                   Source: {item.source}
                 </div>
             )}
           </span>
         ))}
      </div>
      
      <div className="absolute right-4 z-20 bg-slate-950 pl-4 shadow-[-10px_0_15px_-5px_rgba(2,6,23,1)] text-[10px] font-mono text-slate-500">
         {lastUpdated}
      </div>
    </div>
  );
};

const QuickChip = ({ icon: Icon, label, onClick }: { icon: any, label: string, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-indigo-600/20 hover:border-indigo-500/50 border border-white/5 rounded-full transition-all text-xs font-medium text-slate-300 hover:text-white backdrop-blur-sm"
  >
    <Icon className="w-3.5 h-3.5" />
    {label}
  </button>
);

// Voice Visualizer Component
const VoiceVisualizer = ({ active, onClose }: { active: boolean, onClose: () => void }) => {
  if (!active) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="flex flex-col items-center gap-6 p-8 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl relative overflow-hidden max-w-sm w-full">
         <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
         </button>
         
         <div className="relative">
            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/30 animate-bounce-slight relative z-10">
               <Mic className="w-8 h-8 text-white" />
            </div>
         </div>

         <div className="flex items-center justify-center gap-1.5 h-8">
             {[...Array(5)].map((_, i) => (
                 <div key={i} className="w-1.5 bg-indigo-400 rounded-full animate-wave" style={{ animationDelay: `${i * 0.1}s`, height: '10px' }}></div>
             ))}
         </div>

         <div className="text-center">
            <h3 className="text-white font-bold text-lg mb-1">Voice Command Active</h3>
            <p className="text-slate-400 text-xs">Listening for trading instructions...</p>
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
        .animate-bounce-slight {
           animation: bounceSlight 2s infinite ease-in-out;
        }
        @keyframes bounceSlight {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
};

type ViewMode = 'chat' | 'report' | 'academy' | 'chain' | 'backtest' | 'feedback' | 'admin' | 'timemachine' | 'whisper' | 'news-impact' | 'macro' | 'trading';

const App: React.FC = () => {
  // Login State
  const [userSession, setUserSession] = useState<UserSession | null>(null);
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "VOLT Terminal initialized. Live Market Data Feed active. Ready for instructions.",
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [view, setView] = useState<ViewMode>('chat');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<ReturnType<typeof createChatSession> | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Heartbeat Effect
  useEffect(() => {
    if (!userSession) return;
    
    // Heartbeat every minute
    const interval = setInterval(() => {
        fetch('/api/auth/heartbeat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                sessionId: userSession.sessionId, 
                username: userSession.username 
            })
        }).catch(e => console.error("Heartbeat failed", e));
    }, 60000);

    return () => clearInterval(interval);
  }, [userSession]);

  useEffect(() => {
    try {
      chatSessionRef.current = createChatSession();
    } catch (error: any) {
      console.warn('[App] Chat session unavailable during initialization.', error);
      chatSessionRef.current = null;
      setMessages(prev => {
        if (prev.some(message => message.id === 'gemini-key-missing')) {
          return prev;
        }

        return [
          ...prev,
          {
            id: 'gemini-key-missing',
            role: 'model',
            text: GEMINI_KEY_MISSING_MESSAGE,
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

  // Focus input when typing finishes or view switches to chat
  useEffect(() => {
    if (!isTyping && view === 'chat') {
        setTimeout(() => {
            inputRef.current?.focus();
        }, 50);
    }
  }, [isTyping, view]);

  // Voice Input Handler
  const toggleListening = () => {
    if (isListening) {
        setIsListening(false);
        return;
    }

    // @ts-ignore - Vendor prefix handling
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
        setIsListening(true);
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
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
        alert("Voice recognition not supported in this browser.");
    }
  };

  // Text to Speech Handler
  const speakText = (text: string, id: string) => {
      if (isSpeaking === id) {
          window.speechSynthesis.cancel();
          setIsSpeaking(null);
          return;
      }

      window.speechSynthesis.cancel(); // Stop any current speech
      
      const cleanText = text
        .replace(/\*\*/g, '') 
        .replace(/#/g, '')   
        .replace(/\[.*?\]/g, '') 
        .replace(/`/g, '');  

      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.0;
      utterance.pitch = 0.9; 
      
      utterance.onend = () => setIsSpeaking(null);
      
      setIsSpeaking(id);
      window.speechSynthesis.speak(utterance);
  };

  const handleSend = async (text: string = inputValue) => {
    if (!text.trim() || isTyping) return;

    setInputValue('');
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      text: text,
    }]);
    setIsTyping(true);

    try {
      if (!chatSessionRef.current) {
        throw new Error(GEMINI_KEY_MISSING_MESSAGE);
      }
      // @ts-ignore - Handle potential return types
      const response = await chatSessionRef.current.sendMessage(text);
      
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        strategy: response.strategy,
        fundamentals: response.fundamentals,
        news: response.news,
        whisper: response.whisper,
        impactAnalysis: response.impactAnalysis,
        quote: response.quote,
        ragContext: response.ragContext
      } as any]);
    } catch (error: any) {
      console.error('Error:', error);
      
      let errorText = "Connection interrupted. Retrying market feed...";
      if (error?.message?.includes(GEMINI_KEY_MISSING_MESSAGE)) {
          errorText = GEMINI_KEY_MISSING_MESSAGE;
      } else
      if (error?.message?.includes('429') || error?.status === 429 || error?.code === 429) {
          errorText = "⚠️ API Quota Exceeded. The system is momentarily overloaded or your API plan limit has been reached. Please try again in a few minutes.";
      } else if (error?.message?.includes('503') || error?.status === 503) {
          errorText = "⚠️ AI Service Overloaded. Please try again shortly.";
      }

      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: errorText,
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleContractSelect = (ticker: string, expiration: string, contract: OptionContract) => {
     setView('chat');
     const type = contract.type.toUpperCase();
     const prompt = `Analyze this option contract: ${ticker} $${contract.strike} ${type} expiring ${expiration}. It is currently trading at ~$${contract.ask.toFixed(2)}. What are the risks and is this a good entry point?`;
     setInputValue(prompt);
  };

  const handleSessionStart = (session: UserSession) => {
      setUserSession(session);
  };

  const renderContent = () => {
      switch(view) {
          case 'report': return <ReportView />;
          case 'chain': return <OptionsChainView onSelectContract={handleContractSelect} />;
          case 'academy': return <EducationView />;
          case 'backtest': return <BacktestView />;
          case 'timemachine': return <TimeMachineView />;
          case 'whisper': return <WhisperView />;
          case 'news-impact': return <NewsImpactView />;
          case 'macro': return <MacroView />;
          case 'trading': return <TradingView />;
          case 'feedback': return <FeedbackView />;
          case 'admin': return <AdminDashboard />;
          default: return (
            <>
              {messages.length === 1 && (
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8 animate-fade-in-up">
                    <QuickChip icon={TrendingUp} label="🚀 Moonshot" onClick={() => handleSend("I'm extremely bullish on NVDA, what's a high upside play?")} />
                    <QuickChip icon={Newspaper} label="📰 News Scan" onClick={() => handleSend("Scan the news for AAPL and analyze sentiment.")} />
                    <QuickChip icon={HelpCircle} label="💎 Theta Gang" onClick={() => handleSend("I want to profit from time decay (Theta) on a tech stock.")} />
                    <QuickChip icon={Radio} label="📡 Predict Impact" onClick={() => setView('news-impact')} />
                 </div>
              )}

              {messages.map((msg: any) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in group`}>
                  {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center mr-3 mt-1 flex-shrink-0 shadow-lg">
                      <Activity className="w-4 h-4 text-indigo-400" />
                    </div>
                  )}

                  <div className={`max-w-[95%] sm:max-w-[85%] ${msg.role === 'user' ? 'items-end flex flex-col' : ''}`}>
                    {msg.role === 'model' && msg.ragContext && (
                        <div className="mb-2 flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20 w-fit">
                            <Database className="w-3 h-3" />
                            <span>Memory Active: {msg.ragContext.length} items retrieved</span>
                        </div>
                    )}

                    {msg.text && (
                       <div className={`relative px-6 py-4 rounded-2xl backdrop-blur-sm shadow-sm prose prose-invert prose-sm max-w-none transition-all ${
                           msg.role === 'user' 
                           ? 'bg-indigo-600 text-white rounded-br-none shadow-[0_0_20px_-5px_rgba(79,70,229,0.3)]' 
                           : 'bg-slate-900/60 border border-white/5 text-slate-300 rounded-bl-none'
                       }`}>
                          <ReactMarkdown 
                            components={{
                                p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                strong: ({node, ...props}) => <strong className="text-white font-bold" {...props} />,
                                ul: ({node, ...props}) => <ul className="list-disc pl-4 mb-2 space-y-1 marker:text-indigo-400" {...props} />,
                            }}
                          >
                            {msg.text}
                          </ReactMarkdown>
                          
                          {msg.role === 'model' && msg.text && (
                            <button 
                                onClick={() => speakText(msg.text!, msg.id)}
                                className={`absolute -bottom-6 left-0 p-1.5 rounded-full hover:bg-white/10 transition-colors ${isSpeaking === msg.id ? 'text-indigo-400 animate-pulse' : 'text-slate-500 opacity-0 group-hover:opacity-100'}`}
                                title="Read Aloud"
                            >
                                <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                       </div>
                    )}
                    
                    {/* Attachments */}
                    {msg.quote && <QuoteCard quote={msg.quote} />}
                    {msg.fundamentals && <FundamentalsCard data={msg.fundamentals} />}
                    {msg.news && <NewsFeed news={msg.news} />}
                    
                    {/* Render News Impact Prediction */}
                    {msg.impactAnalysis && (
                        <div className="mt-4 border-l-2 border-rose-500 pl-4 py-2 bg-rose-500/5 rounded-r-lg">
                            <h4 className="text-sm font-bold text-rose-400 mb-1 flex items-center gap-2">
                                <Radio className="w-4 h-4" /> Impact Predicted: {msg.impactAnalysis.verdict}
                            </h4>
                            <div className="flex items-center gap-4 text-xs text-slate-300 mt-2">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 uppercase">Current</span>
                                    <span className="font-mono">{msg.impactAnalysis.currentMove > 0 ? '+' : ''}{msg.impactAnalysis.currentMove}%</span>
                                </div>
                                <ArrowRight className="w-3 h-3 text-slate-500" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-slate-500 uppercase">Target</span>
                                    <span className="font-mono text-indigo-400">
                                        {msg.impactAnalysis.predictedMoveLow}% - {msg.impactAnalysis.predictedMoveHigh}%
                                    </span>
                                </div>
                            </div>
                            <button 
                                onClick={() => setView('news-impact')}
                                className="mt-3 text-[10px] text-indigo-300 hover:text-white font-bold uppercase tracking-wide flex items-center gap-1"
                            >
                                View Full Analysis <TrendingUp className="w-3 h-3" />
                            </button>
                        </div>
                    )}

                    {/* Render Whisper View if present in message context */}
                    {msg.whisper && (
                        <div className="mt-4 border-l-2 border-indigo-500 pl-4 py-2 bg-indigo-500/5 rounded-r-lg">
                            <h4 className="text-sm font-bold text-indigo-400 mb-1 flex items-center gap-2">
                                <Users className="w-4 h-4" /> Whisper Signal: {msg.whisper.sentimentLabel}
                            </h4>
                            <p className="text-xs text-slate-400 italic">"{msg.whisper.summary}"</p>
                            <button 
                                onClick={() => setView('whisper')}
                                className="mt-2 text-[10px] text-indigo-300 hover:text-white font-bold uppercase tracking-wide flex items-center gap-1"
                            >
                                View Full Aggregation <TrendingUp className="w-3 h-3" />
                            </button>
                        </div>
                    )}
                    {msg.strategy && <StrategyCard strategy={msg.strategy} />}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                 <div className="flex justify-start">
                    <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center mr-3 flex-shrink-0">
                      <Activity className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="bg-slate-900/50 border border-white/5 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse delay-75"></div>
                       <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-pulse delay-150"></div>
                    </div>
                 </div>
              )}
              <div ref={messagesEndRef} />
            </>
          );
      }
  };

  return (
    <div className="flex flex-col h-screen bg-[#050b14] text-slate-200 font-sans selection:bg-indigo-500/30 overflow-hidden relative">
      
      {!userSession && <LoginOverlay onLogin={handleSessionStart} />}

      {/* Background FX */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>
      <div className="absolute top-0 left-0 w-full h-96 bg-indigo-900/10 blur-[100px] rounded-full pointer-events-none"></div>

      <VoiceVisualizer active={isListening} onClose={() => setIsListening(false)} />

      {/* Header */}
      <TickerTape />
      <header className="flex-none p-4 border-b border-white/5 bg-slate-900/30 backdrop-blur-md sticky top-0 z-10">
        <div className="w-full max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/20 border border-white/10">
              <Zap className="text-white w-5 h-5 fill-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                VOLT <span className="text-slate-600">//</span> OPTION VOLATILITY TERMINAL <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-indigo-300 font-normal">BETA</span>
              </h1>
              <p className="text-[10px] text-emerald-400 flex items-center gap-1.5 font-medium tracking-wide">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                OP: {userSession?.username.toUpperCase() || 'UNAUTHORIZED'}
              </p>
            </div>
          </div>

          <div className="flex bg-slate-900/50 p-1 rounded-xl border border-white/5 overflow-x-auto scrollbar-hide">
             <button 
                onClick={() => setView('chat')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'chat' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
             >
               <MessageSquare className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Chat</span>
             </button>
             <button 
                onClick={() => setView('report')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'report' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
             >
               <FileText className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Report</span>
             </button>
             <button 
                onClick={() => setView('chain')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'chain' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
             >
               <Layers className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Chain</span>
             </button>
             <button 
                onClick={() => setView('backtest')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'backtest' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
             >
               <History className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Backtest</span>
             </button>
             <button 
                onClick={() => setView('news-impact')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'news-impact' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                title="News Impact Predictor"
             >
               <Radio className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Impact</span>
             </button>
             <button 
                onClick={() => setView('macro')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'macro' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                title="Macro Intelligence"
             >
               <Globe className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Macro</span>
             </button>
             <button 
                onClick={() => setView('trading')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'trading' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                title="Alpaca Trading"
             >
               <ShoppingCart className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Trade</span>
             </button>
             <button 
                onClick={() => setView('timemachine')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'timemachine' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                title="Historical Replay"
             >
               <Clock className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Time Machine</span>
             </button>
             <button 
                onClick={() => setView('whisper')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'whisper' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                title="Earnings Whisper Aggregator"
             >
               <Users className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Whisper</span>
             </button>
             <button 
                onClick={() => setView('academy')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'academy' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
             >
               <GraduationCap className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Academy</span>
             </button>
             <button 
                onClick={() => setView('feedback')}
                className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'feedback' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
                title="Send Feedback"
             >
               <MessageCircle className="w-3.5 h-3.5" />
               <span className="hidden md:inline">Feedback</span>
             </button>
             <button 
                onClick={() => setView('admin')}
                className={`ml-2 px-3 md:px-4 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-all whitespace-nowrap ${view === 'admin' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-white'}`}
                title="System Logs"
             >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Logs</span>
             </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto scrollbar-hide p-4 relative z-0">
        <div className={`mx-auto space-y-8 pb-32 pt-4 h-full ${view === 'chat' ? 'max-w-4xl' : 'w-full max-w-[1800px]'}`}>
            {renderContent()}
        </div>
      </main>

      {/* Input Area (Only show in chat mode) */}
      {view === 'chat' && (
        <footer className="flex-none p-4 pb-6 bg-[#050b14]/80 backdrop-blur-xl border-t border-white/5 z-20">
          <div className="max-w-4xl mx-auto relative">
            <div className="flex items-end gap-2 bg-slate-900/60 p-1.5 rounded-2xl border border-white/10 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all shadow-xl">
              
              <button
                onClick={toggleListening}
                className={`p-3 rounded-xl transition-all flex-shrink-0 mb-0.5 ${isListening ? 'bg-rose-500/20 text-rose-500 animate-pulse' : 'hover:bg-white/5 text-slate-400 hover:text-white'}`}
                title="Voice Command"
              >
                <Mic className="w-5 h-5" />
              </button>

              <textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? "Listening..." : "Describe your market view..."}
                  className="w-full bg-transparent text-white placeholder-slate-500 text-sm p-3 focus:outline-none resize-none scrollbar-hide min-h-[50px] max-h-[120px]"
                  rows={1}
                  style={{ height: 'auto', minHeight: '50px' }}
                  onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                  }}
              />
              <button 
                onClick={() => handleSend()}
                disabled={!inputValue.trim() || isTyping}
                className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0 mb-0.5 shadow-lg shadow-indigo-900/20 active:scale-95"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
            
            <div className="mt-3 text-center opacity-40 hover:opacity-100 transition-opacity">
               <p className="text-[10px] text-slate-500 font-medium">
                  VOLT is an AI experiment. Not financial advice. Trading options involves significant risk.
               </p>
            </div>

            <style>{`
              @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
              }
              .animate-marquee {
                animation: marquee 30s linear infinite;
              }
              .animate-fade-in {
                animation: fadeIn 0.5s ease-out forwards;
              }
              @keyframes fadeIn {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;
