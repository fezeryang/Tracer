
import React, { useEffect, useState } from 'react';
import { Newspaper, Radio, Target, History, Zap, ArrowRight, AlertTriangle, TrendingUp, TrendingDown, RefreshCw, Activity } from 'lucide-react';
import { fetchStockNews, fetchStockQuote } from '../services/marketDataService';
import { createChatSession } from '../services/geminiService';
import { NewsImpactAnalysis, NewsItem } from '../types';
import { Language, t } from '../i18n';
import { NuxPageHeader, NuxNotice, RiskDisclaimer } from './NuxPage';

interface NewsImpactViewProps {
    language: Language;
    selectedTicker?: string;
}

const normalizeTicker = (value: string | undefined) => (value || 'NVDA').trim().toUpperCase();

const NewsImpactView: React.FC<NewsImpactViewProps> = ({ language, selectedTicker }) => {
    const [ticker, setTicker] = useState(() => normalizeTicker(selectedTicker));
    const [tickerEdited, setTickerEdited] = useState(false);
    const [loading, setLoading] = useState(false);
    const [analysis, setAnalysis] = useState<NewsImpactAnalysis | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    useEffect(() => {
        const normalized = normalizeTicker(selectedTicker);
        if (tickerEdited || normalized === ticker) return;
        setTicker(normalized);
    }, [selectedTicker, ticker, tickerEdited]);

    const analyze = async () => {
        if (!ticker) return;
        setLoading(true);
        setNotice(null);
        try {
            // 1. Get Real Data
            const [quote, news] = await Promise.all([
                fetchStockQuote(ticker),
                fetchStockNews(ticker)
            ]);

            // Fallback for simulation if no live news is available
            let targetNews: NewsItem;
            
            if (news && news.length > 0) {
                targetNews = news[0];
            } else {
                // Generate a realistic simulated headline based on ticker
                const simHeadlines = [
                    { title: `BREAKING: ${ticker} announces strategic partnership to accelerate AI roadmap.`, sentiment: 'Positive' },
                    { title: `Reports suggest ${ticker} is facing supply chain headwinds in Q3.`, sentiment: 'Negative' },
                    { title: `${ticker} reveals new product line exceeding performance expectations.`, sentiment: 'Positive' },
                    { title: `Regulatory concerns mount for ${ticker} over market dominance.`, sentiment: 'Negative' },
                    { title: `Analyst upgrades ${ticker} with new price target of $${(quote.price * 1.15).toFixed(0)}.`, sentiment: 'Positive' }
                ];
                const sim = simHeadlines[Math.floor(Math.random() * simHeadlines.length)];
                
                targetNews = {
                    title: sim.title,
                    image: '',
                    site: 'MarketWire (Simulated)',
                    text: 'This is a simulated news item because live news could not be fetched from the API.',
                    url: '#',
                    publishedDate: new Date().toISOString(),
                    sentiment: sim.sentiment as any,
                    sentimentScore: sim.sentiment === 'Positive' ? 0.8 : -0.5
                };
            }

            const currentMove = quote.changePercent;

            // 2. Ask Gemini to Predict
            // We create a temporary session just for this analysis tool call
            let response: any = null;
            try {
                const session = createChatSession();
                // We force the prompt to trigger the 'predictNewsImpact' tool
                const prompt = `Analyze the impact of this breaking news for ${ticker}: "${targetNews.title}". 
                The stock has currently moved ${currentMove}%. 
                Call the 'predictNewsImpact' tool to generate a quantitative prediction.`;

                response = await session.sendMessage(prompt);
            } catch (e) {
                console.warn('[NewsImpactView] Gemini unavailable, using fallback analysis.', e);
                setNotice(t(language, 'impact.noKeyFallback'));
            }
            
            if (response?.impactAnalysis) {
                setAnalysis(response.impactAnalysis);
            } else {
                // Fallback if tool wasn't called (rare)
                setAnalysis({
                    headline: targetNews.title,
                    ticker: ticker,
                    publishedTime: targetNews.publishedDate,
                    sentimentScore: targetNews.sentimentScore * 100,
                    predictedMoveLow: currentMove - 1,
                    predictedMoveHigh: currentMove + 1,
                    currentMove: currentMove,
                    remainingAlpha: 0,
                    confidence: 50,
                    reasoning: response?.text || "Fallback analysis based on quote movement and headline sentiment.",
                    similarEvents: [],
                    verdict: 'Wait'
                });
            }

        } catch (e) {
            console.error("Analysis Failed", e);
            setNotice(t(language, 'impact.error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="animate-fade-in w-full pb-10">
            <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'impact.title')} subtitle={t(language, 'impact.subtitle')} />
            {notice && <NuxNotice tone="warning">{notice}</NuxNotice>}
            {/* Header */}
            <div className="mb-8 bg-slate-900/60 p-6 rounded-2xl border border-white/10 backdrop-blur-md flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Radio className="w-6 h-6 text-rose-500 animate-pulse" />
                        {t(language, 'impact.title')}
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">{t(language, 'impact.subtitle')}</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <input 
                        type="text" 
                        value={ticker}
                        onChange={(e) => {
                            setTickerEdited(true);
                            setTicker(e.target.value.toUpperCase());
                        }}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl pl-4 py-3 text-white font-mono focus:border-indigo-500/50 outline-none uppercase font-bold"
                        placeholder={t(language, 'impact.tickerPlaceholder')}
                    />
                    <button 
                        onClick={analyze}
                        disabled={loading}
                        className="px-6 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-rose-500/20 disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                        {t(language, 'impact.predict')}
                    </button>
                </div>
            </div>

            {analysis && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Hero: Headline & Verdict */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-slate-900/60 border-l-4 border-rose-500 rounded-r-2xl p-6 backdrop-blur-md relative overflow-hidden">
                             <div className="absolute top-0 right-0 p-4 opacity-10">
                                 <Newspaper className="w-32 h-32" />
                             </div>
                             <div className="relative z-10">
                                 <div className="flex items-center gap-2 mb-2">
                                     <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider animate-pulse">Breaking</span>
                                     <span className="text-slate-400 text-xs font-mono">{new Date(analysis.publishedTime).toLocaleTimeString()}</span>
                                 </div>
                                 <h3 className="text-xl md:text-2xl font-bold text-white leading-tight mb-4">
                                     "{analysis.headline}"
                                 </h3>
                                 <div className="flex items-center gap-4">
                                     <div className={`px-4 py-2 rounded-lg border font-bold uppercase tracking-wide text-sm ${
                                         analysis.verdict === 'Load the Boat' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50' :
                                         analysis.verdict === 'Priced In' ? 'bg-slate-500/20 text-slate-300 border-slate-500/50' :
                                         'bg-amber-500/20 text-amber-400 border-amber-500/50'
                                     }`}>
                                         Verdict: {analysis.verdict}
                                     </div>
                                     <div className="text-slate-400 text-sm flex items-center gap-1">
                                         <Target className="w-4 h-4 text-indigo-400" /> Confidence: <span className="text-white font-bold">{analysis.confidence}%</span>
                                     </div>
                                 </div>
                             </div>
                        </div>

                        {/* The Impact Gauge */}
                        <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-6 flex items-center gap-2">
                                <Activity className="w-4 h-4 text-indigo-400" /> Price Impact Velocity
                            </h4>
                            
                            <div className="relative pt-8 pb-4">
                                {/* Track */}
                                <div className="h-4 bg-slate-800 rounded-full w-full relative">
                                    {/* Predicted Range Zone */}
                                    <div 
                                        className="absolute h-full bg-indigo-500/20 border-x border-indigo-500/50"
                                        style={{ 
                                            left: `${Math.min(Math.max((analysis.predictedMoveLow + 10) * 3, 0), 80)}%`, // Visual scaling for demo (assuming +/- 15% range)
                                            width: '20%' 
                                        }}
                                    ></div>
                                </div>

                                {/* Current Marker */}
                                <div className="absolute top-0 flex flex-col items-center transition-all duration-1000" style={{ left: '30%' }}>
                                    <div className="text-xs font-bold text-white mb-1">Current</div>
                                    <div className="w-0.5 h-12 bg-white relative">
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full"></div>
                                    </div>
                                    <div className={`mt-2 font-mono font-bold text-lg ${analysis.currentMove > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {analysis.currentMove > 0 ? '+' : ''}{analysis.currentMove}%
                                    </div>
                                </div>

                                {/* Predicted Marker */}
                                <div className="absolute top-0 flex flex-col items-center transition-all duration-1000" style={{ left: '70%' }}>
                                    <div className="text-xs font-bold text-indigo-400 mb-1">Predicted</div>
                                    <div className="w-0.5 h-12 bg-indigo-500/50 border-l border-dashed border-indigo-400 relative">
                                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3 h-3 bg-indigo-500 border border-indigo-300 rounded-full"></div>
                                    </div>
                                    <div className="mt-2 font-mono font-bold text-lg text-indigo-300">
                                        {analysis.predictedMoveLow}% - {analysis.predictedMoveHigh}%
                                    </div>
                                </div>
                                
                                {/* Alpha Arrow */}
                                <div className="absolute top-1/2 -translate-y-1/2 left-[32%] right-[32%] h-0.5 bg-emerald-500/50 flex items-center justify-center">
                                    <div className="bg-emerald-900/80 px-2 py-0.5 rounded text-[10px] text-emerald-400 font-bold uppercase border border-emerald-500/30">
                                        {analysis.remainingAlpha > 0 ? '+' : ''}{analysis.remainingAlpha}% Alpha Left
                                    </div>
                                </div>

                            </div>
                            
                            <p className="mt-6 text-sm text-slate-400 bg-slate-950/50 p-4 rounded-xl border border-white/5 italic">
                                "{analysis.reasoning}"
                            </p>
                        </div>
                    </div>

                    {/* Sidebar: Similar Events */}
                    <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-6 backdrop-blur-md">
                         <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                             <History className="w-4 h-4 text-amber-400" /> Historical Patterns
                         </h4>
                         <div className="space-y-4">
                             {analysis.similarEvents.map((evt, idx) => (
                                 <div key={idx} className="p-3 bg-slate-950/50 rounded-xl border border-white/5 hover:border-indigo-500/30 transition-colors">
                                     <div className="flex justify-between items-start mb-2">
                                         <span className="text-xs font-bold text-white line-clamp-1 w-2/3">{evt.event}</span>
                                         <span className="text-[10px] text-slate-500">{evt.date}</span>
                                     </div>
                                     <div className="flex items-center justify-between">
                                         <div className="flex items-center gap-1.5">
                                             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                             <span className="text-[10px] text-indigo-300 uppercase font-bold">{evt.similarity}% Match</span>
                                         </div>
                                         <div className={`font-mono font-bold text-sm ${evt.movePercent > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                             {evt.movePercent > 0 ? '+' : ''}{evt.movePercent}%
                                         </div>
                                     </div>
                                 </div>
                             ))}
                             {analysis.similarEvents.length === 0 && (
                                 <div className="text-center py-8 text-slate-500 text-sm">
                                     No direct historical correlation found. Model confidence reduced.
                                 </div>
                             )}
                         </div>

                         <div className="mt-6 pt-6 border-t border-white/5">
                             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Sentiment Velocity</h4>
                             <div className="flex items-end gap-1 h-20">
                                 {[20, 35, 45, 60, 55, 75, 85, 92].map((h, i) => (
                                     <div key={i} className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/40 transition-colors rounded-t-sm relative group" style={{ height: `${h}%` }}>
                                         <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity">{h}</div>
                                     </div>
                                 ))}
                             </div>
                             <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono uppercase">
                                 <span>News Break</span>
                                 <span>Now</span>
                             </div>
                         </div>
                    </div>

                </div>
            )}
            {!analysis && !loading && (
                <NuxNotice tone="info">
                    <strong>{t(language, 'impact.emptyTitle')}</strong> {t(language, 'impact.emptyBody')}
                </NuxNotice>
            )}
            <RiskDisclaimer language={language} />
        </div>
    );
};

export default NewsImpactView;
