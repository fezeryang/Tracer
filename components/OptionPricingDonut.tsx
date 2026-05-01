
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { calculateBlackScholes, calculateGreeks } from '../services/marketDataService';
import { Info, MousePointer2, Layers, Zap, Clock, TrendingUp } from 'lucide-react';

interface PricingDonutProps {
  stockPrice: number;
  strikePrice: number;
  dte: number; // Days to expiry
  volatility: number; // Decimal (e.g. 0.45)
  riskFreeRate: number;
  optionType: 'call' | 'put';
}

interface Particle {
  theta: number; // Tube angle
  phi: number;   // Torus angle
  size: number;
  speed: number;
  jitter: number;
  type: 'intrinsic' | 'time' | 'volatility';
  color: string;
}

const OptionPricingDonut: React.FC<PricingDonutProps> = ({ 
  stockPrice, strikePrice, dte, volatility, riskFreeRate, optionType 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState({ x: 0.8, y: 0.6 });
  const [hoverInfo, setHoverInfo] = useState<{label: string, value: string, desc: string} | null>(null);

  // --- Calculations ---
  const { price, intrinsic, extrinsic, greeks, breakdown } = useMemo(() => {
      const timeYears = dte / 365;
      const totalPremium = calculateBlackScholes(optionType, stockPrice, strikePrice, timeYears, riskFreeRate, volatility);
      
      let intr = 0;
      if (optionType === 'call') intr = Math.max(0, stockPrice - strikePrice);
      else intr = Math.max(0, strikePrice - stockPrice);
      
      const extr = Math.max(0, totalPremium - intr);
      
      const g = calculateGreeks(optionType, stockPrice, strikePrice, timeYears, riskFreeRate, volatility);

      // Heuristic breakdown of Extrinsic for visualization
      // Vega component vs Theta/Time component (Not strictly additive in BS, but conceptually useful)
      // High Vol = More Vega dominance. Low Time = Less Theta value remaining.
      const volWeight = volatility * 100; // rough scale
      const timeWeight = dte;
      const totalWeight = volWeight + timeWeight;
      
      const vegaShare = totalWeight > 0 ? (volWeight / totalWeight) : 0.5;
      
      return {
          price: totalPremium,
          intrinsic: intr,
          extrinsic: extr,
          greeks: g,
          breakdown: {
              intrinsicPct: totalPremium > 0 ? intr / totalPremium : 0,
              extrinsicPct: totalPremium > 0 ? extr / totalPremium : 0,
              vegaShare
          }
      };
  }, [stockPrice, strikePrice, dte, volatility, riskFreeRate, optionType]);

  // --- Particle System ---
  const particles = useMemo(() => {
      const p: Particle[] = [];
      const count = 1200;
      
      // Calculate split angle based on Intrinsic %
      // 0 to intrinsicAngle -> Intrinsic
      // intrinsicAngle to 2*PI -> Extrinsic
      const intrinsicAngle = breakdown.intrinsicPct * Math.PI * 2;
      
      for(let i = 0; i < count; i++) {
          const phi = Math.random() * Math.PI * 2;
          let type: 'intrinsic' | 'time' | 'volatility' = 'intrinsic';
          let color = '';
          let jitter = 0;
          let size = 1;

          // Align particles to segments
          if (phi < intrinsicAngle) {
              type = 'intrinsic';
              color = '#10b981'; // Emerald
              jitter = 0.02; // Stable
              size = 1.5;
          } else {
              // Extrinsic Segment
              // Split extrinsic into Time vs Volatility visually
              // We'll interleave them or split the remaining arc? 
              // Let's interleave to show they are combined in extrinsic value
              if (Math.random() < breakdown.vegaShare) {
                  type = 'volatility';
                  color = '#d946ef'; // Fuchsia/Purple
                  jitter = 0.2 + (volatility * 0.5); // Vibrate with Vol
                  size = 1.2;
              } else {
                  type = 'time';
                  color = '#f59e0b'; // Amber
                  jitter = 0.05;
                  size = 1.0;
              }
          }

          p.push({
              theta: Math.random() * Math.PI * 2,
              phi: phi, // Determine position on ring
              size,
              speed: 0.005 + Math.random() * 0.01,
              jitter,
              type,
              color
          });
      }
      return p;
  }, [breakdown, volatility]);

  // --- Drawing ---
  const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Torus Params
      const R = 100; // Major Radius
      const r = 40;  // Minor Radius

      // Sort Z-buffer roughly by drawing back to front?
      // For particles, just drawing them is usually okay if we use additive blending or simple order
      // Let's assume standard draw order is fine for this effect
      
      // Update & Draw Particles
      particles.forEach(p => {
          // Animate phi (rotate around ring)
          p.phi += p.speed * 0.5;
          
          // Apply Jitter (Volatility Effect)
          const jitterX = (Math.random() - 0.5) * p.jitter * 10;
          const jitterY = (Math.random() - 0.5) * p.jitter * 10;
          const jitterZ = (Math.random() - 0.5) * p.jitter * 10;

          // Torus Equation
          // x = (R + r cos(theta)) cos(phi)
          // y = (R + r cos(theta)) sin(phi)
          // z = r sin(theta)
          
          const rawX = (R + r * Math.cos(p.theta)) * Math.cos(p.phi) + (p.type === 'volatility' ? jitterX : 0);
          const rawY = (R + r * Math.cos(p.theta)) * Math.sin(p.phi) + (p.type === 'volatility' ? jitterY : 0);
          const rawZ = r * Math.sin(p.theta) + (p.type === 'volatility' ? jitterZ : 0);

          // 3D Rotation
          // Rotate X
          const y1 = rawY * Math.cos(rotation.x) - rawZ * Math.sin(rotation.x);
          const z1 = rawY * Math.sin(rotation.x) + rawZ * Math.cos(rotation.x);
          // Rotate Y
          const x2 = rawX * Math.cos(rotation.y) + z1 * Math.sin(rotation.y);
          const z2 = -rawX * Math.sin(rotation.y) + z1 * Math.cos(rotation.y);

          // Perspective Project
          const fov = 400;
          const scale = fov / (fov + z2 + 200);
          const x2d = centerX + x2 * scale;
          const y2d = centerY + y1 * scale;

          if (scale > 0) {
              ctx.beginPath();
              const alpha = p.type === 'time' ? 0.6 : 0.9;
              ctx.fillStyle = p.color;
              ctx.globalAlpha = alpha;
              ctx.arc(x2d, y2d, p.size * scale * 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1.0;
          }
      });

      // Draw Center Text (Hologram Price)
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // Glow
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#6366f1';
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`$${price.toFixed(2)}`, centerX, centerY - 10);
      
      ctx.font = '12px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.shadowBlur = 0;
      ctx.fillText('PREMIUM', centerX, centerY + 15);

      requestAnimationFrame(draw);
  };

  useEffect(() => {
      const handle = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(handle);
  }, [particles, rotation, price]);

  // Mouse Interaction for Rotation
  const handleMouseMove = (e: React.MouseEvent) => {
      if (e.buttons === 1) {
          setRotation(prev => ({
              x: prev.x + e.movementY * 0.01,
              y: prev.y + e.movementX * 0.01
          }));
      }
  };

  return (
    <div className="flex flex-col md:flex-row h-full gap-6">
        
        {/* 3D Canvas Container */}
        <div 
            className="flex-1 bg-slate-900/40 border border-white/10 rounded-2xl relative overflow-hidden cursor-move group"
            onMouseMove={handleMouseMove}
        >
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Intrinsic Value</span>
                        <span className="text-sm font-mono font-bold text-white">${intrinsic.toFixed(2)}</span>
                    </div>
                </div>
                <div className="bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-500 shadow-[0_0_10px_#d946ef]"></div>
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-400 uppercase font-bold">Extrinsic Value</span>
                        <span className="text-sm font-mono font-bold text-white">${extrinsic.toFixed(2)}</span>
                    </div>
                </div>
            </div>

            <canvas 
                ref={canvasRef} 
                width={600} 
                height={400} 
                className="w-full h-full object-contain"
            />
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-slate-500 text-[10px] uppercase font-bold flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <MousePointer2 className="w-3 h-3" /> Drag to Rotate Analysis
            </div>
        </div>

        {/* Legend / Breakdown Panel */}
        <div className="w-full md:w-80 flex flex-col gap-4">
            
            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5 backdrop-blur-md space-y-4">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-3">
                    <Layers className="w-4 h-4 text-indigo-400" /> Pricing Components
                </h3>

                {/* Vega / Volatility */}
                <div className="group hover:bg-white/5 p-2 rounded-lg transition-colors">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-fuchsia-400 flex items-center gap-1.5">
                            <Zap className="w-3 h-3" /> Volatility (Vega)
                        </span>
                        <span className="text-xs font-mono text-slate-300">{greeks.vega.toFixed(3)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                        The "Jitter". How much price moves for a 1% change in IV. Higher volatility expands the donut (more extrinsic value).
                    </p>
                </div>

                {/* Theta / Time */}
                <div className="group hover:bg-white/5 p-2 rounded-lg transition-colors">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" /> Time Decay (Theta)
                        </span>
                        <span className="text-xs font-mono text-slate-300">{greeks.theta.toFixed(3)}/day</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                        The "Dissolve". Value lost per day. As DTE drops, the extrinsic shell evaporates, leaving only the intrinsic core.
                    </p>
                </div>

                {/* Delta / Direction */}
                <div className="group hover:bg-white/5 p-2 rounded-lg transition-colors">
                    <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                            <TrendingUp className="w-3 h-3" /> Direction (Delta)
                        </span>
                        <span className="text-xs font-mono text-slate-300">{greeks.delta.toFixed(3)}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-snug">
                        Probability of finishing ITM. Determines the size of the Intrinsic (Green) segment.
                    </p>
                </div>
            </div>

            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2 text-indigo-300 text-xs font-bold uppercase">
                    <Info className="w-3 h-3" /> Insight
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                    {intrinsic > extrinsic 
                        ? "Deep ITM: Price is mostly Intrinsic. Low time decay risk, behaves like stock." 
                        : "OTM / ATM: Price is mostly Extrinsic (Hope). High sensitivity to Volatility and Time Decay."}
                </p>
            </div>

        </div>
    </div>
  );
};

export default OptionPricingDonut;
