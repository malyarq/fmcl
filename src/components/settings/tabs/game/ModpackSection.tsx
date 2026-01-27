import { useMemo, useState } from 'react';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { useToast } from '../../../../contexts/ToastContext';
import type { ModpackConfig, ModpackListItem } from '../../../../contexts/ModpackContext';

export function ModpackSection(props: {
  modpacks: ModpackListItem[];
  modpackId: string;
  modpackConfig: ModpackConfig | null;
  selectInstance: (id: string) => Promise<void>;
  createInstance: (name: string) => Promise<void>;
  renameInstance: (id: string, name: string) => Promise<void>;
  deleteInstance: (id: string) => Promise<void>;
  refreshInstances: () => Promise<void>;
  t: (key: string) => string;
}) {
  const {
    modpacks,
    modpackId,
    modpackConfig,
    selectInstance,
    createInstance,
    renameInstance,
    deleteInstance,
    refreshInstances,
    t,
  } = props;
  const toast = useToast();

  const [renameModpackName, setRenameModpackName] = useState(() => modpackConfig?.name || '');

  const modpackOptions = useMemo(() => {
    return (modpacks.length > 0 ? modpacks : [{ id: 'default', name: 'Default', path: '', selected: true }]) as ModpackListItem[];
  }, [modpacks]);

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300 block">
        {t('modpacks.title')}
      </label>

      <div className="bg-white/60 dark:bg-zinc-900/40 rounded-xl border border-zinc-200/50 dark:border-zinc-800/50 p-3 space-y-3">
        <div className="space-y-2">
          <label className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            {t('modpacks.selected')}
          </label>
          <select
            value={modpackId}
            onChange={async (e) => {
              const id = e.target.value;
              try {
                await selectInstance(id);
              } catch {
                /* ignore */
              }
            }}
            className="w-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm border border-zinc-300/50 dark:border-zinc-700/50 rounded-lg p-3 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-400 dark:focus:ring-zinc-600 shadow-sm hover:shadow-md transition-all"
          >
            {modpackOptions.map((mp) => (
              <option key={mp.id} value={mp.id}>
                {mp.name} ({mp.id})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 bg-zinc-200 text-zinc-900 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-600"
              onClick={async () => {
                const name = renameModpackName.trim() || t('modpacks.new_default_name');
                try {
                  await createInstance(name);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  toast.error(msg);
                }
              }}
            >
              {t('modpacks.create')}
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              disabled={modpackId === 'default'}
              onClick={async () => {
                try {
                  await deleteInstance(modpackId);
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  toast.error(msg);
                }
              }}
            >
              {t('modpacks.delete')}
            </Button>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-200/60 dark:border-zinc-800/60 space-y-2">
          <Input
            label={t('modpacks.name')}
            value={renameModpackName}
            onChange={(e) => setRenameModpackName(e.target.value)}
            placeholder={t('modpacks.rename_placeholder')}
            onKeyDown={async (e) => {
              if (e.key !== 'Enter') return;
              const name = renameModpackName.trim();
              if (!name) return;
              if (name === (modpackConfig?.name || '')) return;
              try {
                await renameInstance(modpackId, name);
                await refreshInstances();
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                toast.error(msg);
              }
            }}
            onBlur={async () => {
              const name = renameModpackName.trim();
              if (!name) return;
              if (name === (modpackConfig?.name || '')) return;
              try {
                await renameInstance(modpackId, name);
                await refreshInstances();
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                toast.error(msg);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

