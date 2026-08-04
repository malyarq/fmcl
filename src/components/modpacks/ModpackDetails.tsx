import React, { useEffect, useState } from 'react';
import type { ModpackMetadata } from '@shared/types/modpack';
import { ArrowLeft } from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { cn } from '../../utils/cn';
import { ScreenshotsTab } from '../../features/screenshots/components/ScreenshotsTab';
import { Breadcrumbs } from '../ui/Breadcrumbs';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ModpackUpdateModal } from './ModpackUpdateModal';
import { MODPACK_SECONDARY_CONTENT_WORKSPACE } from './ModpackCatalogControls';
import {
  ModpackDetailsInfoTab,
  ModpackDetailsModsTab,
  ModpackDetailsSettingsTab,
  ResourcePacksTab,
  ShadersTab,
  WorldsTab,
  type ModpackDetailsTab,
  type ModpackModEntry,
} from './details';
import { ModpackDetailsOperationNotices } from './details/ModpackDetailsActionBar';
import { ModpackDetailsOverview } from './details/ModpackDetailsOverview';
import { useModpackDetailsController } from './details/useModpackDetailsController';
import { useModpackDetailsModsController } from './details/useModpackDetailsModsController';

interface ModpackDetailsProps {
  modpackId: string;
  onBack: () => void;
  onNavigate: (view:
    | { type: 'addMod'; modpackId: string }
    | { type: 'addResourcePack'; modpackId: string }
    | { type: 'addShader'; modpackId: string }
    | { type: 'export'; modpackId: string }
  ) => void;
  onLaunch?: () => void | Promise<void>;
  onMetadataUpdated?: (metadata: ModpackMetadata) => void;
  initialTab?: ModpackDetailsTab;
  initialExpandedModId?: string;
  initialMetadata?: ModpackMetadata;
  initialMods?: ModpackModEntry[];
  hydrateFromIpc?: boolean;
}

export const ModpackDetails: React.FC<ModpackDetailsProps> = ({
  modpackId,
  onBack,
  onNavigate,
  onLaunch,
  onMetadataUpdated,
  initialTab = 'info',
  initialExpandedModId,
  initialMetadata,
  initialMods,
  hydrateFromIpc = true,
}) => {
  const { t, getAccentStyles, getAccentHex } = useSettings();
  const [activeTab, setActiveTab] = useState<ModpackDetailsTab>(initialTab);
  const controller = useModpackDetailsController({
    hydrateFromIpc,
    initialMetadata,
    modpackId,
    onBack,
    onLaunch,
    onMetadataUpdated,
  });
  const { modpack, metadataState, overview } = controller;
  const loaderType = overview.runtimeSummary.modLoader?.type;
  const hasModloader = Boolean(loaderType && loaderType !== 'vanilla');
  const selectedTab = !hasModloader && activeTab === 'mods' ? 'info' : activeTab;
  const loadConfig = controller.config.load;
  const modsController = useModpackDetailsModsController({
    activeTab: selectedTab,
    hydrateFromIpc,
    initialMods,
    modpackId,
  });
  const secondarySurfaceTab = [
    'mods',
    'resourcepacks',
    'shaders',
    'worlds',
    'screenshots',
    'settings',
  ].includes(selectedTab);

  useEffect(() => {
    if (selectedTab === 'settings') void loadConfig();
  }, [loadConfig, selectedTab]);

  if (!modpack) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        className="border-b border-border/70 bg-card/78 px-6 py-3 backdrop-blur-md"
        data-testid="modpack-details-route-top"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Breadcrumbs
            items={[
              { label: t('modpacks.title') || 'Modpacks', onClick: onBack },
              { label: modpack.name, active: true },
            ]}
          />
          <Button variant="secondary" size="sm" onClick={onBack} className="flex items-center gap-2">
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            {t('general.back') || 'Back'}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {metadataState.status === 'loading' ? (
          <div
            className="flex flex-col items-center justify-center gap-3 py-12"
            data-testid="modpack-details-loading"
            role="status"
            aria-live="polite"
          >
            <LoadingSpinner size="lg" />
            <p className="text-sm text-secondary">{t('modpacks.loading')}</p>
          </div>
        ) : metadataState.status === 'error' ? (
          <div
            className="m-6 rounded-2xl border border-red-500/25 bg-red-500/8 p-5"
            data-testid="modpack-details-load-error"
            role="alert"
          >
            <h2 className="text-lg font-semibold text-foreground">
              {t('modpacks.details_load_error_title') || 'Modpack details are unavailable'}
            </h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {t('modpacks.details_load_error_desc') || 'FMCL could not read this modpack metadata.'}
            </p>
            <Button variant="secondary" size="sm" onClick={() => { void controller.retryDetails(); }} className="mt-4">
              {t('modpacks.retry_details') || 'Retry details'}
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
              <div className="flex min-h-full flex-col gap-6 p-6 pb-8">
                <ModpackDetailsOperationNotices
                  {...controller.operationNotices}
                  t={t}
                />
                <ModpackDetailsOverview
                  header={{
                    modpackName: modpack.name,
                    metadata: overview.metadata,
                    runtimeSummary: overview.runtimeSummary,
                    activeTab: selectedTab,
                    onTabChange: setActiveTab,
                    t,
                    getAccentStyles,
                    getAccentHex,
                  }}
                  actions={{
                    canDelete: controller.actions.canDelete,
                    getAccentStyles,
                    onDelete: controller.actions.delete,
                    onDuplicate: controller.actions.duplicate,
                    onExport: () => onNavigate({ type: 'export', modpackId }),
                    onLaunch: controller.actions.launch,
                    onRename: controller.actions.rename,
                    onRetryUpdate: controller.retryUpdate,
                    onShowUpdate: controller.actions.showUpdate,
                    t,
                    updateState: controller.updateState,
                    updateVersionSummary: controller.actions.updateVersionSummary,
                  }}
                />

                <div
                  className={cn(
                    'min-w-0',
                    secondarySurfaceTab
                      ? MODPACK_SECONDARY_CONTENT_WORKSPACE.host
                      : 'surface-panel p-4 sm:p-5',
                  )}
                  data-testid="modpack-details-content-host"
                  data-content-surface={secondarySurfaceTab ? 'secondary' : 'primary'}
                  data-secondary-content-workspace={secondarySurfaceTab ? 'shared' : undefined}
                >
                  {selectedTab === 'info' && (
                    <ModpackDetailsInfoTab
                      descriptionDraft={controller.description.draft}
                      onDescriptionChange={controller.description.setDraft}
                      onSaveDescription={controller.description.save}
                      metadata={overview.metadata}
                      runtimeSummary={overview.runtimeSummary}
                      t={t}
                    />
                  )}

                  {selectedTab === 'mods' && hasModloader && (
                    <ModpackDetailsModsTab
                      mods={modsController.mods}
                      loadingMods={modsController.loading}
                      initialExpandedModId={initialExpandedModId}
                      modSearchQuery={modsController.searchQuery}
                      onModSearchQueryChange={modsController.setSearchQuery}
                      modFilterStatus={modsController.filterStatus}
                      onModFilterStatusChange={modsController.setFilterStatus}
                      onAddMod={() => onNavigate({ type: 'addMod', modpackId })}
                      onRemoveMod={modsController.remove}
                      onModToggle={modsController.toggle}
                      onRefresh={modsController.load}
                      runtimeContext={{
                        minecraft: overview.runtimeSummary.minecraftVersion || undefined,
                        modLoader: overview.runtimeSummary.modLoader,
                      }}
                      t={t}
                      getAccentStyles={getAccentStyles}
                    />
                  )}

                  {selectedTab === 'resourcepacks' && (
                    <ResourcePacksTab
                      instanceId={modpackId}
                      onUpdate={controller.config.load}
                      onAddResourcePack={() => onNavigate({ type: 'addResourcePack', modpackId })}
                    />
                  )}

                  {selectedTab === 'shaders' && (
                    <ShadersTab
                      instanceId={modpackId}
                      runtimeSummary={overview.runtimeSummary}
                      onUpdate={controller.config.load}
                      onAddShader={() => onNavigate({ type: 'addShader', modpackId })}
                    />
                  )}

                  {selectedTab === 'worlds' && (
                    <WorldsTab
                      instanceId={modpackId}
                      mcVersion={overview.runtimeSummary.minecraftVersion || undefined}
                      onUpdate={controller.config.load}
                    />
                  )}

                  {selectedTab === 'screenshots' && <ScreenshotsTab instanceId={modpackId} />}

                  {selectedTab === 'settings' && (
                    <ModpackDetailsSettingsTab
                      effectiveConfig={controller.config.effectiveConfig}
                      runtimeSummary={overview.runtimeSummary}
                      setters={controller.config.setters}
                      versions={controller.catalogs.versions}
                      forgeVersions={controller.catalogs.forgeVersions}
                      fabricVersions={controller.catalogs.fabricVersions}
                      neoForgeVersions={controller.catalogs.neoForgeVersions}
                      optiFineVersions={controller.catalogs.optiFineVersions}
                      onRefresh={controller.config.load}
                      t={t}
                      getAccentStyles={getAccentStyles}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {controller.updateDialog.isOpen && controller.updateDialog.availableUpdate && (
          <ModpackUpdateModal
            modpackId={modpackId}
            sourceId={controller.updateDialog.availableUpdate.sourceId}
            source={controller.updateDialog.availableUpdate.source}
            currentVersion={controller.updateDialog.availableUpdate.currentVersion}
            isOpen={controller.updateDialog.isOpen}
            onClose={controller.updateDialog.close}
            onUpdated={controller.updateDialog.updated}
          />
        )}
      </div>
    </div>
  );
};
