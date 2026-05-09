import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  language: string;
  code: string;
  className?: string;
}

/**
 * CodeBlock component renders syntax-highlighted code with copy functionality.
 *
 * Supports languages:
 * - JavaScript/TypeScript (javascript, typescript, js, ts)
 * - Python (python, py)
 * - SQL (sql)
 * - Bash/Shell (bash, shell)
 * - Java (java)
 * - C/C++ (c, cpp)
 * - Go (go)
 * - Rust (rust)
 * - And many more via Prism.js
 */
export const CodeBlock: React.FC<CodeBlockProps> = ({
  language,
  code,
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  // Normalize language names
  const normalizedLanguage = language.toLowerCase().replace(/^(\w+).*/, '$1');

  // Map common aliases
  const languageMap: Record<string, string> = {
    js: 'javascript',
    ts: 'typescript',
    py: 'python',
    sh: 'bash',
    shell: 'bash',
    yml: 'yaml',
    json: 'json',
    xml: 'xml',
    html: 'html',
    css: 'css',
  };

  const displayLanguage = languageMap[normalizedLanguage] || normalizedLanguage;

  return (
    <div className={`my-4 overflow-hidden rounded-lg border border-white/10 ${className}`}>
      {/* Header with language name and copy button */}
      <div className="flex items-center justify-between border-b border-white/10 bg-slate-900/80 px-4 py-2">
        <span className="text-xs font-medium text-slate-400 uppercase">
          {displayLanguage || 'code'}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors hover:bg-white/10"
          title={copied ? 'Copied!' : 'Copy code'}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-400">Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content with syntax highlighting */}
      <div className="max-h-[400px] overflow-auto">
        <SyntaxHighlighter
          language={displayLanguage}
          style={vscDarkPlus}
          customStyle={{
            margin: 0,
            padding: '1rem',
            background: 'transparent',
            fontSize: '0.875rem',
            lineHeight: '1.5',
          }}
          codeTagProps={{
            style: {
              fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, monospace',
            },
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
};

export default CodeBlock;
