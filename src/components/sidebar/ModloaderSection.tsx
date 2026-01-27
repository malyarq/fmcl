import type { CSSProperties } from 'react';
import { Button } from '../ui/Button';
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
    t,
    getAccentStyles,
  } = props;

  const isForgeSupported = forgeSupportedVersions.includes(version);
  const isFabricSupported = fabricSupportedVersions.includes(version);
  const isNeoForgeSupported = neoForgeSupportedVersions.includes(version);

  const availableModloaders: Array<{ id: 'neoforge' | 'forge' | 'fabric'; label: string; isActive: boolean }> = [];
  if (isNeoForgeSupported) {
    availableModloaders.push({ id: 'neoforge', label: t('neoforge.enable'), isActive: useNeoForge });
  }
  if (isForgeSupported) {
    availableModloaders.push({ id: 'forge', label: t('forge.enable'), isActive: useForge });
  }
  if (isFabricSupported) {
    availableModloaders.push({ id: 'fabric', label: t('fabric.enable'), isActive: useFabric });
  }

  if (availableModloaders.length === 0) {
    return null;
  }

  // Show button if only one modloader is available
  if (availableModloaders.length === 1) {
    const loader = availableModloaders[0];
    return (
      <Button
        onClick={() => {
          // Use direct setLoader to avoid race conditions from multiple state updates
          setLoader(loader.isActive ? 'vanilla' : loader.id);
        }}
        variant={loader.isActive ? 'primary' : 'secondary'}
        className={cn('w-full justify-center', loader.isActive && getAccentStyles('bg').className)}
        style={loader.isActive ? getAccentStyles('bg').style : undefined}
      >
        {loader.label}
      </Button>
    );
  }

  // Show switcher if multiple modloaders are available
  return (
    <div className="space-y-2" data-tour="modloaders">
      <label className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
        {t('general.modloader') || 'Modloader'}
      </label>
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

