
import React, { useRef, useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Play, RotateCcw, X, DollarSign, Clock, Briefcase, Activity, Wallet, Pause, FastForward, Rewind, Layers, Calendar, BrainCircuit, MessageSquare } from 'lucide-react';
import { createChatSession } from '../services/geminiService';

interface Position {
  type: 'CALL' | 'PUT';
  contracts: number;
  avgEntry: number;
}

interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
    time: number;
    volume: number;
    isClosed: boolean;
}

interface NewsEvent {
  time: number; // Minutes from 9:30
  headline: string;
  impact: number; // Price velocity impulse (used for visual shake)
  volatility: number; // Volatility multiplier
}

interface TradeRecord {
    time: string;
    action: 'OPEN' | 'CLOSE' | 'ADD';
    type: 'CALL' | 'PUT';
    price: number;
    pnl?: number;
}

// --- HISTORICAL DATA: SPY OCT 13 2022 (CPI REVERSAL) ---
const SPY_WAYPOINTS = [
    { min: 0, price: 350.20 },   // 9:30 Open (Gap Down)
    { min: 15, price: 349.50 },
    { min: 30, price: 348.11 },  // Low of Day (Panic)
    { min: 45, price: 350.00 },
    { min: 60, price: 353.50 },  // Reversal Start
    { min: 90, price: 356.20 },
    { min: 120, price: 359.80 }, // Squeeze
    { min: 150, price: 361.50 },
    { min: 180, price: 362.10 }, // Consolidation
    { min: 240, price: 364.80 },
    { min: 300, price: 363.50 },
    { min: 330, price: 365.20 },
    { min: 360, price: 367.90 }, // High of Day
    { min: 390, price: 366.00 }  // Close
];

const HISTORICAL_NEWS: NewsEvent[] = [
    { time: 2, headline: "BREAKING: CPI 8.2% vs 8.1% Est. Futures plummet.", impact: -2.0, volatility: 3.0 },
    { time: 30, headline: "SPY tests key 3500 support level.", impact: 0.5, volatility: 1.5 },
    { time: 55, headline: "Algo buy programs triggered off lows.", impact: 1.2, volatility: 2.0 },
    { time: 110, headline: "Sector Rotation: massive inflows into Tech.", impact: 0.8, volatility: 1.2 },
    { time: 190, headline: "VIX crushing below 32.", impact: 0.3, volatility: 0.8 },
    { time: 350, headline: "MOC Imbalance: $2.5B Buy Side.", impact: 1.0, volatility: 1.5 }
];

const OptionsRunnerGame: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Game Configuration
  const MARKET_CLOSE_MINUTES = 390; // 6.5 hours
  const CANDLE_PERIOD = 5; // 5 minute candles

  // Simulation State (Refs for loop performance)
  const state = useRef({
    isPlaying: false,
    isFinished: false,
    marketTime: 0, 
    price: 350.20,
    velocity: 0,
    volatility: 0.25, // Initial high vol
    
    // Candle System
    currentCandle: { open: 350.20, high: 350.20, low: 350.20, close: 350.20, time: 0, volume: 0, isClosed: false } as Candle,
    history: [] as Candle[],
    
    // Events
    events: [] as { time: number, text: string, priceAtEvent: number }[],
    dayEvents: HISTORICAL_NEWS,
    
    // Trading
    cash: 25000,
    position: null as Position | null,
    realizedPnL: 0,
    unrealizedPnL: 0,
    tradeLog: [] as TradeRecord[],
    
    // Visuals
    cameraZ: 0, // Camera moves along time
    cameraShake: 0,
    speedMultiplier: 1.0
  });

  // React UI State
  const [ui, setUi] = useState({
    time: "09:30",
    price: 350.20,
    cash: 25000,
    pnl: 0,
    totalPnL: 0,
    position: null as Position | null,
    isPlaying: false,
    isFinished: false,
    lastEvent: "",
    speed: 1.0
  });

  // Coaching State
  const [coachAnalysis, setCoachAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // --- Engine Logic ---

  const getTargetPrice = (min: number) => {
      // Find the two waypoints we are between
      let idx = 0;
      while(idx < SPY_WAYPOINTS.length - 1 && SPY_WAYPOINTS[idx+1].min < min) {
          idx++;
      }
      
      const p1 = SPY_WAYPOINTS[idx];
      const p2 = SPY_WAYPOINTS[Math.min(idx + 1, SPY_WAYPOINTS.length - 1)];
      
      if (p1.min === p2.min) return p1.price;

      const t = (min - p1.min) / (p2.min - p1.min);
      // Cubic ease in-out for smoother curves
      const smoothT = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      
      return p1.price + (p2.price - p1.price) * smoothT;
  };

  const startGame = () => {
      const startPrice = SPY_WAYPOINTS[0].price;
      state.current = {
          isPlaying: true,
          isFinished: false,
          marketTime: 0,
          price: startPrice,
          velocity: 0,
          volatility: 0.35, // High vol start
          currentCandle: { open: startPrice, high: startPrice, low: startPrice, close: startPrice, time: 0, volume: 0, isClosed: false },
          history: [],
          events: [],
          dayEvents: HISTORICAL_NEWS,
          cash: 25000,
          position: null,
          realizedPnL: 0,
          unrealizedPnL: 0,
          tradeLog: [],
          cameraZ: 0,
          cameraShake: 0,
          speedMultiplier: ui.speed
      };
      
      setCoachAnalysis(null);

      // Seed pre-market candles (Simulated gap down)
      let prePrice = 358.00; // Previous day high
      for(let i=-15; i<0; i++) {
          const target = 358 + (i/15) * (350 - 358); // Trend down to open
          const open = prePrice;
          const close = target + (Math.random()-0.5);
          state.current.history.push({
              open, 
              close, 
              high: Math.max(open, close) + Math.random()*0.5, 
              low: Math.min(open, close) - Math.random()*0.5, 
              time: i * CANDLE_PERIOD,
              volume: Math.random() * 1000,
              isClosed: true
          });
          prePrice = close;
      }

      setUi(prev => ({ ...prev, isPlaying: true, isFinished: false, cash: 25000, pnl: 0, totalPnL: 0, position: null }));
  };

  const getAiCoaching = async () => {
      setIsAnalyzing(true);
      try {
          const session = createChatSession();
          const s = state.current;
          
          const performanceSummary = `
            Scenario: SPY CPI Reversal (Oct 13 2022).
            Final PnL: $${ui.totalPnL.toFixed(2)}.
            Total Trades: ${s.tradeLog.length}.
            Trade Log: ${JSON.stringify(s.tradeLog)}.
            Key Events Survived: ${s.events.map(e => e.text).join(', ')}.
          `;

          const prompt = `
            You are a tough, veteran Wall Street trading coach. 
            Review my trading session on the historical "CPI Reversal Day" (Oct 13, 2022).
            
            My stats:
            ${performanceSummary}
            
            Analyze my timing. Did I panic sell the bottom? Did I FOMO the top? 
            Give me 3 specific bullet points on my psychology and execution. 
            Be concise, sharp, and use financial slang (paper hands, catching knives, theta burn).
            Conclude with a grade (A-F).
          `;

          const response = await session.sendMessage(prompt);
          setCoachAnalysis(response.text);

      } catch (e) {
          setCoachAnalysis("Coach is out to lunch. (Connection Error)");
      } finally {
          setIsAnalyzing(false);
      }
  };

  const updatePhysics = () => {
      const s = state.current;
      if (!s.isPlaying || s.isFinished) return;

      // Time Step based on Speed Control
      const dt = 0.05 * s.speedMultiplier;
      s.marketTime += dt;
      
      // Check End of Day
      if (s.marketTime >= MARKET_CLOSE_MINUTES) {
          s.isPlaying = false;
          s.isFinished = true;
          if (s.position) closePosition();
          setUi(prev => ({ ...prev, isPlaying: false, isFinished: true }));
          return;
      }

      // Check Events
      const activeEvent = s.dayEvents.find(e => Math.abs(e.time - s.marketTime) < dt);
      if (activeEvent) {
          s.volatility = Math.max(0.1, s.volatility + 0.2); // Vol spike
          s.events.push({ time: s.marketTime, text: activeEvent.headline, priceAtEvent: s.price });
          s.cameraShake = 15;
          setUi(prev => ({ ...prev, lastEvent: activeEvent.headline }));
      }

      // --- Realistic Price Physics ---
      const target = getTargetPrice(s.marketTime);
      
      // 1. Trend Component (Pull towards historical target)
      const trendPull = (target - s.price) * 0.05;
      
      // 2. Noise Component (Microstructure volatility)
      const noise = (Math.random() - 0.5) * s.volatility * Math.sqrt(s.speedMultiplier);
      
      // 3. Momentum (Velocity)
      s.velocity += trendPull * 0.1;
      s.velocity *= 0.9; // Friction
      
      s.price += s.velocity + noise;
      
      // Candle Logic
      const c = s.currentCandle;
      c.close = s.price;
      c.high = Math.max(c.high, s.price);
      c.low = Math.min(c.low, s.price);
      c.volume += Math.abs(s.velocity) * 10 + Math.abs(noise) * 50;
      c.time = s.marketTime;

      // Close Candle
      if (Math.floor(s.marketTime / CANDLE_PERIOD) > Math.floor((s.marketTime - dt) / CANDLE_PERIOD)) {
          c.isClosed = true;
          s.history.push({ ...c });
          // Reset new candle
          s.currentCandle = {
              open: s.price,
              high: s.price,
              low: s.price,
              close: s.price,
              time: s.marketTime,
              volume: 0,
              isClosed: false
          };
      }

      // Update PnL
      if (s.position) {
          const diff = s.price - s.position.avgEntry;
          const dir = s.position.type === 'CALL' ? 1 : -1;
          s.unrealizedPnL = diff * dir * s.position.contracts * 100; 
      } else {
          s.unrealizedPnL = 0;
      }

      // Shake Decay
      s.cameraShake *= 0.9;

      // Sync UI periodically
      if (Math.random() > 0.8) {
          const totalMin = 570 + s.marketTime;
          const h = Math.floor(totalMin / 60);
          const m = Math.floor(totalMin % 60);
          const timeStr = `${h}:${m.toString().padStart(2, '0')}`;

          setUi(prev => ({
              ...prev,
              time: timeStr,
              price: s.price,
              pnl: s.unrealizedPnL,
              position: s.position ? {...s.position} : null,
              totalPnL: s.realizedPnL + s.unrealizedPnL
          }));
      }
  };

  // --- 3D Render Engine ---
  const project = (x: number, y: number, z: number, width: number, height: number, camZ: number, priceCenter: number) => {
      // World: X = Time, Y = Price, Z = Depth
      const relX = (x - camZ) * 20; 
      const relY = (y - priceCenter) * 8; 
      const relZ = z; 

      const fov = 800;
      const camDist = 600;
      const angle = 0.2; 
      
      const rotY = relY; 
      const rotZ = relZ * Math.cos(angle) + relX * Math.sin(angle); 
      const rotX = relX * Math.cos(angle) - relZ * Math.sin(angle); 

      const depth = camDist + rotZ;
      if (depth < 50) return null;

      const scale = fov / depth;
      
      return {
          x: width/2 + rotX * scale,
          y: height/2 - rotY * scale,
          scale,
          depth
      };
  };

  const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const s = state.current;

      const targetCamZ = s.marketTime / CANDLE_PERIOD;
      s.cameraZ += (targetCamZ - s.cameraZ) * 0.1;
      
      // Clear
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 0, width, height);

      // --- Draw Grid ---
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      
      const basePrice = Math.floor(s.price / 5) * 5;
      for (let p = basePrice - 20; p <= basePrice + 20; p += 5) {
          const p1 = project(s.cameraZ - 10, p, -20, width, height, s.cameraZ, s.price);
          const p2 = project(s.cameraZ + 5, p, -20, width, height, s.cameraZ, s.price);
          const p3 = project(s.cameraZ + 5, p, 20, width, height, s.cameraZ, s.price);
          const p4 = project(s.cameraZ - 10, p, 20, width, height, s.cameraZ, s.price);
          
          if (p1 && p2 && p3 && p4) {
              ctx.beginPath();
              ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath();
              ctx.stroke();
              ctx.fillStyle = 'rgba(255,255,255,0.2)';
              ctx.font = '10px monospace';
              ctx.fillText(`$${p}`, p2.x + 5, p2.y);
          }
      }

      // --- Draw Candles ---
      const allCandles = [...s.history, s.currentCandle];
      const visibleCandles = allCandles.filter(c => {
          const cIdx = c.time / CANDLE_PERIOD;
          return cIdx > s.cameraZ - 15 && cIdx < s.cameraZ + 5;
      });

      visibleCandles.forEach(c => {
          const cIdx = c.time / CANDLE_PERIOD;
          const isGreen = c.close >= c.open;
          const color = isGreen ? '#10b981' : '#f43f5e';
          const colorDark = isGreen ? '#064e3b' : '#881337';

          const w = 0.3; 
          const d = 5; 
          const top = Math.max(c.open, c.close);
          const bottom = Math.min(c.open, c.close);
          
          // Wick
          const wt = project(cIdx, c.high, 0, width, height, s.cameraZ, s.price);
          const wb = project(cIdx, c.low, 0, width, height, s.cameraZ, s.price);
          
          if (wt && wb) {
              ctx.beginPath();
              ctx.moveTo(wt.x, wt.y); ctx.lineTo(wb.x, wb.y);
              ctx.strokeStyle = color;
              ctx.lineWidth = 2 * wt.scale;
              ctx.stroke();
          }

          // Body
          const f1 = project(cIdx - w, top, d, width, height, s.cameraZ, s.price);
          const f2 = project(cIdx + w, top, d, width, height, s.cameraZ, s.price);
          const f3 = project(cIdx + w, bottom, d, width, height, s.cameraZ, s.price);
          const f4 = project(cIdx - w, bottom, d, width, height, s.cameraZ, s.price);
          const s1 = project(cIdx + w, top, -d, width, height, s.cameraZ, s.price);
          const s2 = project(cIdx + w, bottom, -d, width, height, s.cameraZ, s.price);

          if (f1 && f2 && f3 && f4) {
              ctx.beginPath();
              ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y); ctx.lineTo(f3.x, f3.y); ctx.lineTo(f4.x, f4.y); ctx.closePath();
              ctx.fillStyle = color;
              ctx.fill();
              
              if (s1 && s2) {
                  ctx.beginPath();
                  ctx.moveTo(f2.x, f2.y); ctx.lineTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(f3.x, f3.y); ctx.closePath();
                  ctx.fillStyle = colorDark;
                  ctx.fill();
                  
                  ctx.beginPath();
                  ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y); ctx.lineTo(s1.x, s1.y); 
                  const backTopLeft = project(cIdx - w, top, -d, width, height, s.cameraZ, s.price);
                  if (backTopLeft) ctx.lineTo(backTopLeft.x, backTopLeft.y);
                  ctx.closePath();
                  ctx.fillStyle = isGreen ? '#34d399' : '#fb7185';
                  ctx.fill();
              }
          }

          // Event Markers
          const evt = s.events.find(e => Math.abs(e.time - c.time) < CANDLE_PERIOD/2);
          if (evt) {
              const ep = project(cIdx, evt.priceAtEvent + 5, 0, width, height, s.cameraZ, s.price);
              if (ep) {
                  ctx.fillStyle = '#fff';
                  ctx.font = 'bold 10px sans-serif';
                  ctx.textAlign = 'center';
                  ctx.fillText("NEWS", ep.x, ep.y - 12);
                  
                  ctx.beginPath();
                  ctx.moveTo(ep.x, ep.y);
                  const anchor = project(cIdx, evt.priceAtEvent, 0, width, height, s.cameraZ, s.price);
                  if (anchor) ctx.lineTo(anchor.x, anchor.y);
                  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                  ctx.lineWidth = 1;
                  ctx.stroke();
              }
          }
      });

      // --- Draw Laser Level ---
      const laserY = s.price;
      const startX = s.cameraZ - 5;
      const endX = s.cameraZ + 5;
      const l1 = project(startX, laserY, 0, width, height, s.cameraZ, s.price);
      const l2 = project(endX, laserY, 0, width, height, s.cameraZ, s.price);
      
      if (l1 && l2) {
          ctx.beginPath();
          ctx.moveTo(l1.x, l1.y);
          ctx.lineTo(l2.x, l2.y);
          ctx.strokeStyle = s.currentCandle.close >= s.currentCandle.open ? '#10b981' : '#f43f5e';
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
          
          const tip = project(s.marketTime / CANDLE_PERIOD, laserY, 0, width, height, s.cameraZ, s.price);
          if (tip) {
              const pulse = Math.sin(Date.now() / 100) * 5;
              ctx.beginPath(); ctx.arc(tip.x, tip.y, 4, 0, Math.PI*2); ctx.fillStyle = '#fff'; ctx.fill();
              ctx.beginPath(); ctx.arc(tip.x, tip.y, 10 + pulse, 0, Math.PI*2); ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.stroke();
          }
      }

      // --- Draw Position Lines ---
      if (s.position) {
          const entryY = s.position.avgEntry;
          const color = s.position.type === 'CALL' ? '#10b981' : '#f43f5e';
          const e1 = project(startX, entryY, 0, width, height, s.cameraZ, s.price);
          const e2 = project(endX, entryY, 0, width, height, s.cameraZ, s.price);
          
          if (e1 && e2) {
              ctx.beginPath(); ctx.moveTo(e1.x, e1.y); ctx.lineTo(e2.x, e2.y);
              ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
              ctx.fillStyle = color; ctx.font = 'bold 12px monospace'; ctx.textAlign = 'right';
              ctx.fillText(`${s.position.type} ENTRY`, e2.x - 10, e2.y - 5);
          }
      }
  };

  // --- Actions ---
  const handleBuy = (type: 'CALL' | 'PUT') => {
      const s = state.current;
      const premium = 2.50; 
      const cost = premium * 100;
      
      if (s.cash >= cost) {
          s.cash -= cost;
          s.tradeLog.push({
              time: `${Math.floor(s.marketTime/60) + 9}:${Math.floor(s.marketTime%60)}`,
              action: s.position ? 'ADD' : 'OPEN',
              type,
              price: s.price
          });

          if (s.position && s.position.type === type) {
              const totalUnderlying = (s.position.avgEntry * s.position.contracts) + s.price;
              s.position.contracts += 1;
              s.position.avgEntry = totalUnderlying / s.position.contracts;
          } else {
              if (s.position) closePosition(); 
              s.position = { type, contracts: 1, avgEntry: s.price };
          }
      }
  };

  const closePosition = () => {
      const s = state.current;
      if (s.position) {
          s.tradeLog.push({
              time: `${Math.floor(s.marketTime/60) + 9}:${Math.floor(s.marketTime%60)}`,
              action: 'CLOSE',
              type: s.position.type,
              price: s.price,
              pnl: s.unrealizedPnL
          });
          s.realizedPnL += s.unrealizedPnL;
          s.cash += (250 * s.position.contracts) + s.unrealizedPnL; 
          s.position = null;
          s.unrealizedPnL = 0;
      }
  };

  const adjustSpeed = (val: number) => {
      state.current.speedMultiplier = val;
      setUi(prev => ({ ...prev, speed: val }));
  };

  // Loop
  useEffect(() => {
      let frameId: number;
      const loop = () => {
          updatePhysics();
          draw();
          frameId = requestAnimationFrame(loop);
      };
      frameId = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(frameId);
  }, []);

  // Resize
  useEffect(() => {
      if (canvasRef.current && containerRef.current) {
          canvasRef.current.width = containerRef.current.clientWidth;
          canvasRef.current.height = containerRef.current.clientHeight;
      }
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-[600px] bg-slate-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl group select-none">
        <canvas ref={canvasRef} className="w-full h-full block" />

        {/* --- START SCREEN --- */}
        {!ui.isPlaying && !ui.isFinished && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md z-50">
                <div className="text-center space-y-6 max-w-lg">
                    <h1 className="text-5xl font-black text-white tracking-tighter mb-2">PRO TRADER SIM</h1>
                    <div className="flex items-center justify-center gap-2 text-indigo-400 font-bold uppercase tracking-widest text-xs mb-4">
                        <Calendar className="w-4 h-4" /> Historical Replay: Oct 13, 2022 (CPI)
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-left bg-slate-900/50 p-6 rounded-2xl border border-white/10">
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-400 text-sm font-bold uppercase"><Clock className="w-4 h-4"/> Time</div>
                            <div className="text-white font-mono">09:30 - 16:00</div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-slate-400 text-sm font-bold uppercase"><Wallet className="w-4 h-4"/> Capital</div>
                            <div className="text-white font-mono">$25,000</div>
                        </div>
                        <div className="col-span-2 text-xs text-slate-500 mt-2 border-t border-white/5 pt-2">
                            The "CPI Reversal" Day. Market gaps down on hot inflation data. Can you trade the volatility?
                        </div>
                    </div>
                    <button 
                        onClick={startGame}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl text-lg tracking-widest shadow-[0_0_30px_rgba(79,70,229,0.4)] transition-all hover:scale-[1.02]"
                    >
                        INITIATE SESSION
                    </button>
                </div>
            </div>
        )}

        {/* --- GAME OVER --- */}
        {ui.isFinished && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-50">
                <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl text-center max-w-lg w-full shadow-2xl">
                    <h2 className="text-3xl font-black text-white mb-6">MARKET CLOSED</h2>
                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between items-center text-slate-400 text-sm">
                            <span>Final P&L</span>
                            <span className={`font-mono text-xl font-bold ${ui.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {ui.totalPnL >= 0 ? '+' : ''}${Math.floor(ui.totalPnL).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-slate-400 text-sm">
                            <span>Ending Balance</span>
                            <span className="font-mono text-white font-bold">${Math.floor(ui.cash + ui.totalPnL).toLocaleString()}</span>
                        </div>
                    </div>

                    {coachAnalysis ? (
                        <div className="text-left bg-indigo-900/30 p-4 rounded-xl border border-indigo-500/30 mb-6 max-h-48 overflow-y-auto">
                            <div className="flex items-center gap-2 mb-2 text-indigo-300 font-bold uppercase text-xs">
                                <BrainCircuit className="w-4 h-4" /> AI Performance Coach
                            </div>
                            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{coachAnalysis}</p>
                        </div>
                    ) : (
                        <button 
                            onClick={getAiCoaching}
                            disabled={isAnalyzing}
                            className="w-full py-3 mb-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20"
                        >
                            {isAnalyzing ? <Activity className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
                            {isAnalyzing ? 'Analyzing Tape...' : 'Generate AI Performance Coach'}
                        </button>
                    )}

                    <button onClick={startGame} className="w-full py-3 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors">
                        <RotateCcw className="w-4 h-4" /> Replay Session
                    </button>
                </div>
            </div>
        )}

        {/* --- HUD --- */}
        <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur border border-white/10 px-4 py-2 rounded-xl flex items-center gap-4">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" />
                    <span className="font-mono font-bold text-xl text-white tracking-widest">{ui.time}</span>
                </div>
                <div className="h-6 w-px bg-white/10"></div>
                <div className="flex items-center gap-2">
                    <span className="text-slate-400 font-bold">SPY</span>
                    <span className="font-mono font-bold text-white">${ui.price.toFixed(2)}</span>
                </div>
            </div>

            {/* Speed Control (Pointer Events Auto) */}
            <div className="pointer-events-auto bg-slate-900/80 backdrop-blur border border-white/10 px-2 py-1 rounded-xl flex items-center gap-1">
                <button onClick={() => adjustSpeed(0)} className={`p-2 rounded hover:bg-white/10 ${ui.speed === 0 ? 'text-rose-400' : 'text-slate-400'}`}><Pause className="w-4 h-4"/></button>
                <button onClick={() => adjustSpeed(0.5)} className={`p-2 rounded hover:bg-white/10 ${ui.speed === 0.5 ? 'text-indigo-400' : 'text-slate-400'}`}><Play className="w-4 h-4"/></button>
                <button onClick={() => adjustSpeed(2.0)} className={`p-2 rounded hover:bg-white/10 ${ui.speed === 2.0 ? 'text-emerald-400' : 'text-slate-400'}`}><FastForward className="w-4 h-4"/></button>
                <div className="text-[10px] font-mono text-slate-500 w-8 text-center">{ui.speed}x</div>
            </div>

            <div className={`bg-slate-900/80 backdrop-blur border px-6 py-2 rounded-xl flex flex-col items-end ${ui.totalPnL >= 0 ? 'border-emerald-500/30' : 'border-rose-500/30'}`}>
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Session P&L</span>
                <span className={`font-mono text-2xl font-black ${ui.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {ui.totalPnL >= 0 ? '+' : ''}${Math.floor(ui.totalPnL).toLocaleString()}
                </span>
            </div>
        </div>

        {/* News Ticker */}
        {ui.lastEvent && (
            <div className="absolute top-24 left-1/2 -translate-x-1/2 animate-bounce-slight pointer-events-none">
                <div className="bg-slate-800/90 text-white px-4 py-2 rounded-lg border border-white/10 shadow-xl flex items-center gap-3">
                    <Activity className="w-4 h-4 text-indigo-400 animate-pulse" />
                    <span className="font-bold text-sm tracking-wide">{ui.lastEvent}</span>
                </div>
            </div>
        )}

        {/* Trading Desk */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-end gap-3 pointer-events-auto">
            <button 
                onClick={() => handleBuy('CALL')}
                className="group w-28 h-24 bg-emerald-600/10 hover:bg-emerald-600/20 border border-emerald-500/30 hover:border-emerald-400 rounded-xl backdrop-blur-md flex flex-col items-center justify-center transition-all active:scale-95"
            >
                <TrendingUp className="w-6 h-6 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-emerald-100">BUY CALL</span>
                <span className="text-[9px] text-emerald-500/70 mt-1">Bullish</span>
                {ui.position?.type === 'CALL' && (
                    <div className="absolute -top-2 -right-2 bg-emerald-500 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-lg">
                        {ui.position.contracts}
                    </div>
                )}
            </button>

            <div className="w-32 h-24 flex items-center justify-center">
                {ui.position ? (
                    <button 
                        onClick={closePosition}
                        className="w-full h-16 bg-slate-800 hover:bg-slate-700 border border-white/20 hover:border-white/40 rounded-xl flex flex-col items-center justify-center shadow-lg transition-all active:scale-95"
                    >
                        <span className="text-[10px] text-slate-400 font-bold uppercase mb-1">Unrealized</span>
                        <span className={`font-mono text-lg font-bold ${ui.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {ui.pnl >= 0 ? '+' : ''}${Math.floor(ui.pnl)}
                        </span>
                        <span className="text-[9px] text-slate-500 mt-1">CLICK TO CLOSE</span>
                    </button>
                ) : (
                    <div className="text-center opacity-30">
                        <Briefcase className="w-6 h-6 mx-auto mb-1" />
                        <span className="text-[10px] font-bold uppercase">No Position</span>
                    </div>
                )}
            </div>

            <button 
                onClick={() => handleBuy('PUT')}
                className="group w-28 h-24 bg-rose-600/10 hover:bg-rose-600/20 border border-rose-500/30 hover:border-rose-400 rounded-xl backdrop-blur-md flex flex-col items-center justify-center transition-all active:scale-95"
            >
                <TrendingDown className="w-6 h-6 text-rose-400 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-rose-100">BUY PUT</span>
                <span className="text-[9px] text-rose-500/70 mt-1">Bearish</span>
                {ui.position?.type === 'PUT' && (
                    <div className="absolute -top-2 -right-2 bg-rose-500 text-slate-900 w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shadow-lg">
                        {ui.position.contracts}
                    </div>
                )}
            </button>
        </div>
    </div>
  );
};

export default OptionsRunnerGame;
