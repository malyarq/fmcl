export type ContentAcquisitionKind = 'mod' | 'resourcepack' | 'shader';

export type ContentRuntimeInputMap = {
  mod: {
    instanceId: string;
    minecraftVersion?: string;
    loader?: string;
  };
  resourcepack: {
    instanceId: string;
    minecraftVersion?: string;
  };
  shader: {
    instanceId: string;
    minecraftVersion?: string;
    shaderSupport: 'supported' | 'unsupported' | 'unknown';
  };
};

export type ContentRuntimeInput<K extends ContentAcquisitionKind> = ContentRuntimeInputMap[K];
export type ContentAcquisitionFilters = Readonly<Record<string, string>>;

export type ContentAcquisitionItem = {
  id: string;
  label: string;
  description?: string;
};

export type ContentAcquisitionSelection = {
  id: string;
  label: string;
};

export type ContentSearchPage<Item extends ContentAcquisitionItem> = {
  items: readonly Item[];
  nextPage: number | null;
  total?: number;
};

export type ContentSearchRequest<K extends ContentAcquisitionKind> = {
  kind: K;
  query: string;
  filters: ContentAcquisitionFilters;
  page: number;
  runtime: ContentRuntimeInput<K>;
};

export type AcquisitionIssue = {
  selectionId: string;
  label: string;
  code: 'duplicate' | 'invalid-archive' | 'runtime-blocked' | 'install-failure' | 'manifest-failure' | 'unknown';
  message?: string;
};

export type AcquisitionOutcome = {
  didCommit: boolean;
  isPresentationSuccess: boolean;
  committedSelectionIds: readonly string[];
  retainedSelectionIds: readonly string[];
  issues: readonly AcquisitionIssue[];
};

type ContentAcquisitionAdapterBase<
  K extends ContentAcquisitionKind,
  Item extends ContentAcquisitionItem,
  Selection extends ContentAcquisitionSelection,
> = {
  kind: K;
  search(request: ContentSearchRequest<K>): Promise<ContentSearchPage<Item>>;
  resolveSelection(input: {
    item: Item;
    filters: ContentAcquisitionFilters;
    runtime: ContentRuntimeInput<K>;
  }): Promise<Selection>;
  install(input: {
    selections: readonly Selection[];
    runtime: ContentRuntimeInput<K>;
  }): Promise<AcquisitionOutcome>;
};

export type ContentAcquisitionAdapter<
  K extends ContentAcquisitionKind,
  Item extends ContentAcquisitionItem = ContentAcquisitionItem,
  Selection extends ContentAcquisitionSelection = ContentAcquisitionSelection,
> = ContentAcquisitionAdapterBase<K, Item, Selection> & {
  importLocal?: K extends 'mod'
    ? never
    : (input: { runtime: ContentRuntimeInput<K> }) => Promise<AcquisitionOutcome>;
};

export type ContentAcquisitionSearchStatus = 'idle' | 'loading' | 'loading-more' | 'ready' | 'error';

export type ContentAcquisitionController<
  Item extends ContentAcquisitionItem,
  Selection extends ContentAcquisitionSelection,
> = {
  query: string;
  filters: ContentAcquisitionFilters;
  items: readonly Item[];
  nextPage: number | null;
  total: number | undefined;
  checkedIds: ReadonlySet<string>;
  resolvingIds: ReadonlySet<string>;
  selections: ReadonlyMap<string, Selection>;
  searchStatus: ContentAcquisitionSearchStatus;
  isInstalling: boolean;
  isImportingLocal: boolean;
  error: unknown;
  outcome: AcquisitionOutcome | null;
  canImportLocal: boolean;
  setQuery(query: string): void;
  setFilter(key: string, value: string): void;
  toggle(item: Item, checked: boolean): Promise<void>;
  loadNextPage(): Promise<void>;
  installSelected(): Promise<AcquisitionOutcome | null>;
  retryFailed(): Promise<AcquisitionOutcome | null>;
  retrySearch(): Promise<void>;
  importLocal(): Promise<AcquisitionOutcome | null>;
  reset(): void;
};
