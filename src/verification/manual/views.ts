export type ManualVerificationView =
  | 'overview'
  | 'welcome'
  | 'tour'
  | 'dashboard'
  | 'settings-accounts'
  | 'phase-17-polish'
  | 'accounts'
  | 'modpack-list'
  | 'modpack-create'
  | 'modpack-browser'
  | 'modpack-details'
  | 'modpack-export'
  | 'modpack-add'
  | 'share'
  | 'screenshots'
  | 'utilities'
  | 'content';

export const CORE_VIEWS: Array<{ id: ManualVerificationView; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Manual verification hub for milestone-owned v0.4.0 flows.' },
  { id: 'welcome', label: 'Welcome', description: 'First-run welcome overlay.' },
  { id: 'tour', label: 'Tour', description: 'Onboarding spotlight with stable targets.' },
  { id: 'dashboard', label: 'Dashboard', description: 'Classic play dashboard and quick actions.' },
  { id: 'settings-accounts', label: 'Settings -> Accounts', description: 'Settings shell with accounts continuity.' },
  { id: 'phase-17-polish', label: 'Phase 17 Polish', description: 'Composite proof for constrained catalog, compact nav, and Russian settings localization.' },
  { id: 'accounts', label: 'Accounts', description: 'Standalone account management and skin panel.' },
  { id: 'modpack-list', label: 'Modpack List', description: 'Installed modpack cards and actions.' },
  { id: 'modpack-create', label: 'Create Modpack', description: 'Create flow with explicit runtime dependencies.' },
  { id: 'modpack-browser', label: 'Modpack Browser', description: 'Browser search, history, and results.' },
  { id: 'modpack-details', label: 'Modpack Details', description: 'Details overview and primary actions.' },
  { id: 'modpack-export', label: 'Export', description: 'Export flow on the shared page surface.' },
  { id: 'modpack-add', label: 'Add Mod', description: 'Add-mod dialog with live search and selection.' },
  { id: 'share', label: 'Share', description: 'Share-code modal on the refreshed secondary surface.' },
  { id: 'screenshots', label: 'Screenshots', description: 'Screenshot gallery with live fixture imagery.' },
  { id: 'utilities', label: 'Utilities', description: 'Mirrors priority and local statistics utilities.' },
  { id: 'content', label: 'Content', description: 'Representative world datapack management flow.' },
];

export function isManualVerificationView(value: string | null): value is ManualVerificationView {
  return CORE_VIEWS.some((view) => view.id === value);
}

export function getManualVerificationView(value: string | null): ManualVerificationView {
  return isManualVerificationView(value) ? value : 'overview';
}
