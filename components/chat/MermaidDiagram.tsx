import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidDiagramProps {
  chart: string;
  theme?: 'dark' | 'light';
  className?: string;
}

/**
 * MermaidDiagram component renders Mermaid flowcharts and diagrams.
 *
 * Supports:
 * - Flowcharts (graph TD/LR)
 * - Sequence diagrams
 * - State diagrams
 * - Class diagrams
 * - Entity relationship diagrams
 * - User journey diagrams
 * - Gantt charts
 * - Pie charts
 * - Mindmaps
 *
 * Usage in AI responses:
 * ```mermaid
 * graph TD
 *   A[Start] --> B{Decision}
 *   B -->|Yes| C[Action 1]
 *   B -->|No| D[Action 2]
 * ```
 */
export const MermaidDiagram: React.FC<MermaidDiagramProps> = ({
  chart,
  theme = 'dark',
  className = '',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Initialize Mermaid once
    if (!isInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: theme === 'dark' ? 'dark' : 'default',
        securityLevel: 'loose',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        fontSize: 14,
        themeVariables: {
          darkMode: true,
          background: '#0f172a',
          primaryColor: '#3b82f6',
          primaryTextColor: '#f1f5f9',
          primaryBorderColor: '#1e40af',
          lineColor: '#64748b',
          secondaryColor: '#1e293b',
          tertiaryColor: '#0f172a',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        },
      });
      setIsInitialized(true);
    }
  }, [isInitialized, theme]);

  useEffect(() => {
    if (!isInitialized || !ref.current || !chart) return;

    const renderDiagram = async () => {
      try {
        setError(null);

        // Generate unique ID for this diagram
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;

        // Validate and render the diagram
        const { svg } = await mermaid.render(id, chart);

        if (ref.current) {
          ref.current.innerHTML = svg;

          // Apply custom styles to SVG
          const svgElement = ref.current.querySelector('svg');
          if (svgElement) {
            svgElement.style.maxHeight = '400px';
            svgElement.style.overflow = 'auto';
          }
        }
      } catch (err: any) {
        console.error('Mermaid rendering error:', err);
        setError(err.message || 'Failed to render diagram');
      }
    };

    renderDiagram();
  }, [chart, isInitialized]);

  if (error) {
    return (
      <div className={`rounded-lg border border-red-500/20 bg-red-500/5 p-4 ${className}`}>
        <p className="text-sm text-red-400">Diagram Error: {error}</p>
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-red-300">View source</summary>
          <pre className="mt-2 overflow-auto rounded bg-red-950/30 p-2 text-xs text-red-200">
            {chart}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={`my-4 flex items-center justify-center overflow-hidden rounded-lg border border-white/10 bg-slate-900/50 p-4 ${className}`}
      data-mermaid
    />
  );
};

export default MermaidDiagram;
