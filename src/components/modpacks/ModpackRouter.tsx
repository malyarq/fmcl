import React, { memo, useCallback } from 'react';
import { useModpackNavigation } from '../../features/modpacks/hooks/useModpackNavigation';
import { ModpackList } from './ModpackList';
import { ModpackBrowser } from './ModpackBrowser';
import { ModpackDetails } from './ModpackDetails';
import { AddModPage } from './AddModPage';
import { ExportModpackPage } from './ExportModpackPage';
import { InstallModpackPage } from './InstallModpackPage';
import { ImportModpackPreviewPage } from './ImportModpackPreviewPage';
import { ModpackCreationWizard } from './ModpackCreationWizard';

interface ModpackRouterProps {
  onLaunch?: () => void | Promise<void>;
}

const ModpackRouterInner: React.FC<ModpackRouterProps> = ({ onLaunch }) => {
  const { view, goBack, navigate } = useModpackNavigation();
  const handleCreateWizard = useCallback(() => navigate({ type: 'create' }), [navigate]);

  // Render based on current view
  switch (view.type) {
    case 'list':
      return (
        <ModpackList
          onNavigate={navigate}
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
          onBack={goBack}
          onNavigate={navigate}
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
          onNavigate={navigate}
          onCreateWizard={handleCreateWizard}
        />
      );
  }
};

// Memo: skip re-renders when parent re-renders unless onLaunch changed.
export const ModpackRouter = memo(ModpackRouterInner, (prev, next) => prev.onLaunch === next.onLaunch);
