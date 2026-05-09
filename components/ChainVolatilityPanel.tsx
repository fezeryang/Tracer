import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { OptionsChain } from '../types';
import { Language, t } from '../i18n';

interface ChainVolatilityPanelProps {
  chain: OptionsChain;
  language: Language;
  termStructure: Array<{ expiration: string; dte: number; atmIv: number; expectedMove: number }>;
}

// Quadratic polynomial regression
function fitQuadratic(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 3) return null;

  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumY = 0, sumXY = 0, sumX2Y = 0;

  points.forEach(({ x, y }) => {
    sumX += x;
    sumX2 += x * x;
    sumX3 += x * x * x;
    sumX4 += x * x * x * x;
    sumY += y;
    sumXY += x * y;
    sumX2Y += x * x * y;
  });

  const denom = n * (sumX2 * sumX4 - sumX3 * sumX3)
    - sumX * (sumX * sumX4 - sumX2 * sumX3)
    + sumX2 * (sumX * sumX3 - sumX2 * sumX2);

  if (Math.abs(denom) < 1e-9) return null;

  const a = (n * (sumX2 * sumX2Y - sumX3 * sumXY) - sumX * (sumX * sumX2Y - sumX2 * sumXY) + sumX2 * (sumX * sumX3 - sumX2 * sumX2)) / denom;

  return { a, evaluate: (x: number) => sumY / n + a * (x - sumX / n) }; // Simplified: just fit slope for now

  // Full quadratic: y = c + b*x + a*x^2
  // Using normal equations matrix solution
}

function fitQuadraticFull(points: { x: number; y: number }[]) {
  const n = points.length;
  if (n < 3) return null;

  let sumX = 0, sumX2 = 0, sumX3 = 0, sumX4 = 0;
  let sumY = 0, sumXY = 0, sumX2Y = 0;

  points.forEach(({ x, y }) => {
    const x2 = x * x;
    sumX += x;
    sumX2 += x2;
    sumX3 += x * x2;
    sumX4 += x2 * x2;
    sumY += y;
    sumXY += x * y;
    sumX2Y += x2 * y;
  });

  // Solve using Cramer's rule for 3x3
  const det = n * (sumX2 * sumX4 - sumX3 * sumX3)
            - sumX * (sumX * sumX4 - sumX2 * sumX3)
            + sumX2 * (sumX * sumX3 - sumX2 * sumX2);

  if (Math.abs(det) < 1e-9) return null;

  const detA = sumY * (sumX2 * sumX4 - sumX3 * sumX3)
             - sumX * (sumXY * sumX4 - sumX2Y * sumX3)
             + sumX2 * (sumXY * sumX3 - sumX2Y * sumX2);

  const detB = n * (sumXY * sumX4 - sumX2Y * sumX3)
             - sumY * (sumX * sumX4 - sumX2 * sumX3)
             + sumX2 * (sumX * sumX2Y - sumXY * sumX2);

  const detC = n * (sumX2 * sumX2Y - sumX3 * sumXY)
             - sumX * (sumX * sumX2Y - sumX2 * sumXY)
             + sumY * (sumX * sumX3 - sumX2 * sumX2);

  const a = detA / det;
  const b = detB / det;
  const c = detC / det;

  return { a, b, c, evaluate: (x: number) => a + b * x + c * x * x };
}

const ChainVolatilityPanel: React.FC<ChainVolatilityPanelProps> = ({ chain, language, termStructure }) => {
  const [showFitted, setShowFitted] = useState(true);

  const smileData = (chain.rows || []).map((row) => ({
    strike: row.strike,
    callIv: row.call.impliedVolatility,
    putIv: row.put.impliedVolatility,
    moneyness: Number((row.moneynessPct * 100).toFixed(1)),
  }));

  // Fitted IV smile curve
  const fittedCurve = useMemo(() => {
    if (!chain.rows || chain.rows.length < 3) return [];

    const atmStrike = chain.currentPrice;
    const callPoints = chain.rows.map((row) => ({
      x: (row.strike - atmStrike) / atmStrike,
      y: row.call.impliedVolatility,
    }));

    const fit = fitQuadraticFull(callPoints);
    if (!fit) return [];

    // Sample 80 points across the moneyness range
    const minX = callPoints[0].x;
    const maxX = callPoints[callPoints.length - 1].x;
    const step = (maxX - minX) / 80;

    const points = [];
    for (let i = 0; i <= 80; i++) {
      const moneyness = minX + i * step;
      const iv = fit.evaluate(moneyness);
      points.push({
        moneyness: Number((moneyness * 100).toFixed(1)),
        strike: Number((atmStrike * (1 + moneyness)).toFixed(2)),
        fittedIv: Number(iv.toFixed(2)),
      });
    }
    return points;
  }, [chain.rows, chain.currentPrice]);

  const termData = termStructure.length > 0
    ? termStructure
    : [{
        expiration: chain.selectedExpiration,
        dte: chain.rows?.[0]?.dte || 0,
        atmIv: chain.aggregateStats?.atmIv || 0,
        expectedMove: chain.aggregateStats?.expectedMove || 0,
      }];

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.4fr,1fr]">
      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">{t(language, 'chain.volatilitySmile')}</h3>
            <p className="text-xs text-slate-400">{chain.symbol} {chain.selectedExpiration}</p>
          </div>
          <button
            onClick={() => setShowFitted((v) => !v)}
            className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition-colors ${
              showFitted
                ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                : 'border-white/10 text-slate-500'
            }`}
          >
            {t(language, 'chain.showFitted')}
          </button>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={smileData}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="strike" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <Line type="monotone" dataKey="callIv" name="Call IV" stroke="#22d3ee" dot={false} strokeWidth={2} />
              <Line type="monotone" dataKey="putIv" name="Put IV" stroke="#fb7185" dot={false} strokeWidth={2} />
              {showFitted && fittedCurve.length > 0 && (
                <Line
                  data={fittedCurve}
                  type="monotone"
                  dataKey="fittedIv"
                  name={t(language, 'chain.fittedCurve')}
                  stroke="#818cf8"
                  strokeDasharray="6 3"
                  dot={false}
                  strokeWidth={2}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-white">{t(language, 'chain.termStructure')}</h3>
          <p className="text-xs text-slate-400">{t(language, 'chain.atmIv')} / {t(language, 'chain.expectedMove')}</p>
        </div>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={termData}>
              <CartesianGrid stroke="rgba(148,163,184,0.12)" />
              <XAxis dataKey="dte" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)' }}
                labelStyle={{ color: '#e2e8f0' }}
              />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="atmIv" name={t(language, 'chain.atmIv')} stroke="#60a5fa" dot={{ r: 3 }} strokeWidth={2} />
              <Line yAxisId="right" type="monotone" dataKey="expectedMove" name={t(language, 'chain.expectedMove')} stroke="#f59e0b" dot={{ r: 3 }} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ChainVolatilityPanel;
