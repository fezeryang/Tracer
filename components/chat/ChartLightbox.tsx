import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface ChartLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

/**
 * ChartLightbox provides a modal overlay for viewing charts in full size.
 *
 * Usage:
 * - Click on an embedded chart to open lightbox
 * - Press Escape or click X to close
 * - Click outside content to close
 */
export const ChartLightbox: React.FC<ChartLightboxProps> = ({
  isOpen,
  onClose,
  children,
  title,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    // Prevent body scroll when lightbox is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-h-[90vh] max-w-[95vw] overflow-auto rounded-xl bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">{title || 'Chart'}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

interface ClickableChartProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

/**
 * ClickableChart wraps a chart to make it clickable for lightbox viewing.
 */
export const ClickableChart: React.FC<ClickableChartProps> = ({
  children,
  title,
  className = '',
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={`cursor-pointer transition-transform hover:scale-[1.01] ${className}`}
        title="Click to enlarge"
      >
        {children}
      </div>

      <ChartLightbox
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={title}
      >
        <div onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </ChartLightbox>
    </>
  );
};

export default ChartLightbox;
