
import React, { useState } from 'react';
import { History, PlayCircle, Activity, TrendingUp, AlertTriangle, RefreshCw, ScrollText, ArrowUpRight, ArrowDownRight, Database, Eye, Globe, Layers } from 'lucide-react';
import { runStrategyBacktest } from '../services/marketDataService';
import { BacktestResult, OptionContract } from '../types';
import OptionsChainView from './OptionsChainView';
import Backtest3DVisualizer from './Backtest3DVisualizer';
import { Language, t } from '../i18n';
import { NuxPageHeader, RiskDisclaimer } from './NuxPage';

const BacktestView: React.FC<{ language: Language }> = ({ language }) => {
  const [ticker, setTicker] = useState('SPY');
  const [strategy, setStrategy] = useState<'Covered Call' | 'Long Call' | 'Short Put'>('Covered Call');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestResult | null>(null);
  const [activeTab, setActiveTab] = useState<'visual' | 'logs'>('visual');
  
  // Custom Strategy Config
  const [showChainModal, setShowChainModal] = useState(false);
  const [customContract, setCustomContract] = useState<{
      contract: OptionContract, 
      dte: number, 
      moneyness: number,
      expiration: string 
  } | null>(null);

  const handleContractSelect = (ticker: string, expiration: string, contract: OptionContract, currentPrice: number) => {
      // Calculate implied Moneyness and DTE from the selected contract
      const moneyness = contract.strike / currentPrice;
      
      const now = new Date();
      const expDate = new Date(expiration);
      const diffTime = Math.abs(expDate.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      setCustomContract({
          contract,
          dte: diffDays,
          moneyness: parseFloat(moneyness.toFixed(3)),
          expiration
      });
      setShowChainModal(false);
  };

  const handleRun = async () => {
      setLoading(true);
      try {
          const config = customContract ? { dte: customContract.dte, moneyness: customContract.moneyness } : undefined;
          const data = await runStrategyBacktest(ticker, strategy, config);
          setResult(data);
          setActiveTab('visual'); 
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  const clearCustom = () => {
      setCustomContract(null);
  };

  return (
    <div className="animate-fade-in w-full pb-10 relative">
       <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'backtest.title')} subtitle={t(language, 'backtest.subtitle')} />
       
       {showChainModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
                <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl h-full max-h-[800px] overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="text-white font-bold">{t(language, 'backtest.selectContract')}</h3>
                        <button onClick={() => setShowChainModal(false)} className="text-slate-400 hover:text-white">{t(language, 'backtest.closeModal')}</button>
                    </div>
                    <div className="flex-grow overflow-hidden p-4">
                        <OptionsChainView 
                            language={language}
                            initialTicker={ticker}
                            onSelectContract={handleContractSelect} 
                        />
                    </div>
                </div>
            </div>
       )}

       {/* Header Controls */}
       <div className="mb-8">
           <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <History className="w-6 h-6 text-indigo-400" />
                    {t(language, 'backtest.title')}
                </h2>
                <div className="flex items-center gap-2 bg-slate-900 px-3 py-1 rounded-full border border-white/5">
                    <Globe className="w-3 h-3 text-emerald-400" />
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">{t(language, 'backtest.dataSource')}: Yahoo Finance</span>
                </div>
           </div>

           <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex flex-col gap-6">
               <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wide">{t(language, 'backtest.ticker')}</label>
                        <input 
                            type="text" 
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono focus:border-indigo-500/50 outline-none"
                        />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-xs text-slate-400 mb-1.5 font-bold uppercase tracking-wide">{t(language, 'backtest.strategy')}</label>
                        <select 
                            value={strategy}
                            onChange={(e: any) => setStrategy(e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-white focus:border-blue-500/50 outline-none appearance-none cursor-pointer"
                        >
                            <option value="Covered Call">Covered Call (Passive Income)</option>
                            <option value="Long Call">Long Call (Bullish Speculation)</option>
                            <option value="Short Put">Short Put (Wheel Strategy)</option>
                        </select>
                    </div>
                    <button 
                        onClick={handleRun}
                        disabled={loading}
                        className="w-full md:w-auto px-8 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                        {t(language, 'backtest.runBacktest')}
                    </button>
               </div>
               
               {/* Advanced Contract Config */}
               <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-3">
                        <label className="text-xs text-slate-500 font-bold uppercase tracking-wide flex items-center gap-2">
                             Parameter Lab
                             <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1.5 py-0.5 rounded">Optional</span>
                        </label>
                    </div>
                    
                    {!customContract ? (
                        <div className="flex gap-4">
                             <button 
                                onClick={() => setShowChainModal(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-slate-950 hover:bg-slate-800 border border-white/10 border-dashed rounded-lg text-xs font-medium text-slate-400 transition-colors"
                             >
                                <Database className="w-3.5 h-3.5" />
                                Select Reference Contract from Chain
                             </button>
                             <div className="flex items-center gap-2 text-xs text-slate-500 italic">
                                Uses default parameters (30 DTE, ATM) if unchecked.
                             </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-4 bg-indigo-500/10 border border-indigo-500/20 p-3 rounded-xl animate-fade-in">
                            <div className="flex items-center gap-3">
                                <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${customContract.contract.type === 'call' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                                    {customContract.contract.type}
                                </span>
                                <span className="text-sm font-mono font-bold text-white">
                                    {customContract.contract.strike} Strike
                                </span>
                                <span className="text-xs text-slate-400">
                                    {customContract.dte} DTE
                                </span>
                                <span className="text-xs text-slate-400">
                                    {customContract.expiration}
                                </span>
                            </div>
                            <div className="h-4 w-px bg-white/10"></div>
                            <div className="text-xs text-indigo-300">
                                Simulation will use <strong>{(customContract.moneyness * 100).toFixed(1)}% Moneyness</strong> and <strong>{customContract.dte} Days</strong> duration.
                            </div>
                            <button onClick={clearCustom} className="ml-auto text-xs text-slate-500 hover:text-rose-400">Remove</button>
                        </div>
                    )}
               </div>
           </div>
       </div>

       {result && (
           <div className="space-y-6 animate-fade-in-up">
               {/* Metrics Cards */}
               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                   <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                       <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Total Return</div>
                       <div className={`text-2xl font-mono font-bold ${result.totalReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                           {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn.toFixed(2)}%
                       </div>
                   </div>
                   <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                       <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Win Rate</div>
                       <div className="text-2xl font-mono font-bold text-white">
                           {result.winRate.toFixed(1)}%
                       </div>
                   </div>
                   <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                       <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Max Drawdown</div>
                       <div className="text-2xl font-mono font-bold text-rose-400">
                           -{result.maxDrawdown.toFixed(2)}%
                       </div>
                   </div>
                   <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                       <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Trade Count</div>
                       <div className="text-2xl font-mono font-bold text-white">
                           {result.tradeCount}
                       </div>
                   </div>
               </div>

               {/* Tabs */}
               <div className="flex gap-4 border-b border-white/5">
                    <button 
                        onClick={() => setActiveTab('visual')}
                        className={`pb-2 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'visual' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                    >
                        3D Simulation
                    </button>
                    <button 
                        onClick={() => setActiveTab('logs')}
                        className={`pb-2 text-sm font-bold uppercase tracking-wide transition-colors border-b-2 ${activeTab === 'logs' ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-white'}`}
                    >
                        Trade Ledger
                    </button>
               </div>

               {activeTab === 'visual' ? (
                   <div className="animate-fade-in">
                       <Backtest3DVisualizer data={result} />
                       
                       <div className="mt-4 flex gap-3 text-xs text-slate-500 bg-indigo-500/5 border border-indigo-500/10 p-3 rounded-lg">
                           <AlertTriangle className="w-4 h-4 text-indigo-400 flex-shrink-0" />
                           <p>
                               <strong>Interactive 3D View:</strong> Drag to rotate the camera. The glowing head represents the current date in the simulation. 
                               <span className="text-emerald-400 font-bold"> Green Arcs</span> denote profitable trades, while <span className="text-rose-400 font-bold">Red Arcs</span> denote losses.
                           </p>
                       </div>
                   </div>
               ) : (
                   <div className="bg-slate-900/40 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm animate-fade-in">
                       <div className="p-4 border-b border-white/5 flex items-center justify-between">
                           <h3 className="text-sm font-bold text-white flex items-center gap-2">
                               <ScrollText className="w-4 h-4 text-emerald-400" />
                               Execution Log
                           </h3>
                       </div>
                       <div className="overflow-x-auto max-h-[500px]">
                           <table className="w-full text-left border-collapse">
                               <thead className="sticky top-0 bg-slate-950 z-10 shadow-lg">
                                   <tr className="text-[10px] uppercase font-bold text-slate-500 border-b border-white/5">
                                       <th className="p-3 pl-6">Entry Date</th>
                                       <th className="p-3">Action</th>
                                       <th className="p-3">Stock Price</th>
                                       <th className="p-3">Strike</th>
                                       <th className="p-3">Entry Premium</th>
                                       <th className="p-3">Exit Date</th>
                                       <th className="p-3">Exit Value</th>
                                       <th className="p-3 text-right pr-6">P/L</th>
                                   </tr>
                               </thead>
                               <tbody className="divide-y divide-white/5 text-xs text-slate-300">
                                   {result.trades.map((trade) => (
                                       <tr key={trade.id} className="hover:bg-white/5 transition-colors">
                                           <td className="p-3 pl-6 font-mono">{trade.entryDate}</td>
                                           <td className="p-3">
                                               <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                   trade.action === 'buy' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                                               }`}>
                                                   {trade.action === 'buy' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                                   {trade.action} {trade.type}
                                               </span>
                                           </td>
                                           <td className="p-3 font-mono text-amber-400 font-medium">${trade.stockPrice.toFixed(2)}</td>
                                           <td className="p-3 font-mono font-bold text-white">${trade.strike}</td>
                                           <td className="p-3 font-mono">${trade.entryPrice.toFixed(2)}</td>
                                           <td className="p-3 font-mono text-slate-400">{trade.exitDate}</td>
                                           <td className="p-3 font-mono text-slate-400">${trade.exitPrice.toFixed(2)}</td>
                                           <td className={`p-3 text-right pr-6 font-mono font-bold ${trade.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                               {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                           </td>
                                       </tr>
                                   ))}
                               </tbody>
                           </table>
                       </div>
                   </div>
               )}
           </div>
       )}
       <RiskDisclaimer language={language} />
    </div>
  );
};

export default BacktestView;
