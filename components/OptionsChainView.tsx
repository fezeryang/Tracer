
import React, { useState, useEffect } from 'react';
import { Search, Filter, Calendar, RefreshCw, ChevronDown, Layers, MessageSquarePlus, Calculator, BarChart3, List, Radar, ArrowRight, TrendingUp, TrendingDown, AlertTriangle, Zap, BrainCircuit, X } from 'lucide-react';
import { OptionsChain, OptionContract } from '../types';
import { fetchOptionsChain, calculateHestonPrice } from '../services/marketDataService';
import { createChatSession } from '../services/geminiService';
import OptionsChainVisualizer from './OptionsChainVisualizer';
import { Language, t } from '../i18n';
import { NuxPageHeader, NuxNotice, RiskDisclaimer } from './NuxPage';

interface OptionsChainViewProps {
  language?: Language;
  initialTicker?: string;
  onSelectContract?: (ticker: string, expiration: string, contract: OptionContract, currentPrice: number) => void;
}

interface ContractRowProps { 
    call: OptionContract; 
    put: OptionContract; 
    strike: number;
    onSelect: (c: OptionContract) => void;
}

const ContractRow: React.FC<ContractRowProps> = ({ 
    call, 
    put, 
    strike, 
    onSelect 
}) => {
  return (
    <div className="grid grid-cols-11 text-xs border-b border-white/5 last:border-0 group">
      
      {/* CALLS SIDE */}
      <div 
        onClick={() => onSelect(call)}
        className={`col-span-5 grid grid-cols-5 items-center py-2 px-2 cursor-pointer transition-colors relative ${call.inTheMoney ? 'bg-emerald-900/10 hover:bg-emerald-900/20' : 'hover:bg-white/5'}`}
        title="Click to analyze this Call"
      >
         {/* THEO */}
         <div className="text-indigo-300 font-mono text-right font-medium hidden sm:block bg-indigo-500/10 rounded px-1">{call.theoreticalPrice.toFixed(2)}</div>
         <div className="text-indigo-300 font-mono text-right font-medium sm:hidden">-</div>
         
         <div className="text-slate-500 text-right hidden md:block">{call.volume.toLocaleString()}</div>
         <div className="text-slate-500 text-right md:hidden">-</div>
         
         <div className="text-slate-400 text-right">{call.impliedVolatility}%</div>
         <div className="text-emerald-400 font-mono text-right">{call.bid.toFixed(2)}</div>
         <div className="text-emerald-300 font-mono text-right font-medium">{call.ask.toFixed(2)}</div>
         
         {/* Hover Action Icon */}
         <div className="absolute left-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <MessageSquarePlus className="w-3 h-3 text-indigo-400" />
         </div>
      </div>

      {/* STRIKE SPINE */}
      <div className="col-span-1 bg-slate-900 flex items-center justify-center border-l border-r border-white/5 relative z-10">
         <span className={`font-mono font-bold text-sm ${call.inTheMoney ? 'text-emerald-400' : 'text-slate-400'} ${put.inTheMoney ? 'text-rose-400' : ''}`}>
            {strike}
         </span>
         {/* ITM Indicators */}
         {call.inTheMoney && <div className="absolute left-0 w-0.5 h-full bg-emerald-500"></div>}
         {put.inTheMoney && <div className="absolute right-0 w-0.5 h-full bg-rose-500"></div>}
      </div>

      {/* PUTS SIDE */}
      <div 
        onClick={() => onSelect(put)}
        className={`col-span-5 grid grid-cols-5 items-center py-2 px-2 cursor-pointer transition-colors relative ${put.inTheMoney ? 'bg-rose-900/10 hover:bg-rose-900/20' : 'hover:bg-white/5'}`}
        title="Click to analyze this Put"
      >
         <div className="text-rose-300 font-mono font-medium text-left">{put.bid.toFixed(2)}</div>
         <div className="text-rose-400 font-mono text-left">{put.ask.toFixed(2)}</div>
         <div className="text-slate-400 text-left">{put.impliedVolatility}%</div>
         
         <div className="text-slate-500 text-left hidden md:block">{put.volume.toLocaleString()}</div>
         <div className="text-slate-500 text-left md:hidden">-</div>
         
         {/* THEO */}
         <div className="text-indigo-300 font-mono text-left font-medium hidden sm:block bg-indigo-500/10 rounded px-1">{put.theoreticalPrice.toFixed(2)}</div>
         <div className="text-indigo-300 font-mono text-left font-medium sm:hidden">-</div>

         {/* Hover Action Icon */}
         <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <MessageSquarePlus className="w-3 h-3 text-indigo-400" />
         </div>
      </div>
    </div>
  );
};

interface MispricingResult {
    contract: OptionContract;
    type: 'call' | 'put';
    marketPrice: number;
    hestonPrice: number;
    edge: number; // Percentage diff
    score: number; // Confidence/Magnitude score
    recommendation: 'BUY' | 'SELL';
}

const OptionsChainView: React.FC<OptionsChainViewProps> = ({ language = 'zh', initialTicker = 'SPY', onSelectContract }) => {
  const [ticker, setTicker] = useState(initialTicker);
  const [loading, setLoading] = useState(false);
  const [chain, setChain] = useState<OptionsChain | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'visual' | 'scanner'>('table');
  
  // Scanner State
  const [scannerResults, setScannerResults] = useState<MispricingResult[]>([]);
  const [scanning, setScanning] = useState(false);
  const [quantMemo, setQuantMemo] = useState<{ id: string, text: string } | null>(null);
  const [generatingMemo, setGeneratingMemo] = useState(false);

  const loadChain = async (symbol: string, date?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchOptionsChain(symbol, date);
      setChain(data);
      // Reset scanner when data changes
      setScannerResults([]);
    } catch (e) {
      console.error(e);
      setError(t(language, 'chain.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChain(ticker);
  }, []);

  // Run Heston Scanner Logic
  useEffect(() => {
      if (viewMode === 'scanner' && chain && scannerResults.length === 0 && !scanning) {
          runScanner();
      }
  }, [viewMode, chain]);

  const runScanner = async () => {
      if (!chain) return;
      setScanning(true);
      
      // Simulate heavy calc delay for effect
      await new Promise(r => setTimeout(r, 800));

      const results: MispricingResult[] = [];
      const riskFreeRate = 0.05;
      
      const now = new Date();
      const expDate = new Date(chain.selectedExpiration);
      const diffTime = Math.abs(expDate.getTime() - now.getTime());
      const dteYears = Math.max(0.001, diffTime / (1000 * 60 * 60 * 24 * 365));

      // Process Calls
      chain.calls.forEach(call => {
          if (call.lastPrice < 0.05) return; // Ignore penny options
          
          // Basic calibration assumption for Heston (normally would calibrate to smile)
          // Here we assume Heston Fair Value uses a slightly lower vol-of-vol for stability check
          // If Market IV is crazy high, Heston (mean reverting) usually prices lower -> Sell Signal
          
          const iv = call.impliedVolatility / 100;
          const v0 = iv * iv;
          
          // Calculate Heston "Fair Value"
          const hestonPrice = calculateHestonPrice(
              'call',
              chain.currentPrice,
              call.strike,
              dteYears,
              riskFreeRate,
              v0,      // v0
              v0,      // theta (long term var)
              1.5,     // kappa (mean reversion speed)
              0.5,     // xi (vol of vol)
              -0.5     // rho (correlation)
          );

          const marketPrice = (call.bid + call.ask) / 2 || call.lastPrice;
          const diff = marketPrice - hestonPrice;
          const edgePct = (diff / marketPrice) * 100;

          // If Market > Heston by > 10% -> Overvalued -> SELL
          if (edgePct > 15) {
              results.push({
                  contract: call,
                  type: 'call',
                  marketPrice,
                  hestonPrice,
                  edge: edgePct,
                  score: Math.abs(diff) * Math.abs(edgePct), // simple score
                  recommendation: 'SELL'
              });
          }
          // If Market < Heston by > 10% -> Undervalued -> BUY
          else if (edgePct < -15) {
              results.push({
                  contract: call,
                  type: 'call',
                  marketPrice,
                  hestonPrice,
                  edge: edgePct,
                  score: Math.abs(diff) * Math.abs(edgePct),
                  recommendation: 'BUY'
              });
          }
      });

      // Process Puts
      chain.puts.forEach(put => {
          if (put.lastPrice < 0.05) return;

          const iv = put.impliedVolatility / 100;
          const v0 = iv * iv;
          
          const hestonPrice = calculateHestonPrice(
              'put',
              chain.currentPrice,
              put.strike,
              dteYears,
              riskFreeRate,
              v0, v0, 1.5, 0.5, -0.5
          );

          const marketPrice = (put.bid + put.ask) / 2 || put.lastPrice;
          const diff = marketPrice - hestonPrice;
          const edgePct = (diff / marketPrice) * 100;

          if (edgePct > 15) {
              results.push({
                  contract: put,
                  type: 'put',
                  marketPrice,
                  hestonPrice,
                  edge: edgePct,
                  score: Math.abs(diff) * Math.abs(edgePct),
                  recommendation: 'SELL'
              });
          } else if (edgePct < -15) {
              results.push({
                  contract: put,
                  type: 'put',
                  marketPrice,
                  hestonPrice,
                  edge: edgePct,
                  score: Math.abs(diff) * Math.abs(edgePct),
                  recommendation: 'BUY'
              });
          }
      });

      // Sort by Opportunity Score (Highest Edge)
      results.sort((a, b) => b.score - a.score);
      setScannerResults(results.slice(0, 12)); // Top 12
      setScanning(false);
  };

  const generateQuantMemo = async (res: MispricingResult) => {
      setGeneratingMemo(true);
      setQuantMemo(null);
      
      try {
          const session = createChatSession();
          const prompt = `
            You are a Senior Quantitative Analyst at a High Frequency Trading desk.
            
            Analyze this specific option mispricing found by our Heston Model Scanner:
            Ticker: ${chain?.symbol}
            Strike: ${res.contract.strike} ${res.type.toUpperCase()}
            Market Price: $${res.marketPrice.toFixed(2)} (IV: ${res.contract.impliedVolatility}%)
            Heston Fair Value: $${res.hestonPrice.toFixed(2)}
            Detected Edge: ${res.edge.toFixed(1)}% (${res.edge > 0 ? 'Overvalued' : 'Undervalued'})
            
            Write a short "Quant Memo" (max 3 sentences) explaining WHY the market might be mispricing this relative to the model. 
            Consider: Earnings events, Skew, Liquidity premiums, or Model error.
            Conclude with a confidence rating (Low/Med/High).
          `;
          
          const response = await session.sendMessage(prompt);
          setQuantMemo({
              id: `${res.contract.strike}-${res.type}`,
              text: response.text
          });
      } catch (e) {
          console.error(e);
          setQuantMemo({
              id: `${res.contract.strike}-${res.type}`,
              text: t(language, 'chain.noKeyMemo')
          });
      } finally {
          setGeneratingMemo(false);
      }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if(ticker.trim()) loadChain(ticker);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      if (chain) {
          loadChain(chain.symbol, e.target.value);
      }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in w-full relative">
      <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'chain.title')} subtitle={t(language, 'chain.subtitle')} />
      {error && <NuxNotice tone="danger">{error}</NuxNotice>}
      
      {quantMemo && (
          <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-slate-900 border border-blue-500/50 rounded-2xl p-6 max-w-lg shadow-2xl relative">
                  <button 
                    onClick={() => setQuantMemo(null)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white"
                  >
                      <X className="w-5 h-5" />
                  </button>
                  <div className="flex items-center gap-2 mb-4 text-blue-400 font-bold uppercase tracking-wider text-sm">
                      <BrainCircuit className="w-5 h-5" /> GenAI Quant Memo
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                      {quantMemo.text}
                  </p>
                  <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                      <button 
                        onClick={() => setQuantMemo(null)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold"
                      >
                          Acknowledge
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Controls Header */}
      <div className="mb-6 flex flex-col md:flex-row gap-4 justify-between items-end md:items-center">
         <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
               <Layers className="w-6 h-6 text-blue-400" />
               {t(language, 'chain.title')}
            </h2>
            <p className="text-slate-400 text-sm">{t(language, 'chain.subtitle')}</p>
         </div>

         <div className="flex gap-3 items-center">
             
             {/* View Toggle */}
             <div className="flex bg-slate-900 p-1 rounded-lg border border-white/10 mr-2">
                 <button 
                    onClick={() => setViewMode('table')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'table' ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                    title="Table View"
                 >
                     <List className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('visual')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'visual' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                    title={t(language, 'chain.visualView')}
                 >
                     <BarChart3 className="w-4 h-4" />
                 </button>
                 <button 
                    onClick={() => setViewMode('scanner')}
                    className={`p-2 rounded-md transition-all ${viewMode === 'scanner' ? 'bg-rose-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                    title="Heston Mispricing Scanner"
                 >
                     <Radar className="w-4 h-4" />
                 </button>
             </div>

             <form onSubmit={handleSearch} className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-400" />
                <input 
                  type="text" 
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value.toUpperCase())}
                  placeholder={t(language, 'chain.tickerPlaceholder')}
                  className="bg-slate-900 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 w-32 font-mono font-bold tracking-wide"
                />
             </form>

             {chain && (
                 <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                        <Calendar className="w-4 h-4 text-slate-500" />
                    </div>
                    <select 
                        value={chain.selectedExpiration}
                        onChange={handleDateChange}
                        className="bg-slate-900 border border-white/10 rounded-xl pl-10 pr-8 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none font-mono cursor-pointer transition-colors hover:border-blue-500/30"
                    >
                        {chain.expirations.map(date => (
                            <option key={date} value={date}>{date}</option>
                        ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                 </div>
             )}
         </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md flex flex-col shadow-2xl relative">
         
         {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm z-30">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
         )}

         {viewMode === 'table' ? (
             <>
                {/* Chain Header */}
                <div className="grid grid-cols-11 bg-slate-950 border-b border-white/10 text-[10px] uppercase font-bold text-slate-500 tracking-wider py-3">
                    <div className="col-span-5 grid grid-cols-5 px-2 text-right">
                        <div className="hidden sm:block text-indigo-400">Theo</div>
                        <div className="sm:hidden">-</div>
                        
                        <div className="hidden md:block">Vol</div>
                        <div className="md:hidden">-</div>

                        <div>IV</div>
                        <div>Bid</div>
                        <div>Ask</div>
                    </div>
                    <div className="col-span-1 text-center text-white">Strike</div>
                    <div className="col-span-5 grid grid-cols-5 px-2 text-left">
                        <div>Bid</div>
                        <div>Ask</div>
                        <div>IV</div>

                        <div className="hidden md:block">Vol</div>
                        <div className="md:hidden">-</div>

                        <div className="hidden sm:block text-indigo-400">Theo</div>
                        <div className="sm:hidden">-</div>
                    </div>
                </div>

                {/* Chain Body */}
                <div className="overflow-y-auto scrollbar-hide flex-1 relative">
                    {chain ? (
                        <>
                        {/* Current Price Indicator Line */}
                        <div className="sticky top-0 z-10 bg-indigo-600/20 backdrop-blur-sm border-y border-indigo-500/30 py-1 flex justify-center items-center gap-2">
                            <span className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Underlying Price</span>
                            <span className="text-white font-mono font-bold">${chain.currentPrice.toFixed(2)}</span>
                        </div>

                        {chain.calls.map((call, idx) => (
                            <ContractRow 
                                key={call.strike} 
                                call={call} 
                                put={chain.puts[idx]} 
                                strike={call.strike} 
                                onSelect={(c) => onSelectContract && onSelectContract(chain.symbol, chain.selectedExpiration, c, chain.currentPrice)}
                            />
                        ))}
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-500">
                            <p>{t(language, 'chain.emptyBody')}</p>
                        </div>
                    )}
                </div>
             </>
         ) : viewMode === 'visual' ? (
             <div className="flex-1 relative flex flex-col">
                 {chain ? (
                     <OptionsChainVisualizer 
                        chain={chain} 
                        onSelectContract={(c) => onSelectContract && onSelectContract(chain.symbol, chain.selectedExpiration, c, chain.currentPrice)}
                     />
                 ) : (
                     <div className="flex items-center justify-center h-full text-slate-500">
                         {t(language, 'chain.emptyTitle')}
                     </div>
                 )}
             </div>
         ) : (
             // --- SCANNER VIEW ---
             <div className="flex-1 relative flex flex-col bg-slate-900/20 p-6 overflow-y-auto">
                 {scanning ? (
                     <div className="flex flex-col items-center justify-center h-full space-y-4">
                         <div className="relative">
                             <div className="w-16 h-16 border-4 border-rose-500/30 border-t-rose-500 rounded-full animate-spin"></div>
                             <div className="absolute inset-0 flex items-center justify-center">
                                 <Radar className="w-6 h-6 text-rose-500 animate-pulse" />
                             </div>
                         </div>
                         <p className="text-rose-400 font-bold animate-pulse uppercase tracking-widest text-xs">Running Heston Model Calibration...</p>
                     </div>
                 ) : scannerResults.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {scannerResults.map((res, idx) => (
                             <div key={idx} className="bg-slate-900/80 border border-white/10 rounded-xl p-4 hover:border-indigo-500/50 transition-all group relative overflow-hidden">
                                 {/* Highlight Bar */}
                                 <div className={`absolute top-0 left-0 w-1 h-full ${res.recommendation === 'BUY' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                                 
                                 <div className="pl-3">
                                     <div className="flex justify-between items-start mb-3">
                                         <div>
                                             <div className="flex items-center gap-2">
                                                 <span className={`text-xs font-bold px-1.5 py-0.5 rounded uppercase ${res.type === 'call' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                     {res.type}
                                                 </span>
                                                 <span className="text-white font-mono font-bold text-lg">${res.contract.strike}</span>
                                             </div>
                                             <div className="text-[10px] text-slate-500 mt-1">IV: {res.contract.impliedVolatility}%</div>
                                         </div>
                                         <div className={`text-xs font-bold px-2 py-1 rounded border uppercase flex items-center gap-1 ${
                                             res.recommendation === 'BUY' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                                         }`}>
                                             {res.recommendation === 'BUY' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                             {res.recommendation}
                                         </div>
                                     </div>

                                     <div className="grid grid-cols-2 gap-2 mb-4 bg-black/40 rounded-lg p-2 border border-white/5">
                                         <div>
                                             <div className="text-[9px] text-slate-500 uppercase font-bold">Market Price</div>
                                             <div className="text-white font-mono">${res.marketPrice.toFixed(2)}</div>
                                         </div>
                                         <div className="text-right">
                                             <div className="text-[9px] text-indigo-400 uppercase font-bold">Heston Value</div>
                                             <div className="text-indigo-300 font-mono">${res.hestonPrice.toFixed(2)}</div>
                                         </div>
                                     </div>

                                     <div className="flex items-center justify-between gap-2">
                                         <button 
                                            onClick={() => generateQuantMemo(res)}
                                            disabled={generatingMemo}
                                            className="flex-1 flex items-center justify-center gap-1 text-[10px] bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 px-3 py-1.5 rounded-lg text-blue-300 transition-colors"
                                         >
                                             {generatingMemo ? <RefreshCw className="w-3 h-3 animate-spin"/> : <BrainCircuit className="w-3 h-3" />}
                                             {t(language, 'chain.quantMemo')}
                                         </button>
                                         <button 
                                            onClick={() => onSelectContract && onSelectContract(chain!.symbol, chain!.selectedExpiration, res.contract, chain!.currentPrice)}
                                            className="flex items-center justify-center gap-1 text-[10px] bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 rounded-lg text-white transition-colors"
                                         >
                                             {t(language, 'chain.trade')} <ArrowRight className="w-3 h-3" />
                                         </button>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 ) : (
                     <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
                         <div className="p-4 bg-slate-900 rounded-full border border-white/5">
                             <Radar className="w-8 h-8 text-slate-600" />
                         </div>
                         <p>{t(language, 'chain.emptyTitle')}</p>
                         <button onClick={runScanner} className="text-blue-400 hover:text-white text-xs font-bold uppercase tracking-wide flex items-center gap-2">
                             <RefreshCw className="w-3 h-3" /> {t(language, 'chain.forceRescan')}
                         </button>
                     </div>
                 )}
                 
                 <div className="mt-6 p-4 bg-slate-950/50 border border-white/10 rounded-xl text-xs text-slate-400 flex items-start gap-3">
                     <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                     <p>
                         <strong>Heston-Merton Analysis:</strong> This scanner compares current market mid-prices against a theoretical value derived from the Heston Stochastic Volatility Model. 
                         Differences &gt;15% are flagged as potential arbitrage opportunities (Mispricings). 
                         <span className="block mt-1 text-slate-500 italic">Parameters: Mean Reversion (κ)=1.5, Vol-of-Vol (ξ)=0.5, Corr (ρ)=-0.5.</span>
                     </p>
                 </div>
             </div>
         )}

         {/* Chain Footer Info */}
         {chain && (
             <div className="bg-slate-950/80 border-t border-white/5 p-3 flex justify-between items-center text-[10px] text-slate-500 flex-none z-20">
                 <div className="flex items-center gap-2">
                     <Calculator className="w-3 h-3" />
                     Data Model: Black-Scholes (r=5%)
                 </div>
                 <div className="flex gap-4">
                     <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Calls ITM</span>
                     <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-rose-500"></div> Puts ITM</span>
                 </div>
             </div>
         )}
      </div>
      <RiskDisclaimer language={language} />
    </div>
  );
};

export default OptionsChainView;
