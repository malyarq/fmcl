/**
 * Convert mod display name to URL slug (Modrinth, CurseForge).
 * Removes special characters: apostrophes, quotes, etc.
 * Example: "Reese's Sodium Options" -> "reeses-sodium-options"
 */
export function modNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}
