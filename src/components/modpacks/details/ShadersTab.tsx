import { useState, useEffect, useCallback } from 'react';
import { useToast } from '../../../contexts/ToastContext';
import { useSettings } from '../../../contexts/SettingsContext';
import { shadersIPC } from '../../../services/ipc/shadersIPC';
import type { ShaderPack } from '@shared/contracts/shaders';
import { Button } from '../../ui/Button';
import { cn } from '../../../utils/cn';

interface ShadersTabProps {
    instancePath: string;
    onUpdate?: () => void;
    onAddShader?: () => void;
}

export function ShadersTab({ instancePath, onUpdate, onAddShader }: ShadersTabProps) {
    const { t } = useSettings();
    const [packs, setPacks] = useState<ShaderPack[]>([]);
    const [loading, setLoading] = useState(true);
    const toast = useToast();

    // Load shaders
    const loadPacks = useCallback(async () => {
        setLoading(true);
        try {
            const list = await shadersIPC.list(instancePath);
            setPacks(list);
        } catch (err) {
            console.error(err);
            toast.error(t('modpacks.shader_load_error') || 'Failed to load shader packs');
        } finally {
            setLoading(false);
        }
    }, [instancePath, toast, t]);

    useEffect(() => {
        loadPacks();
    }, [loadPacks]);

    const handleSetActive = async (pack: ShaderPack) => {
        try {
            await shadersIPC.setActive(pack.fileName, instancePath);
            await loadPacks();
            onUpdate?.();
            toast.success(t('modpacks.shader_active_success', { name: pack.name }) || `Shader "${pack.name}" activated`);
        } catch {
            toast.error(t('modpacks.shader_set_error') || 'Failed to set active shader');
        }
    };

    const handleDisable = async () => {
        try {
            await shadersIPC.disable(instancePath);
            await loadPacks();
            onUpdate?.();
            toast.success(t('modpacks.shader_disable_success') || 'Shaders disabled');
        } catch {
            toast.error(t('modpacks.shader_disable_error') || 'Failed to disable shaders');
        }
    };

    const handleDelete = async (pack: ShaderPack) => {
        if (!confirm(t('modpacks.shader_delete_confirm', { name: pack.name }) || `Delete ${pack.name}?`)) return;
        try {
            await shadersIPC.delete(pack.fileName, instancePath);
            await loadPacks();
            onUpdate?.();
        } catch {
            toast.error(t('modpacks.shader_delete_error') || 'Failed to delete shader');
        }
    };

    const activeShader = packs.find(p => p.isActive);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold dark:text-gray-200">{t('modpacks.installed_shaders') || 'Installed Shader Packs'}</h3>
                <div className="flex gap-2">
                    {onAddShader && (
                        <Button onClick={onAddShader} variant="primary" size="sm">{t('modpacks.add_shader_btn') || '+ Add Shader'}</Button>
                    )}
                    <Button onClick={loadPacks} variant="secondary" size="sm">{t('modpacks.update') || 'Refresh'}</Button>
                </div>
            </div>

            {/* Active shader indicator */}
            <div className="text-sm text-gray-600 dark:text-gray-400">
                {t('modpacks.shader_active') || 'Active'}: <span className="font-medium">{activeShader?.name ?? (t('modpacks.shader_active_none') || '(None - Internal)')}</span>
                {activeShader && (
                    <Button onClick={handleDisable} variant="ghost" size="sm" className="ml-2">
                        {t('modpacks.shader_disable') || 'Disable'}
                    </Button>
                )}
            </div>

            {loading ? (
                <div className="text-center py-8 text-gray-500">{t('modpacks.loading') || 'Loading...'}</div>
            ) : packs.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-xl">
                    <p className="text-gray-500">{t('modpacks.no_shaders_installed') || 'No shader packs installed'}</p>
                </div>
            ) : (
                <div className="grid gap-2">
                    {packs.map((pack) => (
                        <div
                            key={pack.fileName}
                            className={cn(
                                "flex items-center gap-4 p-3 rounded-lg border transition-all",
                                pack.isActive
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 shadow-sm"
                                    : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:border-zinc-300"
                            )}
                        >
                            <div className="w-10 h-10 flex-shrink-0 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg flex items-center justify-center text-white text-lg">
                                ✦
                            </div>

                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium truncate text-gray-900 dark:text-gray-100">{pack.name}</h4>
                                <p className="text-xs text-gray-500 truncate">{pack.fileName}</p>
                            </div>

                            <div className="flex items-center gap-2">
                                {pack.isActive ? (
                                    <span className="text-green-600 dark:text-green-400 font-medium text-sm">{t('modpacks.shader_active') || 'Active'}</span>
                                ) : (
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => handleSetActive(pack)}
                                    >
                                        {t('modpacks.shader_activate') || 'Activate'}
                                    </Button>
                                )}

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                    onClick={() => handleDelete(pack)}
                                >
                                    ✕
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
