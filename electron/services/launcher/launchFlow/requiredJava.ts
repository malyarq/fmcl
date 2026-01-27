export function getRequiredJavaForMinecraftVersion(mcVersion: string): 8 | 17 | 21 {
  // mcVersion like "1.20.6"
  const parts = mcVersion.split('.');
  const minor = parseInt(parts[1] || '0', 10); // 20 in 1.20.6
  const patch = parseInt(parts[2] || '0', 10); // 6 in 1.20.6

  // Mojang Java requirements (simplified):
  // - 1.20.5+ => Java 21
  // - 1.17+   => Java 17
  // - else    => Java 8
  if (minor === 20 && patch >= 5) return 21;
  if (minor > 20) return 21;
  if (minor >= 17) return 17;
  return 8;
}

