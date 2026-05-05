
import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, AlertCircle, RefreshCw, BarChart3, Globe } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Language, t } from '../i18n';
import { NuxPageHeader, NuxNotice, RiskDisclaimer } from './NuxPage';

interface EnergyDataPoint {
    period: string;
    value: number;
    seriesId: string;
}

const MacroView: React.FC<{ language: Language }> = ({ language }) => {
    const [data, setData] = useState<EnergyDataPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/macro/energy');
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to fetch energy data');
            }
            const result = await response.json();
            // EIA V2 response structure: result.response.data
            if (result.response && result.response.data) {
                setData(result.response.data.reverse());
            } else {
                throw new Error('Invalid data format from EIA');
            }
        } catch (err: any) {
            console.error("[MacroView] Error:", err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const latest = data.length > 0 ? data[data.length - 1] : null;
    const previous = data.length > 1 ? data[data.length - 2] : null;
    const change = latest && previous ? latest.value - previous.value : 0;
    const changePercent = latest && previous ? (change / previous.value) * 100 : 0;

    return (
        <div className="h-full flex flex-col animate-fade-in space-y-6">
            <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'macro.title')} subtitle={t(language, 'macro.subtitle')} />
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Globe className="w-6 h-6 text-indigo-400" />
                        {t(language, 'macro.title')}
                    </h2>
                    <p className="text-slate-400 text-sm">{t(language, 'macro.subtitle')}</p>
                </div>
                <button 
                    onClick={fetchData}
                    disabled={loading}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-white/10 transition-colors"
                    title={t(language, 'macro.refresh')}
                >
                    <RefreshCw className={`w-4 h-4 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            {error ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-2xl max-w-md text-center">
                        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-4" />
                        <h3 className="text-white font-bold mb-2">{t(language, 'macro.error')}</h3>
                        <p className="text-slate-400 text-sm mb-4">{error}</p>
                        <button 
                            onClick={fetchData}
                            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all"
                        >
                            {t(language, 'common.retry')}
                        </button>
                    </div>
                </div>
            ) : loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
                        <p className="text-slate-500 text-xs font-mono animate-pulse">QUERYING EIA DATASETS...</p>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Key Metric Card */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl">
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-2 bg-indigo-500/10 rounded-lg">
                                    <Activity className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div className={`flex items-center gap-1 text-xs font-bold ${change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {Math.abs(changePercent).toFixed(2)}%
                                </div>
                            </div>
                            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Crude Oil Price (WTI)</h3>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-white">${latest?.value.toFixed(2)}</span>
                                <span className="text-slate-500 text-xs">USD/BBL</span>
                            </div>
                            <p className="text-slate-500 text-[10px] mt-4 leading-relaxed">
                                Monthly average spot price for West Texas Intermediate (WTI) crude oil. Source: EIA Short-Term Energy Outlook.
                            </p>
                        </div>

                        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl">
                            <h3 className="text-white font-bold text-sm mb-4 flex items-center gap-2">
                                <BarChart3 className="w-4 h-4 text-indigo-400" />
                                Market Insight
                            </h3>
                            <div className="space-y-4">
                                <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                    <p className="text-xs text-slate-300 leading-relaxed">
                                        Energy prices are a primary driver of inflation and corporate margins. Monitoring WTI spreads helps anticipate volatility in the transportation and manufacturing sectors.
                                    </p>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono uppercase">
                                    <span>Last Updated</span>
                                    <span>{latest?.period}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chart Card */}
                    <div className="lg:col-span-2 bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-xl flex flex-col min-h-[400px]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-white font-bold text-sm">Historical Price Trend (12 Months)</h3>
                            <div className="flex gap-2">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                                    WTI Spot
                                </div>
                            </div>
                        </div>
                        <div className="flex-1 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data}>
                                    <defs>
                                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                                    <XAxis 
                                        dataKey="period" 
                                        stroke="#475569" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        tickFormatter={(val) => val.split('-')[1] + '/' + val.split('-')[0].slice(2)}
                                    />
                                    <YAxis 
                                        stroke="#475569" 
                                        fontSize={10} 
                                        tickLine={false} 
                                        axisLine={false}
                                        domain={['auto', 'auto']}
                                        tickFormatter={(val) => `$${val}`}
                                    />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '12px', fontSize: '10px' }}
                                        itemStyle={{ color: '#818cf8' }}
                                    />
                                    <Area 
                                        type="monotone" 
                                        dataKey="value" 
                                        stroke="#6366f1" 
                                        strokeWidth={2}
                                        fillOpacity={1} 
                                        fill="url(#colorValue)" 
                                        animationDuration={1500}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
            {!error && !loading && data.length === 0 && (
                <NuxNotice tone="info">
                    <strong>{t(language, 'macro.emptyTitle')}</strong> {t(language, 'macro.emptyBody')}
                </NuxNotice>
            )}
            <RiskDisclaimer language={language} />
        </div>
    );
};

export default MacroView;
