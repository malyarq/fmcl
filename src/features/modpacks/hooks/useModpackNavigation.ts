import { useState, useCallback } from 'react';

export type ModpackView = 
  | { type: 'list' }
  | { type: 'browser' }
  | { type: 'details'; modpackId: string }
  | { type: 'addMod'; modpackId: string }
  | { type: 'export'; modpackId: string }
  | { type: 'install'; modpack: any; versions: any[]; platform: 'curseforge' | 'modrinth' }
  | { type: 'importPreview'; filePath: string }
  | { type: 'create' };

export function useModpackNavigation() {
  const [view, setView] = useState<ModpackView>({ type: 'list' });
  const [history, setHistory] = useState<ModpackView[]>([{ type: 'list' }]);

  const navigate = useCallback((newView: ModpackView) => {
    setView(newView);
    setHistory(prev => [...prev, newView]);
  }, []);

  const goBack = useCallback(() => {
    setHistory(prev => {
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
    setView(targetView);
    setHistory(prev => [...prev, targetView]);
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
    reset,
    canGoBack: history.length > 1,
  };
}
