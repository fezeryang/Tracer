

import React from 'react';
import { StrategyRecommendation } from '../types';
import PayoffChart from './PayoffChart';
import { ArrowUpRight, ArrowDownRight, Minus, Zap, ShieldAlert, BrainCircuit, Database } from 'lucide-react';

interface StrategyCardProps {
  strategy: StrategyRecommendation;
}

const StrategyCard: React.FC<StrategyCardProps> = ({ strategy }) => {
  const getThesisColor = (thesis: string) => {
    switch(thesis.toLowerCase()) {
      case 'bullish': return 'text-emerald-400 border-emerald-500/50 bg-emerald-500/10';
      case 'bearish': return 'text-rose-400 border-rose-500/50 bg-rose-500/10';
      case 'neutral': return 'text-cyan-400 border-cyan-500/50 bg-cyan-500/10';
      default: return 'text-violet-400 border-violet-500/50 bg-violet-500/10';
    }
  };

  const getThesisIcon = (thesis: string) => {
     switch(thesis.toLowerCase()) {
      case 'bullish': return <ArrowUpRight className="w-4 h-4 mr-1" />;
      case 'bearish': return <ArrowDownRight className="w-4 h-4 mr-1" />;
      default: return <Minus className="w-4 h-4 mr-1" />;
    }
  };

  const getComplexityColor = (c: string) => {
     switch(c) {
         case 'Low': return 'bg-blue-500';
         case 'Medium': return 'bg-yellow-500';
         case 'High': return 'bg-orange-500';
         case 'Degen': return 'bg-pink-600';
         default: return 'bg-slate-500';
     }
  };

  return (
    <div className="w-full relative bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden mt-6 shadow-[0_0_40px_-10px_rgba(79,70,229,0.2)] animate-fade-in group hover:border-indigo-500/30 transition-colors duration-500">
      
      {/* Glossy Header */}
      <div className="p-5 border-b border-white/5 flex justify-between items-start bg-gradient-to-r from-white/5 to-transparent">
        <div>
          <div className="flex items-center gap-3 mb-1">
             <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                {strategy.name}
             </h2>
             <span className={`text-xs px-2.5 py-1 rounded-full border flex items-center font-medium shadow-sm uppercase tracking-wide ${getThesisColor(strategy.thesis)}`}>
               {getThesisIcon(strategy.thesis)}
               {strategy.thesis}
             </span>
          </div>
          <p className="text-slate-400 text-sm font-mono">
             {strategy.ticker} <span className="text-slate-600 mx-2">|</span> Price: <span className="text-white">${strategy.currentPrice}</span>
          </p>
        </div>
        
        {/* Hero Metric */}
        <div className="text-right">
             <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mb-1">Max Potential</div>
             <div className={`text-2xl font-mono font-bold tracking-tighter ${strategy.maxProfit === 'Unlimited' ? 'text-emerald-400' : 'text-emerald-400'}`}>
               {strategy.maxProfit === 'Unlimited' ? '∞' : `$${strategy.maxProfit}`}
             </div>
        </div>
      </div>

      <div className="p-0 grid grid-cols-1 lg:grid-cols-2">
        {/* Left Col: Explanation & Legs */}
        <div className="p-5 space-y-6 border-r border-white/5">
          
          {/* Trade DNA Section */}
          <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-950/50 p-3 rounded-lg border border-white/5">
                 <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                    <BrainCircuit className="w-3 h-3" /> Complexity
                 </div>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${getComplexityColor(strategy.complexity)}`} style={{ width: strategy.complexity === 'Low' ? '25%' : strategy.complexity === 'Medium' ? '50%' : strategy.complexity === 'High' ? '75%' : '100%'}}></div>
                 </div>
                 <div className="text-right text-xs text-white mt-1 font-medium">{strategy.complexity}</div>
              </div>

              <div className="bg-slate-950/50 p-3 rounded-lg border border-white/5">
                 <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                    <ShieldAlert className="w-3 h-3" /> Risk Lvl
                 </div>
                 <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-500 to-rose-500" style={{ width: `${strategy.riskScore * 10}%`}}></div>
                 </div>
                 <div className="text-right text-xs text-white mt-1 font-medium">{strategy.riskScore}/10</div>
              </div>

              <div className="bg-slate-900/50 p-3 rounded-lg border border-white/5">
                 <div className="flex items-center gap-1.5 text-slate-400 text-[10px] uppercase font-bold tracking-wider mb-2">
                    <Zap className="w-3 h-3" /> P.O.P.
                 </div>
                 <div className="flex items-end justify-between">
                    <div className="text-xl font-bold text-white">{strategy.pop}%</div>
                    <div className="text-[10px] text-slate-500 mb-1">Prob. Profit</div>
                 </div>
              </div>
          </div>

          <div className="bg-indigo-500/5 p-4 rounded-xl border border-indigo-500/10">
             <h4 className="text-indigo-300 font-semibold mb-2 text-sm flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span> 
                Thesis
             </h4>
             <p className="text-slate-300 text-sm leading-relaxed">
               {strategy.explanation}
             </p>
          </div>

          <div>
             <h4 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">Legs Configuration</h4>
             <div className="space-y-2">
               {strategy.legs.map((leg, idx) => (
                 <div key={idx} className="flex justify-between items-center p-3 bg-slate-950 rounded-lg border border-white/5 text-sm group hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${leg.action === 'buy' ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-900' : 'bg-rose-900/40 text-rose-400 border border-rose-900'}`}>
                        {leg.action}
                      </span>
                      <span className="text-slate-200 font-mono font-medium">{leg.strike} {leg.type.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-500 text-xs">{leg.expiration}</span>
                        <span className="text-white font-mono min-w-[60px] text-right">${leg.premium}</span>
                    </div>
                 </div>
               ))}
             </div>
          </div>
        </div>

        {/* Right Col: Chart & Stats */}
        <div className="flex flex-col p-5 bg-slate-900/30">
           <PayoffChart strategy={strategy} />
           
           <div className="mt-6 grid grid-cols-2 gap-4">
               <div className="bg-slate-950 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-rose-500/20 transition-colors">
                  <div className="text-xs text-rose-400/80 uppercase tracking-wider font-semibold">Max Loss</div>
                  <div className="text-rose-400 font-mono text-lg font-medium mt-1">
                    {strategy.maxLoss === 'Unlimited' ? 'Unlimited' : `$${strategy.maxLoss}`}
                  </div>
               </div>
               <div className="bg-slate-950 p-4 rounded-xl border border-white/5 flex flex-col justify-between hover:border-cyan-500/20 transition-colors">
                  <div className="text-xs text-cyan-400/80 uppercase tracking-wider font-semibold">Breakeven</div>
                  <div className="text-cyan-400 font-mono text-lg font-medium mt-1">
                    {strategy.breakEven.map(b => `$${b}`).join(', ')}
                  </div>
               </div>
           </div>
        </div>
      </div>
      
      {strategy.marketDataSource && (
          <div className="px-5 pb-3 flex justify-end">
              <div className="flex items-center gap-1.5 text-[9px] text-slate-500 uppercase font-bold tracking-wider">
                  <Database className="w-3 h-3" />
                  Prices sourced from: {strategy.marketDataSource}
              </div>
          </div>
      )}
      <div className="px-5 pb-4">
        <p className="text-[10px] text-slate-500 italic text-center">
          For educational research only. Not a trading recommendation.
        </p>
      </div>
    </div>
  );
};

export default StrategyCard;
