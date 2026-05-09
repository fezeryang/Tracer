import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ComposedChart, Line } from 'recharts';
import { OptionsChain, UnusualActivity } from '../types';
import { Language, t } from '../i18n';

interface ChainFlowPanelProps {
  chain: OptionsChain;
  language: Language;
}

type FlowViewMode = 'bar' | 'heatmap';

const PCR_STORAGE_PREFIX = 'volt-pcr-';

function getStoredPcr(ticker: string, expiration: string): number | null {
  try {
    const key = `${PCR_STORAGE_PREFIX}${ticker}:${expiration}`;
    const stored = window.localStorage.getItem(key);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.expiresAt > Date.now()) return parsed.value;
    }
  } catch {}
  return null;
}

function storePcr(ticker: string, expiration: string, value: number) {
  try {
    const key = `${PCR_STORAGE_PREFIX}${ticker}:${expiration}`;
    window.localStorage.setItem(key, JSON.stringify({ value, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }));
  } catch {}
}

const ChainFlowPanel: React.FC<ChainFlowPanelProps> = ({ chain, language }) => {
  const [viewMode, setViewMode] = useState<FlowViewMode>('bar');

  const positioningData = (chain.rows || []).map((row) => ({
    strike: row.strike,
    callOi: row.call.openInterest,
    putOi: row.put.openInterest,
    callVol: row.call.volume,
    putVol: row.put.volume,
    gammaExposure: row.gex ?? Number((((row.call.gamma || 0) * row.call.openInterest) - ((row.put.gamma || 0) * row.put.openInterest)).toFixed(2)),
    maxPainLine: chain.maxPain || 0,
  }));

  // Unusual options activity detection
  const unusualActivity: UnusualActivity[] = useMemo(() => {
    const results: UnusualActivity[] = [];
    if (!chain.rows) return results;

    chain.rows.forEach((row) => {
      ['call', 'put'].forEach((side) => {
        const contract = side === 'call' ? row.call : row.put;
        const vol = contract.volume || 0;
        const oi = contract.openInterest || 0;
        if (oi === 0) return;

        const vOverOi = vol / oi;

        // Flag if volume > 3x OI (unusual relative activity)
        if (vOverOi > 3) {
          results.push({
            strike: row.strike,
            side: side as 'call' | 'put',
            volume: vol,
            openInterest: oi,
            vOverOiRatio: Number(vOverOi.toFixed(2)),
            interpretation: vol > 5000
              ? 'Heavy institutional flow'
              : vOverOi > 5
                ? 'Potential sweep order'
                : 'Elevated relative volume',
          });
        }
        // Flag high absolute activity
        else if (vol > 5000 && oi > 10000) {
          results.push({
            strike: row.strike,
            side: side as 'call' | 'put',
            volume: vol,
            openInterest: oi,
            vOverOiRatio: Number(vOverOi.toFixed(2)),
            interpretation: 'High absolute activity',
          });
        }
      });
    });

    return results.slice(0, 10);
  }, [chain.rows]);

  // PCR trend
  const currentPcr = chain.aggregateStats?.putCallVolumeRatio || 0;
  const [pcrDelta, setPcrDelta] = useState<number | null>(null);

  useEffect(() => {
    const prev = getStoredPcr(chain.symbol, chain.selectedExpiration);
    if (prev !== null && currentPcr > 0) {
      setPcrDelta(Number((currentPcr - prev).toFixed(3)));
    }
    if (currentPcr > 0) {
      storePcr(chain.symbol, chain.selectedExpiration, currentPcr);
    }
  }, [chain.symbol, chain.selectedExpiration, currentPcr]);

  // Heatmap data
  const heatmapData = useMemo(() => {
    if (!chain.rows || chain.rows.length === 0) return { cells: [], strikeBuckets: [] };

    const rows = chain.rows;
    const bucketSize = Math.max(1, Math.ceil(rows.length / 12));
    const cells: Array<{ strikeRange: string; oiIntensity: number; volIntensity: number; startStrike: number }> = [];

    for (let i = 0; i < rows.length; i += bucketSize) {
      const bucket = rows.slice(i, i + bucketSize);
      const totalOi = bucket.reduce((sum, r) => sum + r.call.openInterest + r.put.openInterest, 0);
      const totalVol = bucket.reduce((sum, r) => sum + r.call.volume + r.put.volume, 0);
      const maxOi = Math.max(...bucket.map(r => r.call.openInterest + r.put.openInterest), 1);
      cells.push({
        strikeRange: `$${bucket[0].strike}-$${bucket[bucket.length - 1].strike}`,
        oiIntensity: Number((totalOi / (bucket.length * maxOi || 1)).toFixed(2)),
        volIntensity: Number((totalVol / Math.max(totalOi, 1)).toFixed(2)),
        startStrike: bucket[0].strike,
      });
    }

    return { cells, strikeBuckets: cells.map(c => c.strikeRange) };
  }, [chain.rows]);

  return (
    <div className="grid grid-cols-1 gap-4">
      {/* View mode toggle and PCR trend */}
      <div className="flex items-center gap-3">
        <div className="flex bg-slate-900 rounded-lg p-0.5 border border-white/10">
          <button
            onClick={() => setViewMode('bar')}
            className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${viewMode === 'bar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t(language, 'chain.barChart') || 'Bar'}
          </button>
          <button
            onClick={() => setViewMode('heatmap')}
            className={`px-3 py-1 rounded text-[11px] font-semibold transition-colors ${viewMode === 'heatmap' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t(language, 'chain.heatmap') || 'Heatmap'}
          </button>
        </div>

        {pcrDelta !== null && (
          <div className="flex items-center gap-1.5 text-[11px]">
            <span className="text-slate-500">{t(language, 'chain.pcrTrend') || 'PCR Trend'}:</span>
            <span className={`font-mono font-bold ${pcrDelta > 0 ? 'text-rose-400' : pcrDelta < 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
              {pcrDelta > 0 ? '+' : ''}{pcrDelta.toFixed(3)}
            </span>
            <span className="text-[10px] text-slate-600">{t(language, 'chain.vsPrevious') || 'vs prev'}</span>
          </div>
        )}
      </div>

      {viewMode === 'bar' ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr,1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white">{t(language, 'chain.positioning')}</h3>
              <p className="text-xs text-slate-400">{t(language, 'chain.putCallOi')} {chain.putCallOiRatio?.toFixed(2)} | {t(language, 'chain.putCallVolume')} {chain.putCallVolumeRatio?.toFixed(2)}</p>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={positioningData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="strike" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)' }} />
                  <Legend />
                  <Bar dataKey="callOi" name="Call OI" fill="#22d3ee" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="putOi" name="Put OI" fill="#fb7185" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="callVol" name="Call Vol" fill="#0f766e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="putVol" name="Put Vol" fill="#9f1239" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-white">{t(language, 'chain.gammaExposure')}</h3>
              <p className="text-xs text-slate-400">{t(language, 'chain.netGex')} {(chain.aggregateStats?.netGammaExposure || 0).toLocaleString()}</p>
            </div>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={positioningData}>
                  <CartesianGrid stroke="rgba(148,163,184,0.12)" />
                  <XAxis dataKey="strike" stroke="#64748b" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#020617', border: '1px solid rgba(148,163,184,0.2)' }} />
                  <Legend />
                  <Bar dataKey="gammaExposure" name="Gamma Exposure" fill="#818cf8" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="maxPainLine" name={t(language, 'chain.maxPain')} stroke="#f59e0b" dot={false} strokeWidth={2} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">{t(language, 'chain.positioning')} - Heatmap</h3>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {heatmapData.cells.map((cell, i) => {
              const oiAlpha = Math.min(cell.oiIntensity, 1);
              const volAlpha = Math.min(cell.volIntensity, 1);
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <span className="w-20 text-slate-500 font-mono">{cell.strikeRange}</span>
                  <div
                    className="flex-1 h-6 rounded flex items-center px-2"
                    style={{ backgroundColor: `rgba(34, 211, 238, ${oiAlpha * 0.75})` }}
                    title={`OI intensity: ${(cell.oiIntensity * 100).toFixed(0)}%`}
                  >
                    <span className="text-white font-mono text-[10px]">
                      OI: {(cell.oiIntensity * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div
                    className="flex-1 h-6 rounded flex items-center px-2"
                    style={{ backgroundColor: `rgba(251, 113, 133, ${volAlpha * 0.75})` }}
                    title={`Vol/OI: ${(cell.volIntensity * 100).toFixed(0)}%`}
                  >
                    <span className="text-white font-mono text-[10px]">
                      V/OI: {(cell.volIntensity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Unusual Activity Table */}
      {unusualActivity.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">{t(language, 'chain.unusualActivity') || 'Unusual Activity'}</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b border-white/10">
                  <th className="text-left py-2 font-semibold">Strike</th>
                  <th className="text-left py-2 font-semibold">Side</th>
                  <th className="text-right py-2 font-semibold">Volume</th>
                  <th className="text-right py-2 font-semibold">OI</th>
                  <th className="text-right py-2 font-semibold">{t(language, 'chain.vOverOi') || 'V/OI'}</th>
                  <th className="text-left py-2 font-semibold">Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {unusualActivity.map((act, i) => (
                  <tr key={i} className="border-b border-white/5 text-slate-300">
                    <td className="py-2 font-mono text-white">${act.strike}</td>
                    <td className={`py-2 font-semibold ${act.side === 'call' ? 'text-cyan-400' : 'text-rose-400'}`}>
                      {act.side.toUpperCase()}
                    </td>
                    <td className="py-2 text-right font-mono">{act.volume.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono">{act.openInterest.toLocaleString()}</td>
                    <td className={`py-2 text-right font-mono font-bold ${act.vOverOiRatio > 5 ? 'text-amber-400' : 'text-slate-300'}`}>
                      {act.vOverOiRatio.toFixed(1)}x
                    </td>
                    <td className="py-2 text-slate-400">{act.interpretation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChainFlowPanel;
