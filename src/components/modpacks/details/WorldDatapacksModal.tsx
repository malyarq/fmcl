import React, { useCallback, useEffect, useState } from 'react';
import { Download, Package, Search, Trash2 } from 'lucide-react';
import { useConfirm } from '../../../contexts/ConfirmContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import {
    datapacksIPC,
    type Datapack,
    type DatapackSearchResultItem,
    type DatapackVersion,
} from '../../../services/ipc/datapacksIPC';
import { cn } from '../../../utils/cn';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { LazyImage } from '../../ui/LazyImage';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Modal } from '../../ui/Modal';
import { Select } from '../../ui/Select';

interface WorldDatapacksModalProps {
    isOpen: boolean;
    onClose: () => void;
    instancePath: string;
    worldFolder: string;
    worldName: string;
}

type Tab = 'installed' | 'search';

export const WorldDatapacksModal: React.FC<WorldDatapacksModalProps> = ({
    isOpen,
    onClose,
    instancePath,
    worldFolder,
    worldName,
}) => {
    const { t } = useSettings();
    const toast = useToast();
    const confirm = useConfirm();
    const [tab, setTab] = useState<Tab>('installed');
    const [datapacks, setDatapacks] = useState<Datapack[]>([]);
    const [loadingInstalled, setLoadingInstalled] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [mcVersion, setMcVersion] = useState('');
    const [searchResults, setSearchResults] = useState<DatapackSearchResultItem[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [installing, setInstalling] = useState<string | null>(null);

    const loadInstalled = useCallback(async () => {
        setLoadingInstalled(true);
        try {
            const list = await datapacksIPC.list(instancePath, worldFolder);
            setDatapacks(list);
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.datapacks_load_error'));
        } finally {
            setLoadingInstalled(false);
        }
    }, [instancePath, t, toast, worldFolder]);

    const handleSearch = useCallback(async () => {
        setLoadingSearch(true);
        try {
            const res = await datapacksIPC.search(searchQuery, mcVersion || undefined);
            setSearchResults(res.hits || []);
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.datapacks_search_error'));
        } finally {
            setLoadingSearch(false);
        }
    }, [mcVersion, searchQuery, t, toast]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        if (tab === 'installed') {
            void loadInstalled();
            return;
        }

        void handleSearch();
    }, [handleSearch, isOpen, loadInstalled, tab]);

    const handleToggle = useCallback(
        async (pack: Datapack) => {
            try {
                if (pack.isEnabled) {
                    await datapacksIPC.disable(instancePath, worldFolder, pack.fileName);
                } else {
                    await datapacksIPC.enable(instancePath, worldFolder, pack.fileName);
                }
                await loadInstalled();
            } catch {
                toast.error(t('modpacks.datapack_toggle_error'));
            }
        },
        [instancePath, loadInstalled, t, toast, worldFolder]
    );

    const handleDelete = useCallback(
        async (pack: Datapack) => {
            const confirmed = await confirm.confirm({
                title: t('modpacks.datapacks'),
                message: t('modpacks.datapack_delete_confirm', { name: pack.name }),
                variant: 'danger',
                confirmText: t('modpacks.delete'),
                cancelText: t('general.cancel'),
            });

            if (!confirmed) {
                return;
            }

            try {
                await datapacksIPC.delete(instancePath, worldFolder, pack.fileName);
                await loadInstalled();
            } catch {
                toast.error(t('modpacks.datapack_delete_error'));
            }
        },
        [confirm, instancePath, loadInstalled, t, toast, worldFolder]
    );

    const handleInstall = useCallback(
        async (project: DatapackSearchResultItem) => {
            setInstalling(project.project_id);
            try {
                const versions = await datapacksIPC.getVersions(project.project_id);
                const latest = versions[0] as DatapackVersion | undefined;
                if (!latest) {
                    throw new Error('No versions found');
                }

                await datapacksIPC.install(instancePath, worldFolder, latest.id);
                toast.success(t('modpacks.datapack_install_success', { name: project.title }));
                await loadInstalled();
                setTab('installed');
            } catch (err) {
                console.error(err);
                toast.error(t('modpacks.datapack_install_error'));
            } finally {
                setInstalling(null);
            }
        },
        [instancePath, loadInstalled, t, toast, worldFolder]
    );

    if (!isOpen) {
        return null;
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('modpacks.datapacks_for_world', { name: worldName })} className="max-w-5xl">
            <div className="flex h-[70vh] flex-col gap-4">
                <div className="surface-inline flex items-center gap-2 p-2" role="tablist" aria-label={t('modpacks.datapacks')}>
                    {(['installed', 'search'] as const).map((entry) => {
                        const isActive = tab === entry;
                        const label = entry === 'installed' ? t('modpacks.installed') : t('modpacks.search_modrinth');

                        return (
                            <button
                                key={entry}
                                type="button"
                                role="tab"
                                id={`datapacks-tab-${entry}`}
                                aria-selected={isActive}
                                aria-controls={`datapacks-panel-${entry}`}
                                className={cn(
                                    'rounded-xl px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                    isActive
                                        ? 'bg-[rgb(var(--accent-main))] text-[rgb(var(--accent-content))]'
                                        : 'text-secondary hover:bg-card/72 hover:text-foreground'
                                )}
                                onClick={() => setTab(entry)}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {tab === 'installed' ? (
                    <section
                        id="datapacks-panel-installed"
                        role="tabpanel"
                        aria-labelledby="datapacks-tab-installed"
                        className="flex min-h-0 flex-1 flex-col gap-4"
                    >
                        <div className="surface-card space-y-2 p-4">
                            <div className="kicker-label">{t('modpacks.datapacks')}</div>
                            <h4 className="text-base font-semibold text-foreground">{t('modpacks.datapacks')}</h4>
                            <p className="text-sm text-secondary">{t('modpacks.datapacks_description')}</p>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            {loadingInstalled ? (
                                <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
                                    <LoadingSpinner size="sm" variant="accent" />
                                    {t('modpacks.loading')}
                                </div>
                            ) : datapacks.length === 0 ? (
                                <div className="surface-muted flex flex-col items-center gap-2 p-8 text-center">
                                    <p className="text-base font-semibold text-foreground">{t('modpacks.no_datapacks_installed')}</p>
                                    <p className="max-w-xl text-sm text-secondary">{t('modpacks.datapacks_empty_hint')}</p>
                                </div>
                            ) : (
                                <div className="space-y-3" role="list" aria-label={t('modpacks.datapacks')}>
                                    {datapacks.map((pack) => (
                                        <div
                                            key={pack.fileName}
                                            role="listitem"
                                            className={cn('surface-card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between', !pack.isEnabled && 'opacity-75')}
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                                <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-[rgb(var(--accent-main))]">
                                                    <Package className="h-6 w-6" />
                                                </div>
                                                <div className="min-w-0 space-y-1">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <h4 className="truncate text-base font-semibold text-foreground">{pack.name}</h4>
                                                        <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
                                                            {pack.isEnabled ? t('modpacks.filter_enabled') : t('modpacks.filter_disabled')}
                                                        </span>
                                                    </div>
                                                    <p className="truncate text-sm text-secondary">{pack.description}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                                                <Button
                                                    size="sm"
                                                    variant={pack.isEnabled ? 'secondary' : 'primary'}
                                                    onClick={() => void handleToggle(pack)}
                                                >
                                                    {pack.isEnabled ? t('general.disable') : t('general.enable')}
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                    onClick={() => void handleDelete(pack)}
                                                    aria-label={t('modpacks.datapack_delete_confirm', { name: pack.name })}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                ) : (
                    <section
                        id="datapacks-panel-search"
                        role="tabpanel"
                        aria-labelledby="datapacks-tab-search"
                        className="flex min-h-0 flex-1 flex-col gap-4"
                    >
                        <div className="surface-card grid gap-4 p-4 lg:grid-cols-[1fr_15rem_auto]">
                            <Input
                                label={t('modpacks.search_modrinth')}
                                placeholder={t('modpacks.search_datapacks_placeholder')}
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                            />
                            <Select
                                label={t('modpacks.filter_all')}
                                value={mcVersion}
                                onChange={(event) => setMcVersion(event.target.value)}
                            >
                                <option value="">{t('modpacks.filter_all')}</option>
                                <option value="1.21.4">1.21.4</option>
                                <option value="1.21.3">1.21.3</option>
                                <option value="1.21.1">1.21.1</option>
                                <option value="1.21">1.21</option>
                                <option value="1.20.6">1.20.6</option>
                                <option value="1.20.4">1.20.4</option>
                                <option value="1.20.2">1.20.2</option>
                                <option value="1.20.1">1.20.1</option>
                                <option value="1.20">1.20</option>
                                <option value="1.19.4">1.19.4</option>
                                <option value="1.19.2">1.19.2</option>
                                <option value="1.18.2">1.18.2</option>
                                <option value="1.17.1">1.17.1</option>
                                <option value="1.16.5">1.16.5</option>
                            </Select>
                            <div className="flex items-end">
                                <Button type="button" variant="primary" disabled={loadingSearch} onClick={() => void handleSearch()}>
                                    <Search className="h-4 w-4" />
                                    {t('modpacks.search_btn')}
                                </Button>
                            </div>
                        </div>

                        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                            {loadingSearch ? (
                                <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
                                    <LoadingSpinner size="sm" variant="accent" />
                                    {t('modpacks.loading')}
                                </div>
                            ) : searchResults.length === 0 ? (
                                <div className="surface-muted flex flex-col items-center gap-2 p-8 text-center">
                                    <p className="text-base font-semibold text-foreground">{t('modpacks.no_datapack_results')}</p>
                                    <p className="max-w-xl text-sm text-secondary">{t('modpacks.datapacks_search_hint')}</p>
                                </div>
                            ) : (
                                <div className="space-y-3" role="list" aria-label={t('modpacks.search_modrinth')}>
                                    {searchResults.map((project) => (
                                        <div
                                            key={project.project_id}
                                            role="listitem"
                                            className="surface-card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between"
                                        >
                                            <div className="flex min-w-0 flex-1 items-center gap-4">
                                                <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-2xl border border-border/70 bg-background/70">
                                                    <LazyImage src={project.icon_url ?? undefined} fallback="/icon.png" className="h-full w-full object-cover" />
                                                </div>
                                                <div className="min-w-0 space-y-1">
                                                    <h4 className="truncate text-base font-semibold text-foreground">{project.title}</h4>
                                                    <p className="line-clamp-2 text-sm text-secondary">{project.description}</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={() => void handleInstall(project)}
                                                isLoading={installing === project.project_id}
                                                disabled={Boolean(installing)}
                                            >
                                                <Download className="h-4 w-4" />
                                                {t('modpacks.install_datapack')}
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>
                )}
            </div>
        </Modal>
    );
};
