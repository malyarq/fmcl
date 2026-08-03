/* global console, process, __dirname */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')
const rendererRoot = path.join(root, 'src')
const sourceExtensions = new Set(['.ts', '.tsx'])
const legacyGlobals = [
  'account', 'appUpdater', 'assets', 'cache', 'externalLinks', 'ipcRenderer', 'launcher',
  'mirrors', 'mods', 'networkAPI', 'settings', 'share', 'updater', 'windowControls',
]

function listSourceFiles(dir) {
  const files = []
  const stack = [dir]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(absolutePath)
      else if (sourceExtensions.has(path.extname(entry.name))) files.push(absolutePath)
    }
  }
  return files
}

function parseAllowedChannels() {
  const source = fs.readFileSync(path.join(root, 'shared/contracts/ipcChannels.ts'), 'utf8')
  return [...source.matchAll(/'([a-z0-9-]+:[a-z0-9-]+)'/gi)].map((match) => match[1])
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split('\n').length
}

function main() {
  const violations = []
  const channelPatterns = parseAllowedChannels().map((channel) => ({
    channel,
    regex: new RegExp(`['"]${channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
  }))

  for (const absolutePath of listSourceFiles(rendererRoot)) {
    const source = fs.readFileSync(absolutePath, 'utf8')
    const relativePath = path.relative(root, absolutePath)

    for (const globalName of legacyGlobals) {
      const regex = new RegExp(`\\bwindow\\.${globalName}\\b`, 'g')
      for (const match of source.matchAll(regex)) {
        violations.push(`${relativePath}:${lineNumber(source, match.index)} uses legacy window.${globalName}`)
      }
    }

    for (const { channel, regex } of channelPatterns) {
      for (const match of source.matchAll(regex)) {
        violations.push(`${relativePath}:${lineNumber(source, match.index)} embeds raw IPC channel ${channel}`)
      }
    }
  }

  for (const relativePath of [
    'shared/contracts/ipcRenderer.ts',
    'electron/preload/bridges/IpcRendererBridge.ts',
  ]) {
    if (fs.existsSync(path.join(root, relativePath))) {
      violations.push(`${relativePath} restores the removed generic IPC bridge`)
    }
  }

  const preload = fs.readFileSync(path.join(root, 'electron/preload.ts'), 'utf8')
  const exposedNames = [...preload.matchAll(/contextBridge\.exposeInMainWorld\(\s*['"]([^'"]+)['"]/g)]
    .map((match) => match[1])
  if (exposedNames.length !== 1 || exposedNames[0] !== 'api') {
    violations.push(`electron/preload.ts must expose exactly one global named api; found: ${exposedNames.join(', ') || 'none'}`)
  }

  if (violations.length > 0) {
    console.error('[architecture] Boundary violations:')
    for (const violation of violations.sort()) console.error(`- ${violation}`)
    process.exit(1)
  }

  console.log('[architecture] OK (single typed renderer boundary; no raw IPC or legacy globals)')
}

main()
