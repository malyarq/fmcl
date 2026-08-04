/* global __dirname, console, process */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const forbidden = [
  ['shared/contracts/modpacks.ts', /\bimportModpack\b/],
  ['shared/contracts/ipcChannels.ts', /['"]modpacks:import['"]/],
  ['electron/ipc/handlers/modpacksHandlers.ts', /['"]modpacks:import['"]/],
  ['electron/preload/bridges/ModpacksBridge.ts', /\bimportModpack\b/],
  ['src/services/ipc/modpacksIPC.ts', /\bimportModpack\b|\bimport:\s*\(/],
  ['src/verification/manual/mockEnvironment.ts', /\bimportModpack\b/],
  ['docs/en/contracts-map.md', /`modpacks:import`/],
  ['docs/ru/contracts-map.md', /`modpacks:import`/],
  ['src/components/modpacks/ImportModpackPreviewPage.tsx', /\bimportModpack\b|operationsIPC\.import/],
  ['src/components/modpacks/ImportModpackPreviewModal.tsx', /\bimportModpack\b|operationsIPC\.import/],
  ['src/components/modpacks/ModpackList.tsx', /\bimportModpack\b|operationsIPC\.import/],
]

const violations = forbidden.flatMap(([relativePath, pattern]) => {
  const absolutePath = path.join(root, relativePath)
  if (!fs.existsSync(absolutePath)) return []
  const source = fs.readFileSync(absolutePath, 'utf8')
  return pattern.test(source) ? [`${relativePath} retains legacy archive import IPC`] : []
})

if (violations.length > 0) {
  console.error('[legacy-import] Found removed archive import IPC references:')
  for (const violation of violations) console.error(`- ${violation}`)
  process.exit(1)
}

console.log('[legacy-import] OK (archive import uses operations only)')
