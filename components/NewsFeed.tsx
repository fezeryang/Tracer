
import React from 'react';
import { NewsItem } from '../types';
import { ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface NewsFeedProps {
  news: NewsItem[];
}

const NewsFeed: React.FC<NewsFeedProps> = ({ news }) => {
  if (!news || news.length === 0) return null;

  return (
    <div className="w-full bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden mt-4 animate-fade-in">
      <div className="p-4 border-b border-white/5 bg-gradient-to-r from-slate-800/50 to-transparent flex items-center justify-between">
         <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            Market Intelligence
         </h3>
         <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Live Sentiment Feed</span>
      </div>

      <div className="divide-y divide-white/5">
        {news.map((item, idx) => (
          <div key={idx} className="p-4 hover:bg-white/5 transition-colors group">
             <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border font-bold uppercase tracking-wide flex items-center gap-1 ${
                          item.sentiment === 'Positive' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          item.sentiment === 'Negative' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      }`}>
                         {item.sentiment === 'Positive' && <TrendingUp className="w-3 h-3" />}
                         {item.sentiment === 'Negative' && <TrendingDown className="w-3 h-3" />}
                         {item.sentiment === 'Neutral' && <Minus className="w-3 h-3" />}
                         {item.sentiment}
                      </span>
                      <span className="text-[10px] text-slate-500">{item.site}</span>
                      <span className="text-[10px] text-slate-600">•</span>
                      <span className="text-[10px] text-slate-500">{new Date(item.publishedDate).toLocaleDateString()}</span>
                   </div>
                   <h4 className="text-sm font-medium text-slate-200 leading-snug group-hover:text-white transition-colors">
                      {item.title}
                   </h4>
                   <p className="text-xs text-slate-400 mt-2 line-clamp-2">{item.text}</p>
                </div>
                {item.image && (
                   <img src={item.image} alt="news" className="w-16 h-16 object-cover rounded-lg opacity-80 group-hover:opacity-100 transition-opacity border border-white/5" />
                )}
             </div>
             
             {/* Sentiment Bar */}
             <div className="mt-3 flex items-center gap-2">
                <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                        className={`h-full ${
                             item.sentiment === 'Positive' ? 'bg-emerald-500' :
                             item.sentiment === 'Negative' ? 'bg-rose-500' :
                             'bg-slate-500'
                        }`}
                        style={{ 
                            width: `${Math.abs(item.sentimentScore * 100)}%`,
                            marginLeft: item.sentimentScore < 0 ? 'auto' : '0' // Visual trick for alignment if needed, though simple width is usually fine for magnitude
                        }}
                    ></div>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
                   Read <ExternalLink className="w-3 h-3" />
                </a>
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NewsFeed;
