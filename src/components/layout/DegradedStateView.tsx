import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';

export type DegradedStateVariant = 'empty' | 'zero-results' | 'unavailable' | 'error';
export type DegradedStateLayout = 'card' | 'inline' | 'workspace';

type DegradedStateTone = {
  frame: string;
  label: string;
};

const DEGRADED_STATE_TONES: Record<DegradedStateVariant, DegradedStateTone> = {
  empty: {
    frame: 'border-border/70 bg-card/88',
    label: 'border-border/70 bg-background/80 text-secondary',
  },
  'zero-results': {
    frame: 'border-sky-500/20 bg-sky-500/6',
    label: 'border-sky-500/25 bg-sky-500/12 text-sky-700 dark:text-sky-200',
  },
  unavailable: {
    frame: 'border-amber-500/20 bg-amber-500/8',
    label: 'border-amber-500/25 bg-amber-500/12 text-amber-700 dark:text-amber-200',
  },
  error: {
    frame: 'border-red-500/24 bg-red-500/7',
    label: 'border-red-500/25 bg-red-500/12 text-red-700 dark:text-red-200',
  },
};

export interface DegradedStateViewProps {
  variant: DegradedStateVariant;
  title: string;
  description?: string;
  label?: string;
  layout?: DegradedStateLayout;
  footer?: ReactNode;
  children?: ReactNode;
  className?: string;
  testId?: string;
}

export function DegradedStateView({
  variant,
  title,
  description,
  label,
  layout = 'card',
  footer,
  children,
  className,
  testId,
}: DegradedStateViewProps) {
  const tone = DEGRADED_STATE_TONES[variant];
  const isInline = layout === 'inline' || layout === 'workspace';

  return (
    <section
      role={variant === 'error' ? 'alert' : 'status'}
      aria-live={variant === 'error' ? 'assertive' : 'polite'}
      data-layout={layout}
      data-variant={variant}
      data-testid={testId}
      className={cn('w-full', !isInline && 'flex justify-center', className)}
    >
      <div
        className={cn(
          isInline
            ? 'w-full rounded-2xl border px-4 py-4 sm:px-5 sm:py-5'
            : 'surface-card w-full max-w-2xl rounded-[28px] border px-6 py-6 sm:px-7 sm:py-7',
          tone.frame,
        )}
      >
        <div className={cn('flex flex-col gap-4', isInline && 'sm:flex-row sm:items-start sm:justify-between')}>
          <div className="min-w-0 flex-1 space-y-3">
            {label ? (
              <span
                className={cn(
                  'inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]',
                  tone.label,
                )}
              >
                {label}
              </span>
            ) : null}
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h2>
              {description ? <p className="max-w-xl text-sm leading-6 text-secondary sm:text-base">{description}</p> : null}
            </div>
            {children ? <div className="space-y-3">{children}</div> : null}
          </div>
          {footer ? (
            <div className={cn('flex flex-wrap items-start gap-3', isInline && 'sm:max-w-[18rem] sm:justify-end')}>{footer}</div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
