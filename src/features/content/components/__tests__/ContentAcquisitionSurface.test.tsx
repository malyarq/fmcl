// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type {
  ContentAcquisitionController,
  ContentAcquisitionItem,
  ContentAcquisitionSelection,
} from '../../contentAcquisitionTypes';
import { ContentAcquisitionSurface } from '../ContentAcquisitionSurface';

type Controller = ContentAcquisitionController<ContentAcquisitionItem, ContentAcquisitionSelection>;

const labels = {
  search: 'Search content',
  loading: 'Loading content',
  empty: 'No content found',
  error: 'Content unavailable',
  retry: 'Retry',
  loadMore: 'Load more',
  install: 'Install selected',
  installing: 'Installing',
  localImport: 'Import local file',
  selected: 'selected',
  partial: 'Some content needs attention',
};

function controller(overrides: Partial<Controller> = {}): Controller {
  return {
    query: '',
    filters: {},
    items: [],
    nextPage: null,
    total: undefined,
    checkedIds: new Set(),
    resolvingIds: new Set(),
    selections: new Map(),
    searchStatus: 'ready',
    isInstalling: false,
    isImportingLocal: false,
    error: null,
    outcome: null,
    canImportLocal: false,
    setQuery: vi.fn(),
    setFilter: vi.fn(),
    toggle: vi.fn().mockResolvedValue(undefined),
    loadNextPage: vi.fn().mockResolvedValue(undefined),
    installSelected: vi.fn().mockResolvedValue(null),
    retryFailed: vi.fn().mockResolvedValue(null),
    retrySearch: vi.fn().mockResolvedValue(undefined),
    importLocal: vi.fn().mockResolvedValue(null),
    reset: vi.fn(),
    ...overrides,
  };
}

describe('ContentAcquisitionSurface', () => {
  it('announces loading and empty states with labelled controls', () => {
    const { rerender } = render(<ContentAcquisitionSurface state={controller({ searchStatus: 'loading' })} labels={labels} />);
    expect(screen.getByRole('status').textContent).toContain('Loading content');
    expect(screen.getByRole('searchbox', { name: 'Search content' })).toBeTruthy();

    rerender(<ContentAcquisitionSurface state={controller()} labels={labels} />);
    expect(screen.getByRole('heading', { name: 'No content found' })).toBeTruthy();
  });

  it('renders search errors with an in-place retry action', () => {
    const retrySearch = vi.fn();
    render(<ContentAcquisitionSurface state={controller({ searchStatus: 'error', error: new Error('Provider unavailable'), retrySearch })} labels={labels} />);

    expect(screen.getByRole('alert').textContent).toContain('Provider unavailable');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retrySearch).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard selection in a narrow-first result grid', () => {
    const toggle = vi.fn().mockResolvedValue(undefined);
    render(<ContentAcquisitionSurface state={controller({
      items: [{ id: 'a', label: 'Item a', description: 'Description a' }],
      toggle,
    })} labels={labels} />);

    const list = screen.getByRole('list');
    expect(list.className).toContain('grid-cols-1');
    const checkbox = screen.getByRole('checkbox', { name: /Item a/ });
    checkbox.focus();
    fireEvent.keyDown(checkbox, { key: ' ' });
    fireEvent.click(checkbox);
    expect(toggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }), true);
  });

  it('keeps a partial committed outcome visible and retryable without success semantics', () => {
    const retryFailed = vi.fn();
    render(<ContentAcquisitionSurface state={controller({
      items: [{ id: 'b', label: 'Item b' }],
      checkedIds: new Set(['b']),
      selections: new Map([['b', { id: 'b', label: 'Item b' }]]),
      outcome: {
        didCommit: true,
        isPresentationSuccess: false,
        committedSelectionIds: ['a'],
        retainedSelectionIds: ['b'],
        issues: [{ selectionId: 'b', label: 'Item b', code: 'runtime-blocked' }],
      },
      retryFailed,
    })} labels={labels} />);

    const status = screen.getByRole('status', { name: 'Some content needs attention' });
    expect(status.getAttribute('data-acquisition-committed')).toBe('true');
    expect(status.getAttribute('data-presentation-success')).toBe('false');
    expect(status.textContent).toContain('Item b');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(retryFailed).toHaveBeenCalledTimes(1);
  });
});
