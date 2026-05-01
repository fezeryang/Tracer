
import React from 'react';
import { CompanyFundamentals } from '../types';
import { Building2, Globe, TrendingUp, DollarSign, Activity } from 'lucide-react';

interface FundamentalsCardProps {
  data: CompanyFundamentals;
}

const FundamentalsCard: React.FC<FundamentalsCardProps> = ({ data }) => {
  const formatMarketCap = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden mt-4 animate-fade-in group hover:border-cyan-500/30 transition-colors duration-500">
      
      {/* Header */}
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-cyan-900/10 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-white p-1 flex items-center justify-center">
             <img 
               src={`https://financialmodelingprep.com/image-stock/${data.symbol}.png`} 
               alt={data.symbol} 
               className="w-full h-full object-contain"
               onError={(e) => {
                   (e.target as HTMLImageElement).style.display = 'none';
               }} 
             />
             <Building2 className="w-6 h-6 text-slate-800 hidden group-hover:block absolute" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white leading-none">{data.companyName}</h3>
            <span className="text-cyan-400 font-mono text-xs tracking-wider">{data.symbol}</span>
          </div>
        </div>
        <a 
            href={data.website} 
            target="_blank" 
            rel="noopener noreferrer"
            className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white transition-colors"
        >
            <Globe className="w-4 h-4" />
        </a>
      </div>

      <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
         <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
             <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3 h-3" /> Market Cap
             </div>
             <div className="text-white font-mono font-medium">{formatMarketCap(data.marketCap)}</div>
         </div>
         
         <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
             <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                <Activity className="w-3 h-3" /> Beta (Vol)
             </div>
             <div className={`font-mono font-medium ${data.beta > 1.5 ? 'text-rose-400' : data.beta < 0.8 ? 'text-emerald-400' : 'text-white'}`}>
                {data.beta.toFixed(2)}
             </div>
         </div>

         <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
             <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                <TrendingUp className="w-3 h-3" /> P/E Ratio
             </div>
             <div className="text-white font-mono font-medium">{data.peRatio ? data.peRatio.toFixed(1) : 'N/A'}</div>
         </div>

         <div className="bg-slate-950/50 p-3 rounded-xl border border-white/5">
             <div className="text-[10px] text-slate-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-1.5">
                <Building2 className="w-3 h-3" /> Sector
             </div>
             <div className="text-white text-xs font-medium truncate" title={data.sector}>{data.sector}</div>
         </div>
      </div>
      
      <div className="px-4 pb-4">
        <div className="p-3 bg-slate-950/30 rounded-xl border border-white/5">
           <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
              {data.description}
           </p>
        </div>
      </div>
    </div>
  );
};

export default FundamentalsCard;
