
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, RefreshCw, Zap, TrendingUp, AlertTriangle, Crosshair, DollarSign, Activity, Layers } from 'lucide-react';
import { OptionLeg, StrategyRecommendation, Greeks, OptionContract } from '../types';
import PayoffChart from './PayoffChart';
import { calculateBlackScholes, calculateGreeks } from '../services/marketDataService';
import OptionsChainView from './OptionsChainView';

const MiniGreekDisplay = ({ label, value, type }: { label: string, value: number, type: 'delta' | 'theta' | 'vega' }) => {
    let colorClass = 'bg-slate-500';
    if (type === 'delta') colorClass = value > 0 ? 'bg-emerald-500' : 'bg-rose-500';
    if (type === 'theta') colorClass = 'bg-amber-500';
    if (type === 'vega') colorClass = 'bg-cyan-500';

    // Normalize for visualization (clamped visual range)
    // Delta: -1 to 1
    // Theta: -0.2 to 0.2 (approx daily range for common prices)
    // Vega: -0.2 to 0.2
    let maxRange = 1;
    if (type === 'theta') maxRange = 0.5;
    if (type === 'vega') maxRange = 0.5;

    const percentage = Math.min(Math.abs(value) / maxRange, 1) * 50; // Max 50% width from center

    return (
        <div className="flex flex-col gap-1">
            <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-500">
                <span>{label}</span>
                <span className={value > 0 ? 'text-emerald-400' : value < 0 ? 'text-rose-400' : 'text-slate-400'}>
                    {value > 0 ? '+' : ''}{value.toFixed(type === 'delta' ? 2 : 3)}
                </span>
            </div>
            {/* Center-Zero Bar Chart */}
            <div className="w-full h-1.5 bg-slate-800 rounded-full relative overflow-hidden flex items-center justify-center">
                {/* Center Marker */}
                <div className="w-px h-full bg-white/20 absolute z-10"></div>
                
                {/* The Bar */}
                <div 
                    className={`h-full absolute rounded-full ${colorClass} opacity-80`}
                    style={{
                        width: `${percentage}%`,
                        left: value >= 0 ? '50%' : 'auto',
                        right: value < 0 ? '50%' : 'auto',
                    }}
                ></div>
            </div>
        </div>
    );
};

const StrategyBuilder: React.FC = () => {
  const [stockPrice, setStockPrice] = useState(100);
  const [iv, setIv] = useState(0.35); // 35%
  const [dte, setDte] = useState(30);
  
  const [legs, setLegs] = useState<OptionLeg[]>([
    { type: 'call', action: 'buy', strike: 100, premium: 0, expiration: '30d' }
  ]);
  const [showChainModal, setShowChainModal] = useState(false);

  const [metrics, setMetrics] = useState({
      maxProfit: '0',
      maxLoss: '0',
      breakevens: [] as number[],
      netGreeks: { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 } as Greeks
  });

  // 1. Recalculate Premiums & Greeks on any change
  useEffect(() => {
    let totalDelta = 0;
    let totalGamma = 0;
    let totalTheta = 0;
    let totalVega = 0;

    const updatedLegs = legs.map(leg => {
        // Calculate Premium
        const premium = calculateBlackScholes(
            leg.type, 
            stockPrice, 
            leg.strike, 
            30/365, // Assume standard entry for pricing basis
            0.05, 
            iv
        );

        // Calculate Greeks (using dynamic DTE)
        const g = calculateGreeks(
            leg.type,
            stockPrice,
            leg.strike,
            dte/365,
            0.05,
            iv
        );

        const direction = leg.action === 'buy' ? 1 : -1;
        totalDelta += g.delta * direction;
        totalGamma += g.gamma * direction;
        totalTheta += g.theta * direction;
        totalVega += g.vega * direction;

        return { ...leg, premium: parseFloat(premium.toFixed(2)) };
    });

    setMetrics(prev => ({
        ...prev,
        netGreeks: {
            delta: totalDelta,
            gamma: totalGamma,
            theta: totalTheta,
            vega: totalVega,
            rho: 0
        }
    }));

  }, [stockPrice, iv, dte, legs.map(l => `${l.strike}-${l.action}-${l.type}`).join('|')]);


  // 2. Analyze Payoff for Max Profit/Loss/Breakeven
  useEffect(() => {
     // Generate points similar to PayoffChart to scan for min/max
     const minRange = stockPrice * 0.5;
     const maxRange = stockPrice * 1.5;
     const steps = 100;
     const stepSize = (maxRange - minRange) / steps;
     
     let minPnL = Infinity;
     let maxPnL = -Infinity;
     const pnls: { price: number, val: number }[] = [];

     for(let i=0; i<=steps; i++) {
         const priceAtExpiry = minRange + (i * stepSize);
         let totalProfit = 0;
         
         legs.forEach(leg => {
             // Re-calculate static premium for the leg based on current settings (simplified)
             // Note: In a real strategy builder, entry premium is fixed when you open the trade.
             // Here, we simulate "If I open this trade NOW with these params, what is the profile?"
             // So we use the calculated premium as the cost basis.
             const entryPremium = calculateBlackScholes(leg.type, stockPrice, leg.strike, dte/365, 0.05, iv);
             
             const intrinsic = leg.type === 'call' 
                ? Math.max(0, priceAtExpiry - leg.strike)
                : Math.max(0, leg.strike - priceAtExpiry);
             
             if (leg.action === 'buy') totalProfit += (intrinsic - entryPremium);
             else totalProfit += (entryPremium - intrinsic);
         });

         totalProfit = totalProfit * 100; // Convert to dollar value per contract
         pnls.push({ price: priceAtExpiry, val: totalProfit });

         if (totalProfit < minPnL) minPnL = totalProfit;
         if (totalProfit > maxPnL) maxPnL = totalProfit;
     }

     // Detect "Unlimited" by checking slopes at edges
     const leftSlope = pnls[1].val - pnls[0].val;
     const rightSlope = pnls[pnls.length-1].val - pnls[pnls.length-2].val;

     let displayMax = `$${maxPnL.toFixed(0)}`;
     let displayMin = `$${minPnL.toFixed(0)}`;

     if (rightSlope > 1 || leftSlope > 1) displayMax = 'Unlimited';
     if (rightSlope < -1 || leftSlope < -1) displayMin = 'Unlimited'; // Loss

     // Find Breakevens (Sign changes)
     const bes: number[] = [];
     for(let i=1; i<pnls.length; i++) {
         if ((pnls[i].val > 0 && pnls[i-1].val < 0) || (pnls[i].val < 0 && pnls[i-1].val > 0)) {
             bes.push(Math.round(pnls[i].price));
         }
     }

     setMetrics(prev => ({
         ...prev,
         maxProfit: displayMax,
         maxLoss: displayMin.includes('Unlimited') ? 'Unlimited' : displayMin.replace('-',''), // Display as positive number for "Max Loss" text
         breakevens: bes
     }));

  }, [stockPrice, iv, dte, legs]);


  // Handlers
  const addLeg = () => {
      setLegs([...legs, { type: 'call', action: 'buy', strike: stockPrice, premium: 0, expiration: '30d' }]);
  };

  const removeLeg = (idx: number) => {
      const newLegs = [...legs];
      newLegs.splice(idx, 1);
      setLegs(newLegs);
  };

  const updateLeg = (idx: number, field: keyof OptionLeg, value: any) => {
      const newLegs = [...legs];
      newLegs[idx] = { ...newLegs[idx], [field]: value };
      setLegs(newLegs);
  };
  
  const handleImportChain = (ticker: string, expiration: string, contract: OptionContract, currentPrice: number) => {
      // Sync Simulator Environment to the Real Data
      setStockPrice(currentPrice);
      setIv(contract.impliedVolatility / 100);
      
      // Calculate Days to Expiry
      const now = new Date();
      const expDate = new Date(expiration);
      const diffTime = Math.abs(expDate.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      setDte(diffDays > 0 ? diffDays : 1);

      // Add the new leg
      setLegs([...legs, {
          type: contract.type,
          action: 'buy', // default to buy
          strike: contract.strike,
          premium: contract.lastPrice, // This will be recalculated by the effect anyway
          expiration: expiration
      }]);
      setShowChainModal(false);
  };

  // Construct object for Chart
  const strategyForChart: StrategyRecommendation = {
      name: "Custom Strategy",
      ticker: "LAB",
      currentPrice: stockPrice,
      thesis: "Neutral",
      explanation: "",
      legs: legs.map(l => ({
          ...l,
          premium: parseFloat(calculateBlackScholes(l.type, stockPrice, l.strike, dte/365, 0.05, iv).toFixed(2))
      })),
      maxProfit: 0,
      maxLoss: 0,
      breakEven: [],
      pop: 50,
      riskScore: 5,
      complexity: 'High'
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full animate-fade-in relative">
        
        {showChainModal && (
            <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
                <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl h-full max-h-[800px] overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="text-white font-bold">Select Contract to Add</h3>
                        <button onClick={() => setShowChainModal(false)} className="text-slate-400 hover:text-white">Close</button>
                    </div>
                    <div className="flex-grow overflow-hidden p-4">
                        <OptionsChainView 
                            initialTicker="SPY"
                            onSelectContract={handleImportChain} 
                        />
                    </div>
                </div>
            </div>
        )}

        {/* Left Panel: Chart & Metrics */}
        <div className="flex-1 flex flex-col gap-6">
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl flex-grow flex flex-col min-h-[400px]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Activity className="w-5 h-5 text-indigo-400" />
                        Payoff Analyzer
                    </h3>
                    <div className="flex gap-4 text-xs">
                        <div className="flex flex-col items-end">
                            <span className="text-emerald-400 font-bold">{metrics.maxProfit}</span>
                            <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Max Profit</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className="text-rose-400 font-bold">{metrics.maxLoss}</span>
                            <span className="text-slate-500 uppercase font-bold tracking-wider text-[10px]">Max Loss</span>
                        </div>
                    </div>
                </div>
                
                <div className="flex-grow w-full relative">
                    <PayoffChart strategy={strategyForChart} daysToExpiry={dte} volatility={iv} />
                </div>

                {/* Greeks Dashboard */}
                <div className="grid grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/5">
                     {[
                         { label: 'Net Delta', val: metrics.netGreeks.delta, fmt: (n: number) => n.toFixed(2) },
                         { label: 'Net Gamma', val: metrics.netGreeks.gamma, fmt: (n: number) => n.toFixed(3) },
                         { label: 'Net Theta', val: metrics.netGreeks.theta, fmt: (n: number) => n.toFixed(2) },
                         { label: 'Net Vega', val: metrics.netGreeks.vega, fmt: (n: number) => n.toFixed(2) },
                     ].map((g) => (
                         <div key={g.label} className="bg-slate-950/50 p-3 rounded-xl border border-white/5 text-center">
                             <div className="text-[10px] text-slate-500 uppercase font-bold mb-1">{g.label}</div>
                             <div className={`text-sm font-mono font-bold ${g.val > 0 ? 'text-emerald-400' : g.val < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                 {g.val > 0 ? '+' : ''}{g.fmt(g.val)}
                             </div>
                         </div>
                     ))}
                </div>
            </div>
        </div>

        {/* Right Panel: Controls */}
        <div className="w-full lg:w-[400px] flex flex-col gap-6">
            
            {/* Global Params */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Crosshair className="w-4 h-4" /> Market Conditions
                </h4>
                <div className="space-y-4">
                    <div>
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-slate-400">Stock Price</span>
                            <span className="text-white font-mono">${stockPrice}</span>
                        </div>
                        <input 
                            type="range" 
                            min={Math.floor(stockPrice * 0.5)} 
                            max={Math.ceil(stockPrice * 1.5)} 
                            step="1" 
                            value={stockPrice} 
                            onChange={e => setStockPrice(Number(e.target.value))} 
                            className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" 
                        />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-slate-400">Implied Volatility</span>
                            <span className="text-cyan-400 font-mono">{(iv*100).toFixed(0)}%</span>
                        </div>
                        <input type="range" min="0.1" max="1.5" step="0.05" value={iv} onChange={e => setIv(Number(e.target.value))} className="w-full accent-cyan-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                    </div>
                    <div>
                        <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-slate-400">Days to Expiration</span>
                            <span className="text-amber-400 font-mono">{dte} Days</span>
                        </div>
                        <input type="range" min="1" max="120" step="1" value={dte} onChange={e => setDte(Number(e.target.value))} className="w-full accent-amber-500 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                    </div>
                </div>
            </div>

            {/* Leg Manager */}
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 backdrop-blur-md flex-grow overflow-hidden flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4" /> Strategy Legs
                    </h4>
                    <button onClick={() => setLegs([])} className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-rose-400 transition-colors" title="Clear All">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>

                <div className="space-y-3 overflow-y-auto pr-2 flex-grow scrollbar-hide">
                    {legs.map((leg, idx) => {
                        // Calculate Greeks per leg for visualization
                        const legGreeks = calculateGreeks(leg.type, stockPrice, leg.strike, dte/365, 0.05, iv);
                        const mult = leg.action === 'buy' ? 1 : -1;
                        const lDelta = legGreeks.delta * mult;
                        const lTheta = legGreeks.theta * mult;
                        const lVega = legGreeks.vega * mult;

                        return (
                        <div key={idx} className="bg-slate-950 p-3 rounded-xl border border-white/5 relative group hover:border-indigo-500/30 transition-colors">
                            <div className="flex gap-2 mb-3">
                                <div className="flex bg-slate-900 rounded-lg p-0.5 border border-white/10">
                                    <button 
                                        onClick={() => updateLeg(idx, 'action', 'buy')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-colors ${leg.action === 'buy' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >Buy</button>
                                    <button 
                                        onClick={() => updateLeg(idx, 'action', 'sell')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-colors ${leg.action === 'sell' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >Sell</button>
                                </div>
                                <div className="flex bg-slate-900 rounded-lg p-0.5 border border-white/10">
                                    <button 
                                        onClick={() => updateLeg(idx, 'type', 'call')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-colors ${leg.type === 'call' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >Call</button>
                                    <button 
                                        onClick={() => updateLeg(idx, 'type', 'put')}
                                        className={`px-3 py-1 rounded-md text-[10px] font-bold uppercase transition-colors ${leg.type === 'put' ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/20' : 'text-slate-500 hover:text-slate-300'}`}
                                    >Put</button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex-1">
                                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Strike Price</label>
                                    <input 
                                        type="number" 
                                        value={leg.strike}
                                        onChange={(e) => updateLeg(idx, 'strike', Number(e.target.value))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:border-indigo-500/50 outline-none"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Est. Premium</label>
                                    <div className="w-full bg-slate-900/50 border border-white/5 rounded-lg px-2 py-1.5 text-xs text-slate-400 font-mono">
                                        ${calculateBlackScholes(leg.type, stockPrice, leg.strike, dte/365, 0.05, iv).toFixed(2)}
                                    </div>
                                </div>
                            </div>

                            {/* Mini Greek Charts */}
                            <div className="grid grid-cols-3 gap-3 border-t border-white/5 pt-2">
                                <MiniGreekDisplay label="Δ Delta" value={lDelta} type="delta" />
                                <MiniGreekDisplay label="Θ Theta" value={lTheta} type="theta" />
                                <MiniGreekDisplay label="ν Vega" value={lVega} type="vega" />
                            </div>

                            <button 
                                onClick={() => removeLeg(idx)}
                                className="absolute top-2 right-2 p-1.5 text-slate-600 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        );
                    })}
                    
                    <button 
                        onClick={() => setShowChainModal(true)}
                        className="w-full py-3 rounded-xl border border-white/10 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide mb-2"
                    >
                        <Layers className="w-4 h-4" /> Select from Chain
                    </button>
                    
                    <button 
                        onClick={addLeg}
                        className="w-full py-3 rounded-xl border-2 border-dashed border-white/10 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide"
                    >
                        <Plus className="w-4 h-4" /> Add Manual Leg
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
};

export default StrategyBuilder;
