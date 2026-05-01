
import React, { useState, useEffect } from 'react';
import { StrategyRecommendation, OptionLeg, Greeks } from '../types';
import PayoffChart from './PayoffChart';
import { calculateBlackScholes, calculateGreeks } from '../services/marketDataService';
import { Sliders, RefreshCcw, Microscope } from 'lucide-react';

interface StrategySimulatorProps {
  initialStrategy: StrategyRecommendation;
}

const StrategySimulator: React.FC<StrategySimulatorProps> = ({ initialStrategy }) => {
  const [basePrice, setBasePrice] = useState(initialStrategy.currentPrice);
  const [volatility, setVolatility] = useState(0.40); // 40% IV default
  const [dte, setDte] = useState(30); // 30 Days default
  const [legs, setLegs] = useState<OptionLeg[]>(initialStrategy.legs);
  const [portfolioGreeks, setPortfolioGreeks] = useState<Greeks>({ delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 });

  // Update premiums and Calculate Greeks whenever inputs change
  useEffect(() => {
    const newLegs = legs.map(leg => {
        // 1. Recalculate Premium
        const premium = calculateBlackScholes(
            leg.type, 
            basePrice, 
            leg.strike, 
            30 / 365, // Standardized entry assumption for premium basis
            0.05, 
            0.40
        );
        return { ...leg, premium: parseFloat(premium.toFixed(2)) };
    });
    
    // We don't want to loop setLegs here if we can avoid it, but we need the premium for the chart visual.
    // Ideally premium is fixed at entry, but for "Lab" we might want to see how P/L changes if we entered NOW.
    // However, keeping premium static allows analyzing current P/L of an *existing* trade.
    // Let's stick to "Analysis of a NEW trade with these params".
    // Actually, setting legs here causes infinite loop if we rely on `legs` in dependency.
    // We'll calculate aggregated Greeks separately.
    
    let netDelta = 0;
    let netGamma = 0;
    let netTheta = 0;
    let netVega = 0;

    legs.forEach(leg => {
        const greeks = calculateGreeks(
            leg.type,
            basePrice,
            leg.strike,
            dte / 365, // Use dynamic DTE for greeks
            0.05,
            volatility // Use dynamic Vol for greeks
        );

        const direction = leg.action === 'buy' ? 1 : -1;
        netDelta += greeks.delta * direction;
        netGamma += greeks.gamma * direction;
        netTheta += greeks.theta * direction; // Daily Theta
        netVega += greeks.vega * direction;
    });

    setPortfolioGreeks({
        delta: netDelta,
        gamma: netGamma,
        theta: netTheta,
        vega: netVega,
        rho: 0
    });

  }, [basePrice, volatility, dte, legs]); 

  const handleStrikeChange = (index: number, newStrike: number) => {
      const newLegs = [...legs];
      // Recalc premium for the new strike assuming standardized entry conditions
      const premium = calculateBlackScholes(
          newLegs[index].type,
          basePrice,
          newStrike,
          30/365,
          0.05,
          0.40
      );
      newLegs[index] = { ...newLegs[index], strike: newStrike, premium: parseFloat(premium.toFixed(2)) };
      setLegs(newLegs);
  };

  const currentStrategy: StrategyRecommendation = {
      ...initialStrategy,
      currentPrice: basePrice,
      legs: legs
  };

  const reset = () => {
      setBasePrice(initialStrategy.currentPrice);
      setVolatility(0.40);
      setDte(30);
      setLegs(initialStrategy.legs);
  };

  return (
    <div className="bg-slate-950/30 rounded-lg overflow-hidden border border-white/5 flex flex-col h-full">
        {/* Chart Area */}
        <div className="h-56 w-full bg-slate-900/50 relative">
            <PayoffChart 
                strategy={currentStrategy} 
                daysToExpiry={dte} 
                volatility={volatility} 
            />
            <button onClick={reset} className="absolute top-2 right-2 p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors" title="Reset Lab">
                <RefreshCcw className="w-3 h-3" />
            </button>
        </div>

        {/* Controls Lab */}
        <div className="p-4 space-y-4 bg-slate-950/50 border-t border-white/5 flex-grow">
            
            {/* Real-time Greeks Dashboard */}
            <div className="grid grid-cols-4 gap-2 mb-4">
                 <div className="bg-slate-900 p-2 rounded border border-white/5 text-center">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">Delta</div>
                    <div className={`text-xs font-mono font-bold ${portfolioGreeks.delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {portfolioGreeks.delta > 0 ? '+' : ''}{portfolioGreeks.delta.toFixed(2)}
                    </div>
                 </div>
                 <div className="bg-slate-900 p-2 rounded border border-white/5 text-center">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">Gamma</div>
                    <div className="text-xs font-mono font-bold text-indigo-400">
                        {portfolioGreeks.gamma.toFixed(3)}
                    </div>
                 </div>
                 <div className="bg-slate-900 p-2 rounded border border-white/5 text-center">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">Theta</div>
                    <div className="text-xs font-mono font-bold text-amber-400">
                        {portfolioGreeks.theta.toFixed(2)}
                    </div>
                 </div>
                 <div className="bg-slate-900 p-2 rounded border border-white/5 text-center">
                    <div className="text-[9px] text-slate-500 uppercase font-bold">Vega</div>
                    <div className="text-xs font-mono font-bold text-cyan-400">
                        {portfolioGreeks.vega.toFixed(2)}
                    </div>
                 </div>
            </div>

            <div className="flex items-center gap-2 mb-2 text-indigo-400">
                <Sliders className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">Market Conditions</span>
            </div>

            {/* Global Sliders */}
            <div className="space-y-3">
                <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>Stock Price (Delta/Gamma)</span>
                        <span className="text-white">${basePrice}</span>
                    </div>
                    <input 
                        type="range" 
                        min={initialStrategy.currentPrice * 0.5} 
                        max={initialStrategy.currentPrice * 1.5} 
                        step={1}
                        value={basePrice}
                        onChange={(e) => setBasePrice(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>Time to Expiry (Theta)</span>
                        <span className="text-amber-400">{dte} Days</span>
                    </div>
                    <input 
                        type="range" 
                        min={0} 
                        max={90} 
                        step={1}
                        value={dte}
                        onChange={(e) => setDte(parseInt(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase">
                        <span>Implied Volatility (Vega)</span>
                        <span className="text-cyan-400">{(volatility * 100).toFixed(0)}%</span>
                    </div>
                    <input 
                        type="range" 
                        min={0.1} 
                        max={1.5} 
                        step={0.05}
                        value={volatility}
                        onChange={(e) => setVolatility(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                </div>
            </div>

            {/* Leg Configs */}
            <div className="pt-2 border-t border-white/5 space-y-2">
                <div className="text-[9px] text-slate-500 font-bold uppercase mb-1">Leg Configuration</div>
                {legs.map((leg, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-slate-900 rounded px-2 py-1.5 border border-white/5">
                        <span className={`text-[10px] font-bold uppercase px-1.5 rounded ${leg.action === 'buy' ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                            {leg.action} {leg.type}
                        </span>
                        <div className="flex items-center gap-2">
                            <label className="text-[9px] text-slate-500 uppercase">Strike</label>
                            <input 
                                type="number" 
                                value={leg.strike}
                                onChange={(e) => handleStrikeChange(idx, parseFloat(e.target.value))}
                                className="w-16 bg-black/40 border border-white/10 rounded text-right text-xs text-white px-1 py-0.5 focus:border-indigo-500/50 outline-none"
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};

export default StrategySimulator;
