import type {
  CurseForgeManifest,
  ModpackManifest,
} from '../../../../shared/types/modpack';

/**
 * Парсинг CurseForge манифеста (manifest.json)
 */
export function parseCurseForgeManifest(manifestJson: string): ModpackManifest {
  let parsed: CurseForgeManifest;
  
  try {
    parsed = JSON.parse(manifestJson);
  } catch (error) {
    throw new Error(`Failed to parse CurseForge manifest JSON: ${error}`);
  }

  // Валидация структуры
  if (!parsed.manifestVersion) {
    throw new Error('CurseForge manifest missing manifestVersion');
  }
  
  if (parsed.manifestType !== 'minecraftModpack') {
    throw new Error(`Invalid manifestType: expected "minecraftModpack", got "${parsed.manifestType}"`);
  }
  
  if (!parsed.minecraft) {
    throw new Error('CurseForge manifest missing minecraft section');
  }
  
  if (!parsed.minecraft.version) {
    throw new Error('CurseForge manifest missing minecraft.version');
  }
  
  if (!Array.isArray(parsed.minecraft.modLoaders)) {
    throw new Error('CurseForge manifest minecraft.modLoaders must be an array');
  }
  
  if (!parsed.name) {
    throw new Error('CurseForge manifest missing name');
  }
  
  if (!parsed.version) {
    throw new Error('CurseForge manifest missing version');
  }
  
  if (!Array.isArray(parsed.files)) {
    throw new Error('CurseForge manifest files must be an array');
  }

  // Преобразование в универсальный формат
  const manifest: ModpackManifest = {
    formatVersion: parsed.manifestVersion,
    minecraft: {
      version: parsed.minecraft.version,
      modLoaders: parsed.minecraft.modLoaders.map((loader) => ({
        id: loader.id,
        primary: loader.primary ?? false,
      })),
    },
    name: parsed.name,
    version: parsed.version,
    author: parsed.author,
    files: parsed.files.map((file) => ({
      projectID: file.projectID,
      fileID: file.fileID,
      required: file.required ?? true,
    })),
    overrides: parsed.overrides || 'overrides',
  };

  return manifest;
}

/**
 * Валидация CurseForge манифеста
 */
export function validateCurseForgeManifest(manifest: CurseForgeManifest): boolean {
  try {
    if (!manifest.manifestVersion || manifest.manifestVersion !== 1) {
      return false;
    }
    
    if (manifest.manifestType !== 'minecraftModpack') {
      return false;
    }
    
    if (!manifest.minecraft?.version) {
      return false;
    }
    
    if (!Array.isArray(manifest.minecraft.modLoaders)) {
      return false;
    }
    
    if (!manifest.name || !manifest.version) {
      return false;
    }
    
    if (!Array.isArray(manifest.files)) {
      return false;
    }
    
    // Валидация файлов
    for (const file of manifest.files) {
      if (typeof file.projectID !== 'number' || typeof file.fileID !== 'number') {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}
