import React, { useRef, useEffect, useState, useMemo } from 'react';
import { BacktestResult, EquityPoint, TradeLog } from '../types';
import { Play, Pause, RotateCcw, MousePointer2, Move3d } from 'lucide-react';

interface VisualizerProps {
  data: BacktestResult;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
  date: string;
  value: number;
  index: number;
}

const Backtest3DVisualizer: React.FC<VisualizerProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Camera & Animation State
  const [camera, setCamera] = useState({ yaw: 0.5, pitch: 0.4, zoom: 1.0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouse, setLastMouse] = useState({ x: 0, y: 0 });
  const [progress, setProgress] = useState(1.0); // 0 to 1
  const [isPlaying, setIsPlaying] = useState(true);
  
  const animationRef = useRef<number>(0);
  const progressRef = useRef(0);

  // --- Data Processing ---
  const { path, benchmarkPath, tradesMap, maxVal, minVal } = useMemo(() => {
      const points: Point3D[] = [];
      const benchPoints: Point3D[] = [];
      
      let max = -Infinity;
      let min = Infinity;

      data.equityCurve.forEach(p => {
          max = Math.max(max, p.strategyValue, p.benchmarkValue);
          min = Math.min(min, p.strategyValue, p.benchmarkValue);
      });
      
      // Add padding
      const range = max - min;
      max += range * 0.1;
      min -= range * 0.1;

      const xStep = 4.0 / data.equityCurve.length; // Spread over width 4.0 units

      data.equityCurve.forEach((p, i) => {
          // Normalize Y to -1 to 1 range approx
          const yNorm = ((p.strategyValue - min) / (max - min)) * 2 - 1;
          const yBenchNorm = ((p.benchmarkValue - min) / (max - min)) * 2 - 1;
          
          const x = (i * xStep) - 2.0; // Center X around 0

          points.push({ x, y: yNorm, z: 0, date: p.date, value: p.strategyValue, index: i });
          benchPoints.push({ x, y: yBenchNorm, z: 0.5, date: p.date, value: p.benchmarkValue, index: i }); // Benchmark slightly behind in Z
      });

      // Map trades to indices
      const tMap: { entryIdx: number, exitIdx: number, pnl: number, type: 'win'|'loss' }[] = [];
      
      data.trades.forEach(t => {
          const entryIdx = data.equityCurve.findIndex(p => p.date === t.entryDate);
          const exitIdx = data.equityCurve.findIndex(p => p.date === t.exitDate);
          
          if (entryIdx !== -1 && exitIdx !== -1) {
              tMap.push({
                  entryIdx,
                  exitIdx,
                  pnl: t.pnl,
                  type: t.pnl >= 0 ? 'win' : 'loss'
              });
          }
      });

      return { path: points, benchmarkPath: benchPoints, tradesMap: tMap, maxVal: max, minVal: min };
  }, [data]);

  // --- 3D Projection Engine ---
  const project = (x: number, y: number, z: number, width: number, height: number) => {
      const cx = Math.cos(camera.yaw);
      const sx = Math.sin(camera.yaw);
      const cy = Math.cos(camera.pitch);
      const sy = Math.sin(camera.pitch);

      // Rotate Y (Yaw)
      let x1 = x * cx - z * sx;
      let z1 = x * sx + z * cx;

      // Rotate X (Pitch)
      let y2 = y * cy - z1 * sy;
      let z2 = y * sy + z1 * cy;

      // Camera Offset
      z2 += 3.5; // Distance

      // Perspective
      const fov = 600 * camera.zoom;
      if (z2 < 0.1) return null; // Clip behind camera

      const scale = fov / z2;
      return {
          x: width / 2 + x1 * scale,
          y: height / 2 - y2 * scale, // Invert Y for canvas
          scale: scale,
          z: z2
      };
  };

  // --- Render Loop ---
  const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      // Auto-play logic
      if (isPlaying && progressRef.current < 1.0) {
          progressRef.current = Math.min(1.0, progressRef.current + 0.005);
          setProgress(progressRef.current);
      } else if (isPlaying && progressRef.current >= 1.0) {
          setIsPlaying(false);
      } else if (!isPlaying) {
          progressRef.current = progress; // Sync if dragged manually (future feature) or finished
      }

      ctx.clearRect(0, 0, width, height);

      // Background Grid
      const floorY = -1.2;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      
      // Z-lines
      for(let i = -5; i <= 5; i++) {
          const x = i * 0.8;
          const p1 = project(x, floorY, -2, width, height);
          const p2 = project(x, floorY, 2, width, height);
          if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
      }
      // X-lines
      for(let i = -5; i <= 5; i++) {
          const z = i * 0.8;
          const p1 = project(-4, floorY, z, width, height);
          const p2 = project(4, floorY, z, width, height);
          if (p1 && p2) { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
      }

      const currentIndex = Math.floor(progressRef.current * (path.length - 1));

      // --- Draw Benchmark (Ghost Line) ---
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.2)'; // Amber low opacity
      ctx.lineWidth = 2;
      let started = false;
      for(let i=0; i <= currentIndex; i++) {
          const p = benchmarkPath[i];
          const proj = project(p.x, p.y, p.z, width, height);
          if (proj) {
              if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
              else ctx.lineTo(proj.x, proj.y);
          }
      }
      ctx.stroke();

      // --- Draw Equity Curve (Main Hero) ---
      ctx.beginPath();
      ctx.strokeStyle = '#6366f1'; // Indigo
      ctx.lineWidth = 3;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#6366f1';
      ctx.lineJoin = 'round';
      
      started = false;
      let lastProj = null;

      for(let i=0; i <= currentIndex; i++) {
          const p = path[i];
          const proj = project(p.x, p.y, p.z, width, height);
          if (proj) {
              if (!started) { ctx.moveTo(proj.x, proj.y); started = true; }
              else ctx.lineTo(proj.x, proj.y);
              lastProj = proj;
          }
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Draw "Head" Glow
      if (lastProj) {
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(lastProj.x, lastProj.y, 4, 0, Math.PI * 2); ctx.fill();
          
          ctx.beginPath();
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.arc(lastProj.x, lastProj.y, 10 + Math.sin(Date.now() / 100) * 5, 0, Math.PI * 2);
          ctx.stroke();

          // Drop line to floor
          const floorProj = project(path[currentIndex].x, floorY, 0, width, height);
          if (floorProj) {
              ctx.beginPath();
              ctx.strokeStyle = 'rgba(255,255,255,0.1)';
              ctx.setLineDash([2, 4]);
              ctx.moveTo(lastProj.x, lastProj.y);
              ctx.lineTo(floorProj.x, floorProj.y);
              ctx.stroke();
              ctx.setLineDash([]);
              
              // Date Label
              ctx.fillStyle = '#94a3b8';
              ctx.font = '10px monospace';
              ctx.textAlign = 'center';
              ctx.fillText(path[currentIndex].date, floorProj.x, floorProj.y + 15);
          }
      }

      // --- Draw Trade Arcs ---
      tradesMap.forEach(t => {
          if (t.exitIdx <= currentIndex) {
              // Trade is complete, draw full arc
              const pStart = path[t.entryIdx];
              const pEnd = path[t.exitIdx];
              
              const projStart = project(pStart.x, pStart.y, pStart.z, width, height);
              const projEnd = project(pEnd.x, pEnd.y, pEnd.z, width, height);

              if (projStart && projEnd) {
                  // Bezier Control Point (Midpoint + Height)
                  const midX = (pStart.x + pEnd.x) / 2;
                  const midY = Math.max(pStart.y, pEnd.y) + 0.5; // Arch height
                  const midZ = (pStart.z + pEnd.z) / 2;
                  
                  const projMid = project(midX, midY, midZ, width, height);

                  if (projMid) {
                      ctx.beginPath();
                      ctx.strokeStyle = t.type === 'win' ? 'rgba(16, 185, 129, 0.6)' : 'rgba(244, 63, 94, 0.6)';
                      ctx.lineWidth = 1.5;
                      ctx.moveTo(projStart.x, projStart.y);
                      ctx.quadraticCurveTo(projMid.x, projMid.y, projEnd.x, projEnd.y);
                      ctx.stroke();
                      
                      // Entry/Exit Dots
                      ctx.fillStyle = t.type === 'win' ? '#10b981' : '#f43f5e';
                      ctx.beginPath(); ctx.arc(projEnd.x, projEnd.y, 2, 0, Math.PI*2); ctx.fill();
                  }
              }
          }
      });

      // Axis Labels
      // Draw Y-Axis labels (Price) on the left side in 3D space
      const range = maxVal - minVal;
      for(let i=0; i<=4; i++) {
          const val = minVal + (range * (i/4));
          const yPos = (i/4) * 2 - 1;
          const p = project(-2.2, yPos, 0, width, height);
          if (p) {
              ctx.fillStyle = '#64748b';
              ctx.font = '10px monospace';
              ctx.textAlign = 'right';
              ctx.fillText(`$${val.toFixed(0)}`, p.x, p.y);
          }
      }

      animationRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
      animationRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(animationRef.current);
  }, [path, camera, isPlaying]); // Re-bind on state change

  // --- Interactions ---
  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      if (isDragging) {
          const dx = e.clientX - lastMouse.x;
          const dy = e.clientY - lastMouse.y;
          setCamera(prev => ({
              ...prev,
              yaw: prev.yaw + dx * 0.01,
              pitch: Math.max(-0.5, Math.min(1.5, prev.pitch + dy * 0.01))
          }));
          setLastMouse({ x: e.clientX, y: e.clientY });
      }
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetAnimation = () => {
      progressRef.current = 0;
      setProgress(0);
      setIsPlaying(true);
  };

  // Resize Handler
  useEffect(() => {
      const canvas = canvasRef.current;
      if (canvas) {
          const rect = canvas.getBoundingClientRect();
          const dpr = window.devicePixelRatio || 1;
          canvas.width = rect.width * dpr;
          canvas.height = rect.height * dpr;
          const ctx = canvas.getContext('2d');
          if(ctx) ctx.scale(dpr, dpr);
      }
  }, []);

  return (
    <div className="relative w-full h-[450px] bg-slate-950 rounded-2xl overflow-hidden border border-white/10 shadow-2xl group cursor-move">
        <canvas 
            ref={canvasRef}
            className="w-full h-full block"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        />
        
        {/* Overlays */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5">
                <div className="w-3 h-0.5 bg-indigo-500"></div>
                <span className="text-[10px] uppercase font-bold text-slate-300">Equity Curve</span>
            </div>
            <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/5">
                <div className="w-3 h-0.5 bg-amber-500/50"></div>
                <span className="text-[10px] uppercase font-bold text-slate-400">Benchmark (Hold)</span>
            </div>
        </div>

        <div className="absolute bottom-4 left-4 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold">
            <Move3d className="w-4 h-4" /> Drag to Orbit
        </div>

        {/* Controls */}
        <div className="absolute bottom-4 right-4 flex gap-2">
            <button 
                onClick={() => setIsPlaying(!isPlaying)}
                className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg shadow-lg transition-colors"
            >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button 
                onClick={resetAnimation}
                className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg border border-white/10 transition-colors"
            >
                <RotateCcw className="w-4 h-4" />
            </button>
        </div>
        
        {/* Current Value Display */}
        <div className="absolute top-4 right-4 text-right pointer-events-none">
            <div className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Current Equity</div>
            <div className="text-2xl font-mono font-bold text-white">
                ${path[Math.floor(progress * (path.length - 1))]?.value.toLocaleString()}
            </div>
        </div>
    </div>
  );
};

export default Backtest3DVisualizer;