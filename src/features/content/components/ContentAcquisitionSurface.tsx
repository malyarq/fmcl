import type { ReactNode } from 'react';
import type {
  AcquisitionIssue,
  ContentAcquisitionController,
  ContentAcquisitionItem,
  ContentAcquisitionSelection,
} from '../contentAcquisitionTypes';
import { Button } from '../../../components/ui/Button';
import { DegradedStateView } from '../../../components/layout/DegradedStateView';
import { toDisplayErrorMessage } from '../../../utils/displayError';

export type ContentAcquisitionLabels = {
  search: string;
  loading: string;
  empty: string;
  emptyDescription?: string;
  error: string;
  errorDescription?: string;
  retry: string;
  loadMore: string;
  install: string;
  installing: string;
  localImport: string;
  selected: string;
  partial: string;
  success?: string;
  searchPlaceholder?: string;
  issueMessages?: Partial<Record<AcquisitionIssue['code'], string>>;
};

export type ContentAcquisitionSurfaceTestIds = {
  resultsViewport?: string;
  results?: string;
  actions?: string;
  outcome?: string;
  localImport?: string;
};

export function ContentAcquisitionSurface<
  Item extends ContentAcquisitionItem,
  Selection extends ContentAcquisitionSelection,
>({
  state,
  labels,
  controls,
  secondaryAction,
  renderItem,
  testIds,
  className = 'space-y-4',
  resultsClassName = '',
  actionsClassName = '',
}: {
  state: ContentAcquisitionController<Item, Selection>;
  labels: ContentAcquisitionLabels;
  controls?: ReactNode;
  secondaryAction?: ReactNode;
  renderItem?: (item: Item, selection: Selection | undefined) => ReactNode;
  testIds?: ContentAcquisitionSurfaceTestIds;
  className?: string;
  resultsClassName?: string;
  actionsClassName?: string;
}) {
  const selectedCount = state.selections.size;
  const isInitialLoading = state.searchStatus === 'loading' && state.items.length === 0;
  const showEmpty = state.searchStatus === 'ready' && state.items.length === 0;
  const outcomeTone = state.outcome?.isPresentationSuccess
    ? 'success'
    : state.outcome?.didCommit || state.outcome?.issues.every(({ code }) => code === 'duplicate')
      ? 'warning'
      : 'error';

  return (
    <section
      className={className}
      aria-busy={state.searchStatus === 'loading' || state.isInstalling || undefined}
      data-secondary-content-workspace="shared"
    >
      <label className="block space-y-1.5">
        <span className="control-label">{labels.search}</span>
        <input
          type="search"
          value={state.query}
          onChange={(event) => state.setQuery(event.target.value)}
          aria-label={labels.search}
          placeholder={labels.searchPlaceholder}
          className="control-frame min-h-11 w-full px-4 py-2.5 text-sm"
        />
      </label>

      {controls}

      <div className={resultsClassName} data-testid={testIds?.resultsViewport}>
        {isInitialLoading ? (
          <div role="status" aria-live="polite" className="surface-muted p-4 text-sm text-secondary">
            {labels.loading}
          </div>
        ) : null}

        {state.searchStatus === 'error' ? (
          <DegradedStateView
            variant="error"
            layout="inline"
            title={labels.error}
            description={toDisplayErrorMessage(state.error, labels.errorDescription ?? labels.error)}
            footer={<Button variant="secondary" onClick={() => { void state.retrySearch(); }}>{labels.retry}</Button>}
          />
        ) : null}

        {showEmpty ? (
          <DegradedStateView
            variant={state.query.trim() ? 'zero-results' : 'empty'}
            layout="inline"
            title={labels.empty}
            description={labels.emptyDescription}
          />
        ) : null}

        {state.items.length > 0 ? (
          <ul role="list" className="grid grid-cols-1 gap-3 md:grid-cols-2" data-testid={testIds?.results}>
            {state.items.map((item) => {
              const checked = state.checkedIds.has(item.id);
              const resolving = state.resolvingIds.has(item.id);
              return (
                <li key={item.id} className="surface-soft min-w-0 p-4">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={state.isInstalling || resolving}
                      onChange={(event) => { void state.toggle(item, event.target.checked); }}
                      aria-label={`${item.label}${checked ? `, ${labels.selected}` : ''}`}
                      className="mt-1 h-4 w-4"
                    />
                    {renderItem ? renderItem(item, state.selections.get(item.id)) : (
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-foreground">{item.label}</span>
                        {item.description ? <span className="mt-1 block text-sm text-secondary">{item.description}</span> : null}
                      </span>
                    )}
                  </label>
                </li>
              );
            })}
          </ul>
        ) : null}

        {state.nextPage !== null ? (
          <Button
            variant="secondary"
            onClick={() => { void state.loadNextPage(); }}
            isLoading={state.searchStatus === 'loading-more'}
          >
            {labels.loadMore}
          </Button>
        ) : null}
      </div>

      <div className={actionsClassName || 'space-y-3'} data-testid={testIds?.actions}>
        {state.outcome ? (
          <section
            role="status"
            aria-label={state.outcome.isPresentationSuccess ? (labels.success ?? labels.install) : labels.partial}
            aria-live="polite"
            data-testid={testIds?.outcome}
            data-tone={outcomeTone}
            data-acquisition-committed={String(state.outcome.didCommit)}
            data-presentation-success={String(state.outcome.isPresentationSuccess)}
            className={outcomeTone === 'success'
              ? 'rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-4'
              : outcomeTone === 'warning'
                ? 'rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4'
                : 'rounded-2xl border border-red-500/25 bg-red-500/10 p-4'}
          >
            <p className="text-sm font-medium text-foreground">
              {state.outcome.isPresentationSuccess ? (labels.success ?? labels.install) : labels.partial}
            </p>
            {state.outcome.issues.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-secondary">
                {state.outcome.issues.map((issue) => {
                  const detail = issue.message ?? labels.issueMessages?.[issue.code];
                  return (
                    <li key={`${issue.selectionId}:${issue.code}`}>
                      {issue.label}{detail ? `: ${detail}` : ''}
                    </li>
                  );
                })}
              </ul>
            ) : null}
            {state.outcome.retainedSelectionIds.length > 0 ? (
              <Button className="mt-3" variant="secondary" size="sm" onClick={() => { void state.retryFailed(); }}>
                {labels.retry}
              </Button>
            ) : null}
          </section>
        ) : null}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        {secondaryAction}
        {state.canImportLocal ? (
          <Button
            variant="secondary"
            onClick={() => { void state.importLocal(); }}
            isLoading={state.isImportingLocal}
            data-testid={testIds?.localImport}
          >
            {labels.localImport}
          </Button>
        ) : null}
        <Button
          onClick={() => { void state.installSelected(); }}
          disabled={selectedCount === 0 || state.resolvingIds.size > 0}
          isLoading={state.isInstalling}
        >
          {state.isInstalling ? labels.installing : labels.install}
        </Button>
        </div>
      </div>
    </section>
  );
}
