import type { ProjectVersion } from '@xmcl/modrinth';

export function pickPrimaryModrinthFile(v: ProjectVersion) {
  const primary = v.files.find((f) => f.primary) ?? v.files[0];
  return primary;
}

