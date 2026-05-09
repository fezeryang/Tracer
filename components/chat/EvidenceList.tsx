
import React from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { Language, t } from '../../i18n';

interface EvidenceItem {
  label: string;
  source?: string;
  url?: string;
}

interface EvidenceListProps {
  language: Language;
  items: EvidenceItem[];
}

const EvidenceList: React.FC<EvidenceListProps> = ({ language, items }) => {
  if (!items || items.length === 0) {
    return (
      <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
        <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
          <FileText className="w-3.5 h-3.5 text-indigo-400" />
          {t(language, 'chat.blocks.evidence')}
        </h4>
        <p className="text-xs text-slate-500 italic">{t(language, 'chat.blocks.noEvidence')}</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
      <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        <FileText className="w-3.5 h-3.5 text-indigo-400" />
        {t(language, 'chat.blocks.evidence')}
      </h4>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between bg-slate-950/50 p-2.5 rounded-lg border border-white/5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
              <span className="text-xs text-slate-200 truncate">{item.label}</span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
              {item.source && (
                <span className="text-[9px] text-slate-500 uppercase font-bold">{item.source}</span>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-500 hover:text-white transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EvidenceList;
