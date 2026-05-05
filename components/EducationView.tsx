
import React, { useState } from 'react';
import { Clock, TrendingUp, Activity, Zap, BarChart3, AlertTriangle, Layers, MoveRight, Gauge, BookOpen, Target, TrendingDown, ShieldCheck, ArrowRight, Filter, MinusCircle, Microscope, Beaker, Box, Settings, Database, PieChart, Gamepad2 } from 'lucide-react';
import { StrategyRecommendation, OptionContract } from '../types';
import StrategySimulator from './StrategySimulator';
import StrategyBuilder from './StrategyBuilder';
import VolatilitySurface from './VolatilitySurface';
import OptionsChainView from './OptionsChainView';
import OptionPricingDonut from './OptionPricingDonut';
import OptionsRunnerGame from './OptionsRunnerGame';
import { Language, t } from '../i18n';
import { NuxPageHeader, RiskDisclaimer } from './NuxPage';

interface ConceptProps {
  title: string;
  symbol: string;
  icon: any;
  description: string;
  proTip: string;
  colorTheme: 'emerald' | 'rose' | 'amber' | 'cyan' | 'violet';
}

const ConceptCard: React.FC<ConceptProps> = ({ title, symbol, icon: Icon, description, proTip, colorTheme }) => {
  
  const getThemeClasses = () => {
    switch (colorTheme) {
      case 'emerald': return { 
          iconBg: 'bg-emerald-500/10 text-emerald-400', 
          border: 'border-white/10 hover:border-emerald-500/50', 
          tipBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
      };
      case 'rose': return { 
          iconBg: 'bg-rose-500/10 text-rose-400', 
          border: 'border-white/10 hover:border-rose-500/50', 
          tipBg: 'bg-rose-500/10 border-rose-500/20 text-rose-300' 
      };
      case 'amber': return { 
          iconBg: 'bg-amber-500/10 text-amber-400', 
          border: 'border-white/10 hover:border-amber-500/50', 
          tipBg: 'bg-amber-500/10 border-amber-500/20 text-amber-300' 
      };
      case 'cyan': return { 
          iconBg: 'bg-cyan-500/10 text-cyan-400', 
          border: 'border-white/10 hover:border-cyan-500/50', 
          tipBg: 'bg-cyan-500/10 border-cyan-500/20 text-cyan-300' 
      };
      case 'violet': return { 
          iconBg: 'bg-violet-500/10 text-violet-400', 
          border: 'border-white/10 hover:border-violet-500/50', 
          tipBg: 'bg-violet-500/10 border-violet-500/20 text-violet-300' 
      };
      default: return { 
          iconBg: 'bg-slate-500/10 text-slate-400', 
          border: 'border-white/10', 
          tipBg: 'bg-slate-500/10' 
      };
    }
  };

  const theme = getThemeClasses();

  return (
    <div className={`p-6 rounded-2xl border bg-slate-900/40 backdrop-blur-md transition-all duration-300 group ${theme.border} relative overflow-hidden`}>
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
          <Icon className="w-24 h-24" />
      </div>
      
      <div className="flex justify-between items-start mb-4 relative z-10">
        <div className={`p-3 rounded-xl ${theme.iconBg}`}>
          <Icon size={24} />
        </div>
        <span className="text-3xl font-serif italic text-white/20 font-bold">{symbol}</span>
      </div>
      
      <h3 className="text-xl font-bold text-white mb-2 relative z-10">{title}</h3>
      <p className="text-slate-400 text-sm leading-relaxed mb-5 relative z-10 h-20">{description}</p>
      
      <div className={`p-3 rounded-lg border flex gap-3 items-start relative z-10 ${theme.tipBg}`}>
        <Zap className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
            <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5 opacity-80">Trader's Edge</p>
            <p className="text-xs leading-snug">{proTip}</p>
        </div>
      </div>
    </div>
  );
};

// --- Strategy Data & Component ---

type StrategyType = 'bullish' | 'bearish' | 'neutral' | 'volatile';

interface StrategyDetail {
  id: string;
  name: string;
  type: StrategyType;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  risk: 'Low' | 'Medium' | 'High' | 'Unlimited';
  setup: string;
  description: string;
  idealIV: 'Low' | 'High' | 'Any';
  greeks: {
      delta: string; 
      theta: string; 
      vega: string;  
  };
  scenario: string; 
  riskDetail: string; 
}

const STRATEGIES: StrategyDetail[] = [
  {
    id: 'long-call',
    name: 'Long Call',
    type: 'bullish',
    difficulty: 'Beginner',
    risk: 'Medium',
    setup: 'Buy Call Option',
    description: 'The purest bullish bet. You have the right to buy shares at a fixed price. Profit is theoretically unlimited if the stock moons.',
    idealIV: 'Low',
    greeks: {
        delta: '+ Positive',
        theta: '- Negative',
        vega: '+ Positive'
    },
    scenario: "Stock is $150. You buy a $160 Call. You need the stock to explode past $160 + premium paid before expiration. If it stays flat, time decay (Theta) kills the trade.",
    riskDetail: "100% loss of premium if OTM at expiry. Time is your enemy."
  },
  {
    id: 'covered-call',
    name: 'Covered Call',
    type: 'bullish',
    difficulty: 'Beginner',
    risk: 'Low',
    setup: 'Own 100 Shares + Sell Call',
    description: 'The landlord strategy. You own the "house" (shares) and collect "rent" (premium) by selling upside potential.',
    idealIV: 'High',
    greeks: {
        delta: '+ Positive',
        theta: '+ Positive',
        vega: '- Negative'
    },
    scenario: "You own AAPL at $170. You sell a $180 Call for $3.00 credit. If AAPL stays flat, you keep the $300. If it hits $200, you are forced to sell at $180, missing extra gains.",
    riskDetail: "Opportunity cost. Your shares get called away, capping your win."
  },
  {
    id: 'bull-call-spread',
    name: 'Bull Call Spread',
    type: 'bullish',
    difficulty: 'Intermediate',
    risk: 'Low',
    setup: 'Buy Call + Sell Higher Call',
    description: 'A cheaper, hedged version of a Long Call. You cap your profit to reduce your cost basis and volatility risk.',
    idealIV: 'Low',
    greeks: {
        delta: '+ Positive',
        theta: '~ Neutral',
        vega: '~ Neutral'
    },
    scenario: "Stock $100. Buy $105 Call, Sell $110 Call. Cost is lower than just buying the $105. Max profit happens if stock is above $110. You don't care if it goes to $200.",
    riskDetail: "Capped profit. If stock skyrockets, you don't participate past the short strike."
  },
  {
    id: 'long-put',
    name: 'Long Put',
    type: 'bearish',
    difficulty: 'Beginner',
    risk: 'Medium',
    setup: 'Buy Put Option',
    description: 'Profit from a crash. You have the right to sell shares at a high price, even if the market hits zero.',
    idealIV: 'Low',
    greeks: {
        delta: '- Negative',
        theta: '- Negative',
        vega: '+ Positive'
    },
    scenario: "Stock $50. You think earnings will miss. Buy $45 Put. If stock crashes to $30, your Put value explodes. If stock stays at $50, you lose the premium.",
    riskDetail: "Defined risk (premium paid), but timing must be perfect."
  },
  {
    id: 'bear-put-spread',
    name: 'Bear Put Spread',
    type: 'bearish',
    difficulty: 'Intermediate',
    risk: 'Low',
    setup: 'Buy Put + Sell Lower Put',
    description: 'A surgical bearish bet. You expect a drop, but not a total collapse. Reduces cost by selling the floor.',
    idealIV: 'Low',
    greeks: {
        delta: '- Negative',
        theta: '~ Neutral',
        vega: '~ Neutral'
    },
    scenario: "Stock $200. Buy $190 Put, Sell $180 Put. You profit as it drops to $180. The short put offsets the cost (Theta bill) of the long put.",
    riskDetail: "Profit limited to the width of the strikes minus debit paid."
  },
  {
    id: 'iron-condor',
    name: 'Iron Condor',
    type: 'neutral',
    difficulty: 'Advanced',
    risk: 'Medium',
    setup: 'Sell OTM Call Spread + Sell OTM Put Spread',
    description: 'Profiting from nothing happening. You collect premium from both sides, betting the stock stays in a specific range.',
    idealIV: 'High',
    greeks: {
        delta: '~ Neutral',
        theta: '+ Positive',
        vega: '- Negative'
    },
    scenario: "Stock $100. Sell $110 Call / $90 Put. Buy wings ($115/$85) for protection. You win if stock ends between $90-$110. Time decay pays you daily.",
    riskDetail: "One big move blows up the trade. Max loss is defined but usually > max profit."
  },
  {
    id: 'iron-butterfly',
    name: 'Iron Butterfly',
    type: 'neutral',
    difficulty: 'Advanced',
    risk: 'High',
    setup: 'Sell ATM Call Spread + Sell ATM Put Spread',
    description: 'Aggressive income strategy. You sell the exact current price, betting on absolute stagnation. Higher credit than Condor.',
    idealIV: 'High',
    greeks: {
        delta: '~ Neutral',
        theta: '++ Positive',
        vega: '-- Negative'
    },
    scenario: "Stock $50. Sell $50 Call and $50 Put. Buy wings. You collect a massive credit. You need the stock to pin exactly at $50 to keep it all.",
    riskDetail: "Narrow profit tent. Small moves can turn a winner into a loser quickly."
  },
  {
    id: 'straddle',
    name: 'Long Straddle',
    type: 'volatile',
    difficulty: 'Intermediate',
    risk: 'High',
    setup: 'Buy Call + Buy Put (Same Strike)',
    description: 'The "Chaos" trade. You profit if the stock moves massively in EITHER direction. You lose if it stays still.',
    idealIV: 'Low',
    greeks: {
        delta: '~ Neutral',
        theta: '-- Negative',
        vega: '++ Positive'
    },
    scenario: "Earnings today. Stock $100. Buy $100 Call and $100 Put. Cost $10. You need stock > $110 or < $90 to win. If it's $100 tomorrow, you lose $10.",
    riskDetail: "Expensive to enter. Requires a move larger than the 'Expected Move' to profit."
  }
];

const getExampleChartData = (id: string): StrategyRecommendation => {
    const basePrice = 100;
    
    let legs: any[] = [];
    
    switch(id) {
        case 'long-call':
            legs = [{ type: 'call', action: 'buy', strike: 105, premium: 2.5, expiration: '30d' }];
            break;
        case 'covered-call':
            legs = [{ type: 'put', action: 'sell', strike: 100, premium: 3.0, expiration: '30d' }];
            break;
        case 'bull-call-spread':
            legs = [
                { type: 'call', action: 'buy', strike: 100, premium: 4.0, expiration: '30d' },
                { type: 'call', action: 'sell', strike: 110, premium: 1.5, expiration: '30d' }
            ];
            break;
        case 'long-put':
            legs = [{ type: 'put', action: 'buy', strike: 95, premium: 2.5, expiration: '30d' }];
            break;
        case 'bear-put-spread':
            legs = [
                { type: 'put', action: 'buy', strike: 100, premium: 4.0, expiration: '30d' },
                { type: 'put', action: 'sell', strike: 90, premium: 1.5, expiration: '30d' }
            ];
            break;
        case 'iron-condor':
            legs = [
                { type: 'call', action: 'sell', strike: 110, premium: 1.5, expiration: '30d' },
                { type: 'call', action: 'buy', strike: 115, premium: 0.5, expiration: '30d' },
                { type: 'put', action: 'sell', strike: 90, premium: 1.5, expiration: '30d' },
                { type: 'put', action: 'buy', strike: 85, premium: 0.5, expiration: '30d' }
            ];
            break;
        case 'iron-butterfly':
            legs = [
                { type: 'call', action: 'sell', strike: 100, premium: 3.5, expiration: '30d' },
                { type: 'call', action: 'buy', strike: 110, premium: 0.8, expiration: '30d' },
                { type: 'put', action: 'sell', strike: 100, premium: 3.5, expiration: '30d' },
                { type: 'put', action: 'buy', strike: 90, premium: 0.8, expiration: '30d' }
            ];
            break;
        case 'straddle':
            legs = [
                { type: 'call', action: 'buy', strike: 100, premium: 3.5, expiration: '30d' },
                { type: 'put', action: 'buy', strike: 100, premium: 3.5, expiration: '30d' }
            ];
            break;
        default:
            legs = [];
    }

    return {
        name: "Example",
        ticker: "EXAMPLE",
        currentPrice: basePrice,
        thesis: "Neutral",
        explanation: "",
        legs: legs,
        maxProfit: 0,
        maxLoss: 0,
        breakEven: [],
        pop: 50,
        riskScore: 5,
        complexity: 'Medium'
    };
};

const EducationView: React.FC<{ language: Language }> = ({ language }) => {
  const [activeView, setActiveView] = useState<'playbook' | 'lab' | '3d' | 'pricing' | 'game'>('playbook');
  const [filter, setFilter] = useState<'all' | StrategyType>('all');
  
  // 3D View State
  const [surfaceVol, setSurfaceVol] = useState(0.40);
  const [surfaceRate, setSurfaceRate] = useState(0.05);
  const [surfaceType, setSurfaceType] = useState<'call' | 'put'>('call');
  const [surfaceStrike, setSurfaceStrike] = useState(100);
  
  // Pricing View State
  const [pricingStock, setPricingStock] = useState(100);
  const [pricingStrike, setPricingStrike] = useState(100);
  const [pricingDte, setPricingDte] = useState(30);
  const [pricingVol, setPricingVol] = useState(0.35);
  const [pricingType, setPricingType] = useState<'call' | 'put'>('call');

  // Modal State
  const [showChainModal, setShowChainModal] = useState(false);
  const [selectedContractInfo, setSelectedContractInfo] = useState<{ticker: string, expiry: string} | null>(null);

  const filteredStrategies = filter === 'all' 
    ? STRATEGIES 
    : STRATEGIES.filter(s => s.type === filter || (filter === 'neutral' && s.type === 'volatile'));

  const handleContractSelect = (ticker: string, expiration: string, contract: OptionContract, currentPrice: number) => {
      // Update Surface params
      setSurfaceStrike(contract.strike);
      setSurfaceVol(contract.impliedVolatility / 100);
      setSurfaceType(contract.type);
      
      // Update Pricing params
      setPricingStock(currentPrice);
      setPricingStrike(contract.strike);
      setPricingVol(contract.impliedVolatility / 100);
      setPricingType(contract.type);
      // Rough calc for DTE
      const diff = new Date(expiration).getTime() - Date.now();
      setPricingDte(Math.max(1, Math.ceil(diff / (1000 * 60 * 60 * 24))));

      setSelectedContractInfo({ ticker, expiry: expiration });
      setShowChainModal(false);
  };

  return (
    <div className="mt-6 animate-fade-in pb-20 relative">
       <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'academy.title')} subtitle={t(language, 'academy.subtitle')} />

       {showChainModal && (
            <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-8 animate-fade-in">
                <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-5xl h-full max-h-[800px] overflow-hidden flex flex-col shadow-2xl">
                    <div className="p-4 border-b border-white/10 flex justify-between items-center">
                        <h3 className="text-white font-bold">{t(language, 'backtest.selectContract')}</h3>
                        <button onClick={() => setShowChainModal(false)} className="text-slate-400 hover:text-white">{t(language, 'common.close')}</button>
                    </div>
                    <div className="flex-grow overflow-hidden p-4">
                        <OptionsChainView 
                            language={language}
                            initialTicker="SPY"
                            onSelectContract={handleContractSelect} 
                        />
                    </div>
                </div>
            </div>
       )}
       
       {/* Navigation / Header */}
       <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-4">
             <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                <BookOpen className="w-6 h-6" />
             </div>
             <div>
                <h3 className="text-xl font-bold text-white">Academy</h3>
                <p className="text-slate-400 text-xs mt-0.5">Master the Greeks and advanced structures.</p>
             </div>
          </div>
          
          <div className="flex bg-slate-950 p-1 rounded-xl border border-white/5 overflow-x-auto scrollbar-hide max-w-full">
              <button 
                  onClick={() => setActiveView('playbook')}
                  className={`px-4 lg:px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeView === 'playbook' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                  <Layers className="w-4 h-4" /> Playbook
              </button>
              <button 
                  onClick={() => setActiveView('lab')}
                  className={`px-4 lg:px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeView === 'lab' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                  <Beaker className="w-4 h-4" /> Lab
              </button>
              <button 
                  onClick={() => setActiveView('game')}
                  className={`px-4 lg:px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeView === 'game' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                  <Gamepad2 className="w-4 h-4" /> Game
              </button>
              <button 
                  onClick={() => setActiveView('pricing')}
                  className={`px-4 lg:px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeView === 'pricing' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                  <PieChart className="w-4 h-4" /> Pricing 3D
              </button>
              <button 
                  onClick={() => setActiveView('3d')}
                  className={`px-4 lg:px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeView === '3d' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-white'}`}
              >
                  <Box className="w-4 h-4" /> Surface 3D
              </button>
          </div>
       </div>

       {activeView === 'game' && (
           <OptionsRunnerGame />
       )}

       {activeView === 'playbook' && (
           <>
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-sm font-bold text-slate-500 uppercase tracking-wide">Browse Strategies</h4>
                    <div className="flex bg-slate-900/50 p-1 rounded-lg border border-white/5 scale-90 origin-right">
                        {(['all', 'bullish', 'bearish', 'neutral'] as const).map((f) => (
                            <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-4 py-1.5 rounded-md text-xs font-medium capitalize transition-all ${
                                filter === f 
                                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' 
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                            >
                            {f === 'neutral' ? 'Neutral / Range' : f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    {filteredStrategies.map((strat) => (
                        <div key={strat.id} className="group bg-slate-900/30 border border-white/5 hover:border-indigo-500/30 rounded-2xl p-6 transition-all hover:bg-slate-900/50 flex flex-col h-full">
                            
                            {/* Header */}
                            <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <span className={`p-2 rounded-lg ${
                                    strat.type === 'bullish' ? 'bg-emerald-500/10 text-emerald-400' :
                                    strat.type === 'bearish' ? 'bg-rose-500/10 text-rose-400' :
                                    'bg-violet-500/10 text-violet-400'
                                }`}>
                                    {strat.type === 'bullish' && <TrendingUp className="w-5 h-5" />}
                                    {strat.type === 'bearish' && <TrendingDown className="w-5 h-5" />}
                                    {(strat.type === 'neutral' || strat.type === 'volatile') && <MinusCircle className="w-5 h-5" />}
                                </span>
                                <div>
                                    <h4 className="font-bold text-white text-lg leading-tight">{strat.name}</h4>
                                    <span className={`text-[10px] uppercase font-bold tracking-wider ${
                                        strat.difficulty === 'Beginner' ? 'text-emerald-400' :
                                        strat.difficulty === 'Intermediate' ? 'text-amber-400' :
                                        'text-rose-400'
                                    }`}>
                                        {strat.difficulty} Lvl
                                    </span>
                                </div>
                            </div>
                            <div className="text-xs font-mono text-slate-500 bg-black/20 px-2 py-1 rounded border border-white/5">
                                {strat.setup}
                            </div>
                            </div>

                            {/* VISUAL PNL CHART LAB */}
                            <div className="mb-6 w-full h-[320px] bg-slate-950/30 rounded-lg border border-white/5 relative overflow-hidden">
                                <StrategySimulator initialStrategy={getExampleChartData(strat.id)} />
                            </div>

                            <p className="text-slate-300 text-sm leading-relaxed mb-6 flex-grow">
                            {strat.description}
                            </p>

                            {/* The Greeks Engine */}
                            <div className="mb-5 bg-slate-950/40 rounded-xl p-3 border border-white/5">
                                <div className="flex items-center gap-2 mb-2">
                                    <Microscope className="w-3 h-3 text-indigo-400" />
                                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">The Greeks Engine</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[
                                        { label: 'Delta', val: strat.greeks.delta },
                                        { label: 'Theta', val: strat.greeks.theta },
                                        { label: 'Vega', val: strat.greeks.vega },
                                    ].map((g) => (
                                        <div key={g.label} className="bg-slate-900/50 rounded-lg p-2 text-center border border-white/5">
                                            <div className="text-[9px] text-slate-500 uppercase mb-1">{g.label}</div>
                                            <div className={`text-[10px] font-bold ${
                                                g.val.includes('+') ? 'text-emerald-400' : 
                                                g.val.includes('-') ? 'text-rose-400' : 
                                                'text-slate-300'
                                            }`}>{g.val}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Scenario & Risks */}
                            <div className="space-y-3 text-xs bg-indigo-500/5 rounded-xl p-4 border border-indigo-500/10">
                            <div>
                                    <span className="text-indigo-300 font-bold block mb-1 flex items-center gap-1.5">
                                        <Target className="w-3 h-3" /> Winning Scenario
                                    </span>
                                    <p className="text-slate-400 leading-snug">"{strat.scenario}"</p>
                            </div>
                            <div className="pt-2 border-t border-white/5">
                                    <span className="text-rose-400 font-bold block mb-1 flex items-center gap-1.5">
                                        <ShieldCheck className="w-3 h-3" /> Main Risk
                                    </span>
                                    <p className="text-slate-400 leading-snug">{strat.riskDetail}</p>
                            </div>
                            </div>

                        </div>
                    ))}
                </div>
           </>
       )}
       
       {activeView === 'lab' && <StrategyBuilder />}

       {activeView === 'pricing' && (
           <div className="animate-fade-in flex flex-col gap-6">
                
                {/* Control Bar */}
                <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-wrap items-end gap-4">
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Stock Price</label>
                        <input type="number" value={pricingStock} onChange={e => setPricingStock(Number(e.target.value))} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none font-mono" />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Strike Price</label>
                        <input type="number" value={pricingStrike} onChange={e => setPricingStrike(Number(e.target.value))} className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500/50 outline-none font-mono" />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Volatility</label>
                        <input type="range" min="0.1" max="2.0" step="0.05" value={pricingVol} onChange={e => setPricingVol(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-fuchsia-500" />
                        <div className="text-right text-[10px] text-fuchsia-400 mt-1 font-mono">{(pricingVol*100).toFixed(0)}%</div>
                    </div>
                    <div className="flex-1 min-w-[120px]">
                        <label className="text-[10px] uppercase font-bold text-slate-500 mb-1 block">Time (Days)</label>
                        <input type="range" min="1" max="365" step="1" value={pricingDte} onChange={e => setPricingDte(Number(e.target.value))} className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500" />
                        <div className="text-right text-[10px] text-amber-400 mt-1 font-mono">{pricingDte} DTE</div>
                    </div>
                    <div>
                        <div className="flex bg-slate-950 p-1 rounded-lg border border-white/10">
                            <button onClick={() => setPricingType('call')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-colors ${pricingType === 'call' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>Call</button>
                            <button onClick={() => setPricingType('put')} className={`px-4 py-2 rounded-md text-xs font-bold uppercase transition-colors ${pricingType === 'put' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-white'}`}>Put</button>
                        </div>
                    </div>
                    <button 
                        onClick={() => setShowChainModal(true)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-all border border-white/5 flex items-center gap-2"
                    >
                        <Database className="w-4 h-4" /> Load Real Data
                    </button>
                </div>

                {/* 3D Component */}
                <div className="h-[500px]">
                    <OptionPricingDonut 
                        stockPrice={pricingStock}
                        strikePrice={pricingStrike}
                        dte={pricingDte}
                        volatility={pricingVol}
                        riskFreeRate={0.05}
                        optionType={pricingType}
                    />
                </div>
           </div>
       )}

       {activeView === '3d' && (
           <div className="flex flex-col lg:flex-row gap-6 h-[600px] animate-fade-in">
                {/* Visualizer */}
                <div className="flex-1 bg-slate-900/40 border border-white/10 rounded-2xl p-1 backdrop-blur-md shadow-2xl relative">
                    <VolatilitySurface 
                        volatility={surfaceVol} 
                        riskFreeRate={surfaceRate} 
                        isCall={surfaceType === 'call'} 
                        strikePrice={surfaceStrike}
                    />
                </div>

                {/* Controls */}
                <div className="w-full lg:w-80 flex flex-col gap-4">
                    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 backdrop-blur-md">
                        <div className="flex justify-between items-center mb-4">
                             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                                <Settings className="w-4 h-4" /> Parameters
                             </h4>
                             {selectedContractInfo && (
                                 <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/30">
                                     {selectedContractInfo.ticker}
                                 </span>
                             )}
                        </div>
                        
                        <button 
                            onClick={() => setShowChainModal(true)}
                            className="w-full py-3 mb-6 rounded-xl border border-white/10 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide"
                        >
                            <Database className="w-4 h-4" /> Select Contract
                        </button>
                        
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-bold text-slate-300 block mb-2">Strike Price ($)</label>
                                <input 
                                    type="number" 
                                    value={surfaceStrike} 
                                    onChange={(e) => setSurfaceStrike(parseFloat(e.target.value))}
                                    className="w-full bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-indigo-500/50 outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-slate-300 block mb-2">Option Type</label>
                                <div className="flex bg-slate-950 p-1 rounded-lg border border-white/10">
                                    <button 
                                        onClick={() => setSurfaceType('call')}
                                        className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase transition-colors ${surfaceType === 'call' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                                    >Call</button>
                                    <button 
                                        onClick={() => setSurfaceType('put')}
                                        className={`flex-1 py-1.5 rounded-md text-xs font-bold uppercase transition-colors ${surfaceType === 'put' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-white'}`}
                                    >Put</button>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-slate-400">Implied Volatility</span>
                                    <span className="text-cyan-400 font-mono">{(surfaceVol * 100).toFixed(0)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.1" 
                                    max="1.5" 
                                    step="0.05" 
                                    value={surfaceVol} 
                                    onChange={(e) => setSurfaceVol(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-2">
                                    <span className="text-slate-400">Risk-Free Rate</span>
                                    <span className="text-amber-400 font-mono">{(surfaceRate * 100).toFixed(1)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0.0" 
                                    max="0.15" 
                                    step="0.005" 
                                    value={surfaceRate} 
                                    onChange={(e) => setSurfaceRate(parseFloat(e.target.value))}
                                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-5 flex-grow">
                        <h4 className="text-indigo-300 font-bold text-sm mb-2 flex items-center gap-2">
                            <Box className="w-4 h-4" /> Understanding the Mesh
                        </h4>
                        <ul className="text-xs text-slate-300 space-y-3 list-disc pl-4">
                            <li>
                                <strong>Depth (Z-Axis):</strong> Time Decay. The surface visualizes how premium evaporates as you move from <span className="text-white">1 Year</span> to <span className="text-white">Expiration</span>.
                            </li>
                            <li>
                                <strong>Width (X-Axis):</strong> Spot Price range centered on your Strike (${surfaceStrike}).
                            </li>
                            <li>
                                <strong>Color:</strong> Represents Option Value. <span className="text-rose-400">Red</span> is high premium, <span className="text-blue-400">Blue</span> is low premium.
                            </li>
                        </ul>
                    </div>
                </div>
           </div>
       )}
       <RiskDisclaimer language={language} />
    </div>
  );
};

export default EducationView;
