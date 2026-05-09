
import React from 'react';
import { FunctionSquare } from 'lucide-react';
import { Language, t } from '../../i18n';

interface FormulaBlockProps {
  language: Language;
  formula: string;
  description?: string;
}

const FormulaBlock: React.FC<FormulaBlockProps> = ({ language, formula, description }) => {
  return (
    <div className="bg-slate-900/60 backdrop-blur-md border border-white/10 rounded-2xl p-4 animate-fade-in">
      <h4 className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
        <FunctionSquare className="w-3.5 h-3.5 text-indigo-400" />
        {t(language, 'chat.blocks.formula')}
      </h4>
      <div className="bg-slate-950 rounded-xl border border-white/5 p-4 overflow-x-auto">
        <pre className="text-sm font-mono text-cyan-300 whitespace-pre-wrap break-all">
          {formula}
        </pre>
      </div>
      {description && (
        <p className="mt-2 text-xs text-slate-500 italic">{description}</p>
      )}
    </div>
  );
};

export default FormulaBlock;
