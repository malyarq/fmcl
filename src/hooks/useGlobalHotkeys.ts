import { useEffect } from 'react';

type HotkeyAction = (e: KeyboardEvent) => void;

interface HotkeyMap {
    [key: string]: HotkeyAction;
}

export const useGlobalHotkeys = (actions: HotkeyMap) => {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for modifier keys helper
            const isCtrlOrCmd = e.ctrlKey || e.metaKey;

            // Build string key like "ctrl+1" or "ctrl+,"
            let keyString = e.key.toLowerCase();

            // Special check for comma to avoid confusion
            if (keyString === ',') keyString = ',';

            // Only handle if Ctrl/Cmd is pressed for our shortcuts
            if (isCtrlOrCmd) {
                const action = actions[`ctrl+${keyString}`];
                if (action) {
                    e.preventDefault();
                    action(e);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [actions]);
};
