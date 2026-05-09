
import React from 'react';
import { Code } from 'lucide-react';
import { Language, t } from '../../i18n';

interface MermaidBlockProps {
  language: Language;
  code: string;
}

const MermaidBlock: React.FC<MermaidBlockProps> = ({ language, code }) => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
      <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        <Code className="w-3.5 h-3.5 text-indigo-400" />
        {t(language, 'chat.blocks.mermaid')}
      </h4>
      <div className="bg-slate-950 rounded-xl border border-white/5 p-4 overflow-x-auto">
        <pre className="text-xs font-mono text-slate-300 whitespace-pre-wrap break-all">
          {code}
        </pre>
      </div>
      <p className="mt-2 text-[10px] text-slate-500 italic">
        {t(language, 'chat.blocks.mermaidPlaceholder')}
      </p>
    </div>
  );
};

export default MermaidBlock;
