// NOTE: @xmcl/curseforge exports `const enum`s in d.ts; with `isolatedModules` we must not reference them as values.
const CF_MODLOADER_ANY = 0;
const CF_MODLOADER_FORGE = 1;
const CF_MODLOADER_FABRIC = 4;
const CF_MODLOADER_QUILT = 5;
const CF_MODLOADER_NEOFORGE = 6;

export const CF_SORT_POPULARITY = 2;
export const CF_SORT_LAST_UPDATED = 3;
export const CF_SORT_NAME = 4;

export function mapLoaderToModrinth(loader?: string) {
  switch ((loader ?? 'any').toLowerCase()) {
    case 'forge':
      return 'forge';
    case 'fabric':
      return 'fabric';
    case 'quilt':
      return 'quilt';
    case 'neoforge':
      return 'neoforge';
    default:
      return undefined;
  }
}

export function mapLoaderToCurseforge(loader?: string): number | undefined {
  switch ((loader ?? 'any').toLowerCase()) {
    case 'forge':
      return CF_MODLOADER_FORGE;
    case 'fabric':
      return CF_MODLOADER_FABRIC;
    case 'quilt':
      return CF_MODLOADER_QUILT;
    case 'neoforge':
      return CF_MODLOADER_NEOFORGE;
    default:
      return CF_MODLOADER_ANY;
  }
}

