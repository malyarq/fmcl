import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
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
        aria-expanded={expanded}
        data-state={expanded ? 'expanded' : 'collapsed'}
        className={cn(
          'flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs font-bold uppercase tracking-wider transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          expanded
            ? 'border-[rgb(var(--accent-main)/0.24)] bg-[rgb(var(--accent-main)/0.12)] text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.16)]'
            : 'border-border/60 bg-card/68 text-secondary hover:border-[rgb(var(--accent-main)/0.16)] hover:bg-card/92 hover:text-foreground'
        )}
      >
        <span>{title}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-transform duration-200 ease-out',
            expanded ? 'rotate-180' : 'rotate-0'
          )}
        />
      </button>
      {showHint && showHintState && hintText && (
        <div className="surface-inline p-2 text-xs text-secondary">
          {hintText}
        </div>
      )}
      <div
        className={cn(
          'overflow-hidden transition-all duration-200 ease-out',
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        )}
        aria-hidden={!expanded}
      >
        <div className="pt-2 space-y-3">{children}</div>
      </div>
    </div>
  );
}
