/**
 * Типы для работы с модпаками в сервисе
 */

import type {
  ModpackMetadata,
  ModpackManifest,
  CurseForgeManifest,
  ModrinthManifest,
  ModpackSource,
} from '../../../shared/types/modpack';

export type {
  ModpackMetadata,
  ModpackManifest,
  CurseForgeManifest,
  ModrinthManifest,
  ModpackSource,
};

/**
 * Расширенный индекс модпаков с метаданными
 */
export interface ModpacksMetadataIndex {
  /** ID выбранного модпака */
  selectedModpack: string;
  /** Метаданные всех модпаков */
  modpacks: Record<string, ModpackMetadata>;
}
