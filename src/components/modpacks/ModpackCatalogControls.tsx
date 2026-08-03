import React from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

// Secondary modpack tabs and add-content routes deliberately share these seams.
// Keeping the layout tokens here prevents each route from inventing a slightly
// different content width or search/filter arrangement.
export const MODPACK_SECONDARY_CONTENT_WORKSPACE = {
  host: 'mx-auto w-full max-w-6xl space-y-4',
  controls: 'surface-card space-y-4 p-4',
  searchRow: 'w-full',
  filterRow: 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3',
  counter: 'surface-inline flex min-h-[5.75rem] flex-col items-center justify-center rounded-2xl px-3 py-3 text-center',
  action: 'min-h-10 min-w-[8.5rem] justify-center',
} as const;

export interface ModpackCatalogControlItem {
  key: string;
  label: string;
  control: React.ReactNode;
}

interface ModpackCatalogControlsProps {
  header?: React.ReactNode;
  searchLabel: string;
  searchControl: React.ReactNode;
  controls: ModpackCatalogControlItem[];
  activeFilterTokens?: string[];
  onReset?: () => void;
  resetLabel: string;
  status?: React.ReactNode;
  footer?: React.ReactNode;
  rootTestId?: string;
  headerTestId?: string;
  controlsTestId?: string;
  className?: string;
}

export const ModpackCatalogControls: React.FC<ModpackCatalogControlsProps> = ({
  header,
  searchLabel,
  searchControl,
  controls,
  activeFilterTokens = [],
  onReset,
  resetLabel,
  status,
  footer,
  rootTestId,
  headerTestId,
  controlsTestId,
  className,
}) => {
  return (
    <div
      className={cn('surface-muted mb-4 space-y-2.5 p-4', className)}
      role="search"
      aria-label={searchLabel}
      data-testid={rootTestId}
      data-catalog-controls="shared"
    >
      {header && <div data-testid={headerTestId}>{header}</div>}

      <div
        className="flex flex-col gap-3 lg:flex-row lg:items-end"
        data-testid={controlsTestId}
        data-catalog-controls-layout="compact-shared"
      >
        <div className="min-w-0 flex-[1.6] space-y-1">
          <div className="text-xs font-medium text-secondary">{searchLabel}</div>
          {searchControl}
        </div>
        {controls.length > 0 && (
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {controls.map((item) => (
              <div key={item.key} className="space-y-1">
                <div className="text-xs font-medium text-secondary">{item.label}</div>
                {item.control}
              </div>
            ))}
          </div>
        )}
        {onReset && activeFilterTokens.length > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="shrink-0 lg:self-end">
            {resetLabel}
          </Button>
        )}
      </div>

      {status && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
          {status}
        </div>
      )}

      {activeFilterTokens.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-secondary">
          {activeFilterTokens.map((token) => (
            <span key={token} className="rounded-full border border-border/70 bg-background/72 px-2.5 py-1">
              {token}
            </span>
          ))}
        </div>
      )}

      {footer}
    </div>
  );
};
