import type { CSSProperties } from 'react';
import { cn } from '../../utils/cn';

export function ModloaderSection(props: {
  version: string;
  useForge: boolean;
  setUseForge: (val: boolean) => void;
  useFabric: boolean;
  setUseFabric: (val: boolean) => void;
  useNeoForge: boolean;
  setUseNeoForge: (val: boolean) => void;
  setLoader: (loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge') => void;
  forgeSupportedVersions: string[];
  fabricSupportedVersions: string[];
  neoForgeSupportedVersions: string[];
  isModloadersLoading?: boolean;
  t: (key: string) => string;
  getAccentStyles: (type: 'bg') => { className?: string; style?: CSSProperties };
}) {
  const {
    version,
    useForge,
    useFabric,
    useNeoForge,
    setLoader,
    forgeSupportedVersions,
    fabricSupportedVersions,
    neoForgeSupportedVersions,
    isModloadersLoading = false,
    t,
    getAccentStyles,
  } = props;

  // Показываем все 3 модлоадера, пока загружаем версии или списки пусты. После загрузки — только поддерживаемые.
  const hasData =
    forgeSupportedVersions.length > 0 ||
    fabricSupportedVersions.length > 0 ||
    neoForgeSupportedVersions.length > 0;
  const showAllThree = isModloadersLoading || !hasData;

  const isForgeSupported = forgeSupportedVersions.includes(version);
  const isFabricSupported = fabricSupportedVersions.includes(version);
  const isNeoForgeSupported = neoForgeSupportedVersions.includes(version);

  const availableModloaders: Array<{ id: 'neoforge' | 'forge' | 'fabric'; label: string; isActive: boolean }> = [];
  if (showAllThree) {
    availableModloaders.push(
      { id: 'neoforge', label: t('neoforge.enable'), isActive: useNeoForge },
      { id: 'forge', label: t('forge.enable'), isActive: useForge },
      { id: 'fabric', label: t('fabric.enable'), isActive: useFabric },
    );
  } else {
    if (isNeoForgeSupported) availableModloaders.push({ id: 'neoforge', label: t('neoforge.enable'), isActive: useNeoForge });
    if (isForgeSupported) availableModloaders.push({ id: 'forge', label: t('forge.enable'), isActive: useForge });
    if (isFabricSupported) availableModloaders.push({ id: 'fabric', label: t('fabric.enable'), isActive: useFabric });
  }

  if (availableModloaders.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2" data-tour="modloaders">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
        {t('general.modloader') || 'Modloader'}
      </label>
      {showAllThree && (
        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
          {t('modloaders.loading_hint') || 'Checking available versions in the background. Compatible modloaders will appear within a minute.'}
        </p>
      )}
      <div className="flex bg-zinc-100/80 dark:bg-zinc-900/50 backdrop-blur-sm p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-700/50 shadow-inner">
        {availableModloaders.map((loader) => {
          const isActive = loader.isActive;
          return (
            <button
              key={loader.id}
              onClick={() => {
                // Use direct setLoader to avoid race conditions from multiple state updates
                if (isActive) {
                  setLoader('vanilla');
                } else {
                  setLoader(loader.id);
                }
              }}
              className={cn(
                'flex-1 py-2 text-xs font-bold uppercase rounded-lg transition-all',
                isActive
                  ? cn('bg-white/90 dark:bg-zinc-700/90 backdrop-blur-sm shadow-md text-zinc-900 dark:text-white', getAccentStyles('bg').className)
                  : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
              )}
              style={isActive ? getAccentStyles('bg').style : undefined}
            >
              {loader.id === 'neoforge' ? 'NeoForge' : loader.id === 'forge' ? 'Forge' : 'Fabric'}
            </button>
          );
        })}
      </div>
    </div>
  );
}

