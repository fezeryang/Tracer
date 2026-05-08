import React, { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Language, t } from '../../i18n';
import { SourceTrustLevel } from '../../types';
import { theme } from '../../designTokens';

interface TrustGaugeProps {
  score: number; // 0-100
  level: SourceTrustLevel;
  language: Language;
  size?: number;
  showLabel?: boolean;
}

// Resolve CSS custom property to actual color for canvas API
const resolveColor = (element: HTMLElement, cssVar: string): string => {
  // If it's already a resolved color (doesn't start with 'var('), return as-is
  if (!cssVar.startsWith('var(')) return cssVar;
  try {
    const name = cssVar.slice(4, -1).trim();
    return getComputedStyle(element).getPropertyValue(name).trim() || '#666';
  } catch {
    return '#666';
  }
};

const getConfidenceLabel = (level: SourceTrustLevel): string => {
  if (level === 'high') return 'HIGH';
  if (level === 'medium') return 'MED';
  if (level === 'low') return 'LOW';
  return 'N/A';
};

const TrustGauge: React.FC<TrustGaugeProps> = ({
  score,
  level,
  language,
  size = 200,
  showLabel = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animatedScoreRef = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const lastUiUpdateRef = useRef(0);
  const animationFrameRef = useRef<number>();

  const strokeWidth = 16;
  const padding = 12;
  const radius = size / 2 - padding - strokeWidth / 2;
  const centerY = radius + padding;
  const gaugeHeight = Math.max(Math.round(centerY + strokeWidth + 64), Math.round(size * 0.8));
  const overlayTop = Math.round(centerY + 8);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvas.isConnected) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resolve theme colors to actual values for canvas API
    const colorSuccess = resolveColor(canvas, theme.colors.up);
    const colorWarning = resolveColor(canvas, theme.colors.warn);
    const colorDanger = resolveColor(canvas, theme.colors.down);
    const colorMuted = resolveColor(canvas, theme.colors.chart.muted);
    const colorBorder = resolveColor(canvas, theme.colors.borderSubtle);

    // High DPI support
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const centerX = rect.width / 2;
    const radiusPx = Math.max(0, rect.width / 2 - padding - strokeWidth / 2);
    const centerYPx = Math.min(rect.height - padding, radiusPx + padding);

    const targetScore = Math.max(0, Math.min(100, score));
    const duration = 800;
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      animatedScoreRef.current = targetScore * eased;

      // Throttled state update for text overlay
      if (currentTime - lastUiUpdateRef.current > 50) {
        lastUiUpdateRef.current = currentTime;
        setDisplayScore(Math.round(targetScore * eased));
      }
      // Ensure final value
      if (progress >= 1) {
        setDisplayScore(Math.round(targetScore));
      }

      ctx.clearRect(0, 0, rect.width, rect.height);

      // Background arc
      ctx.beginPath();
      ctx.arc(centerX, centerYPx, radiusPx, Math.PI, 0);
      ctx.strokeStyle = colorMuted;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Active arc
      const scoreAngle = Math.PI + (animatedScoreRef.current / 100) * Math.PI;
      const currentColor = animatedScoreRef.current >= 70 ? colorSuccess :
        animatedScoreRef.current >= 40 ? colorWarning : colorDanger;

      ctx.beginPath();
      ctx.arc(centerX, centerYPx, radiusPx, Math.PI, scoreAngle);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = strokeWidth;
      ctx.lineCap = 'round';
      ctx.stroke();

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate(performance.now());

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [score, size, padding, strokeWidth]);

  // displayScore is managed via useState for reactive text updates
  const scoreColor = score >= 70 ? theme.colors.up :
    score >= 40 ? theme.colors.warn : theme.colors.down;

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: gaugeHeight }}>
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width: '100%', height: '100%' }}
        />
        <div className="absolute inset-x-0 flex flex-col items-center" style={{ top: overlayTop }}>
          <ShieldCheck className="mb-1 h-5 w-5" style={{ color: scoreColor }} />
          <div className="text-3xl font-semibold tracking-tight" style={{ color: theme.colors.textPrimary }}>
            {displayScore}
          </div>
          {showLabel && (
            <div className="mt-1 text-xs font-semibold uppercase tracking-widest" style={{ color: scoreColor }}>
              {getConfidenceLabel(level)}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className="text-[11px] uppercase tracking-wider" style={{ color: theme.colors.textMuted }}>
          {t(language, 'sourceTrust.overallScore')}
        </div>
      </div>
    </div>
  );
};

export default TrustGauge;
