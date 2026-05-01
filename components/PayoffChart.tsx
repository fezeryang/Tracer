
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Line } from 'recharts';
import { StrategyRecommendation } from '../types';
import { calculateBlackScholes } from '../services/marketDataService';

interface PayoffChartProps {
  strategy: StrategyRecommendation;
  daysToExpiry?: number;
  volatility?: number;
}

const PayoffChart: React.FC<PayoffChartProps> = ({ strategy, daysToExpiry, volatility }) => {
  const data = useMemo(() => {
    const { currentPrice, legs } = strategy;
    let minPrice = currentPrice * 0.7; // Wider range for analysis
    let maxPrice = currentPrice * 1.3;

    legs.forEach(leg => {
      minPrice = Math.min(minPrice, leg.strike * 0.85);
      maxPrice = Math.max(maxPrice, leg.strike * 1.15);
    });

    const points = [];
    const steps = 80;
    const stepSize = (maxPrice - minPrice) / steps;

    // Use provided volatility or default to a reasonable assumption if not provided
    const vol = volatility || 0.35;
    const dteYears = (daysToExpiry !== undefined ? daysToExpiry : 0) / 365;
    const r = 0.05; // Risk free rate

    for (let i = 0; i <= steps; i++) {
      const priceAtExpiry = minPrice + (i * stepSize);
      let totalProfit = 0; // At Expiration
      let currentProfit = 0; // Mark to Market (Black Scholes)

      legs.forEach(leg => {
        // 1. Calculate Expiry P/L (Intrinsic Value)
        let legProfit = 0;
        const intrinsic = leg.type === 'call' 
          ? Math.max(0, priceAtExpiry - leg.strike)
          : Math.max(0, leg.strike - priceAtExpiry);
        
        if (leg.action === 'buy') {
            legProfit = intrinsic - leg.premium;
        } else {
            legProfit = leg.premium - intrinsic;
        }
        totalProfit += legProfit;

        // 2. Calculate Current P/L (Theoretical Value)
        if (daysToExpiry !== undefined) {
             let theoreticalValue = calculateBlackScholes(leg.type, priceAtExpiry, leg.strike, dteYears, r, vol);
             // For Covered Call simulation (Short Put equivalence), we treat it as an option strategy
             // If Strategy is "Covered Call" in simulation, the legs usually include just the option leg + stock logic handled elsewhere?
             // Actually StrategyCard/Simulator passes just Option Legs. 
             // Note: For "Covered Call" type, PayoffChart often receives a synthetic equivalent (Short Put) or explicit Stock + Short Call legs.
             // If explicit Stock leg is present (action='buy', type='stock'?? No, type is call|put).
             // Assuming legs are standard options for now.
             
             if (leg.action === 'buy') {
                 currentProfit += (theoreticalValue - leg.premium);
             } else {
                 currentProfit += (leg.premium - theoreticalValue);
             }
        }
      });

      points.push({
        price: parseFloat(priceAtExpiry.toFixed(2)),
        profit: parseFloat((totalProfit * 100).toFixed(2)),
        currentProfit: daysToExpiry !== undefined ? parseFloat((currentProfit * 100).toFixed(2)) : null
      });
    }
    return points;
  }, [strategy, daysToExpiry, volatility]);

  const gradientOffset = () => {
    const dataMax = Math.max(...data.map((i) => i.profit));
    const dataMin = Math.min(...data.map((i) => i.profit));

    if (dataMax <= 0) return 0;
    if (dataMin >= 0) return 1;

    return dataMax / (dataMax - dataMin);
  };

  const off = gradientOffset();

  return (
    <div className="w-full h-full relative min-h-[250px]">
      <div className="absolute top-2 left-2 z-10">
         <h3 className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Profit / Loss Curve</h3>
         {daysToExpiry !== undefined && (
             <div className="flex items-center gap-3 mt-1">
                 <div className="flex items-center gap-1.5">
                     <div className="w-2 h-0.5 bg-amber-400"></div>
                     <span className="text-[9px] text-amber-400 font-bold uppercase">Current (T+{daysToExpiry}d)</span>
                 </div>
                 <div className="flex items-center gap-1.5">
                     <div className="w-2 h-0.5 bg-slate-400"></div>
                     <span className="text-[9px] text-slate-500 font-bold uppercase">At Expiry</span>
                 </div>
             </div>
         )}
      </div>
      
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 40, right: 0, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
              <stop offset={off} stopColor="#10b981" stopOpacity={0.3} /> {/* Emerald for profit */}
              <stop offset={off} stopColor="#f43f5e" stopOpacity={0.3} /> {/* Rose for loss */}
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff" opacity={0.05} />
          <XAxis 
            dataKey="price" 
            stroke="#475569" 
            fontSize={10} 
            tickFormatter={(val) => `${Math.round(val)}`}
            tickLine={false}
            axisLine={false}
            dy={10}
          />
          <YAxis 
            stroke="#475569" 
            fontSize={10}
            tickFormatter={(val) => `${val}`}
            tickLine={false}
            axisLine={false}
            dx={-5}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', color: '#f1f5f9', fontSize: '12px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.5)' }}
            formatter={(value: number, name: string) => {
                if (name === 'currentProfit') return [value > 0 ? `+$${value}` : `-$${Math.abs(value)}`, `Current P/L`];
                return [value > 0 ? `+$${value}` : `-$${Math.abs(value)}`, "Expiry P/L"];
            }}
            labelFormatter={(label: number) => `At Stock Price: $${label}`}
            cursor={{ stroke: '#6366f1', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <ReferenceLine y={0} stroke="#475569" strokeDasharray="3 3" />
          <ReferenceLine x={strategy.currentPrice} stroke="#6366f1" label={{ position: 'top',  value: 'Now', fill: '#6366f1', fontSize: 9 }} strokeDasharray="3 3" />
          
          {/* Expiry Curve (Area) */}
          <Area 
            type="monotone" 
            dataKey="profit" 
            stroke="#94a3b8" 
            strokeWidth={2}
            fill="url(#splitColor)" 
            strokeDasharray="4 4" // Dashed to show it's "Future"
            animationDuration={500}
          />

          {/* Current Curve (Line) - Only if DTE provided */}
          {daysToExpiry !== undefined && (
              <Line 
                type="monotone" 
                dataKey="currentProfit" 
                stroke="#fbbf24" // Amber for current
                strokeWidth={2}
                dot={false}
                animationDuration={500}
              />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PayoffChart;
