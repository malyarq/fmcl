import { useCallback, useState } from 'react';
import type { ModpackSearchResultItem, ModpackVersionDescriptor } from '@shared/contracts/modpacks';

export type ModpackPlatform = 'curseforge' | 'modrinth';
export type ModpackBrowserSortOption = 'popularity' | 'date' | 'alphabetical';
export type ModpackBrowserFilterValue = string | 'all';

export interface ModpackBrowserState {
  platform: ModpackPlatform;
  query: string;
  sortBy: ModpackBrowserSortOption;
  filterMCVersion: ModpackBrowserFilterValue;
  filterLoader: ModpackBrowserFilterValue;
  currentPage: number;
  itemsPerPage: number;
  showHistory: boolean;
}

export const DEFAULT_MODPACK_BROWSER_STATE: ModpackBrowserState = {
  platform: 'modrinth',
  query: '',
  sortBy: 'popularity',
  filterMCVersion: 'all',
  filterLoader: 'all',
  currentPage: 1,
  itemsPerPage: 12,
  showHistory: false,
};

const AVAILABLE_MODPACK_BROWSER_PLATFORMS: ReadonlyArray<ModpackPlatform> = ['modrinth'];

export function normalizeModpackBrowserState(state: ModpackBrowserState): ModpackBrowserState {
  const nextPlatform = AVAILABLE_MODPACK_BROWSER_PLATFORMS.includes(state.platform)
    ? state.platform
    : DEFAULT_MODPACK_BROWSER_STATE.platform;

  return {
    ...DEFAULT_MODPACK_BROWSER_STATE,
    ...state,
    platform: nextPlatform,
  };
}

export type ModpackView =
  | { type: 'list' }
  | { type: 'browser'; state: ModpackBrowserState }
  | { type: 'details'; modpackId: string }
  | { type: 'addMod'; modpackId: string }
  | { type: 'addResourcePack'; modpackId: string }
  | { type: 'addShader'; modpackId: string }
  | { type: 'export'; modpackId: string }
  | { type: 'install'; modpack: ModpackSearchResultItem; versions: ModpackVersionDescriptor[]; platform: ModpackPlatform }
  | { type: 'importPreview'; filePath: string }
  | { type: 'create' };

function normalizeView(view: ModpackView): ModpackView {
  if (view.type !== 'browser') {
    return view;
  }

  return {
    type: 'browser',
    state: normalizeModpackBrowserState(view.state),
  };
}

export function useModpackNavigation() {
  const [view, setView] = useState<ModpackView>({ type: 'list' });
  const [history, setHistory] = useState<ModpackView[]>([{ type: 'list' }]);

  const navigate = useCallback((newView: ModpackView) => {
    const normalizedView = normalizeView(newView);
    setView(normalizedView);
    setHistory((prev) => [...prev, normalizedView]);
  }, []);

  const goBack = useCallback(() => {
    setHistory((prev) => {
      if (prev.length <= 1) {
        // Если только один элемент в истории, возвращаемся к списку
        setView({ type: 'list' });
        return [{ type: 'list' }];
      }
      // Удаляем текущий вид и переходим к предыдущему
      const newHistory = prev.slice(0, -1);
      setView(newHistory[newHistory.length - 1]);
      return newHistory;
    });
  }, []);

  const goTo = useCallback((targetView: ModpackView) => {
    const normalizedView = normalizeView(targetView);
    setView(normalizedView);
    setHistory((prev) => [...prev, normalizedView]);
  }, []);

  const replace = useCallback((targetView: ModpackView) => {
    const normalizedView = normalizeView(targetView);
    setView(normalizedView);
    setHistory((prev) => {
      if (prev.length === 0) {
        return [normalizedView];
      }

      return [...prev.slice(0, -1), normalizedView];
    });
  }, []);

  const reset = useCallback(() => {
    setView({ type: 'list' });
    setHistory([{ type: 'list' }]);
  }, []);

  return {
    view,
    navigate,
    goBack,
    goTo,
    replace,
    reset,
    canGoBack: history.length > 1,
  };
}
