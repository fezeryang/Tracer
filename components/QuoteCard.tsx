
import React from 'react';
import { StockQuote } from '../types';
import { Activity, Database, AlertTriangle, Clock } from 'lucide-react';

interface QuoteCardProps {
  quote: StockQuote;
}

const QuoteCard: React.FC<QuoteCardProps> = ({ quote }) => {
  const isSimulation = quote.source?.includes('Simulation');
  const isPolygon = quote.source?.includes('Polygon');

  // Default color (Yahoo/Others)
  let sourceColor = 'text-amber-400';
  let sourceIcon = <Database className="w-3 h-3" />;

  if (isPolygon) {
      sourceColor = 'text-violet-400'; // Polygon Brand Color
      sourceIcon = <Activity className="w-3 h-3" />;
  }
  
  if (isSimulation) {
      sourceColor = 'text-rose-400';
      sourceIcon = <AlertTriangle className="w-3 h-3" />;
  }

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden mt-4 animate-fade-in group">
        <div className="p-4 border-b border-white/5 bg-slate-950/30 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-indigo-400" />
                Raw Market Feed
            </h3>
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${sourceColor}`}>
                {sourceIcon}
                Source: {quote.source || 'Unknown'}
            </div>
        </div>
        
        <div className="p-5 flex items-center justify-between">
            <div>
                <div className="text-3xl font-black text-white font-mono tracking-tighter">
                    {quote.symbol}
                </div>
                <div className="text-xs text-slate-500 font-mono mt-1 flex items-center gap-1">
                   <Clock className="w-3 h-3" /> Real-time Snapshot
                </div>
            </div>

            <div className="text-right">
                <div className="text-3xl font-mono font-bold text-white">
                    ${quote.price.toFixed(2)}
                </div>
                <div className={`text-sm font-mono font-medium ${quote.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {quote.change > 0 ? '+' : ''}{quote.change.toFixed(2)} ({quote.changePercent.toFixed(2)}%)
                </div>
            </div>
        </div>

        {isSimulation && (
             <div className="px-5 pb-4">
                 <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 flex items-start gap-2">
                     <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                     <p>
                         <strong>Warning:</strong> Live data connection failed. Displaying simulated/mock data. 
                         Prices are not real. Do not trade based on this information.
                     </p>
                 </div>
             </div>
        )}
        
        <div className="px-5 pb-5 grid grid-cols-2 gap-4">
             <div className="bg-slate-950 p-2 rounded-lg border border-white/5 flex justify-between items-center">
                 <span className="text-[10px] text-slate-500 uppercase font-bold">Implied Volatility</span>
                 <span className="text-cyan-400 font-mono font-bold">{(quote.volatility * 100).toFixed(1)}%</span>
             </div>
             <div className="bg-slate-950 p-2 rounded-lg border border-white/5 flex justify-between items-center">
                 <span className="text-[10px] text-slate-500 uppercase font-bold">Data Integrity</span>
                 <span className="text-white font-mono font-bold">{isSimulation ? 'LOW' : 'HIGH'}</span>
             </div>
        </div>
    </div>
  );
};

export default QuoteCard;
