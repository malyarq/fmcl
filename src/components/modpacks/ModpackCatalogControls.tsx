import React from 'react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

export interface ModpackCatalogControlItem {
  key: string;
  label: string;
  control: React.ReactNode;
}

interface ModpackCatalogControlsProps {
  searchLabel: string;
  searchControl: React.ReactNode;
  controls: ModpackCatalogControlItem[];
  activeFilterTokens?: string[];
  onReset?: () => void;
  resetLabel: string;
  status?: React.ReactNode;
  footer?: React.ReactNode;
  rootTestId?: string;
  controlsTestId?: string;
  className?: string;
}

export const ModpackCatalogControls: React.FC<ModpackCatalogControlsProps> = ({
  searchLabel,
  searchControl,
  controls,
  activeFilterTokens = [],
  onReset,
  resetLabel,
  status,
  footer,
  rootTestId,
  controlsTestId,
  className,
}) => {
  return (
    <div
      className={cn('surface-muted mb-4 space-y-3 p-4', className)}
      role="search"
      aria-label={searchLabel}
      data-testid={rootTestId}
      data-catalog-controls="shared"
    >
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
