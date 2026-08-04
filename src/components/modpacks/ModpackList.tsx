import { useCallback, useEffect, useState } from 'react';
import { useInstanceCrudActions } from '../../contexts/instances/hooks/useInstanceCrudActions';
import { useSettings } from '../../contexts/SettingsContext';
import { useInstanceInvalidation } from '../../features/instances/hooks/useInstanceInvalidation';
import { useInstanceList, useSelectedInstanceId } from '../../features/instances/hooks/useInstanceSelectors';
import { ImportShareModal } from '../../features/share/ImportShareModal';
import { ShareModal } from '../../features/share/ShareModal';
import { OperationStatusView } from '../../features/operations/components/OperationStatusView';
import { cn } from '../../utils/cn';
import { InstalledModpackCatalog } from './list/InstalledModpackCatalog';
import { InstalledModpackContextMenu } from './list/InstalledModpackContextMenu';
import { useInstalledModpackCatalog } from './list/useInstalledModpackCatalog';

const EMPTY_MODPACKS = [] as const;

export type ModpackListView =
  | { type: 'browser' }
  | { type: 'details'; modpackId: string }
  | { type: 'export'; modpackId: string }
  | {
    type: 'importPreview';
    archiveRef: string;
    inspection: import('@shared/contracts/archiveInspection').ArchiveManifestMetadata;
  };

export interface ModpackListProps {
  onNavigate?: (view: ModpackListView) => void;
  onCreateWizard?: () => void;
}

export function ModpackList({ onNavigate, onCreateWizard }: ModpackListProps) {
  const { t } = useSettings();
  const listQuery = useInstanceList();
  const selectedQuery = useSelectedInstanceId();
  const { invalidateInstances } = useInstanceInvalidation();
  const {
    select,
    remove,
    rename,
    duplicate,
    duplicateOperation,
    duplicateOperationError,
    cancelDuplicate,
    retryDuplicate,
    deleteOperation,
    deleteOperationError,
    cancelDelete,
    retryDelete,
  } = useInstanceCrudActions({ invalidateInstances });
  const selectedId = selectedQuery.status === 'ready' ? selectedQuery.data : '';
  const modpacks = listQuery.status === 'ready' ? listQuery.data : EMPTY_MODPACKS;
  const refresh = invalidateInstances;
  const [shareModpackId, setShareModpackId] = useState<string | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [importShareModalOpen, setImportShareModalOpen] = useState(false);
  const navigate = useCallback((view: ModpackListView) => onNavigate?.(view), [onNavigate]);
  const catalog = useInstalledModpackCatalog({
    modpacks,
    select,
    remove,
    rename,
    duplicate,
    refresh,
    onImportArchive: ({ archiveRef, inspection }) => navigate({ type: 'importPreview', archiveRef, inspection }),
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key === 'n') {
        event.preventDefault();
        onCreateWizard?.();
      } else if (event.key === 'o') {
        event.preventDefault();
        navigate({ type: 'browser' });
      } else if (event.key === 'e' && selectedId) {
        event.preventDefault();
        navigate({ type: 'details', modpackId: selectedId });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, onCreateWizard, selectedId]);

  const showDetails = useCallback((id: string) => navigate({ type: 'details', modpackId: id }), [navigate]);
  const exportModpack = useCallback((id: string) => navigate({ type: 'export', modpackId: id }), [navigate]);
  const openShare = useCallback((id: string) => {
    setShareModpackId(id);
    setShareModalOpen(true);
  }, []);
  const browse = useCallback(() => navigate({ type: 'browser' }), [navigate]);

  return (
    <>
      <div
        className={cn(
          'flex flex-1 flex-col overflow-y-auto p-8 transition-all',
          catalog.isDragging && 'border-2 border-dashed border-border-active bg-background/60',
        )}
        onDragOver={catalog.handleDragOver}
        onDragLeave={catalog.handleDragLeave}
        onDrop={catalog.handleDrop}
      >
        <OperationStatusView
          snapshot={duplicateOperation}
          error={duplicateOperationError}
          onCancel={cancelDuplicate}
          onRetry={retryDuplicate}
          t={t}
          testId="duplicate-operation-status"
        />
        <OperationStatusView
          snapshot={deleteOperation}
          error={deleteOperationError}
          onCancel={cancelDelete}
          onRetry={retryDelete}
          t={t}
          testId="delete-operation-status"
        />

        {catalog.isDragging && (
          <div className="surface-panel absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-border-active bg-background/86 backdrop-blur-sm">
            <div className="text-center">
              <p className="mb-2 text-xl font-bold text-foreground">
                {t('modpacks.drop_file') || 'Перетащите файл модпака сюда'}
              </p>
              <p className="text-sm text-secondary">
                {t('modpacks.supported_formats') || 'Поддерживаемые форматы: .mrpack, .zip, .curseforge'}
              </p>
            </div>
          </div>
        )}

        <InstalledModpackContextMenu
          items={catalog.items}
          selectedId={selectedId}
          onSelect={(id) => void catalog.selectItem(id)}
          onShowDetails={showDetails}
          onShare={openShare}
          onExport={exportModpack}
          onRename={(id, name) => void catalog.renameItem(id, name)}
          onDuplicate={(id, name) => void catalog.duplicateItem(id, name)}
          onDelete={(id, name) => void catalog.deleteItem(id, name)}
        >
          <InstalledModpackCatalog
            items={catalog.visibleItems}
            loading={catalog.loading}
            loadError={catalog.loadError}
            availableUpdatesById={catalog.availableUpdatesById}
            selectedId={selectedId}
            searchQuery={catalog.searchQuery}
            onSearchQueryChange={catalog.setSearchQuery}
            minecraftVersion={catalog.minecraftVersion}
            onMinecraftVersionChange={catalog.setMinecraftVersion}
            loader={catalog.loader}
            onLoaderChange={catalog.setLoader}
            sort={catalog.sort}
            onSortChange={catalog.setSort}
            availableVersions={catalog.availableVersions}
            availableLoaders={catalog.availableLoaders}
            hasActiveFilters={catalog.hasActiveFilters}
            hasSearchFilters={catalog.hasSearchFilters}
            onResetFilters={catalog.resetFilters}
            onRetry={() => void catalog.reload()}
            onSelect={(id) => void catalog.selectItem(id)}
            onShowDetails={showDetails}
            onImportCode={() => setImportShareModalOpen(true)}
            onCreate={() => onCreateWizard?.()}
            onBrowse={browse}
          />
        </InstalledModpackContextMenu>
      </div>

      {shareModpackId && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          modpackId={shareModpackId}
        />
      )}
      <ImportShareModal
        isOpen={importShareModalOpen}
        onClose={() => setImportShareModalOpen(false)}
        onCommitted={async () => {
          await refresh();
        }}
      />
    </>
  );
}
