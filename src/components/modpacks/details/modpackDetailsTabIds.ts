export type ModpackDetailsTab = 'info' | 'mods' | 'resourcepacks' | 'shaders' | 'worlds' | 'screenshots' | 'settings';

export function getModpackDetailsTabId(tab: ModpackDetailsTab): string {
  return `modpack-details-tab-${tab}`;
}

export function getModpackDetailsPanelId(tab: ModpackDetailsTab): string {
  return `modpack-details-panel-${tab}`;
}
