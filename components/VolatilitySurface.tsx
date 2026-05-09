
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { calculateBlackScholes, calculateHestonPrice } from '../services/marketDataService';
import { OptionsChain } from '../types';
import { Maximize, Eye, Info, DollarSign, Target, Pause, Play, ScanLine, Crosshair, Settings2, Move3d, MousePointer2, Grid3X3, Clock, TrendingUp, RefreshCw } from 'lucide-react';

interface Point3D {
  x: number;
  y: number;
  z: number;
  price: number;
  spot: number;
  time: number;
}

interface Particle {
    x: number;
    y: number;
    z: number;
    speed: number;
    size: number;
    alpha: number;
}

interface SurfaceProps {
  volatility: number;
  riskFreeRate: number;
  isCall: boolean;
  strikePrice?: number;
  chain?: OptionsChain;
}

const VolatilitySurface: React.FC<SurfaceProps> = ({ volatility, riskFreeRate, isCall, strikePrice = 100, chain }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Camera & Interaction State
  const [camera, setCamera] = useState({ yaw: 0.6, pitch: 0.5 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [interactionMode, setInteractionMode] = useState<'ORBIT' | 'SCAN'>('ORBIT');
  
  // Animation State
  const [isScanning, setIsScanning] = useState(true);
  const [scanPos, setScanPos] = useState({ x: 0.5, z: 0.5 }); 
  
  // View Modes
  const [showPnL, setShowPnL] = useState(false);
  const [showGuides, setShowGuides] = useState(true);
  const [pricingModel, setPricingModel] = useState<'BS' | 'HESTON'>('BS');
  
  // Mesh State (Async)
  const [mesh, setMesh] = useState<Point3D[][]>([]);
  const [isMeshReady, setIsMeshReady] = useState(false);
  
  // Heston Parameters
  const [hestonParams, setHestonParams] = useState({
      v0: volatility * volatility,
      theta: volatility * volatility,
      kappa: 1.5,
      xi: 0.3,
      rho: -0.3
  });

  // Data for HUD
  const [hudData, setHudData] = useState<{price: number, pnl: number, spot: number, daysLeft: number} | null>(null);

  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  // Initialize Particles
  useEffect(() => {
      const p: Particle[] = [];
      for(let i=0; i<60; i++) {
          p.push({
              x: (Math.random() - 0.5) * 5,
              y: (Math.random() - 0.5) * 4 - 1,
              z: (Math.random() - 0.5) * 5,
              speed: 0.001 + Math.random() * 0.004,
              size: Math.random() * 2.0,
              alpha: Math.random() * 0.4
          });
      }
      particlesRef.current = p;
  }, []);

  // Sync Params
  useEffect(() => {
     if (pricingModel === 'BS') {
         setHestonParams(prev => ({
             ...prev,
             v0: volatility * volatility,
             theta: volatility * volatility
         }));
     }
  }, [volatility, pricingModel]);

  // Constants
  const GRID_RES = 16; // Optimized resolution for performance
  const SPOT_RANGE = { min: strikePrice * 0.6, max: strikePrice * 1.4 };
  const TIME_RANGE = { min: 0.02, max: 1.0 }; 

  // --- ASYNC MESH GENERATION ---
  // Moved out of useMemo to prevent main thread blocking during heavy calc
  useEffect(() => {
      let isCancelled = false;
      
      const generateMesh = async () => {
          setIsMeshReady(false);
          
          // Yield to main thread to allow UI updates (e.g. slider movement) to render first
          await new Promise(resolve => setTimeout(resolve, 10));
          
          if (isCancelled) return;

          const m: Point3D[][] = [];
          const heightScale = Math.max(1, strikePrice * 0.4); // Avoid div by zero
          
          for (let i = 0; i <= GRID_RES; i++) {
            const row: Point3D[] = [];
            const tNorm = i / GRID_RES;
            const t = TIME_RANGE.min + (TIME_RANGE.max - TIME_RANGE.min) * tNorm;
            
            for (let j = 0; j <= GRID_RES; j++) {
              const sNorm = j / GRID_RES;
              const s = SPOT_RANGE.min + (SPOT_RANGE.max - SPOT_RANGE.min) * sNorm;
              
              let price = 0;
              try {
                  if (pricingModel === 'BS') {
                      price = calculateBlackScholes(isCall ? 'call' : 'put', s, strikePrice, t, riskFreeRate, volatility);
                  } else {
                      price = calculateHestonPrice(isCall ? 'call' : 'put', s, strikePrice, t, riskFreeRate, hestonParams.v0, hestonParams.theta, hestonParams.kappa, hestonParams.xi, hestonParams.rho);
                  }
              } catch (e) {
                  price = 0;
              }

              if (isNaN(price) || !isFinite(price)) price = 0;

              row.push({
                  x: (sNorm - 0.5) * 2.5, 
                  y: (price / heightScale) - 0.5,
                  z: (tNorm - 0.5) * 2.5,
                  price,
                  spot: s,
                  time: t
              });
            }
            m.push(row);
          }
          
          if (!isCancelled) {
              setMesh(m);
              setIsMeshReady(true);
          }
      };

      generateMesh();

      return () => { isCancelled = true; };
  }, [pricingModel, volatility, riskFreeRate, isCall, strikePrice, hestonParams]);

  // Calculate Entry Price (Cost Basis) for PnL
  const entryPrice = useMemo(() => {
      let price = 0;
      if (pricingModel === 'BS') {
          price = calculateBlackScholes(isCall ? 'call' : 'put', strikePrice, strikePrice, TIME_RANGE.max, riskFreeRate, volatility);
      } else {
          price = calculateHestonPrice(isCall ? 'call' : 'put', strikePrice, strikePrice, TIME_RANGE.max, riskFreeRate, hestonParams.v0, hestonParams.theta, hestonParams.kappa, hestonParams.xi, hestonParams.rho);
      }
      return isNaN(price) ? 0 : price;
  }, [volatility, riskFreeRate, isCall, strikePrice, hestonParams, pricingModel]);

  // --- 3D Projection Engine ---
  const project = (p: Point3D, width: number, height: number, yaw: number, pitch: number) => {
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);

    // Rotate Y (Yaw)
    const x1 = p.x * cosYaw - p.z * sinYaw;
    const z1 = p.x * sinYaw + p.z * cosYaw;

    // Rotate X (Pitch)
    const y2 = p.y * cosPitch - z1 * sinPitch;
    const z2 = p.y * sinPitch + z1 * cosPitch;

    // Perspective
    const fov = 700;
    const distance = 4.5;
    
    // Z-Clipping
    if (z2 + distance < 0.1) return null;

    const scale = fov / (distance + z2);
    const x2d = x1 * scale + width / 2;
    const y2d = -y2 * scale + height / 2; // Invert Y

    return { x: x2d, y: y2d, scale, z: z2 };
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false }); // Optimization
    if (!ctx) return;

    const width = canvas.width / (window.devicePixelRatio || 1); // Logical width
    const height = canvas.height / (window.devicePixelRatio || 1); // Logical height

    ctx.clearRect(0, 0, width, height);
    
    // Background Gradient
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#020617');
    bgGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // --- Draw Particles ---
    particlesRef.current.forEach(p => {
        const proj = project({ x: p.x, y: p.y, z: p.z, price: 0, spot: 0, time: 0 }, width, height, camera.yaw, camera.pitch);
        if (proj) {
            ctx.beginPath();
            ctx.fillStyle = `rgba(99, 102, 241, ${p.alpha})`; // Indigo
            ctx.arc(proj.x, proj.y, p.size * (proj.scale/100), 0, Math.PI * 2);
            ctx.fill();
        }
        // Animate
        p.y += p.speed;
        if (p.y > 2) p.y = -2;
    });

    // --- Draw Grid Floor ---
    const floorY = -0.55;
    if (showGuides) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        const range = 2.0;
        const steps = 8;
        
        // Z-lines
        for(let i=-steps; i<=steps; i++) {
            const x = (i/steps) * range;
            const p1 = project({x, y: floorY, z: -range, price:0, spot:0, time:0}, width, height, camera.yaw, camera.pitch);
            const p2 = project({x, y: floorY, z: range, price:0, spot:0, time:0}, width, height, camera.yaw, camera.pitch);
            if(p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
        // X-lines
        for(let i=-steps; i<=steps; i++) {
            const z = (i/steps) * range;
            const p1 = project({x: -range, y: floorY, z, price:0, spot:0, time:0}, width, height, camera.yaw, camera.pitch);
            const p2 = project({x: range, y: floorY, z, price:0, spot:0, time:0}, width, height, camera.yaw, camera.pitch);
            if(p1 && p2) {
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();
            }
        }
    }

    if (!isMeshReady || mesh.length === 0) return;

    // --- Draw Surface Mesh ---
    ctx.shadowBlur = 10;
    ctx.lineJoin = 'round';

    for (let i = 0; i < mesh.length; i++) {
        for (let j = 0; j < mesh[i].length; j++) {
            const p = mesh[i][j];
            const pp = project(p, width, height, camera.yaw, camera.pitch);
            if (!pp) continue;

            // Determine Color
            let strokeStyle = '';
            let shadowColor = '';
            
            if (showPnL) {
                const pnl = p.price - entryPrice;
                if (pnl >= 0) {
                    strokeStyle = `rgba(16, 185, 129, 0.5)`;
                    shadowColor = '#10b981';
                } else {
                    strokeStyle = `rgba(244, 63, 94, 0.5)`;
                    shadowColor = '#f43f5e';
                }
            } else {
                // Neon Aesthetic
                const normalizedH = Math.max(0, Math.min(1, p.y + 0.5)); 
                const hue = 240 - (normalizedH * 60); // Blue to Cyan
                const light = 50 + (normalizedH * 40);
                strokeStyle = `hsla(${hue}, 80%, ${light}%, 0.4)`;
                shadowColor = `hsla(${hue}, 80%, 50%, 0.8)`;
            }

            ctx.shadowColor = shadowColor;
            ctx.strokeStyle = strokeStyle;
            ctx.lineWidth = 1.5;

            // Scanner Highlight
            const isScannedRow = i === Math.floor(scanPos.z * GRID_RES);
            const isScannedCol = j === Math.floor(scanPos.x * GRID_RES);
            
            if (isScannedRow || isScannedCol) {
                ctx.strokeStyle = '#ffffff';
                ctx.shadowColor = '#ffffff';
                ctx.lineWidth = 2;
                ctx.shadowBlur = 20;
            }

            // Draw X-segments
            if (j < mesh[i].length - 1) {
                const right = mesh[i][j+1];
                const pr = project(right, width, height, camera.yaw, camera.pitch);
                if (pr) {
                    ctx.beginPath();
                    ctx.moveTo(pp.x, pp.y);
                    ctx.lineTo(pr.x, pr.y);
                    ctx.stroke();
                }
            }
            // Draw Z-segments
            if (i < mesh.length - 1) {
                const bottom = mesh[i+1][j];
                const pb = project(bottom, width, height, camera.yaw, camera.pitch);
                if (pb) {
                    ctx.beginPath();
                    ctx.moveTo(pp.x, pp.y);
                    ctx.lineTo(pb.x, pb.y);
                    ctx.stroke();
                }
            }
        }
    }
    
    ctx.shadowBlur = 0;

    // --- Draw Scanner Target & Drop Lines ---
    const sZ = Math.floor(scanPos.z * GRID_RES);
    const sX = Math.floor(scanPos.x * GRID_RES);
    
    if (sZ < mesh.length && sX < mesh[0].length) {
        const scanPoint = mesh[sZ][sX];
        const projScan = project(scanPoint, width, height, camera.yaw, camera.pitch);
        
        if (projScan) {
            // Drop Line to Floor
            const projFloor = project({ ...scanPoint, y: floorY }, width, height, camera.yaw, camera.pitch);
            
            if (projFloor) {
                // Main Drop
                const grad = ctx.createLinearGradient(projScan.x, projScan.y, projFloor.x, projFloor.y);
                grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
                grad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
                
                ctx.beginPath();
                ctx.moveTo(projScan.x, projScan.y);
                ctx.lineTo(projFloor.x, projFloor.y);
                ctx.strokeStyle = grad;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([2, 2]);
                ctx.stroke();
                ctx.setLineDash([]);

                // --- AXIS DROP LINES ---
                const zEdge = 1.25; 
                const projSpotAxis = project({ ...scanPoint, y: floorY, z: zEdge }, width, height, camera.yaw, camera.pitch);
                
                if (projSpotAxis) {
                    ctx.beginPath();
                    ctx.moveTo(projFloor.x, projFloor.y);
                    ctx.lineTo(projSpotAxis.x, projSpotAxis.y);
                    ctx.strokeStyle = 'rgba(251, 191, 36, 0.4)'; // Amber
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
                    ctx.fillRect(projSpotAxis.x - 20, projSpotAxis.y - 10, 40, 20);
                    
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#fbbf24';
                    ctx.font = 'bold 10px monospace';
                    ctx.fillText(`$${scanPoint.spot.toFixed(0)}`, projSpotAxis.x, projSpotAxis.y);
                }

                const xEdge = -1.25;
                const projTimeAxis = project({ ...scanPoint, y: floorY, x: xEdge }, width, height, camera.yaw, camera.pitch);
                
                if (projTimeAxis) {
                    ctx.beginPath();
                    ctx.moveTo(projFloor.x, projFloor.y);
                    ctx.lineTo(projTimeAxis.x, projTimeAxis.y);
                    ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)'; // Cyan
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(2, 6, 23, 0.8)';
                    ctx.fillRect(projTimeAxis.x - 20, projTimeAxis.y - 10, 40, 20);

                    ctx.fillStyle = '#22d3ee';
                    ctx.font = 'bold 10px monospace';
                    ctx.fillText(`${(scanPoint.time * 365).toFixed(0)}d`, projTimeAxis.x, projTimeAxis.y);
                }
                
                ctx.beginPath();
                ctx.arc(projFloor.x, projFloor.y, 3, 0, Math.PI * 2);
                ctx.fillStyle = '#ffffff';
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(projScan.x, projScan.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            
            const pulse = (Math.sin(timeRef.current * 8) + 1) * 0.5;
            ctx.beginPath();
            ctx.arc(projScan.x, projScan.y, 8 + pulse * 8, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 - pulse * 0.5})`;
            ctx.lineWidth = 1;
            ctx.stroke();

            const pnl = scanPoint.price - entryPrice;
            const labelX = projScan.x + 30;
            const labelY = projScan.y - 30;
            
            ctx.beginPath();
            ctx.moveTo(projScan.x, projScan.y);
            ctx.lineTo(labelX, labelY + 12);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
            ctx.beginPath();
            // Fallback for Firefox/Older browsers
            if (ctx.roundRect) ctx.roundRect(labelX, labelY - 20, 80, 40, 6);
            else ctx.rect(labelX, labelY - 20, 80, 40);
            
            ctx.fill();
            ctx.strokeStyle = pnl >= 0 ? '#10b981' : '#f43f5e';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 12px monospace';
            ctx.fillText(`$${scanPoint.price.toFixed(2)}`, labelX + 8, labelY - 2);
            
            ctx.font = '10px monospace';
            ctx.fillStyle = pnl >= 0 ? '#34d399' : '#fb7185';
            ctx.fillText(`P/L ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`, labelX + 8, labelY + 12);
        }
    }
  };

  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (interactionMode === 'ORBIT' && isDragging) {
          const deltaX = e.clientX - lastMouse.x;
          const deltaY = e.clientY - lastMouse.y;
          setCamera(prev => ({
              yaw: prev.yaw + deltaX * 0.005,
              pitch: Math.max(0.1, Math.min(Math.PI / 2, prev.pitch + deltaY * 0.005))
          }));
          setLastMouse({ x: e.clientX, y: e.clientY });
      } else if (interactionMode === 'SCAN' && isDragging) {
          const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
          const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
          
          setScanPos({ x: x, z: y });
          setIsScanning(false);
          setLastMouse({ x: e.clientX, y: e.clientY });
      }
  };

  const handleMouseUp = () => setIsDragging(false);

  // Animation Loop
  useEffect(() => {
    const loop = () => {
        timeRef.current += 0.01;
        
        if (!isDragging && interactionMode === 'ORBIT') {
            setCamera(prev => ({ ...prev, yaw: prev.yaw + 0.0005 }));
        }

        if (isScanning) {
            setScanPos({
                x: 0.5 + Math.sin(timeRef.current * 0.5) * 0.4, 
                z: 0.5 + Math.cos(timeRef.current * 0.3) * 0.4  
            });
        }
        draw();
        animationRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(animationRef.current);
  }, [isScanning, mesh, showPnL, showGuides, camera, isDragging, interactionMode, isMeshReady]); 

  // Sync HUD
  useEffect(() => {
      if (!mesh || mesh.length === 0) return;
      const xIdx = Math.floor(scanPos.x * GRID_RES);
      const zIdx = Math.floor(scanPos.z * GRID_RES);
      if (zIdx < mesh.length && xIdx < mesh[0].length) {
          const p = mesh[zIdx][xIdx];
          setHudData({
              price: p.price,
              pnl: p.price - entryPrice,
              spot: p.spot,
              daysLeft: Math.floor(p.time * 365)
          });
      }
  }, [scanPos, mesh, entryPrice]);

  // Adjust canvas size for DPI
  useEffect(() => {
      const resize = () => {
          const canvas = canvasRef.current;
          const container = containerRef.current;
          if (canvas && container) {
              const dpr = window.devicePixelRatio || 1;
              canvas.width = container.clientWidth * dpr;
              canvas.height = container.clientHeight * dpr;
              const ctx = canvas.getContext('2d');
              if (ctx) ctx.scale(dpr, dpr);
          }
      };
      
      const observer = new ResizeObserver(resize);
      if (containerRef.current) observer.observe(containerRef.current);
      resize(); // Initial
      
      return () => observer.disconnect();
  }, []);

  return (
    <div 
        ref={containerRef}
        className="relative w-full h-full bg-slate-950/80 rounded-xl overflow-hidden border border-white/5 shadow-inner group select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
        {!isMeshReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-2">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                    <span className="text-xs text-white font-bold uppercase tracking-wider">Generating Surface...</span>
                </div>
            </div>
        )}

        <canvas 
            ref={canvasRef} 
            className={`w-full h-full object-cover ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ width: '100%', height: '100%' }}
        />
        
        {/* Top-Right: Interaction Mode Toggle */}
        <div className="absolute top-4 right-4 flex gap-2 pointer-events-auto z-10">
             <button 
                onClick={() => setInteractionMode('ORBIT')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${interactionMode === 'ORBIT' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'}`}
             >
                 <Move3d className="w-3.5 h-3.5" /> Orbit
             </button>
             <button 
                onClick={() => setInteractionMode('SCAN')}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold transition-all ${interactionMode === 'SCAN' ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg' : 'bg-black/40 border-white/10 text-slate-400 hover:text-white'}`}
             >
                 <Crosshair className="w-3.5 h-3.5" /> Scan
             </button>
        </div>

        {/* Top-Left: Model Controls */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-auto z-10">
             <div className="bg-black/60 backdrop-blur-md p-3 rounded-xl border border-white/10 w-56 shadow-2xl">
                <div className="flex justify-between items-center mb-3">
                    <h4 className="text-white font-bold text-xs flex items-center gap-2">
                        <Settings2 className="w-3 h-3 text-indigo-400" /> Model
                    </h4>
                    <div className="flex bg-slate-900 rounded p-0.5 border border-white/10">
                        <button 
                            onClick={() => setPricingModel('BS')} 
                            className={`text-[9px] px-2 py-0.5 rounded font-bold transition-colors ${pricingModel === 'BS' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >BS</button>
                        <button 
                            onClick={() => setPricingModel('HESTON')} 
                            className={`text-[9px] px-2 py-0.5 rounded font-bold transition-colors ${pricingModel === 'HESTON' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                        >HESTON</button>
                    </div>
                </div>

                {pricingModel === 'HESTON' ? (
                    <div className="space-y-3 animate-fade-in">
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-slate-500">
                                <span>Mean Reversion (κ)</span> <span className="text-indigo-300">{hestonParams.kappa.toFixed(1)}</span>
                            </div>
                            <input type="range" min="0.1" max="5" step="0.1" value={hestonParams.kappa} onChange={e => setHestonParams(p => ({...p, kappa: Number(e.target.value)}))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-400" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-slate-500">
                                <span>Vol of Vol (ξ)</span> <span className="text-rose-300">{hestonParams.xi.toFixed(2)}</span>
                            </div>
                            <input type="range" min="0.01" max="1" step="0.05" value={hestonParams.xi} onChange={e => setHestonParams(p => ({...p, xi: Number(e.target.value)}))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[9px] uppercase font-bold text-slate-500">
                                <span>Correlation (ρ)</span> <span className="text-amber-300">{hestonParams.rho.toFixed(2)}</span>
                            </div>
                            <input type="range" min="-0.99" max="0.99" step="0.05" value={hestonParams.rho} onChange={e => setHestonParams(p => ({...p, rho: Number(e.target.value)}))} className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400" />
                        </div>
                    </div>
                ) : (
                     <div className="p-2 bg-slate-800/50 border border-white/5 rounded text-[9px] text-slate-400 leading-tight">
                        <div className="mb-1 text-slate-500 uppercase font-bold">Standard Model</div>
                        Constant Volatility: <span className="text-white font-mono font-bold">{(volatility * 100).toFixed(1)}%</span>
                     </div>
                )}
             </div>
        </div>
        
        {/* Bottom Toolbar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md p-1.5 rounded-xl border border-white/10 shadow-lg pointer-events-auto z-10">
            <button 
                onClick={() => setIsScanning(!isScanning)}
                className={`p-2 rounded-lg transition-colors ${isScanning ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                title={isScanning ? "Pause Auto-Scan" : "Play Auto-Scan"}
            >
                {isScanning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <div className="w-px h-4 bg-white/10"></div>
            <button 
                onClick={() => setShowPnL(!showPnL)}
                className={`p-2 rounded-lg transition-colors ${showPnL ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                title="Toggle PnL Heatmap"
            >
                <DollarSign className="w-4 h-4" />
            </button>
            <button 
                onClick={() => setShowGuides(!showGuides)}
                className={`p-2 rounded-lg transition-colors ${showGuides ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                title="Toggle Grid Lines"
            >
                <Grid3X3 className="w-4 h-4" />
            </button>
        </div>
        
        {/* Status Text */}
        <div className="absolute bottom-4 right-4 text-[9px] text-slate-500 font-bold uppercase tracking-widest pointer-events-none opacity-50 z-10">
            {interactionMode === 'ORBIT' ? 'Drag to Rotate' : 'Drag to Scan'}
        </div>

        {/* Live Chain Badge */}
        {chain && !chain.isSynthetic && (
          <div className="absolute bottom-4 left-4 pointer-events-none z-10">
            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold text-emerald-300 border border-emerald-500/30">
              Live Chain
            </span>
          </div>
        )}
    </div>
  );
};

export default VolatilitySurface;
