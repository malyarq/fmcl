import React, { memo, useCallback, useEffect } from 'react';
import {
  DEFAULT_MODPACK_BROWSER_STATE,
  useModpackNavigation,
} from '../../features/modpacks/hooks/useModpackNavigation';
import { ModpackList } from './ModpackList';
import { ModpackBrowser } from './ModpackBrowser';
import { ModpackDetails } from './ModpackDetails';
import { AddModPage } from './AddModPage';
import { ExportModpackPage } from './ExportModpackPage';
import { InstallModpackPage } from './InstallModpackPage';
import { ImportModpackPreviewPage } from './ImportModpackPreviewPage';
import { ModpackCreationWizard } from './ModpackCreationWizard';
import {
  getPrimaryActionOwnershipForView,
  setModpackPrimaryActionOwnership,
} from './primaryActionOwnership';

interface ModpackRouterProps {
  onLaunch?: () => void | Promise<void>;
}

const ModpackRouterInner: React.FC<ModpackRouterProps> = ({ onLaunch }) => {
  const { view, goBack, navigate, replace } = useModpackNavigation();
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

  // Render based on current view
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
        <AddModPage
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
          filePath={view.filePath}
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

// Memo: skip re-renders when parent re-renders unless onLaunch changed.
export const ModpackRouter = memo(ModpackRouterInner, (prev, next) => prev.onLaunch === next.onLaunch);
