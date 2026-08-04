import React, { lazy, memo, Suspense, useCallback, useEffect } from 'react';
import {
  DEFAULT_MODPACK_BROWSER_STATE,
} from '../../features/modpacks/hooks/useModpackNavigation';
import { usePersistentModpackNavigation } from '../../features/modpacks/navigation/ModpackNavigationContext';
import { ModpackList } from './ModpackList';
import { ModpackDetails } from './ModpackDetails';
import {
  getPrimaryActionOwnershipForView,
  setModpackPrimaryActionOwnership,
} from './primaryActionOwnership';
import { useInstanceInvalidation } from '../../features/instances/hooks/useInstanceInvalidation';

const ModpackBrowser = lazy(() => import('./ModpackBrowser').then((module) => ({ default: module.ModpackBrowser })));
const ModpackCreationWizard = lazy(() => import('./ModpackCreationWizard').then((module) => ({ default: module.ModpackCreationWizard })));
const AddModPage = lazy(() => import('./AddModPage').then((module) => ({ default: module.AddModPage })));
const ExportModpackPage = lazy(() => import('./ExportModpackPage').then((module) => ({ default: module.ExportModpackPage })));
const InstallModpackPage = lazy(() => import('./InstallModpackPage').then((module) => ({ default: module.InstallModpackPage })));
const ImportModpackPreviewPage = lazy(() => import('./ImportModpackPreviewPage').then((module) => ({ default: module.ImportModpackPreviewPage })));

interface ModpackRouterProps {
  onLaunch?: () => void | Promise<void>;
}

function RoutedAddModPage({ modpackId, onBack }: { modpackId: string; onBack: () => void }) {
  const { invalidateInstance } = useInstanceInvalidation();
  const handleCommitted = useCallback(() => invalidateInstance(modpackId), [invalidateInstance, modpackId]);
  return <AddModPage modpackId={modpackId} onBack={onBack} onCommitted={handleCommitted} />;
}

function ModpackRouteLoadingState() {
  return (
    <div
      role="status"
      aria-label="Loading"
      aria-live="polite"
      className="min-h-12 w-full flex-1 animate-pulse bg-background/30"
    />
  );
}

const ModpackRouterInner: React.FC<ModpackRouterProps> = ({ onLaunch }) => {
  const { view, goBack, navigate, replace } = usePersistentModpackNavigation();
  const handleCreateWizard = useCallback(() => navigate({ type: 'create' }), [navigate]);
  const handleOpenBrowser = useCallback(() => {
    navigate({ type: 'browser', state: DEFAULT_MODPACK_BROWSER_STATE });
  }, [navigate]);
  const handleBrowserStateChange = useCallback((state: typeof DEFAULT_MODPACK_BROWSER_STATE) => {
    replace({ type: 'browser', state });
  }, [replace]);
  const primaryActionOwnership = getPrimaryActionOwnershipForView(view);

  useEffect(() => {
    setModpackPrimaryActionOwnership(primaryActionOwnership);
  }, [primaryActionOwnership]);

  useEffect(() => () => {
    setModpackPrimaryActionOwnership('shell');
  }, []);

  const renderRoute = () => {
    switch (view.type) {
    case 'list':
      return (
        <ModpackList
          onNavigate={(targetView) => {
            if (targetView.type === 'browser') {
              handleOpenBrowser();
              return;
            }

            navigate(targetView);
          }}
          onCreateWizard={handleCreateWizard}
        />
      );

    case 'create':
      return (
        <ModpackCreationWizard
          onBack={goBack}
          onCreated={() => {
            navigate({ type: 'list' });
          }}
        />
      );

    case 'browser':
      return (
        <ModpackBrowser
          initialState={view.state}
          onBack={goBack}
          onNavigate={navigate}
          onStateChange={handleBrowserStateChange}
        />
      );

    case 'details':
      return (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ModpackDetails
            modpackId={view.modpackId}
            onBack={goBack}
            onNavigate={navigate}
            onLaunch={onLaunch}
          />
        </div>
      );

    case 'addMod':
      return (
        <RoutedAddModPage
          modpackId={view.modpackId}
          onBack={goBack}
        />
      );

    case 'addResourcePack':
      return (
        <AddModPage
          modpackId={view.modpackId}
          onBack={goBack}
          contentType="resourcepack"
        />
      );

    case 'addShader':
      return (
        <AddModPage
          modpackId={view.modpackId}
          onBack={goBack}
          contentType="shader"
        />
      );

    case 'export':
      return (
        <ExportModpackPage
          modpackId={view.modpackId}
          onBack={goBack}
        />
      );

    case 'install':
      return (
        <InstallModpackPage
          modpack={view.modpack}
          versions={view.versions}
          platform={view.platform}
          onBack={goBack}
        />
      );

    case 'importPreview':
      return (
        <ImportModpackPreviewPage
          archiveRef={view.archiveRef}
          inspection={view.inspection}
          onBack={goBack}
        />
      );

    default:
      return (
        <ModpackList
          onNavigate={(targetView) => {
            if (targetView.type === 'browser') {
              handleOpenBrowser();
              return;
            }

            navigate(targetView);
          }}
          onCreateWizard={handleCreateWizard}
        />
      );
    }
  };

  return (
    <Suspense fallback={<ModpackRouteLoadingState />}>
      {renderRoute()}
    </Suspense>
  );
};

// Memo: skip re-renders when parent re-renders unless onLaunch changed.
export const ModpackRouter = memo(ModpackRouterInner, (prev, next) => prev.onLaunch === next.onLaunch);
