import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { FolderOpen, Share2 } from 'lucide-react';
import { useSettings } from '../../../contexts/SettingsContext';
import { AnchoredOverlay } from '../../ui/AnchoredOverlay';
import {
  rectFromElement,
  type AnchoredAlign,
  type AnchoredRect,
} from '../../ui/anchoredOverlayLayout';
import type { InstalledModpackItem } from './useInstalledModpackCatalog';
import {
  InstalledModpackMenuContext,
  type InstalledModpackMenuTrigger,
} from './installedModpackContextMenuContext';

interface OpenMenuState {
  anchorRect: AnchoredRect;
  align: AnchoredAlign;
  modpackId: string;
}

export interface InstalledModpackContextMenuProps {
  children: ReactNode;
  items: InstalledModpackItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onShowDetails: (id: string) => void;
  onShare: (id: string) => void;
  onExport: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string, name: string) => void;
  onDelete: (id: string, name: string) => void;
}

function translateWithFallback(
  t: (key: string, params?: Record<string, string | number>) => string,
  key: string,
  fallback: string,
): string {
  const value = t(key);
  return value === key ? fallback : value;
}

export function InstalledModpackContextMenu({
  children,
  items,
  selectedId,
  onSelect,
  onShowDetails,
  onShare,
  onExport,
  onRename,
  onDuplicate,
  onDelete,
}: InstalledModpackContextMenuProps) {
  const { t } = useSettings();
  const [menu, setMenu] = useState<OpenMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  const close = useCallback((restoreFocus = false) => {
    setMenu(null);
    const trigger = triggerRef.current;
    if (restoreFocus && trigger) {
      requestAnimationFrame(() => trigger.focus());
    }
  }, []);

  const open = useCallback((
    modpackId: string,
    anchorRect: AnchoredRect,
    trigger: HTMLElement | null,
    align: AnchoredAlign,
  ) => {
    triggerRef.current = trigger;
    setMenu({ modpackId, anchorRect, align });
  }, []);

  const openAtPointer = useCallback((event: ReactMouseEvent, modpackId: string) => {
    event.preventDefault();
    event.stopPropagation();
    open(modpackId, {
      top: event.clientY,
      left: event.clientX,
      right: event.clientX,
      bottom: event.clientY,
      width: 0,
      height: 0,
    }, null, 'start');
  }, [open]);

  const openFromButton = useCallback((event: ReactMouseEvent<HTMLButtonElement>, modpackId: string) => {
    event.preventDefault();
    event.stopPropagation();
    open(modpackId, rectFromElement(event.currentTarget), event.currentTarget, 'end');
  }, [open]);

  const openFromKeyboard = useCallback((anchor: HTMLElement, modpackId: string) => {
    open(modpackId, rectFromElement(anchor), anchor, 'end');
  }, [open]);

  useEffect(() => {
    if (!menu) return;
    const handleClickOutside = () => close();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [close, menu]);

  useEffect(() => {
    if (!menu) return;
    const frameId = requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    });
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      close(true);
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [close, menu]);

  const triggerValue = useMemo<InstalledModpackMenuTrigger>(() => ({
    activeModpackId: menu?.modpackId ?? null,
    openAtPointer,
    openFromButton,
    openFromKeyboard,
  }), [menu?.modpackId, openAtPointer, openFromButton, openFromKeyboard]);
  const activeItem = menu ? items.find((item) => item.id === menu.modpackId) : undefined;

  return (
    <InstalledModpackMenuContext.Provider value={triggerValue}>
      {children}
      {menu && (
        <AnchoredOverlay
          open={true}
          anchorRect={menu.anchorRect}
          placement="bottom"
          align={menu.align}
          offset={8}
          padding={12}
          className="z-50"
        >
          <div
            ref={menuRef}
            id={`modpack-actions-menu-${menu.modpackId}`}
            role="menu"
            aria-label={`${t('modpacks.actions_title') || 'More actions'}: ${activeItem?.name || menu.modpackId}`}
            className="surface-card min-w-[176px] py-1"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
              onClick={() => {
                onShowDetails(menu.modpackId);
                close();
              }}
            >
              <FolderOpen className="h-4 w-4" />
              {translateWithFallback(t, 'modpacks.open_details', 'Open details')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
              disabled={selectedId === menu.modpackId}
              aria-disabled={selectedId === menu.modpackId}
              onClick={() => {
                onSelect(menu.modpackId);
                close();
              }}
            >
              {selectedId === menu.modpackId
                ? translateWithFallback(t, 'modpacks.active_now', 'Active now')
                : translateWithFallback(t, 'modpacks.make_active', 'Make active')}
            </button>
            <div className="my-1 h-px bg-border/60" />
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
              onClick={() => {
                onShare(menu.modpackId);
                close();
              }}
            >
              <Share2 className="h-4 w-4" />
              {t('modpacks.share_btn')}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
              onClick={() => {
                onExport(menu.modpackId);
                close();
              }}
            >
              {t('modpacks.export') || 'Экспорт'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
              onClick={() => {
                if (activeItem) onRename(activeItem.id, activeItem.name);
                close();
              }}
            >
              {t('modpacks.rename') || 'Переименовать'}
            </button>
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-foreground hover:bg-background/70"
              onClick={() => {
                if (activeItem) onDuplicate(activeItem.id, activeItem.name);
                close();
              }}
            >
              {t('modpacks.duplicate') || 'Дублировать'}
            </button>
            <div className="my-1 h-px bg-border/60" />
            <button
              type="button"
              role="menuitem"
              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-background/70 dark:text-red-400"
              onClick={() => {
                if (activeItem) onDelete(activeItem.id, activeItem.name);
                close();
              }}
            >
              {t('modpacks.delete')}
            </button>
          </div>
        </AnchoredOverlay>
      )}
    </InstalledModpackMenuContext.Provider>
  );
}
