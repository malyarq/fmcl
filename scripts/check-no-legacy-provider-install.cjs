/* global __dirname, console, process */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const forbidden = [
  ['shared/contracts/modpacks.ts', /\binstallCurseForgeModpack\b|\binstallModrinthModpack\b|\bonInstallProgress\b/],
  ['shared/contracts/ipcChannels.ts', /['"]modpacks:(?:installCurseForge|installModrinth|updateProgress)['"]/],
  ['electron/ipc/handlers/modpacksHandlers.ts', /['"]modpacks:(?:installCurseForge|installModrinth|updateProgress)['"]/],
  ['electron/preload/bridges/ModpacksBridge.ts', /\binstallCurseForgeModpack\b|\binstallModrinthModpack\b|\bonInstallProgress\b/],
  ['src/services/ipc/modpacksIPC.ts', /\binstallCurseForge\b|\binstallModrinth\b|\bonInstallProgress\b/],
  ['src/verification/manual/mockEnvironment.ts', /\binstallCurseForgeModpack\b|\binstallModrinthModpack\b|\bonInstallProgress\b/],
  ['docs/en/contracts-map.md', /`modpacks:(?:installCurseForge|installModrinth|updateProgress)`/],
  ['docs/ru/contracts-map.md', /`modpacks:(?:installCurseForge|installModrinth|updateProgress)`/],
  ['src/components/modpacks/InstallModpackPage.tsx', /modpacksIPC\.(?:installCurseForge|installModrinth|onInstallProgress)/],
  ['src/components/modpacks/InstallModpackModal.tsx', /modpacksIPC\.(?:installCurseForge|installModrinth|onInstallProgress)/],
  ['src/components/modpacks/ModpackUpdateModal.tsx', /modpacksIPC\.(?:installCurseForge|installModrinth|onInstallProgress)/],
]

const violations = forbidden.flatMap(([relativePath, pattern]) => {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8')
  return pattern.test(source) ? [`${relativePath} retains legacy provider install IPC`] : []
})

if (violations.length > 0) {
  console.error('[legacy-provider-install] Found removed provider install IPC references:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log('[legacy-provider-install] OK (provider installs use operations only)')
