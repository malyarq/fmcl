export type SupportedJavaVersion = 8 | 17 | 21 | 25;

export function getRequiredJavaForMinecraftVersion(mcVersion: string): SupportedJavaVersion {
  const parts = mcVersion.split('.');
  const major = Number(parts[0]);
  const minor = Number(parts[1]);
  const patch = Number(parts[2] ?? 0);

  // Mojang's calendar-versioned releases (26.x+) require Java 25.
  if (major > 1) return 25;
  if ((minor * 100) + patch >= 2005) return 21;
  if (minor >= 17) return 17;
  return 8;
}
