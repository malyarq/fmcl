import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { DegradedStateView } from '../../layout/DegradedStateView';
import { Modal } from '../../ui/Modal';
import { Select } from '../../ui/Select';
import { toDisplayErrorMessage } from '../../../utils/displayError';

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
    const { t, getAccentStyles, formatNumber } = useSettings();
    const toast = useToast();
    const confirm = useConfirm();
    const [tab, setTab] = useState<Tab>('installed');
    const [datapacks, setDatapacks] = useState<Datapack[]>([]);
    const [loadingInstalled, setLoadingInstalled] = useState(false);
    const [installedError, setInstalledError] = useState<unknown | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [mcVersion, setMcVersion] = useState('');
    const [searchResults, setSearchResults] = useState<DatapackSearchResultItem[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [searchError, setSearchError] = useState<unknown | null>(null);
    const [installing, setInstalling] = useState<string | null>(null);
    const enabledDatapacks = useMemo(() => datapacks.filter((pack) => pack.isEnabled), [datapacks]);
    const hasSearchFilters = searchQuery.trim().length > 0 || mcVersion.length > 0;
    const activeTabBackground = getAccentStyles('soft-bg');
    const activeTabBorder = getAccentStyles('soft-border');
    const activeTabLabel = getAccentStyles('title');

    const loadInstalled = useCallback(async () => {
        setLoadingInstalled(true);
        setInstalledError(null);
        try {
            const list = await datapacksIPC.list(instancePath, worldFolder);
            setDatapacks(list);
        } catch (err) {
            console.error(err);
            setInstalledError(err);
            toast.error(t('modpacks.datapacks_load_error'));
        } finally {
            setLoadingInstalled(false);
        }
    }, [instancePath, t, toast, worldFolder]);

    const handleSearch = useCallback(async () => {
        setLoadingSearch(true);
        setSearchError(null);
        try {
            const res = await datapacksIPC.search(searchQuery, mcVersion || undefined);
            setSearchResults(res.hits || []);
        } catch (err) {
            console.error(err);
            setSearchError(err);
            toast.error(t('modpacks.datapacks_search_error'));
        } finally {
            setLoadingSearch(false);
        }
    }, [mcVersion, searchQuery, t, toast]);
    const installedErrorDescription = installedError
        ? toDisplayErrorMessage(installedError, t('error.inline_fallback'))
        : t('error.inline_fallback');
    const searchErrorDescription = searchError
        ? toDisplayErrorMessage(searchError, t('error.inline_fallback'))
        : t('error.inline_fallback');

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
            <div className="space-y-4">
                <div className="surface-inline grid gap-2 p-2 sm:grid-cols-2" role="tablist" aria-label={t('modpacks.datapacks')}>
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
                                data-state={isActive ? 'active' : 'inactive'}
                                className={cn(
                                    'rounded-xl border px-4 py-2 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-main))] focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                    isActive
                                        ? cn(
                                            'border-border bg-card/90 text-foreground shadow-[0_12px_28px_rgba(0,0,0,0.16)]',
                                            activeTabBackground.className,
                                            activeTabBorder.className,
                                            activeTabLabel.className,
                                        )
                                        : 'border-transparent text-secondary hover:bg-card/72 hover:text-foreground'
                                )}
                                style={isActive ? {
                                    ...activeTabBackground.style,
                                    ...activeTabBorder.style,
                                    ...activeTabLabel.style,
                                } : undefined}
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
                        className="space-y-4"
                    >
                        <div className="surface-card space-y-2 p-4">
                            <div className="kicker-label">{t('modpacks.datapacks')}</div>
                            <h4 className="text-base font-semibold text-foreground">{t('modpacks.datapacks')}</h4>
                            <p className="text-sm text-secondary">{t('modpacks.datapacks_description')}</p>
                            <div
                                className="grid gap-3 pt-2 lg:grid-cols-[minmax(0,1fr)_repeat(2,minmax(0,9rem))]"
                                data-testid="world-datapacks-installed-summary"
                            >
                                <div className="surface-inline p-3 text-sm text-secondary">
                                    {t('modpacks.datapacks_description')}
                                </div>
                                <div className="surface-inline rounded-2xl px-3 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('modpacks.enabled')}</p>
                                    <p className="mt-2 text-base font-semibold text-foreground">{installedError ? t('degraded.unavailable_label') : formatNumber(enabledDatapacks.length)}</p>
                                </div>
                                <div className="surface-inline rounded-2xl px-3 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('modpacks.installed')}</p>
                                    <p className="mt-2 text-base font-semibold text-foreground">{installedError ? t('degraded.unavailable_label') : formatNumber(datapacks.length)}</p>
                                </div>
                            </div>
                        </div>

                        {loadingInstalled ? (
                            <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
                                <LoadingSpinner size="sm" variant="accent" />
                                {t('modpacks.loading')}
                            </div>
                        ) : installedError ? (
                            <DegradedStateView
                                variant="unavailable"
                                label={t('degraded.unavailable_label')}
                                title={t('modpacks.datapacks_load_error')}
                                description={installedErrorDescription}
                                footer={(
                                    <>
                                        <Button size="sm" variant="secondary" onClick={() => void loadInstalled()}>
                                            {t('modpacks.world_refresh')}
                                        </Button>
                                        <Button size="sm" variant="secondary" onClick={() => setTab('search')}>
                                            <Search className="h-4 w-4" />
                                            {t('modpacks.search_modrinth')}
                                        </Button>
                                    </>
                                )}
                            />
                        ) : datapacks.length === 0 ? (
                            <DegradedStateView
                                variant="empty"
                                label={t('degraded.empty_label')}
                                title={t('modpacks.no_datapacks_installed')}
                                description={t('modpacks.datapacks_empty_hint')}
                                footer={(
                                    <Button size="sm" variant="secondary" onClick={() => setTab('search')}>
                                        <Search className="h-4 w-4" />
                                        {t('modpacks.search_modrinth')}
                                    </Button>
                                )}
                            />
                        ) : (
                            <div className="space-y-3" role="list" aria-label={t('modpacks.datapacks')}>
                                {datapacks.map((pack) => (
                                    <div
                                        key={pack.fileName}
                                        role="listitem"
                                        data-state={pack.isEnabled ? 'active' : 'inactive'}
                                        className={cn(
                                            'surface-card flex flex-col gap-4 p-4 transition-colors lg:flex-row lg:items-center lg:justify-between',
                                            pack.isEnabled
                                                ? 'border-border/70 bg-card/86'
                                                : 'border-border/55 bg-background/78 text-secondary'
                                        )}
                                    >
                                        <div className="flex min-w-0 flex-1 items-center gap-4">
                                            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background/70 text-[rgb(var(--accent-main))]">
                                                <Package className="h-6 w-6" />
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h4 className="break-words text-base font-semibold leading-5 text-foreground">{pack.name}</h4>
                                                    <span className="rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-xs font-medium text-secondary">
                                                        {pack.isEnabled ? t('modpacks.filter_enabled') : t('modpacks.filter_disabled')}
                                                    </span>
                                                </div>
                                                <p className="line-clamp-2 break-words text-sm text-secondary">{pack.description}</p>
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
                    </section>
                ) : (
                    <section
                        id="datapacks-panel-search"
                        role="tabpanel"
                        aria-labelledby="datapacks-tab-search"
                        className="space-y-4"
                    >
                        <div className="surface-card space-y-4 p-4">
                            <div className="space-y-2">
                                <div className="kicker-label">{t('modpacks.search_modrinth')}</div>
                                <p className="text-sm text-secondary">{t('modpacks.datapacks_description')}</p>
                            </div>
                            <div className="grid gap-4 lg:grid-cols-[1fr_15rem_auto]">
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
                            <div className="flex justify-end" data-testid="world-datapacks-search-summary">
                                <div className="surface-inline rounded-2xl px-3 py-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">{t('modpacks.results')}</p>
                                    <p className="mt-2 text-base font-semibold text-foreground">{searchError ? t('degraded.unavailable_label') : formatNumber(searchResults.length)}</p>
                                </div>
                            </div>
                        </div>

                        {loadingSearch ? (
                            <div className="surface-inline flex items-center justify-center gap-3 p-6 text-sm text-secondary" role="status">
                                <LoadingSpinner size="sm" variant="accent" />
                                {t('modpacks.loading')}
                            </div>
                        ) : searchError ? (
                            <DegradedStateView
                                variant="unavailable"
                                label={t('degraded.unavailable_label')}
                                title={t('modpacks.datapacks_search_error')}
                                description={searchErrorDescription}
                                footer={(
                                    <Button size="sm" variant="secondary" onClick={() => void handleSearch()}>
                                        <Search className="h-4 w-4" />
                                        {t('modpacks.search_btn')}
                                    </Button>
                                )}
                            />
                        ) : searchResults.length === 0 ? (
                            hasSearchFilters ? (
                                <DegradedStateView
                                    variant="zero-results"
                                    label={t('degraded.zero_results_label')}
                                    title={t('modpacks.no_datapack_results')}
                                    description={t('modpacks.datapacks_search_hint')}
                                    footer={(
                                        <Button
                                            size="sm"
                                            variant="secondary"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setMcVersion('');
                                            }}
                                        >
                                            {t('modpacks.clear_filters')}
                                        </Button>
                                    )}
                                />
                            ) : (
                                <DegradedStateView
                                    variant="empty"
                                    label={t('degraded.empty_label')}
                                    title={t('modpacks.search_modrinth')}
                                    description={t('modpacks.datapacks_search_hint')}
                                />
                            )
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
                                                <LazyImage src={project.icon_url ?? undefined} className="h-full w-full object-cover" />
                                            </div>
                                            <div className="min-w-0 space-y-1">
                                                <h4 className="break-words text-base font-semibold leading-5 text-foreground">{project.title}</h4>
                                                <p className="line-clamp-2 break-words text-sm text-secondary">{project.description}</p>
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
                    </section>
                )}
            </div>
        </Modal>
    );
};
