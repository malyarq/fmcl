import fs from 'node:fs';
import path from 'node:path';
import type { ModpackConfig, ModpacksIndex } from './types';
import { loadModpackConfigFile, saveModpackConfigFile } from './configStore';
import { ensureModpacksMigratedFile, loadModpacksIndexFile, saveModpacksIndexFile } from './indexStore';
import {
  ensureXmclFolders,
  getDefaultRootPath,
  getModpackConfigPath,
  getModpackDir,
  getModpacksIndexPath,
} from './paths';
import { syncRenamedModpackMetadata } from '../modpacks/storage';

export type { ModpackConfig, ModpacksIndex, ModpackRuntime, ModLoaderType, NetworkMode } from './types';
import { javaScanner, type DetectedJava } from '../java/javaScanner';

export type { DetectedJava };

/**
 * Owns modpack/root folder layout concerns.
 *
 * Step-0 note:
 * - This only encapsulates "ensure folders exist" and default rootPath.
 * - Step 7 will migrate to XMCL modpack format and richer CRUD.
 */
export class ModpackService {
  public getDefaultRootPath() {
    return getDefaultRootPath();
  }

  public ensureXmclFolders(rootPath: string) {
    ensureXmclFolders(rootPath);
  }

  public getModpacksIndexPath(rootPath: string) {
    return getModpacksIndexPath(rootPath);
  }

  public getModpackDir(rootPath: string, modpackId: string) {
    return getModpackDir(rootPath, modpackId);
  }

  public getModpackConfigPath(rootPath: string, modpackId: string) {
    return getModpackConfigPath(rootPath, modpackId);
  }

  /**
   * Ensure XMCL-like modpack layout exists.
   * If there is no modpacks.json, create a `default` modpack.
   */
  public ensureModpacksMigrated(rootPath: string, seedDefault?: Partial<ModpackConfig>) {
    ensureModpacksMigratedFile(rootPath, seedDefault);
  }

  public loadModpacksIndex(rootPath: string): ModpacksIndex {
    this.ensureModpacksMigrated(rootPath);
    return loadModpacksIndexFile(rootPath);
  }

  public saveModpacksIndex(rootPath: string, index: ModpacksIndex) {
    saveModpacksIndexFile(rootPath, index);
  }

  public listModpacks(rootPath: string) {
    const idx = this.loadModpacksIndex(rootPath);
    return Object.entries(idx.modpacks).map(([id, meta]) => ({
      id,
      name: meta.name,
      path: this.getModpackDir(rootPath, id),
      selected: idx.selectedModpack === id,
    }));
  }

  public getSelectedModpackId(rootPath: string) {
    const idx = this.loadModpacksIndex(rootPath);
    return idx.selectedModpack;
  }

  public setSelectedModpack(rootPath: string, modpackId: string) {
    const idx = this.loadModpacksIndex(rootPath);
    if (!idx.modpacks[modpackId]) {
      throw new Error(`Modpack ${modpackId} not found`);
    }
    idx.selectedModpack = modpackId;
    this.saveModpacksIndex(rootPath, idx);
  }

  public loadModpackConfig(rootPath: string, modpackId: string): ModpackConfig {
    this.ensureModpacksMigrated(rootPath);
    return loadModpackConfigFile(rootPath, modpackId);
  }

  public saveModpackConfig(rootPath: string, cfg: ModpackConfig) {
    saveModpackConfigFile(rootPath, cfg);
  }

  public createModpack(rootPath: string, name: string, seed?: Partial<ModpackConfig>) {
    const idx = this.loadModpacksIndex(rootPath);
    const base = name.trim() || 'Modpack';
    const slug = base
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'modpack';
    let id = slug;
    let i = 2;
    while (idx.modpacks[id]) {
      id = `${slug}-${i++}`;
    }

    idx.modpacks[id] = { name: base };
    idx.selectedModpack = id;
    this.saveModpacksIndex(rootPath, idx);

    const now = new Date().toISOString();
    const cfg: ModpackConfig = {
      id,
      name: base,
      runtime: seed?.runtime ?? { minecraft: '1.12.2', modLoader: { type: 'vanilla' } },
      java: seed?.java,
      memory: seed?.memory ?? { maxMb: 4096 },
      vmOptions: seed?.vmOptions ?? [],
      server: seed?.server,
      networkMode: seed?.networkMode,
      createdAt: now,
      updatedAt: now,
    };
    fs.mkdirSync(this.getModpackDir(rootPath, id), { recursive: true });
    fs.mkdirSync(path.join(this.getModpackDir(rootPath, id), 'mods'), { recursive: true });
    this.saveModpackConfig(rootPath, cfg);
    return { id, config: cfg };
  }

  public cleanupFailedCreation(rootPath: string, modpackId: string): void {
    const idx = this.loadModpacksIndex(rootPath);
    if (!idx.modpacks[modpackId]) return;

    delete idx.modpacks[modpackId];

    // If deleted modpack was selected, select another one (prefer 'default' if exists, otherwise first available)
    if (idx.selectedModpack === modpackId) {
      const remainingIds = Object.keys(idx.modpacks);
      idx.selectedModpack = remainingIds.length > 0
        ? (idx.modpacks['default'] ? 'default' : remainingIds[0])
        : 'default';
    }

    this.saveModpacksIndex(rootPath, idx);
    const dir = this.getModpackDir(rootPath, modpackId);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }

  /**
   * Bootstrap modpacks from legacy renderer settings.
   * - If modpacks.json exists: no-op, returns current selected config.
   * - If missing: creates `default` modpack using `seedDefault`.
   */
  public bootstrapModpacks(rootPath: string, seedDefault?: Partial<ModpackConfig>) {
    this.ensureXmclFolders(rootPath);
    const indexPath = this.getModpacksIndexPath(rootPath);
    if (!fs.existsSync(indexPath)) {
      this.ensureModpacksMigrated(rootPath, seedDefault);
    } else {
      // still ensure folder layout
      this.ensureModpacksMigrated(rootPath);
    }
    const idx = this.loadModpacksIndex(rootPath);
    const selectedId = idx.selectedModpack || 'default';
    const cfg = this.loadModpackConfig(rootPath, selectedId);
    return { index: idx, selectedId, config: cfg };
  }

  public renameModpack(rootPath: string, modpackId: string, name: string) {
    const idx = this.loadModpacksIndex(rootPath);
    if (!idx.modpacks[modpackId]) throw new Error(`Modpack ${modpackId} not found`);
    const newName = name.trim();
    if (!newName) throw new Error('Modpack name cannot be empty');
    idx.modpacks[modpackId].name = newName;
    this.saveModpacksIndex(rootPath, idx);

    const cfg = this.loadModpackConfig(rootPath, modpackId);
    cfg.name = newName;
    this.saveModpackConfig(rootPath, cfg);
    syncRenamedModpackMetadata(rootPath, cfg);
    return { ok: true } as const;
  }

  public async scanJava(): Promise<DetectedJava[]> {
    return await javaScanner.scanJava();
  }
}
