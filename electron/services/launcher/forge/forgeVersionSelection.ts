import type { ForgeVersion, ForgeVersionList } from '@xmcl/installer';

interface ForgePromotionsData {
  promos: Record<string, string>;
}

export async function getForgeVersionFromPromotions(mcVersion: string, onLog: (data: string) => void) {
  // `promotions_slim.json` is hosted on files.minecraftforge.net (not on maven.minecraftforge.net).
  // Trying the maven host produces 404 noise and delays in logs.
  const promotionsUrl = 'https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json';
  onLog('[Forge] Falling back to promotions JSON...');
  const response = await fetch(promotionsUrl);
  if (!response.ok) {
    throw new Error(`Forge promotions fetch failed: ${response.status} ${response.statusText}`);
  }
  const data = (await response.json()) as ForgePromotionsData;
  const promoKey = `${mcVersion}-recommended`;
  const latestKey = `${mcVersion}-latest`;
  const version = data.promos[promoKey] ?? data.promos[latestKey];
  if (!version) {
    throw new Error(`No Forge promotions found for Minecraft ${mcVersion}`);
  }
  const type = data.promos[promoKey] ? 'recommended' : 'latest';
  onLog(`[Forge] Using ${type} build from promotions: ${version}`);
  return { mcversion: mcVersion, version };
}

export function selectForgeVersion(mcVersion: string, list: ForgeVersionList[] | ForgeVersionList): ForgeVersion {
  const pages = Array.isArray(list) ? list : [list];
  const page = pages.find((p) => p.mcversion === mcVersion);
  if (!page || page.versions.length === 0) {
    throw new Error(`Forge list is empty for Minecraft ${mcVersion}`);
  }

  const recommended = page.versions.find((v) => v.type === 'recommended');
  const latest = page.versions.find((v) => v.type === 'latest');
  const common = page.versions.find((v) => v.type === 'common');
  return recommended ?? latest ?? common ?? page.versions[0];
}

