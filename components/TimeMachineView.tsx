
import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, StepForward, TrendingUp, Activity, AlertTriangle, Newspaper, Rewind, BarChart4 } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts';
import { getMarketEvents } from '../services/timeMachineService';
import { MarketEvent } from '../types';
import { Language, t } from '../i18n';
import { NuxPageHeader, RiskDisclaimer } from './NuxPage';

const TimeMachineView: React.FC<{ language: Language }> = ({ language }) => {
  const events = getMarketEvents();
  const [selectedEvent, setSelectedEvent] = useState<MarketEvent>(events[0]);
  const [currentFrameIndex, setCurrentFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentFrame = selectedEvent.frames[currentFrameIndex];
  
  // Strategy Simulation State
  const [strategies, setStrategies] = useState({
      bull: { name: 'Long Call', value: 0 },
      bear: { name: 'Long Put', value: 0 }
  });

  const togglePlay = () => setIsPlaying(!isPlaying);

  const reset = () => {
      setIsPlaying(false);
      setCurrentFrameIndex(0);
      setStrategies({
        bull: { name: 'Long Call', value: 0 },
        bear: { name: 'Long Put', value: 0 }
      });
  };

  const stepForward = () => {
      if (currentFrameIndex < selectedEvent.frames.length - 1) {
          setCurrentFrameIndex(prev => prev + 1);
      } else {
          setIsPlaying(false);
      }
  };

  useEffect(() => {
      if (isPlaying) {
          playbackRef.current = setInterval(() => {
              stepForward();
          }, 2000); // 2 seconds per frame
      } else {
          if (playbackRef.current) clearInterval(playbackRef.current);
      }
      return () => { if (playbackRef.current) clearInterval(playbackRef.current); };
  }, [isPlaying, currentFrameIndex]);

  // Recalculate Strategy P/L on frame change
  useEffect(() => {
      if (currentFrameIndex === 0) {
          setStrategies({
            bull: { name: 'Long Call', value: 0 },
            bear: { name: 'Long Put', value: 0 }
          });
          return;
      }
      
      const entryPrice = selectedEvent.frames[0].price;
      const currentPrice = currentFrame.price;
      
      // Simple P/L Simulation
      // Long Call: (Current - Entry) * 100
      // Long Put: (Entry - Current) * 100
      const bullPL = (currentPrice - entryPrice) * 100;
      const bearPL = (entryPrice - currentPrice) * 100;

      setStrategies({
          bull: { name: 'Long Call', value: parseFloat(bullPL.toFixed(0)) },
          bear: { name: 'Long Put', value: parseFloat(bearPL.toFixed(0)) }
      });

  }, [currentFrameIndex, selectedEvent]);

  // Prepare chart data (slice up to current frame)
  const chartData = selectedEvent.frames.slice(0, currentFrameIndex + 1);

  return (
    <div className="animate-fade-in w-full pb-10">
       <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'nav.timemachine')} subtitle={t(language, 'backtest.subtitle')} />
       
       {/* Event Selector */}
       <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-hide">
           {events.map(evt => (
               <button
                  key={evt.id}
                  onClick={() => { setSelectedEvent(evt); reset(); }}
                  className={`flex-shrink-0 p-4 rounded-xl border w-64 text-left transition-all ${
                      selectedEvent.id === evt.id 
                      ? 'bg-indigo-600 border-indigo-500 shadow-lg shadow-indigo-500/30' 
                      : 'bg-slate-900/40 border-white/10 hover:bg-slate-800'
                  }`}
               >
                   <div className="text-xs font-bold uppercase tracking-wider mb-1 opacity-70">{evt.ticker}</div>
                   <h3 className="text-white font-bold text-sm mb-1">{evt.title}</h3>
                   <p className="text-xs text-slate-400 line-clamp-2">{evt.description}</p>
               </button>
           ))}
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           
           {/* Main Player Area */}
           <div className="lg:col-span-2 space-y-6">
               <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                   
                   {/* Header Info */}
                   <div className="flex justify-between items-start mb-6">
                       <div>
                           <div className="flex items-center gap-3">
                               <h2 className="text-3xl font-bold text-white tracking-tight">{selectedEvent.ticker}</h2>
                               <span className="text-xl font-mono text-emerald-400">${currentFrame.price}</span>
                           </div>
                           <p className="text-slate-400 text-sm mt-1">{currentFrame.date}</p>
                       </div>
                       <div className="text-right">
                           <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Market VIX</div>
                           <div className={`text-2xl font-mono font-bold ${currentFrame.volatility > 40 ? 'text-rose-400' : 'text-slate-300'}`}>
                               {currentFrame.volatility}
                           </div>
                       </div>
                   </div>

                   {/* Chart */}
                   <div className="h-64 w-full mb-6">
                       <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={chartData}>
                               <defs>
                                   <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                                       <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                       <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                   </linearGradient>
                               </defs>
                               <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                               <XAxis dataKey="date" stroke="#475569" fontSize={10} tickFormatter={d => d.substring(5)} />
                               <YAxis domain={['auto', 'auto']} stroke="#475569" fontSize={10} />
                               <Area type="monotone" dataKey="price" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" animationDuration={300} />
                           </AreaChart>
                       </ResponsiveContainer>
                   </div>

                   {/* Controls */}
                   <div className="flex items-center justify-center gap-6">
                       <button onClick={reset} className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                           <Rewind className="w-5 h-5" />
                       </button>
                       <button 
                            onClick={togglePlay}
                            className="w-14 h-14 rounded-full bg-indigo-500 hover:bg-indigo-400 text-white flex items-center justify-center shadow-lg shadow-indigo-500/40 transition-transform active:scale-95"
                       >
                           {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current pl-1" />}
                       </button>
                       <button onClick={stepForward} className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 transition-colors">
                           <StepForward className="w-5 h-5" />
                       </button>
                   </div>

                   {/* Progress Bar */}
                   <div className="absolute bottom-0 left-0 h-1 bg-slate-800 w-full">
                       <div 
                         className="h-full bg-indigo-500 transition-all duration-300"
                         style={{ width: `${((currentFrameIndex + 1) / selectedEvent.frames.length) * 100}%` }}
                       ></div>
                   </div>
               </div>
           </div>

           {/* Sidebar: Commentary & Stats */}
           <div className="space-y-6">
               {/* AI Commentary Feed */}
               <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 backdrop-blur-md h-64 flex flex-col">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                       <Activity className="w-4 h-4 text-indigo-400" /> Live Commentary
                   </h3>
                   <div className="flex-grow overflow-y-auto pr-2 space-y-4 scrollbar-hide">
                       <div className="animate-fade-in">
                           <div className="flex items-center gap-2 mb-1">
                               <Newspaper className="w-3 h-3 text-slate-400" />
                               <span className="text-[10px] text-slate-500 font-bold uppercase">Breaking News</span>
                           </div>
                           <p className="text-white text-sm font-medium leading-snug mb-2">{currentFrame.news}</p>
                           <div className="bg-indigo-500/10 p-3 rounded-lg border border-indigo-500/20">
                               <p className="text-indigo-200 text-xs italic">" {currentFrame.commentary} "</p>
                           </div>
                       </div>
                   </div>
               </div>

               {/* Strategy Race */}
               <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                   <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                       <BarChart4 className="w-4 h-4 text-emerald-400" /> Strategy Performance
                   </h3>
                   <div className="space-y-4">
                       <div>
                           <div className="flex justify-between text-xs mb-1">
                               <span className="text-emerald-400 font-bold">Bull: {strategies.bull.name}</span>
                               <span className={strategies.bull.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                   {strategies.bull.value >= 0 ? '+' : ''}${strategies.bull.value}
                               </span>
                           </div>
                           <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                               <div 
                                 className="h-full bg-emerald-500 transition-all duration-500"
                                 style={{ width: `${Math.min(Math.abs(strategies.bull.value) / 20, 100)}%` }} // Normalized visual
                               ></div>
                           </div>
                       </div>
                       
                       <div>
                           <div className="flex justify-between text-xs mb-1">
                               <span className="text-rose-400 font-bold">Bear: {strategies.bear.name}</span>
                               <span className={strategies.bear.value >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                                   {strategies.bear.value >= 0 ? '+' : ''}${strategies.bear.value}
                               </span>
                           </div>
                           <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                               <div 
                                 className="h-full bg-rose-500 transition-all duration-500"
                                 style={{ width: `${Math.min(Math.abs(strategies.bear.value) / 20, 100)}%` }}
                               ></div>
                           </div>
                       </div>
                   </div>
               </div>
           </div>

       </div>
       <RiskDisclaimer language={language} />
    </div>
  );
};

export default TimeMachineView;
