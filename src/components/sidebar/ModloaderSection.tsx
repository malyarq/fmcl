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
  disabled?: boolean;
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
    disabled,
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
    <div className={cn("space-y-2", disabled && "opacity-60 pointer-events-none")} data-tour="modloaders">
      <label className="text-xs font-medium uppercase tracking-wider text-secondary">
        {t('general.modloader') || 'Modloader'}
      </label>
      {showAllThree && (
        <p className="text-[11px] text-muted">
          {t('modloaders.loading_hint') || 'Checking available versions in the background. Compatible modloaders will appear within a minute.'}
        </p>
      )}
      <div className="flex rounded-xl border border-border/60 bg-background/72 p-1">
        {availableModloaders.map((loader) => {
          const isActive = loader.isActive;
          return (
            <button
              key={loader.id}
              disabled={disabled}
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
                  ? cn('shadow-md text-foreground', getAccentStyles('bg').className)
                  : 'text-secondary hover:text-foreground'
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
