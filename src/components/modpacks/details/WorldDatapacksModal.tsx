import React, { useState, useEffect } from 'react';
import { useSettings } from '../../../contexts/SettingsContext';
import { useToast } from '../../../contexts/ToastContext';
import { Button } from '../../ui/Button';
import { LoadingSpinner } from '../../ui/LoadingSpinner';
import { Modal } from '../../ui/Modal';
import { LazyImage } from '../../ui/LazyImage';
import { datapacksIPC, type Datapack } from '../../../services/ipc/datapacksIPC';
import { cn } from '../../../utils/cn';

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
    const [tab, setTab] = useState<Tab>('installed');

    // Installed state
    const [datapacks, setDatapacks] = useState<Datapack[]>([]);
    const [loadingInstalled, setLoadingInstalled] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [mcVersion, setMcVersion] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [installing, setInstalling] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        if (tab === 'installed') loadInstalled();
        else if (tab === 'search') handleSearch();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, tab]);

    const loadInstalled = async () => {
        setLoadingInstalled(true);
        try {
            const list = await datapacksIPC.list(instancePath, worldFolder);
            setDatapacks(list);
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.datapacks_load_error') || 'Failed to load datapacks');
        } finally {
            setLoadingInstalled(false);
        }
    };

    const handleSearch = async () => {
        setLoadingSearch(true);
        try {
            const res = await datapacksIPC.search(searchQuery, mcVersion || undefined);
            setSearchResults(res.hits || []);
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.datapacks_search_error') || 'Failed to search datapacks');
        } finally {
            setLoadingSearch(false);
        }
    };

    const handleToggle = async (pack: Datapack) => {
        try {
            if (pack.isEnabled) {
                await datapacksIPC.disable(instancePath, worldFolder, pack.fileName);
            } else {
                await datapacksIPC.enable(instancePath, worldFolder, pack.fileName);
            }
            await loadInstalled();
        } catch {
            toast.error(t('modpacks.datapack_toggle_error') || 'Failed to toggle datapack');
        }
    };

    const handleDelete = async (pack: Datapack) => {
        if (!confirm(`Delete datapack "${pack.name}"?`)) return;
        try {
            await datapacksIPC.delete(instancePath, worldFolder, pack.fileName);
            await loadInstalled();
        } catch {
            toast.error(t('modpacks.datapack_delete_error') || 'Failed to delete datapack');
        }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleInstall = async (project: any) => {
        setInstalling(project.project_id);
        try {
            // Get latest version
            const versions = await datapacksIPC.getVersions(project.project_id);
            if (!versions || versions.length === 0) throw new Error("No versions found");

            const latest = versions[0];
            await datapacksIPC.install(instancePath, worldFolder, latest.id);

            toast.success(`Installed ${project.title}`);
            if (tab === 'installed') loadInstalled(); // Should handle auto-switch?
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.datapack_install_error') || 'Failed to install datapack');
        } finally {
            setInstalling(null);
        }
    };

    if (!isOpen) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`${t('modpacks.datapacks') || 'Datapacks'} - ${worldName}`}
            className="max-w-4xl"
        >
            <div className="flex flex-col h-[70vh]">
                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-4 flex-shrink-0">
                    <button
                        className={cn("px-4 py-2 font-medium", tab === 'installed' ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400" : "text-gray-500")}
                        onClick={() => setTab('installed')}
                    >
                        {t('modpacks.installed') || 'Installed'}
                    </button>
                    <button
                        className={cn("px-4 py-2 font-medium", tab === 'search' ? "border-b-2 border-blue-500 text-blue-600 dark:text-blue-400" : "text-gray-500")}
                        onClick={() => setTab('search')}
                    >
                        {t('modpacks.search_modrinth') || 'Search Modrinth'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto min-h-0">
                    {tab === 'installed' ? (
                        <>
                            {loadingInstalled ? (
                                <div className="flex justify-center p-8"><LoadingSpinner /></div>
                            ) : datapacks.length === 0 ? (
                                <p className="text-center text-gray-500 p-8">{t('modpacks.no_datapacks_installed') || 'No datapacks installed.'}</p>
                            ) : (
                                <div className="space-y-2">
                                    {datapacks.map(pack => (
                                        <div key={pack.fileName} className={cn(
                                            "flex items-center p-3 rounded border",
                                            pack.isEnabled ? "bg-white dark:bg-zinc-800 border-gray-200 dark:border-gray-700" : "bg-gray-100 dark:bg-zinc-900 border-transparent opacity-80"
                                        )}>
                                            <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded flex items-center justify-center text-purple-600 text-xl mr-3">
                                                📦
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-medium">{pack.name}</h4>
                                                <p className="text-sm text-gray-500 truncate">{pack.description}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    variant={pack.isEnabled ? "secondary" : "primary"}
                                                    onClick={() => handleToggle(pack)}
                                                >
                                                    {pack.isEnabled ? 'Disable' : 'Enable'}
                                                </Button>
                                                <Button size="sm" variant="ghost" onClick={() => handleDelete(pack)} className="text-red-500">
                                                    ✕
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex flex-col h-full">
                            <form onSubmit={(e) => { e.preventDefault(); handleSearch(); }} className="flex gap-2 mb-4 flex-wrap">
                                <input
                                    className="flex-1 min-w-[200px] p-2 rounded border bg-white dark:bg-zinc-900 border-gray-300 dark:border-gray-700"
                                    placeholder={t('modpacks.search_datapacks_placeholder') || 'Search datapacks...'}
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                />
                                <select
                                    className="p-2 rounded border bg-white dark:bg-zinc-900 border-gray-300 dark:border-gray-700"
                                    value={mcVersion}
                                    onChange={e => setMcVersion(e.target.value)}
                                >
                                    <option value="">{t('modpacks.filter_all') || 'All MC Versions'}</option>
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
                                </select>
                                <Button type="submit" variant="primary" disabled={loadingSearch}>{t('modpacks.search_btn') || 'Search'}</Button>
                            </form>

                            <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
                                {loadingSearch ? (
                                    <div className="flex justify-center p-8"><LoadingSpinner /></div>
                                ) : (
                                    searchResults.map(project => (
                                        <div key={project.project_id} className="flex items-center p-3 rounded border bg-white dark:bg-zinc-800 border-gray-200 dark:border-gray-700">
                                            <div className="w-12 h-12 mr-3 flex-shrink-0">
                                                <LazyImage src={project.icon_url} fallback="/icon.png" className="w-full h-full rounded object-cover" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="font-medium">{project.title}</h4>
                                                <p className="text-sm text-gray-500 truncate">{project.description}</p>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="primary"
                                                onClick={() => handleInstall(project)}
                                                isLoading={installing === project.project_id}
                                                disabled={!!installing}
                                            >
                                                Install
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
};
