export type ManualVerificationView =
  | 'overview'
  | 'phase-24-home-closeout'
  | 'phase-24-modpacks-closeout'
  | 'phase-24-degraded-closeout'
  | 'phase-24-theme-dark'
  | 'phase-24-theme-light'
  | 'phase-24-locale-en'
  | 'phase-24-locale-ru'
  | 'phase-41-ownership-en'
  | 'phase-41-ownership-ru'
  | 'phase-41-recovery-en'
  | 'phase-41-recovery-ru'
  | 'phase-41-surfaces-en'
  | 'phase-41-surfaces-ru'
  | 'phase-42-tunnel-en'
  | 'phase-42-lan-ru'
  | 'welcome'
  | 'tour'
  | 'dashboard'
  | 'settings-appearance'
  | 'settings-accounts'
  | 'phase-22-theme-dark'
  | 'phase-22-theme-light'
  | 'phase-22-locale-en'
  | 'phase-22-locale-ru'
  | 'phase-17-polish'
  | 'accounts'
  | 'modpack-list'
  | 'modpack-create'
  | 'modpack-browser'
  | 'modpack-details'
  | 'phase-21-browser-density'
  | 'phase-21-details-density'
  | 'phase-21-runtime-create'
  | 'phase-21-runtime-edit'
  | 'phase-21-secondary-density'
  | 'modpack-export'
  | 'modpack-add'
  | 'guided-resourcepacks'
  | 'guided-resourcepacks-recovery'
  | 'guided-shaders'
  | 'guided-shaders-recovery'
  | 'operation-recovery'
  | 'modpack-install'
  | 'modpack-import-preview'
  | 'modpack-add-modal'
  | 'resource-packs'
  | 'share'
  | 'screenshots'
  | 'utilities'
  | 'content';

export type ManualVerificationViewGroup = 'hub' | 'closeout' | 'general' | 'legacy';

export type ManualVerificationViewMeta = {
  id: ManualVerificationView;
  label: string;
  description: string;
  group: ManualVerificationViewGroup;
  screenshot?: boolean;
  viewport?: 'desktop' | 'wide';
  theme?: 'dark' | 'light';
  language?: 'en' | 'ru';
  forbidText?: string[];
};

const OVERVIEW_VIEW: ManualVerificationViewMeta = {
  id: 'overview',
  label: 'Overview',
  description: 'Manual proof hub for the current Phase 34 details-hierarchy, first-read runtime truth, and shared-content-workspace contract, plus retained historical regression routes.',
  group: 'hub',
};

export const CLOSEOUT_VIEWS: ManualVerificationViewMeta[] = [
  {
    id: 'phase-24-home-closeout',
    label: 'Phase 24 Home Closeout',
    description: 'Canonical launcher-home closeout proof for the shipped shell, brand reset, and single primary Play action.',
    group: 'closeout',
    screenshot: true,
    viewport: 'wide',
    forbidText: ['${file.jarVersion}', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-24-modpacks-closeout',
    label: 'Phase 24 Modpacks Closeout',
    description: 'Representative route-owned modpacks proof for dense browse flows, fallback art, and stable shell spacing.',
    group: 'closeout',
    screenshot: true,
    viewport: 'wide',
    forbidText: ['${file.jarVersion}', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-24-degraded-closeout',
    label: 'Phase 24 Degraded Closeout',
    description: 'Representative shell-integrated degraded-state proof for route search failure and secondary-content availability loss.',
    group: 'closeout',
    screenshot: true,
    viewport: 'wide',
    forbidText: ['${file.jarVersion}', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-24-theme-dark',
    label: 'Phase 24 Theme Dark',
    description: 'Dark-theme closeout pair for final appearance review under deterministic shell-owned fixture data.',
    group: 'closeout',
    screenshot: true,
    viewport: 'wide',
    theme: 'dark',
    forbidText: ['${file.jarVersion}', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-24-theme-light',
    label: 'Phase 24 Theme Light',
    description: 'Light-theme closeout pair for direct comparison against the dark closeout surface without fixture drift.',
    group: 'closeout',
    screenshot: true,
    viewport: 'wide',
    theme: 'light',
    forbidText: ['${file.jarVersion}', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-24-locale-en',
    label: 'Phase 24 Locale EN',
    description: 'English closeout pair on real shell-integrated content with visible counts, dates, and secondary content.',
    group: 'closeout',
    screenshot: true,
    viewport: 'wide',
    language: 'en',
    forbidText: ['${file.jarVersion}', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-24-locale-ru',
    label: 'Phase 24 Locale RU',
    description: 'Russian closeout pair on the same shell-integrated content for direct language comparison.',
    group: 'closeout',
    screenshot: true,
    viewport: 'wide',
    language: 'ru',
    forbidText: ['${file.jarVersion}', 'node_modules', 'renderWithHooks'],
  },
];

export const GENERAL_VIEWS: ManualVerificationViewMeta[] = [
  {
    id: 'phase-42-tunnel-en',
    label: 'Phase 42 FriendTunnel EN',
    description: 'English real multiplayer surface initialized from a live main-owned FriendTunnel host snapshot.',
    group: 'general', screenshot: true, viewport: 'desktop', language: 'en',
    forbidText: ['/Users/', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-42-lan-ru',
    label: 'Phase 42 LAN RU',
    description: 'Russian real multiplayer LAN discovery surface with typed live state and discovered endpoint.',
    group: 'general', screenshot: true, viewport: 'desktop', language: 'ru',
    forbidText: ['/Users/', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-41-ownership-en',
    label: 'Phase 41 Ownership EN',
    description: 'English real-route proof that the shell and installed catalog share one canonical instance owner.',
    group: 'general',
    screenshot: true,
    viewport: 'wide',
    language: 'en',
    forbidText: ['/Users/', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-41-ownership-ru',
    label: 'Phase 41 Ownership RU',
    description: 'Russian pair for the canonical shell and route instance-ownership proof.',
    group: 'general',
    screenshot: true,
    viewport: 'wide',
    language: 'ru',
    forbidText: ['/Users/', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-41-recovery-en',
    label: 'Phase 41 Recovery EN',
    description: 'English production-owned startup recovery proof with recovered and recovery-required journal records.',
    group: 'general',
    screenshot: true,
    viewport: 'wide',
    language: 'en',
    forbidText: ['/Users/', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-41-recovery-ru',
    label: 'Phase 41 Recovery RU',
    description: 'Russian pair for production-owned recovered and manual-attention journal records.',
    group: 'general',
    screenshot: true,
    viewport: 'wide',
    language: 'ru',
    forbidText: ['/Users/', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-41-surfaces-en',
    label: 'Phase 41 Surfaces EN',
    description: 'English narrow-first proof for the real split Appearance, Details, and content-acquisition surfaces.',
    group: 'general',
    screenshot: true,
    viewport: 'desktop',
    language: 'en',
    forbidText: ['/Users/', 'node_modules', 'renderWithHooks'],
  },
  {
    id: 'phase-41-surfaces-ru',
    label: 'Phase 41 Surfaces RU',
    description: 'Russian pair for keyboard-reachable split Appearance, Details, and content-acquisition surfaces.',
    group: 'general',
    screenshot: true,
    viewport: 'desktop',
    language: 'ru',
    forbidText: ['/Users/', 'node_modules', 'renderWithHooks'],
  },
  { id: 'welcome', label: 'Welcome', description: 'First-run welcome overlay.', group: 'general' },
  { id: 'tour', label: 'Tour', description: 'Onboarding spotlight with stable targets.', group: 'general' },
  {
    id: 'dashboard',
    label: 'Launcher Home',
    description: 'Phase 33 classic runtime truth proof for Fabric wording and cold-start labels that must match the canonical launch target.',
    group: 'general',
  },
  {
    id: 'settings-appearance',
    label: 'Settings -> Appearance',
    description: 'Phase 36 behavior-driven settings proof for duplicate-copy removal, preset predictability, aligned control geometry, and visible-effect scope on the live appearance surface.',
    group: 'general',
  },
  { id: 'settings-accounts', label: 'Settings -> Accounts', description: 'Settings shell with accounts continuity.', group: 'general' },
  { id: 'accounts', label: 'Accounts', description: 'Standalone account management and skin panel.', group: 'general' },
  {
    id: 'modpack-list',
    label: 'Modpack List',
    description: 'Phase 33 installed catalog proof for a compact header, minimal card metadata, and coherent primary actions.',
    group: 'general',
  },
  { id: 'modpack-create', label: 'Create Wizard', description: 'Phase 36.1 create-wizard proof for a fixed action rail, runtime-aware failure explanations, and calm optional follow-up guidance after successful creation.', group: 'general' },
  {
    id: 'modpack-browser',
    label: 'Modpack Browser',
    description: 'Phase 33 remote catalog proof for compact controls, minimal card metadata, coherent primary actions, and neutral fallback art.',
    group: 'general',
  },
  {
    id: 'modpack-details',
    label: 'Modpack Details',
    description: 'Phase 34 details proof for tab reachability above the fold, first-read runtime authority, and one shared content workspace across Mods, Resource Packs, Shaders, Worlds, and Screenshots.',
    group: 'general',
  },
  { id: 'modpack-export', label: 'Export', description: 'Shell-integrated export-route proof for flow-first actions and visible final content edges.', group: 'general' },
  { id: 'modpack-add', label: 'Add Content', description: 'Phase 35 add-content route proof for a fixed action rail, retained selections, and itemized mixed-success recovery on the live route.', group: 'general' },
  {
    id: 'guided-resourcepacks',
    label: 'Guided Resource Packs',
    description: 'Phase 35 guided resource-pack browser proof with runtime-scoped copy, explicit local .zip fallback, and no commerce framing.',
    group: 'general',
  },
  {
    id: 'guided-resourcepacks-recovery',
    label: 'Guided Resource Pack Recovery',
    description: 'Phase 35 guided resource-pack fallback proof showing partial local import recovery and retry-ready fallback without leaving the guided route shell.',
    group: 'general',
  },
  {
    id: 'guided-shaders',
    label: 'Guided Shaders',
    description: 'Phase 35 guided shader browser proof with needs-setup runtime guidance, honest capability copy, explicit local fallback, and shader-specific catalog fixtures.',
    group: 'general',
  },
  {
    id: 'guided-shaders-recovery',
    label: 'Guided Shader Recovery',
    description: 'Phase 35 guided shader recovery proof with unsupported-runtime guidance and retry-ready blocked install state.',
    group: 'general',
  },
  {
    id: 'operation-recovery',
    label: 'Operation Recovery',
    description: 'Production-mounted startup recovery inbox with recovered and recovery-required journal records, safe inspect/dismiss actions, and no generic replay.',
    group: 'general',
  },
  { id: 'modpack-install', label: 'Install', description: 'Shell-integrated install-route proof for route-owned CTA hierarchy.', group: 'general' },
  { id: 'modpack-import-preview', label: 'Import Preview', description: 'Shell-integrated import-preview proof with visible final import controls.', group: 'general' },
  { id: 'modpack-add-modal', label: 'Add Mod Modal', description: 'Phase 35 add-mod modal proof for a fixed action rail, locked exits during install, and on-surface mixed-success recovery above the real shell.', group: 'general' },
  { id: 'resource-packs', label: 'Resource Packs', description: 'Shell-integrated deep-media proof with no-art pack thumbnails routed through the shared fallback policy.', group: 'general' },
  { id: 'share', label: 'Share', description: 'Share-code modal on the refreshed secondary surface.', group: 'general' },
  { id: 'screenshots', label: 'Screenshots', description: 'Screenshot gallery with live fixture imagery.', group: 'general' },
  {
    id: 'utilities',
    label: 'Utilities',
    description: 'Phase 36 utility proof for embedded mirrors and statistics surfaces after duplicate settings copy is removed from the shared shell.',
    group: 'general',
  },
  { id: 'content', label: 'Content', description: 'Representative world datapack management flow.', group: 'general' },
];

export const LEGACY_VIEWS: ManualVerificationViewMeta[] = [
  {
    id: 'phase-22-theme-dark',
    label: 'Phase 22 Theme Dark',
    description: 'Shell-integrated dark-theme proof for appearance controls under a shipped preset with the Phase 22 state contract.',
    group: 'legacy',
  },
  {
    id: 'phase-22-theme-light',
    label: 'Phase 22 Theme Light',
    description: 'Shell-integrated light-theme proof for appearance controls under a custom accent variant with the same shared state contract.',
    group: 'legacy',
  },
  {
    id: 'phase-22-locale-en',
    label: 'Phase 22 Locale EN',
    description: 'English route proof combining a modpack primary route and a secondary-content overlay with visible dates and counts.',
    group: 'legacy',
  },
  {
    id: 'phase-22-locale-ru',
    label: 'Phase 22 Locale RU',
    description: 'Russian route proof combining a modpack primary route and a secondary-content overlay with visible dates and counts.',
    group: 'legacy',
  },
  { id: 'phase-17-polish', label: 'Phase 17 Polish', description: 'Composite proof for constrained catalog, compact nav, and Russian settings localization.', group: 'legacy' },
  {
    id: 'phase-21-browser-density',
    label: 'Phase 21 Browser Density',
    description: 'Crowded shell-integrated browser proof with long labels, stacked metadata, and enough cards to expose dense-route failures.',
    group: 'legacy',
  },
  {
    id: 'phase-21-details-density',
    label: 'Phase 21 Details Density',
    description: 'Retained regression route for constrained-width details, long metadata, and long tab labels after the main Phase 34 details proof passes.',
    group: 'legacy',
  },
  {
    id: 'phase-21-runtime-create',
    label: 'Phase 21 Create Summary',
    description: 'Create-wizard runtime summary truth seeded to the same dense runtime fixture used by the edit proof.',
    group: 'legacy',
  },
  {
    id: 'phase-21-runtime-edit',
    label: 'Phase 21 Edit Summary',
    description: 'Edit-settings runtime summary truth for the shared dense Phase 21 runtime fixture inside the real shell.',
    group: 'legacy',
  },
  {
    id: 'phase-21-secondary-density',
    label: 'Phase 21 Secondary Density',
    description: 'Retained regression route for dense resource-pack rows, fallback art, and shared-workspace stress after the main Phase 34 details proof passes.',
    group: 'legacy',
  },
];

export const CORE_VIEWS: ManualVerificationViewMeta[] = [
  OVERVIEW_VIEW,
  ...CLOSEOUT_VIEWS,
  ...GENERAL_VIEWS,
  ...LEGACY_VIEWS,
];

export const PLAYWRIGHT_CLOSEOUT_VIEWS: ManualVerificationViewMeta[] = CLOSEOUT_VIEWS.filter((view) => view.screenshot);

export function isManualVerificationView(value: string | null): value is ManualVerificationView {
  return CORE_VIEWS.some((view) => view.id === value);
}

export function getManualVerificationView(value: string | null): ManualVerificationView {
  return isManualVerificationView(value) ? value : 'overview';
}
