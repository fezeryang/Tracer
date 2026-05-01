
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { OptionContract, OptionsChain } from '../types';
import { MousePointer2, Maximize, Zap, Layers, Activity, Calendar } from 'lucide-react';

interface VisualizerProps {
  chain: OptionsChain;
  onSelectContract?: (contract: OptionContract) => void;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  speed: number;
  offset: number; // Random starting pos
  brightness: number;
}

interface StreamData {
    particles: Particle[];
    height: number;
    contract: OptionContract;
    type: 'call' | 'put';
    xBase: number;
    zBase: number;
    colorBase: string; // hsl string base
    index: number;
}

const OptionsChainVisualizer: React.FC<VisualizerProps> = ({ chain, onSelectContract }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverData, setHoverData] = useState<{ contract: OptionContract, type: 'call' | 'put' } | null>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);
  
  // --- Configuration ---
  const MAX_HEIGHT = 280;
  const BAR_WIDTH = 34; // Wider buildings
  const BAR_DEPTH = 34; // Deeper to match
  const GAP = 12;
  const ROW_GAP = 60; // Separation between Call/Put rows
  
  // Camera Angles
  const PITCH = 0.55; // Look down angle (radians)
  const YAW = -0.15;   // Slight rotation to show depth (radians)
  
  // Custom Projector for 3D Scene
  const project = (x: number, y: number, z: number, centerX: number, centerY: number) => {
      // 1. Rotate Y (Yaw)
      const x1 = x * Math.cos(YAW) - z * Math.sin(YAW);
      const z1 = x * Math.sin(YAW) + z * Math.cos(YAW);

      // 2. Rotate X (Pitch)
      const y2 = y * Math.cos(PITCH) - z1 * Math.sin(PITCH);
      const z2 = y * Math.sin(PITCH) + z1 * Math.cos(PITCH);

      // 3. Perspective
      const perspective = 1200;
      const scale = perspective / (perspective + z2);
      
      return { 
          x: centerX + x1 * scale, 
          y: centerY - y2 * scale,
          scale: scale,
          z: z2 // Depth for sorting
      };
  };

  // --- Data Preparation ---
  const streams = useMemo(() => {
      const s: StreamData[] = [];
      if (!chain) return s;

      // Scaling Factors
      let maxOI = 0;
      let maxVol = 0;
      
      chain.calls.forEach(c => { maxOI = Math.max(maxOI, c.openInterest); maxVol = Math.max(maxVol, c.volume); });
      chain.puts.forEach(p => { maxOI = Math.max(maxOI, p.openInterest); maxVol = Math.max(maxVol, p.volume); });
      
      if (maxOI === 0) maxOI = 1;
      if (maxVol === 0) maxVol = 1;

      // Dynamic Range based on typical screen width
      // Show ~40-50 strikes to fill wide screens
      const atmIndex = chain.calls.findIndex(c => c.strike >= chain.currentPrice);
      const visibleCount = 46;
      const halfCount = Math.floor(visibleCount / 2);
      const startIndex = Math.max(0, atmIndex - halfCount);
      const endIndex = Math.min(chain.calls.length, startIndex + visibleCount);
      
      const visibleCalls = chain.calls.slice(startIndex, endIndex);
      const visiblePuts = chain.puts.slice(startIndex, endIndex);

      // Generate Streams
      visibleCalls.forEach((call, i) => {
          const put = visiblePuts[i];
          if (!call || !put) return;

          // X-position (Horizontal distribution)
          const x = (i - (visibleCalls.length / 2)) * (BAR_WIDTH + GAP);

          // CALLS (Back Row)
          const zCall = ROW_GAP; 
          
          const callHeight = Math.max(5, (call.openInterest / maxOI) * MAX_HEIGHT);
          const callDensity = Math.ceil((call.volume / maxVol) * 25);
          const callParticles: Particle[] = [];
          for(let k=0; k<callDensity; k++) {
              callParticles.push({
                  x: (Math.random() - 0.5) * (BAR_WIDTH * 0.8),
                  y: Math.random() * callHeight,
                  z: (Math.random() - 0.5) * (BAR_DEPTH * 0.8),
                  speed: 0.5 + Math.random() * 2.5,
                  offset: Math.random() * 100,
                  brightness: 0.5 + Math.random() * 0.5
              });
          }
          
          s.push({
              particles: callParticles,
              height: callHeight,
              contract: call,
              type: 'call',
              xBase: x,
              zBase: zCall,
              colorBase: '180, 100%, 50%', // Cyan
              index: i
          });

          // PUTS (Front Row)
          const zPut = -ROW_GAP - BAR_DEPTH;

          const putHeight = Math.max(5, (put.openInterest / maxOI) * MAX_HEIGHT);
          const putDensity = Math.ceil((put.volume / maxVol) * 25);
          const putParticles: Particle[] = [];
          for(let k=0; k<putDensity; k++) {
              putParticles.push({
                  x: (Math.random() - 0.5) * (BAR_WIDTH * 0.8),
                  y: Math.random() * putHeight,
                  z: (Math.random() - 0.5) * (BAR_DEPTH * 0.8),
                  speed: 0.5 + Math.random() * 2.5,
                  offset: Math.random() * 100,
                  brightness: 0.5 + Math.random() * 0.5
              });
          }

          s.push({
              particles: putParticles,
              height: putHeight,
              contract: put,
              type: 'put',
              xBase: x,
              zBase: zPut,
              colorBase: '330, 100%, 50%', // Rose
              index: i
          });
      });

      return s;
  }, [chain]);


  const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2 + 80; 

      ctx.clearRect(0, 0, width, height);

      // --- Background Grid ---
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      
      // Draw Horizon Lines
      const floorY = -5;
      const range = 2000;
      
      // Center Axis
      const pStart = project(-range, floorY, 0, centerX, centerY);
      const pEnd = project(range, floorY, 0, centerX, centerY);
      ctx.beginPath(); ctx.moveTo(pStart.x, pStart.y); ctx.lineTo(pEnd.x, pEnd.y); ctx.stroke();

      const regions: any[] = [];

      // Sort by depth (High Z is further away)
      // Since we rotate, we need to sort by the projected Z or distance
      // We calculate projected Z for the base of each stream for accurate sorting
      const sortedStreams = streams.map(s => {
          const proj = project(s.xBase, 0, s.zBase, centerX, centerY);
          return { ...s, projZ: proj.z };
      }).sort((a, b) => b.projZ - a.projZ);

      sortedStreams.forEach(stream => {
          const isHovered = hoverData && hoverData.contract.strike === stream.contract.strike && hoverData.type === stream.type;
          
          // Vertices
          const x = stream.xBase;
          const z = stream.zBase;
          const w = BAR_WIDTH;
          const d = BAR_DEPTH;
          const h = stream.height;

          // 8 Corners of the cube
          // Bottom
          const b1 = project(x, 0, z, centerX, centerY);
          const b2 = project(x + w, 0, z, centerX, centerY);
          const b3 = project(x + w, 0, z + d, centerX, centerY);
          const b4 = project(x, 0, z + d, centerX, centerY);
          
          // Top
          const t1 = project(x, h, z, centerX, centerY);
          const t2 = project(x + w, h, z, centerX, centerY);
          const t3 = project(x + w, h, z + d, centerX, centerY);
          const t4 = project(x, h, z + d, centerX, centerY);

          const baseColor = isHovered ? `hsla(${stream.colorBase}, 0.8)` : `hsla(${stream.colorBase}, 0.1)`;
          const strokeColor = isHovered ? `hsla(${stream.colorBase}, 1.0)` : `hsla(${stream.colorBase}, 0.25)`;
          const topColor = isHovered ? `hsla(${stream.colorBase}, 0.5)` : `hsla(${stream.colorBase}, 0.15)`;

          // Draw Logic: Painter's algorithm handles back-to-front
          // We draw the visible faces based on our fixed camera angle (Looking Down + Slightly Right/Left)
          // Yaw is negative (-0.15), so we see the Left side and Front/Back depending.
          // Actually, let's just draw Top, Front, Side to be safe, opacity handles the rest.

          // Back Face (b1-b2-t2-t1) - usually hidden by front, but transparent
          /*
          ctx.beginPath();
          ctx.moveTo(b1.x, b1.y); ctx.lineTo(b2.x, b2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t1.x, t1.y); ctx.closePath();
          ctx.fillStyle = `hsla(${stream.colorBase}, 0.05)`;
          ctx.fill();
          */

          // Front Face (b4-b3-t3-t4)
          ctx.beginPath();
          ctx.moveTo(b4.x, b4.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y); ctx.closePath();
          ctx.fillStyle = baseColor;
          ctx.fill();
          ctx.strokeStyle = strokeColor;
          ctx.stroke();

          // Left Side (b1-b4-t4-t1) - Visible due to negative Yaw
          ctx.beginPath();
          ctx.moveTo(b1.x, b1.y); ctx.lineTo(b4.x, b4.y); ctx.lineTo(t4.x, t4.y); ctx.lineTo(t1.x, t1.y); ctx.closePath();
          ctx.fillStyle = `hsla(${stream.colorBase}, 0.08)`;
          ctx.fill();
          ctx.stroke();

          // Right Side (b2-b3-t3-t2) - Visible if Yaw positive
          ctx.beginPath();
          ctx.moveTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t2.x, t2.y); ctx.closePath();
          ctx.fillStyle = `hsla(${stream.colorBase}, 0.08)`;
          ctx.fill();
          ctx.stroke();

          // Top Face
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y); ctx.closePath();
          ctx.fillStyle = topColor;
          ctx.fill();
          ctx.stroke();

          // Hit Region (Use a generous bounding box of the top/front)
          // We project a simplified quad for hit testing
          regions.push({
              path: [t1, t2, t3, t4, b3, b4], // Polygon points for point-in-poly check
              contract: stream.contract,
              type: stream.type,
              center: t1 // approx for distance
          });

          // Particles
          stream.particles.forEach(p => {
              // Update Logic
              const age = (timeRef.current * p.speed + p.offset) % 100;
              const yNorm = age / 100;
              
              let alpha = p.brightness;
              if (yNorm < 0.1) alpha *= yNorm * 10;
              if (yNorm > 0.8) alpha *= (1 - yNorm) * 5;

              const pp = project(
                  stream.xBase + BAR_WIDTH/2 + p.x, 
                  yNorm * stream.height, 
                  stream.zBase + BAR_DEPTH/2 + p.z, 
                  centerX, centerY
              );
              
              ctx.beginPath();
              ctx.fillStyle = `hsla(${stream.colorBase}, ${alpha})`;
              ctx.arc(pp.x, pp.y, 1.2 * pp.scale, 0, Math.PI * 2);
              ctx.fill();
          });

          // Strike Labels (Front Row - Puts)
          if (stream.type === 'put') { 
              const labelPos = project(stream.xBase + BAR_WIDTH/2, -10, stream.zBase + BAR_DEPTH + 10, centerX, centerY);
              const isAtm = Math.abs(stream.contract.strike - chain.currentPrice) < (chain.currentPrice * 0.005);
              
              if (isAtm || stream.index % 4 === 0) { 
                  ctx.textAlign = 'center';
                  ctx.fillStyle = isAtm ? '#fbbf24' : '#64748b';
                  ctx.font = isAtm ? 'bold 12px monospace' : '10px monospace';
                  ctx.fillText(stream.contract.strike.toString(), labelPos.x, labelPos.y + 20);
                  
                  if (isAtm) {
                      ctx.shadowBlur = 10;
                      ctx.shadowColor = '#fbbf24';
                      ctx.beginPath();
                      ctx.arc(labelPos.x, labelPos.y, 3, 0, Math.PI * 2);
                      ctx.fill();
                      ctx.shadowBlur = 0;
                  }
              }
          }
      });

      (canvas as any).hitRegions = regions;
  };

  const loop = () => {
      timeRef.current += 1;
      draw();
      animationRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          const ctx = canvas.getContext('2d');
          if (ctx) ctx.scale(dpr, dpr);
      }
      
      animationRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animationRef.current);
  }, [streams, hoverData]);

  // Point in Polygon Utility
  const isPointInPoly = (x: number, y: number, poly: {x:number, y:number}[]) => {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x, yi = poly[i].y;
          const xj = poly[j].x, yj = poly[j].y;
          const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
      }
      return inside;
  };

  // Interaction
  const handleMouseMove = (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const regions = (canvas as any).hitRegions || [];
      let found = null;

      // Check hit regions
      // Reverse iterate to hit frontmost first
      for (let i = regions.length - 1; i >= 0; i--) {
          const r = regions[i];
          if (isPointInPoly(x, y, r.path)) {
              found = r;
              break;
          }
      }
      
      if (found) {
          setHoverData({ contract: found.contract, type: found.type });
      } else {
          setHoverData(null);
      }
  };

  const handleClick = () => {
      if (hoverData && onSelectContract) {
          onSelectContract(hoverData.contract);
      }
  };

  return (
    <div className="relative w-full h-full bg-slate-950 rounded-xl overflow-hidden cursor-crosshair group">
        <canvas 
            ref={canvasRef} 
            className="w-full h-full block"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoverData(null)}
            onClick={handleClick}
        />
        
        {/* Fixed Info Card (Inspector) */}
        <div className="absolute top-4 right-4 w-60 bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-xl shadow-2xl pointer-events-none transition-all duration-200 min-h-[160px] flex flex-col justify-center">
            {hoverData ? (
                <>
                    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2 animate-fade-in">
                        <span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${hoverData.type === 'call' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {hoverData.type}
                        </span>
                        <span className="text-xl font-mono font-bold text-white tracking-tight">${hoverData.contract.strike}</span>
                    </div>
                    
                    <div className="space-y-3 animate-fade-in">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                <Zap className="w-3 h-3 text-white" /> Volume
                            </span>
                            <span className="text-white font-mono font-bold">{hoverData.contract.volume.toLocaleString()}</span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-slate-400 uppercase font-bold flex items-center gap-2">
                                <Layers className="w-3 h-3 text-slate-500" /> Open Int
                            </span>
                            <span className={`font-mono font-bold ${hoverData.type === 'call' ? 'text-cyan-400' : 'text-rose-400'}`}>
                                {hoverData.contract.openInterest.toLocaleString()}
                            </span>
                        </div>

                        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Premium</span>
                            <span className="text-emerald-400 font-mono text-base font-bold">${hoverData.contract.lastPrice.toFixed(2)}</span>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center text-slate-600 gap-2 opacity-60">
                    <Activity className="w-8 h-8 opacity-50" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Hover to Inspect</span>
                </div>
            )}
        </div>

        {/* Legend Overlay */}
        <div className="absolute top-4 left-4 pointer-events-none flex flex-col gap-2 bg-black/40 p-2 rounded-lg border border-white/5 backdrop-blur-sm">
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-cyan-500/20 border border-cyan-500"></div>
                <span className="text-[10px] uppercase font-bold text-cyan-400">Calls (Back Row)</span>
            </div>
            <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-rose-500/20 border border-rose-500"></div>
                <span className="text-[10px] uppercase font-bold text-rose-400">Puts (Front Row)</span>
            </div>
            {chain && (
                <div className="mt-2 pt-2 border-t border-white/10">
                    <div className="flex items-center gap-1.5 text-slate-300">
                        <Calendar className="w-3 h-3 text-indigo-400" />
                        <span className="text-[10px] font-mono font-bold">{chain.selectedExpiration}</span>
                    </div>
                </div>
            )}
        </div>
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
            <Maximize className="w-3 h-3" /> Liquidity Horizon
        </div>
    </div>
  );
};

export default OptionsChainVisualizer;
