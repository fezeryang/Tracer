
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { WhisperData, WhisperSource } from '../types';
import { Move3d, MousePointer2 } from 'lucide-react';

interface VisualizerProps {
  data: WhisperData;
}

interface Satellite {
  id: string;
  source: string;
  score: number;
  sentiment: string;
  trend: string;
  insight: string;
  theta: number; // Orbit angle
  yOffset: number; // Vertical position (Helix)
  radius: number;
  speed: number;
  color: string;
  icon: string;
}

const Whisper3DVisualizer: React.FC<VisualizerProps> = ({ data }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Camera & Interaction State
  const [rotation, setRotation] = useState({ y: 0 }); // We only need Y-axis rotation for the carousel
  const [isDragging, setIsDragging] = useState(false);
  const [lastMouseX, setLastMouseX] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const animationRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  // --- Initialize Satellites (Helix Layout) ---
  const satellites = useMemo(() => {
      const count = data.sources.length;
      return data.sources.map((s, i) => {
          // Helical distribution: Spread out vertically
          const yOffset = ((i / (count - 1 || 1)) - 0.5) * 200; 
          
          let color = '#94a3b8';
          if (s.sentiment === 'Bullish') color = '#10b981'; // Emerald
          if (s.sentiment === 'Bearish') color = '#f43f5e'; // Rose
          if (s.sentiment === 'Neutral') color = '#fbbf24'; // Amber

          return {
              id: s.source,
              source: s.source,
              score: s.score,
              sentiment: s.sentiment,
              trend: s.trend,
              insight: s.insight,
              theta: (Math.PI * 2 / count) * i,
              yOffset,
              radius: 320, // Wider orbit for cards
              speed: 0.002,
              color,
              icon: s.source[0]
          };
      });
  }, [data]);

  // --- 3D Projection Engine ---
  const project = (x: number, y: number, z: number, width: number, height: number) => {
      // Apply Carousel Rotation (Y-axis only)
      const rY = rotation.y;
      const x1 = x * Math.cos(rY) - z * Math.sin(rY);
      const z1 = x * Math.sin(rY) + z * Math.cos(rY);

      // Simple Camera Settings
      const fov = 900;
      const distance = 1200;
      
      const scale = fov / (distance + z1);
      
      return {
          x: width / 2 + x1 * scale,
          y: height / 2 + y * scale,
          scale,
          z: z1, // Depth
          isVisible: z1 < 200 // Fade out back items logic helper
      };
  };

  // Helper: Draw Rounded Rect
  const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
  };

  // Helper: Wrap Text
  const wrapText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) => {
      const words = text.split(' ');
      let line = '';
      let currentY = y;

      for(let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          const testWidth = metrics.width;
          if (testWidth > maxWidth && n > 0) {
              ctx.fillText(line, x, currentY);
              line = words[n] + ' ';
              currentY += lineHeight;
          } else {
              line = testLine;
          }
      }
      ctx.fillText(line, x, currentY);
  };

  const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);

      // --- Draw Core (Sentiment Sun) ---
      const coreProj = project(0, 0, 0, width, height);
      const coreColor = data.overallScore > 60 ? '#10b981' : data.overallScore < 40 ? '#f43f5e' : '#fbbf24';
      
      // Dynamic Core Size
      const pulse = Math.sin(timeRef.current * 0.05) * 5;
      const coreRadius = (30 + pulse) * coreProj.scale;

      // Glow
      const gradient = ctx.createRadialGradient(coreProj.x, coreProj.y, coreRadius * 0.2, coreProj.x, coreProj.y, coreRadius * 3);
      gradient.addColorStop(0, coreColor);
      gradient.addColorStop(0.1, coreColor);
      gradient.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.fillStyle = gradient;
      ctx.arc(coreProj.x, coreProj.y, coreRadius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Core Text
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${16 * coreProj.scale}px monospace`;
      ctx.fillText(data.overallScore.toString(), coreProj.x, coreProj.y);

      // --- Draw Satellites ---
      // We need to sort them by Z (depth) so front cards draw over back cards
      const renderList = satellites.map(sat => {
          // Rotate locally if not paused
          if (!hoveredId && !isDragging) {
              sat.theta += sat.speed; 
          }
          
          const x = sat.radius * Math.cos(sat.theta);
          const z = sat.radius * Math.sin(sat.theta);
          const y = sat.yOffset; // Helix

          const proj = project(x, y, z, width, height);
          return { sat, proj };
      });

      renderList.sort((a, b) => b.proj.z - a.proj.z); // Draw furthest first

      renderList.forEach(item => {
          const { sat, proj } = item;
          const { x, y, scale, z } = proj;

          // Opacity based on depth (fade out back items)
          // Z ranges roughly from -radius to +radius
          // We want front (negative Z in this system usually means closer? project logic: z1 positive is away)
          // In my project fn: scale = fov / (dist + z). Larger z = further away.
          // So smaller z is closer.
          
          // Let's normalize alpha
          // z varies from approx -320 to +320
          // Front is -320. Back is +320.
          const alphaNorm = 1 - ((z + 320) / 700); 
          const alpha = Math.max(0.1, Math.min(1, alphaNorm));
          
          // --- Connector Line (Tether) ---
          ctx.beginPath();
          const tetherGrad = ctx.createLinearGradient(x, y, coreProj.x, coreProj.y);
          tetherGrad.addColorStop(0, sat.color);
          tetherGrad.addColorStop(1, 'transparent');
          ctx.strokeStyle = tetherGrad;
          ctx.lineWidth = 1 * scale;
          ctx.globalAlpha = alpha * 0.3;
          ctx.moveTo(x, y);
          ctx.lineTo(coreProj.x, coreProj.y);
          ctx.stroke();
          ctx.globalAlpha = 1.0;

          // --- The Holographic Card ---
          const cardW = 180 * scale;
          const cardH = 100 * scale;
          const cardX = x - cardW / 2;
          const cardY = y - cardH / 2;

          // Card Background
          ctx.globalAlpha = alpha;
          
          // Glass Effect
          ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'; // Slate 900 semi-transparent
          ctx.strokeStyle = sat.color;
          ctx.lineWidth = 2 * scale;
          
          // Glow if hovered
          if (hoveredId === sat.id) {
              ctx.shadowColor = sat.color;
              ctx.shadowBlur = 20;
              ctx.fillStyle = 'rgba(15, 23, 42, 0.9)'; // Darker/Solid when hovered
          }

          roundRect(ctx, cardX, cardY, cardW, cardH, 8 * scale);
          ctx.fill();
          ctx.stroke();
          ctx.shadowBlur = 0;

          // --- Card Content ---
          // 1. Source Header
          ctx.fillStyle = sat.color;
          ctx.font = `bold ${12 * scale}px sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(sat.source.toUpperCase(), cardX + 10 * scale, cardY + 10 * scale);

          // 2. Score
          ctx.textAlign = 'right';
          ctx.fillText(sat.score.toString(), cardX + cardW - 10 * scale, cardY + 10 * scale);

          // 3. Insight Text (Wrapped)
          ctx.fillStyle = '#e2e8f0'; // Slate 200
          ctx.font = `${10 * scale}px sans-serif`;
          ctx.textAlign = 'left';
          
          // Only render text if card is large enough/close enough
          if (scale > 0.6) {
              wrapText(ctx, `"${sat.insight}"`, cardX + 10 * scale, cardY + 35 * scale, cardW - 20 * scale, 12 * scale);
          } else {
              // Placeholder lines for distant cards
              ctx.fillStyle = 'rgba(255,255,255,0.2)';
              ctx.fillRect(cardX + 10 * scale, cardY + 40 * scale, cardW - 20 * scale, 4 * scale);
              ctx.fillRect(cardX + 10 * scale, cardY + 50 * scale, cardW - 40 * scale, 4 * scale);
          }

          // 4. Trend Indicator
          const trendColor = sat.trend === 'up' ? '#10b981' : sat.trend === 'down' ? '#f43f5e' : '#94a3b8';
          ctx.fillStyle = trendColor;
          ctx.beginPath();
          const circleX = cardX + cardW - 15 * scale;
          const circleY = cardY + cardH - 15 * scale;
          ctx.arc(circleX, circleY, 3 * scale, 0, Math.PI * 2);
          ctx.fill();

          // Reset Alpha
          ctx.globalAlpha = 1.0;
      });

      // Hit Detection Logic Update
      (canvas as any).hitRegions = renderList.map(item => ({
          id: item.sat.id,
          x: item.proj.x,
          y: item.proj.y,
          w: 180 * item.proj.scale,
          h: 100 * item.proj.scale
      }));

      timeRef.current += 1;
      animationRef.current = requestAnimationFrame(draw);
  };

  useEffect(() => {
      animationRef.current = requestAnimationFrame(draw);
      return () => cancelAnimationFrame(animationRef.current);
  }, [satellites, rotation, hoveredId]);

  // Handle Resize
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
  }, []);

  // --- Interaction ---
  const handleMouseDown = (e: React.MouseEvent) => {
      setIsDragging(true);
      setLastMouseX(e.clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // 1. Dragging logic
      if (isDragging) {
          const dx = e.clientX - lastMouseX;
          setRotation(prev => ({ y: prev.y + dx * 0.005 }));
          setLastMouseX(e.clientX);
      }

      // 2. Hover logic
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      
      const hits = (canvas as any).hitRegions || [];
      let found = null;
      
      // Check hits (reverse order for z-index, front first)
      for (let i = hits.length - 1; i >= 0; i--) {
          const h = hits[i];
          // Simple rect check centered on x,y
          const left = h.x - h.w / 2;
          const right = h.x + h.w / 2;
          const top = h.y - h.h / 2;
          const bottom = h.y + h.h / 2;
          
          if (mx >= left && mx <= right && my >= top && my <= bottom) {
              found = h.id;
              break;
          }
      }
      setHoveredId(found);
  };

  const handleMouseUp = () => setIsDragging(false);

  return (
    <div className="relative w-full h-[600px] bg-slate-950 rounded-3xl overflow-hidden border border-white/10 shadow-2xl group cursor-move">
        {/* Background FX */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/40 via-slate-950 to-slate-950 pointer-events-none"></div>
        
        <canvas 
            ref={canvasRef}
            className="w-full h-full block relative z-10"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => { setIsDragging(false); setHoveredId(null); }}
        />

        {/* Overlay Info */}
        <div className="absolute top-6 left-6 z-20 pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 shadow-lg">
                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Target Ticker</div>
                <div className="text-2xl font-black text-white tracking-tight">{data.ticker}</div>
            </div>
        </div>

        {/* Interaction Hint */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 text-slate-500 text-[10px] uppercase font-bold tracking-widest opacity-60 pointer-events-none">
            <Move3d className="w-4 h-4" /> Drag to Spin • Hover to Inspect
        </div>
    </div>
  );
};

export default Whisper3DVisualizer;
