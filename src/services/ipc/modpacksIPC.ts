import type { ModpackConfig, ModpackListItem } from '../../contexts/instances/types';
import { toIpcError } from './ipcError';

type ModpacksApi = Window['modpacks'];
type NamespacedModpacksApi = Window['api']['modpacks'];

type LegacyLauncherModpacks = Partial<{
  listModpacks: (rootPath?: string) => Promise<ModpackListItem[]>;
  bootstrapModpacks: (seed?: Partial<ModpackConfig>, rootPath?: string) => Promise<{ index?: unknown; selectedId?: string; config?: ModpackConfig }>;
  getSelectedModpack: (rootPath?: string) => Promise<string | null>;
  setSelectedModpack: (id: string, rootPath?: string) => Promise<{ ok: boolean }>;
  createModpack: (name: string, rootPath?: string) => Promise<{ id?: string } | null>;
  renameModpack: (id: string, name: string, rootPath?: string) => Promise<{ ok: boolean }>;
  duplicateModpack: (sourceId: string, name?: string, rootPath?: string) => Promise<{ id?: string } | null>;
  deleteModpack: (id: string, rootPath?: string) => Promise<{ ok: boolean }>;
  getModpackConfig: (id: string, rootPath?: string) => Promise<ModpackConfig | null>;
  saveModpackConfig: (cfg: ModpackConfig, rootPath?: string) => Promise<{ ok: boolean }>;
}>;

function hasModpacks(): boolean {
  return typeof window !== 'undefined' && Boolean(window.api?.modpacks || window.modpacks);
}

function hasMethod<K extends keyof ModpacksApi>(key: K): boolean {
  const api = (typeof window !== 'undefined' ? (window.api?.modpacks ?? window.modpacks) : undefined) as
    | NamespacedModpacksApi
    | ModpacksApi
    | undefined;
  return Boolean(api && typeof api[key] === 'function');
}

function requireModpacks(methodName: string): ModpacksApi {
  const api = (typeof window !== 'undefined' ? (window.api?.modpacks ?? window.modpacks) : undefined) as
    | NamespacedModpacksApi
    | ModpacksApi
    | undefined;
  if (!api) {
    throw new Error(`[modpacksIPC] modpacks API is not available (method: ${methodName})`);
  }
  return api;
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = toIpcError({ namespace: 'modpacksIPC', method: methodName }, err);
    console.error(e);
    throw e;
  }
}

export const modpacksIPC = {
  list(rootPath?: string): Promise<ModpackListItem[]> {
    if (!hasModpacks() || !hasMethod('listModpacks')) {
      // Backward compatibility: older builds exposed modpack APIs on window.launcher.
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.listModpacks !== 'function') return Promise.resolve([]);
      return legacy.listModpacks(rootPath) as Promise<ModpackListItem[]>;
    }
    return call('listModpacks', () => requireModpacks('listModpacks').listModpacks(rootPath)) as Promise<ModpackListItem[]>;
  },

  listWithMetadata(rootPath?: string) {
    return call('listModpacksWithMetadata', () => requireModpacks('listModpacksWithMetadata').listModpacksWithMetadata(rootPath));
  },

  bootstrap(
    seed?: Partial<ModpackConfig>,
    rootPath?: string,
  ): Promise<{ index?: unknown; selectedId?: string; config?: ModpackConfig }> {
    if (!hasModpacks() || !hasMethod('bootstrapModpacks')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.bootstrapModpacks !== 'function') return Promise.resolve({});
      return legacy.bootstrapModpacks(seed, rootPath) as Promise<{ index?: unknown; selectedId?: string; config?: ModpackConfig }>;
    }
    return call('bootstrapModpacks', () => requireModpacks('bootstrapModpacks').bootstrapModpacks(seed, rootPath)) as Promise<{ index?: unknown; selectedId?: string; config?: ModpackConfig }>;
  },

  getSelected(rootPath?: string): Promise<string | null> {
    if (!hasModpacks() || !hasMethod('getSelectedModpack')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.getSelectedModpack !== 'function') return Promise.resolve(null);
      return legacy.getSelectedModpack(rootPath) as Promise<string | null>;
    }
    return call('getSelectedModpack', () => requireModpacks('getSelectedModpack').getSelectedModpack(rootPath)) as Promise<string | null>;
  },

  setSelected(id: string, rootPath?: string): Promise<{ ok: boolean }> {
    if (!hasModpacks() || !hasMethod('setSelectedModpack')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.setSelectedModpack !== 'function') return Promise.resolve({ ok: true });
      return legacy.setSelectedModpack(id, rootPath) as Promise<{ ok: boolean }>;
    }
    return call('setSelectedModpack', () => requireModpacks('setSelectedModpack').setSelectedModpack(id, rootPath)) as Promise<{ ok: boolean }>;
  },

  create(name: string, rootPath?: string): Promise<{ id?: string } | null> {
    if (!hasModpacks() || !hasMethod('createModpack')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.createModpack !== 'function') return Promise.resolve(null);
      return legacy.createModpack(name, rootPath) as Promise<{ id?: string } | null>;
    }
    return call('createModpack', () => requireModpacks('createModpack').createModpack(name, rootPath)) as Promise<{ id?: string } | null>;
  },

  rename(id: string, name: string, rootPath?: string): Promise<{ ok: boolean }> {
    if (!hasModpacks() || !hasMethod('renameModpack')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.renameModpack !== 'function') return Promise.resolve({ ok: true });
      return legacy.renameModpack(id, name, rootPath) as Promise<{ ok: boolean }>;
    }
    return call('renameModpack', () => requireModpacks('renameModpack').renameModpack(id, name, rootPath)) as Promise<{ ok: boolean }>;
  },

  duplicate(sourceId: string, name?: string, rootPath?: string): Promise<{ id?: string } | null> {
    if (!hasModpacks() || !hasMethod('duplicateModpack')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.duplicateModpack !== 'function') return Promise.resolve(null);
      return legacy.duplicateModpack(sourceId, name, rootPath) as Promise<{ id?: string } | null>;
    }
    return call('duplicateModpack', () => requireModpacks('duplicateModpack').duplicateModpack(sourceId, name, rootPath)) as Promise<{ id?: string } | null>;
  },

  remove(id: string, rootPath?: string): Promise<{ ok: boolean }> {
    if (!hasModpacks() || !hasMethod('deleteModpack')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.deleteModpack !== 'function') return Promise.resolve({ ok: true });
      return legacy.deleteModpack(id, rootPath) as Promise<{ ok: boolean }>;
    }
    return call('deleteModpack', () => requireModpacks('deleteModpack').deleteModpack(id, rootPath)) as Promise<{ ok: boolean }>;
  },

  getConfig(id: string, rootPath?: string): Promise<ModpackConfig | null> {
    if (!hasModpacks() || !hasMethod('getModpackConfig')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.getModpackConfig !== 'function') return Promise.resolve(null);
      return legacy.getModpackConfig(id, rootPath) as Promise<ModpackConfig | null>;
    }
    return call('getModpackConfig', () => requireModpacks('getModpackConfig').getModpackConfig(id, rootPath)) as Promise<ModpackConfig | null>;
  },

  saveConfig(cfg: ModpackConfig, rootPath?: string): Promise<{ ok: boolean }> {
    if (!hasModpacks() || !hasMethod('saveModpackConfig')) {
      const legacy = (window as unknown as { launcher?: unknown }).launcher as LegacyLauncherModpacks | undefined;
      if (!legacy || typeof legacy.saveModpackConfig !== 'function') return Promise.resolve({ ok: true });
      return legacy.saveModpackConfig(cfg, rootPath) as Promise<{ ok: boolean }>;
    }
    return call('saveModpackConfig', () => requireModpacks('saveModpackConfig').saveModpackConfig(cfg, rootPath)) as Promise<{ ok: boolean }>;
  },

  getMetadata(modpackId: string, rootPath?: string) {
    return call('getModpackMetadata', () => requireModpacks('getModpackMetadata').getModpackMetadata(modpackId, rootPath));
  },

  updateMetadata(modpackId: string, updates: Partial<import('@shared/types/modpack').ModpackMetadata>, rootPath?: string) {
    return call('updateModpackMetadata', () => requireModpacks('updateModpackMetadata').updateModpackMetadata(modpackId, updates, rootPath));
  },

  // Поиск модпаков
  searchCurseForge(
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) {
    return call('searchCurseForgeModpacks', () => requireModpacks('searchCurseForgeModpacks').searchCurseForgeModpacks(query, mcVersion, loader, sort, offset, limit));
  },

  searchModrinth(
    query: string,
    mcVersion?: string,
    loader?: string,
    sort?: 'popularity' | 'date' | 'alphabetical',
    offset?: number,
    limit?: number,
  ) {
    return call('searchModrinthModpacks', () => requireModpacks('searchModrinthModpacks').searchModrinthModpacks(query, mcVersion, loader, sort, offset, limit));
  },

  getCurseForgeVersions(projectId: number) {
    return call('getCurseForgeModpackVersions', () => requireModpacks('getCurseForgeModpackVersions').getCurseForgeModpackVersions(projectId));
  },

  getModrinthVersions(projectId: string) {
    return call('getModrinthModpackVersions', () => requireModpacks('getModrinthModpackVersions').getModrinthModpackVersions(projectId));
  },

  // Установка модпаков
  installCurseForge(projectId: number, fileId: number, targetModpackId?: string, rootPath?: string) {
    return call('installCurseForgeModpack', () => requireModpacks('installCurseForgeModpack').installCurseForgeModpack(projectId, fileId, targetModpackId, rootPath));
  },

  installModrinth(projectId: string, versionId: string, targetModpackId?: string, rootPath?: string) {
    return call('installModrinthModpack', () => requireModpacks('installModrinthModpack').installModrinthModpack(projectId, versionId, targetModpackId, rootPath));
  },

  // Получение информации о модпаке из файла
  getModpackInfoFromFile(filePath: string) {
    return call('getModpackInfoFromFile', () => requireModpacks('getModpackInfoFromFile').getModpackInfoFromFile(filePath));
  },

  // Импорт модпака
  import(filePath: string, targetModpackId?: string, rootPath?: string) {
    return call('importModpack', () => requireModpacks('importModpack').importModpack(filePath, targetModpackId, rootPath));
  },

  // Создание локального модпака
  createLocal(name: string, version: string, minecraftVersion: string, modLoader?: { type: string; version?: string }, rootPath?: string) {
    return call('createLocalModpack', () => requireModpacks('createLocalModpack').createLocalModpack(name, version, minecraftVersion, modLoader, rootPath));
  },

  // Экспорт модпака
  export(modpackId: string, format: 'curseforge' | 'modrinth' | 'zip', outputPath: string, rootPath?: string) {
    return call('exportModpack', () => requireModpacks('exportModpack').exportModpack(modpackId, format, outputPath, rootPath));
  },

  // Получение списка модов в модпаке
  getMods(modpackId: string, rootPath?: string) {
    return call('getModpackMods', () => requireModpacks('getModpackMods').getModpackMods(modpackId, rootPath));
  },

  // Удаление мода из модпака
  removeMod(modpackId: string, modPath: string, rootPath?: string) {
    return call('removeModFromModpack', () => requireModpacks('removeModFromModpack').removeModFromModpack(modpackId, modPath, rootPath));
  },

  // Включить/выключить мод (.jar <-> .jar.disabled)
  setModEnabled(modpackId: string, modPath: string, enabled: boolean, rootPath?: string) {
    return call('setModEnabled', () => requireModpacks('setModEnabled').setModEnabled(modpackId, modPath, enabled, rootPath));
  },

  // Резервное копирование модпака
  backup(modpackId: string, rootPath?: string) {
    return call('backupModpack', () => requireModpacks('backupModpack').backupModpack(modpackId, rootPath));
  },

  // Добавление мода в модпак
  addMod(modpackId: string, mod: { platform: 'curseforge' | 'modrinth'; projectId: string | number; versionId: string | number }, rootPath?: string) {
    return call('addModToModpack', () => requireModpacks('addModToModpack').addModToModpack(modpackId, mod, rootPath));
  },
};

export type ModpacksIPC = typeof modpacksIPC;

