import React, { useState, useEffect } from 'react';
import { cn } from '../../utils/cn';

export interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  storageKey?: string;
  children: React.ReactNode;
  className?: string;
  onToggle?: (expanded: boolean) => void;
  showHint?: boolean;
  hintText?: string;
  hintStorageKey?: string;
}

export function CollapsibleSection({
  title,
  defaultExpanded = false,
  storageKey,
  children,
  className,
  onToggle,
  showHint = false,
  hintText,
  hintStorageKey,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(() => {
    if (storageKey) {
      const saved = localStorage.getItem(storageKey);
      if (saved !== null) {
        return saved === 'true';
      }
    }
    return defaultExpanded;
  });

  const [showHintState, setShowHintState] = useState(() => {
    if (showHint && hintStorageKey) {
      const saved = localStorage.getItem(hintStorageKey);
      return saved !== 'false';
    }
    return false;
  });

  useEffect(() => {
    if (storageKey) {
      localStorage.setItem(storageKey, String(expanded));
    }
    onToggle?.(expanded);
  }, [expanded, storageKey, onToggle]);

  const handleToggle = () => {
    setExpanded((prev) => !prev);
    if (showHintState && hintStorageKey) {
      localStorage.setItem(hintStorageKey, 'false');
      setShowHintState(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center justify-between w-full text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
      >
        <span>{title}</span>
        <span
          className={cn(
            'transition-transform duration-200 ease-out',
            expanded ? 'rotate-180' : 'rotate-0'
          )}
        >
          ▼
        </span>
      </button>
      {showHint && showHintState && hintText && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 bg-zinc-100/50 dark:bg-zinc-800/50 rounded-lg p-2 border border-zinc-200 dark:border-zinc-700">
          {hintText}
        </div>
      )}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
      >
        <div className="pt-2 space-y-3">{children}</div>
      </div>
    </div>
  );
}
