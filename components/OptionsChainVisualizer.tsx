import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { OptionContract, OptionsChain } from '../types';
import { Maximize, Zap, Layers, Activity, Calendar, RotateCcw } from 'lucide-react';

interface VisualizerProps {
  chain: OptionsChain;
  onSelectContract?: (contract: OptionContract) => void;
}

interface Particle {
  x: number;
  y: number;
  z: number;
  speed: number;
  offset: number;
  brightness: number;
}

interface StreamData {
    particles: Particle[];
    height: number;
    contract: OptionContract;
    type: 'call' | 'put';
    xBase: number;
    zBase: number;
    colorBase: string;
    index: number;
}

const OptionsChainVisualizer: React.FC<VisualizerProps> = ({ chain, onSelectContract }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverData, setHoverData] = useState<{ contract: OptionContract, type: 'call' | 'put' } | null>(null);
  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // Camera state with refs for animation loop access
  const [yaw, setYaw] = useState(-0.15);
  const [pitch, setPitch] = useState(0.55);
  const [zoom, setZoom] = useState(1200);
  const yawRef = useRef(yaw);
  const pitchRef = useRef(pitch);
  const zoomRef = useRef(zoom);
  useEffect(() => { yawRef.current = yaw; }, [yaw]);
  useEffect(() => { pitchRef.current = pitch; }, [pitch]);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);

  // Drag state
  const dragRef = useRef({ active: false, lastX: 0, lastY: 0 });
  const hoverDataRef = useRef(hoverData);
  useEffect(() => { hoverDataRef.current = hoverData; }, [hoverData]);

  // Configuration
  const MAX_HEIGHT = 280;
  const BAR_WIDTH = 34;
  const BAR_DEPTH = 34;
  const GAP = 12;
  const ROW_GAP = 60;

  // Canvas size ref for dynamic strike count
  const canvasSizeRef = useRef({ width: 800, height: 600 });

  const project = useCallback((x: number, y: number, z: number, centerX: number, centerY: number) => {
      const yVal = yawRef.current;
      const pVal = pitchRef.current;
      const zVal = zoomRef.current;

      const x1 = x * Math.cos(yVal) - z * Math.sin(yVal);
      const z1 = x * Math.sin(yVal) + z * Math.cos(yVal);
      const y2 = y * Math.cos(pVal) - z1 * Math.sin(pVal);
      const z2 = y * Math.sin(pVal) + z1 * Math.cos(pVal);
      const scale = zVal / (zVal + z2);

      return {
          x: centerX + x1 * scale,
          y: centerY - y2 * scale,
          scale: scale,
          z: z2
      };
  }, []);

  // Streams data (uses dynamic visible count from canvas width)
  const streams = useMemo(() => {
      const s: StreamData[] = [];
      if (!chain) return s;

      let maxOI = 0;
      let maxVol = 0;

      chain.calls.forEach(c => { maxOI = Math.max(maxOI, c.openInterest); maxVol = Math.max(maxVol, c.volume); });
      chain.puts.forEach(p => { maxOI = Math.max(maxOI, p.openInterest); maxVol = Math.max(maxVol, p.volume); });

      if (maxOI === 0) maxOI = 1;
      if (maxVol === 0) maxVol = 1;

      const canvasWidth = canvasSizeRef.current.width || 800;
      const visibleCount = Math.max(10, Math.floor(canvasWidth / (BAR_WIDTH + GAP)));

      const atmIndex = chain.calls.findIndex(c => c.strike >= chain.currentPrice);
      const startIdx = Math.max(0, Math.min(atmIndex - Math.floor(visibleCount / 2), chain.calls.length - visibleCount));
      const endIndex = Math.min(chain.calls.length, startIdx + visibleCount);

      const visibleCalls = chain.calls.slice(startIdx, endIndex);
      const visiblePuts = chain.puts.slice(startIdx, endIndex);

      visibleCalls.forEach((call, i) => {
          const put = visiblePuts[i];
          if (!call || !put) return;

          const x = (i - (visibleCalls.length / 2)) * (BAR_WIDTH + GAP);

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
              particles: callParticles, height: callHeight, contract: call,
              type: 'call', xBase: x, zBase: zCall,
              colorBase: '180, 100%, 50%', index: i
          });

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
              particles: putParticles, height: putHeight, contract: put,
              type: 'put', xBase: x, zBase: zPut,
              colorBase: '330, 100%, 50%', index: i
          });
      });

      return s;
  }, [chain]);

  // Ref for streams so animation loop doesn't recreate on data change
  const streamsRef = useRef(streams);
  useEffect(() => { streamsRef.current = streams; }, [streams]);

  const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      const centerX = width / 2;
      const centerY = height / 2 + 80;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.save();
      ctx.scale(dpr, dpr);

      // Background grid
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;

      const floorY = -5;
      const range = 2000;
      const pStart = project(-range, floorY, 0, centerX, centerY);
      const pEnd = project(range, floorY, 0, centerX, centerY);
      ctx.beginPath(); ctx.moveTo(pStart.x, pStart.y); ctx.lineTo(pEnd.x, pEnd.y); ctx.stroke();

      const regions: any[] = [];
      const currentStreams = streamsRef.current;
      const currentHover = hoverDataRef.current;

      const sortedStreams = currentStreams.map(s => {
          const proj = project(s.xBase, 0, s.zBase, centerX, centerY);
          return { ...s, projZ: proj.z };
      }).sort((a, b) => b.projZ - a.projZ);

      sortedStreams.forEach(stream => {
          const isHovered = currentHover && currentHover.contract.strike === stream.contract.strike && currentHover.type === stream.type;

          const x = stream.xBase;
          const z = stream.zBase;
          const w = BAR_WIDTH;
          const d = BAR_DEPTH;
          const h = stream.height;

          const b1 = project(x, 0, z, centerX, centerY);
          const b2 = project(x + w, 0, z, centerX, centerY);
          const b3 = project(x + w, 0, z + d, centerX, centerY);
          const b4 = project(x, 0, z + d, centerX, centerY);
          const t1 = project(x, h, z, centerX, centerY);
          const t2 = project(x + w, h, z, centerX, centerY);
          const t3 = project(x + w, h, z + d, centerX, centerY);
          const t4 = project(x, h, z + d, centerX, centerY);

          const baseColor = isHovered ? `hsla(${stream.colorBase}, 0.8)` : `hsla(${stream.colorBase}, 0.1)`;
          const strokeColor = isHovered ? `hsla(${stream.colorBase}, 1.0)` : `hsla(${stream.colorBase}, 0.25)`;
          const topColor = isHovered ? `hsla(${stream.colorBase}, 0.5)` : `hsla(${stream.colorBase}, 0.15)`;

          // Front face
          ctx.beginPath();
          ctx.moveTo(b4.x, b4.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y); ctx.closePath();
          ctx.fillStyle = baseColor; ctx.fill();
          ctx.strokeStyle = strokeColor; ctx.stroke();

          // Left side
          ctx.beginPath();
          ctx.moveTo(b1.x, b1.y); ctx.lineTo(b4.x, b4.y); ctx.lineTo(t4.x, t4.y); ctx.lineTo(t1.x, t1.y); ctx.closePath();
          ctx.fillStyle = `hsla(${stream.colorBase}, 0.08)`; ctx.fill(); ctx.stroke();

          // Right side
          ctx.beginPath();
          ctx.moveTo(b2.x, b2.y); ctx.lineTo(b3.x, b3.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t2.x, t2.y); ctx.closePath();
          ctx.fillStyle = `hsla(${stream.colorBase}, 0.08)`; ctx.fill(); ctx.stroke();

          // Top face
          ctx.beginPath();
          ctx.moveTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.lineTo(t4.x, t4.y); ctx.closePath();
          ctx.fillStyle = topColor; ctx.fill(); ctx.stroke();

          regions.push({
              path: [t1, t2, t3, t4, b3, b4],
              contract: stream.contract,
              type: stream.type,
          });

          // Particles
          stream.particles.forEach(p => {
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

          // Strike labels
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

      ctx.restore();
      (canvas as any).hitRegions = regions;
  }, [project, chain.currentPrice]);

  // Effect 1: Animation loop (mount/dismount only)
  useEffect(() => {
      const loop = () => {
          timeRef.current += 1;
          draw();
          animationRef.current = requestAnimationFrame(loop);
      };

      animationRef.current = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(animationRef.current);
  }, [draw]);

  // Effect 2: Canvas sizing + ResizeObserver
  useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const resize = () => {
          const rect = container.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          canvas.style.width = rect.width + 'px';
          canvas.style.height = rect.height + 'px';
          canvasSizeRef.current = { width: rect.width, height: rect.height };
      };

      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(container);

      return () => observer.disconnect();
  }, []);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
      dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (dragRef.current.active) {
          const dx = e.clientX - dragRef.current.lastX;
          const dy = e.clientY - dragRef.current.lastY;
          dragRef.current.lastX = e.clientX;
          dragRef.current.lastY = e.clientY;

          setYaw(prev => prev + dx * 0.005);
          setPitch(prev => Math.max(0.1, Math.min(1.4, prev - dy * 0.005)));
      }

      // Hit testing
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const regions = (canvas as any).hitRegions || [];
      let found = null;

      for (let i = regions.length - 1; i >= 0; i--) {
          const r = regions[i];
          let inside = false;
          const poly = r.path;
          for (let j = 0, k = poly.length - 1; j < poly.length; k = j++) {
              const xi = poly[j].x, yi = poly[j].y;
              const xj = poly[k].x, yj = poly[k].y;
              if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                  inside = !inside;
              }
          }
          if (inside) { found = r; break; }
      }

      setHoverData(found ? { contract: found.contract, type: found.type } : null);
  };

  const handleMouseUp = () => {
      dragRef.current.active = false;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
      e.preventDefault();
      setZoom(prev => Math.max(400, Math.min(3000, prev + e.deltaY)));
  };

  const resetView = () => {
      setYaw(-0.15);
      setPitch(0.55);
      setZoom(1200);
  };

  const handleClick = () => {
      if (hoverData && onSelectContract) {
          onSelectContract(hoverData.contract);
      }
  };

  return (
    <div
        ref={containerRef}
        className="relative w-full h-full bg-slate-950 rounded-xl overflow-hidden cursor-crosshair group"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { setHoverData(null); dragRef.current.active = false; }}
        onWheel={handleWheel}
        onClick={handleClick}
    >
        <canvas
            ref={canvasRef}
            className="w-full h-full block"
        />

        {/* Inspector Card */}
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
                            <span className="text-emerald-400 font-mono text-base font-bold">${(hoverData.contract.mid || hoverData.contract.lastPrice).toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-slate-400 uppercase font-bold">Spread</span>
                            <span className="text-white font-mono">{(((hoverData.contract.spreadPct || 0) * 100)).toFixed(1)}%</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs text-slate-400 uppercase font-bold">IV / Δ</span>
                            <span className="text-white font-mono">{hoverData.contract.impliedVolatility.toFixed(1)}% / {(hoverData.contract.delta || 0).toFixed(2)}</span>
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
                    {chain.isSynthetic && (
                        <div className="mt-2 rounded-full bg-slate-700/70 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-200">
                            Simulated Visualization
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* Reset View button */}
        <button
            onClick={resetView}
            className="absolute bottom-4 right-4 z-10 rounded-full bg-slate-800/80 border border-white/10 p-2 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Reset View"
        >
            <RotateCcw className="w-4 h-4" />
        </button>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] text-slate-500 uppercase font-bold tracking-widest flex items-center gap-2 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
            <Maximize className="w-3 h-3" /> Drag to orbit | Scroll to zoom
        </div>
    </div>
  );
};

export default OptionsChainVisualizer;
