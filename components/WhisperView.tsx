
import React, { useState } from 'react';
import { Search, Globe, TrendingUp, Users, Smartphone, MessageCircle, RefreshCw, Briefcase, BarChart2, Zap } from 'lucide-react';
import { fetchWhisperData } from '../services/marketDataService';
import { WhisperData } from '../types';
import Whisper3DVisualizer from './Whisper3DVisualizer';
import { Language, t } from '../i18n';
import { NuxPageHeader, RiskDisclaimer } from './NuxPage';

const WhisperView: React.FC<{ language: Language }> = ({ language }) => {
  const [ticker, setTicker] = useState('NVDA');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<WhisperData | null>(null);

  const loadData = async () => {
      setLoading(true);
      try {
          const result = await fetchWhisperData(ticker);
          setData(result);
      } catch (e) {
          console.error(e);
      } finally {
          setLoading(false);
      }
  };

  // Initial load
  React.useEffect(() => {
      loadData();
  }, []);

  return (
    <div className="animate-fade-in w-full pb-10">
      <NuxPageHeader eyebrow={t(language, 'common.nuxEyebrow')} title={t(language, 'whisper.title')} subtitle={t(language, 'whisper.subtitle')} />
      
      {/* Header & Controls */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Users className="w-6 h-6 text-blue-400" />
                  {t(language, 'whisper.title')}
              </h2>
              <p className="text-slate-400 text-sm mt-1">{t(language, 'whisper.subtitle')}</p>
          </div>

          <div className="flex gap-2 w-full md:w-auto bg-slate-900 p-1.5 rounded-2xl border border-white/10">
              <input 
                type="text" 
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                className="bg-transparent border-none outline-none text-white font-mono px-4 py-1 w-32 placeholder-slate-600 font-bold"
                placeholder={t(language, 'common.tickerPlaceholder')}
              />
              <button 
                  onClick={loadData}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold transition-all shadow-lg disabled:opacity-50 flex items-center gap-2 text-xs"
              >
                  {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : t(language, 'whisper.scan')}
              </button>
          </div>
      </div>

      {data ? (
          <div className="relative">
              {/* 3D Visualizer */}
              <Whisper3DVisualizer data={data} />

              {/* Summary Overlay (Floating Glass Panel) */}
              <div className="absolute bottom-6 right-6 max-w-md w-full animate-fade-in-up">
                  <div className="bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl">
                      <div className="flex items-center gap-2 mb-3 text-indigo-300 text-xs font-bold uppercase tracking-wide">
                          <Zap className="w-4 h-4" /> Alpha Signal Analysis
                      </div>
                      <p className="text-sm text-slate-200 leading-relaxed font-medium">
                          {data.summary}
                      </p>
                      
                      <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-4">
                          <div>
                              <div className="text-[10px] text-slate-500 uppercase font-bold">Dominant Mood</div>
                              <div className={`text-lg font-bold ${data.overallScore > 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {data.sentimentLabel}
                              </div>
                          </div>
                          <div className="text-right">
                              <div className="text-[10px] text-slate-500 uppercase font-bold">Data Points</div>
                              <div className="text-lg font-mono text-white">
                                  {data.sources.length} Sources
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      ) : (
          <div className="h-[500px] flex items-center justify-center border border-white/10 rounded-3xl bg-slate-900/50 border-dashed">
              <div className="text-center text-slate-500">
                  <RefreshCw className="w-10 h-10 mx-auto mb-4 animate-spin opacity-50" />
                  <p className="text-sm font-medium">{t(language, 'whisper.emptyBody')}</p>
              </div>
          </div>
      )}
      <RiskDisclaimer language={language} />
    </div>
  );
};

export default WhisperView;
