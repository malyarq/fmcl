/* global console, process, __dirname */
const fs = require('node:fs')
const path = require('node:path')

const defaultRoot = path.join(__dirname, '..')
const sourceExtensions = new Set(['.ts', '.tsx'])
const legacyGlobals = [
  'account', 'appUpdater', 'assets', 'cache', 'externalLinks', 'ipcRenderer', 'launcher',
  'mirrors', 'mods', 'networkAPI', 'settings', 'share', 'updater', 'windowControls',
]
const removedOwnerFiles = [
  'electron/services/instances/instanceService.ts',
  'electron/services/instances/indexStore.ts',
  'electron/services/instances/configStore.ts',
  'electron/services/modpacks/modpackService.ts',
  'electron/services/modpacks/storage.ts',
]
const removedGenericBridgeFiles = [
  'shared/contracts/ipcRenderer.ts',
  'electron/preload/bridges/IpcRendererBridge.ts',
]
const compositionOnlyConstructors = [
  'InstanceApplication',
  'JsonControlPlaneStore',
  'OperationRunner',
  'ModPlatformService',
  'LauncherManager',
]

function listSourceFiles(dir) {
  if (!fs.existsSync(dir)) return []
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

function isProductionSource(relativePath) {
  return !relativePath.includes('/__tests__/')
    && !/\.(?:test|spec)\.[^.]+$/.test(relativePath)
}

function parseAllowedChannels(projectRoot) {
  const contractPath = path.join(projectRoot, 'shared/contracts/ipcChannels.ts')
  if (!fs.existsSync(contractPath)) return []
  const source = fs.readFileSync(contractPath, 'utf8')
  return [...source.matchAll(/'([a-z0-9-]+:[a-z0-9-]+)'/gi)].map((match) => match[1])
}

function lineNumber(source, offset) {
  return source.slice(0, offset).split('\n').length
}

function relative(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/')
}

function addMatches(violations, source, relativePath, regex, message) {
  for (const match of source.matchAll(regex)) {
    violations.push(`${relativePath}:${lineNumber(source, match.index)} ${message(match)}`)
  }
}

function collectArchitectureViolations(projectRoot = defaultRoot) {
  const violations = []
  const rendererRoot = path.join(projectRoot, 'src')
  const channelPatterns = parseAllowedChannels(projectRoot).map((channel) => ({
    channel,
    regex: new RegExp(`['"]${channel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
  }))

  for (const absolutePath of listSourceFiles(rendererRoot)) {
    const source = fs.readFileSync(absolutePath, 'utf8')
    const relativePath = relative(projectRoot, absolutePath)

    for (const globalName of legacyGlobals) {
      addMatches(
        violations,
        source,
        relativePath,
        new RegExp(`\\bwindow\\.${globalName}\\b`, 'g'),
        () => `uses legacy window.${globalName}`,
      )
    }

    for (const { channel, regex } of channelPatterns) {
      addMatches(violations, source, relativePath, regex, () => `embeds raw IPC channel ${channel}`)
    }
  }

  for (const relativePath of removedGenericBridgeFiles) {
    if (fs.existsSync(path.join(projectRoot, relativePath))) {
      violations.push(`${relativePath}:1 restores the removed generic IPC bridge`)
    }
  }

  for (const relativePath of removedOwnerFiles) {
    if (fs.existsSync(path.join(projectRoot, relativePath))) {
      violations.push(`${relativePath}:1 restores removed legacy owner`)
    }
  }

  const allProductionFiles = ['electron', 'src', 'shared']
    .flatMap((directory) => listSourceFiles(path.join(projectRoot, directory)))
    .filter((absolutePath) => isProductionSource(relative(projectRoot, absolutePath)))

  for (const absolutePath of allProductionFiles) {
    const source = fs.readFileSync(absolutePath, 'utf8')
    const relativePath = relative(projectRoot, absolutePath)

    if (relativePath === 'shared/contracts/operations.ts') {
      addMatches(
        violations,
        source,
        relativePath,
        /\b(?:rootPath|filePath)\b/g,
        (match) => `exposes ${match[0]} through the public operations contract`,
      )
    }

    if (relativePath === 'shared/contracts/launcher.ts') {
      addMatches(
        violations,
        source,
        relativePath,
        /\b(?:rootPath|gamePath|filePath|modpackPath|instancePath|javaPath)\b/g,
        (match) => `exposes ${match[0]} through the public launcher contract`,
      )
      addMatches(
        violations,
        source,
        relativePath,
        /\bmodpackId\b/g,
        () => 'exposes legacy modpackId through the public launcher contract',
      )
    }

    if (relativePath === 'src/services/ipc/operationsIPC.ts') {
      addMatches(
        violations,
        source,
        relativePath,
        /\b(?:rootPath|filePath)\b/g,
        (match) => `exposes ${match[0]} through the renderer operations wrapper`,
      )
    } else if (
      relativePath.startsWith('src/')
      && /(?:from\s+|import\s*\()\s*['"][^'"]*operationsIPC[^'"]*['"]/.test(source)
    ) {
      addMatches(
        violations,
        source,
        relativePath,
        /\b(?:rootPath|filePath)\b/g,
        (match) => `passes ${match[0]} through renderer operations`,
      )
    }

    if (relativePath === 'src/services/ipc/launcherIPC.ts') {
      addMatches(
        violations,
        source,
        relativePath,
        /\b(?:rootPath|gamePath|filePath|modpackPath|instancePath|javaPath|modpackId)\b/g,
        (match) => `exposes ${match[0]} through the renderer launcher wrapper`,
      )
    } else if (
      relativePath.startsWith('src/')
      && /(?:from\s+|import\s*\()\s*['"][^'"]*launcherIPC[^'"]*['"]/.test(source)
    ) {
      addMatches(
        violations,
        source,
        relativePath,
        /\b(?:rootPath|gamePath|filePath|modpackPath|instancePath|javaPath|modpackId)\b/g,
        (match) => `passes ${match[0]} through renderer launcher IPC`,
      )
    }

    addMatches(
      violations,
      source,
      relativePath,
      /(?:from\s+|import\s*\(|require\s*\()\s*['"][^'"]*(?:features\/launch(?:\/|['"])|contracts\/modpacks|modpacksIPC|ModpacksBridge|modpacksHandlers|services\/instances\/(?:instanceService|indexStore|configStore)|services\/modpacks\/(?:modpackService|storage))[^'"]*['"]/g,
      () => 'imports removed launch or mixed-transport code',
    )

    if (relativePath.startsWith('shared/contracts/')) {
      addMatches(
        violations,
        source,
        relativePath,
        /(?:from\s+|import\s*\()\s*['"]\.\/modpacks['"]/g,
        () => 'imports removed launch or mixed-transport code',
      )
    }

    if (relativePath.startsWith('electron/domains/instances/')) {
      addMatches(
        violations,
        source,
        relativePath,
        /(?:from\s+|import\s*\(|require\s*\()\s*['"](?:node:|fs(?:\/promises)?['"]|path['"]|electron['"])[^'"]*/g,
        () => 'imports native runtime into the instance domain',
      )
    }

    if (relativePath !== 'electron/app/compositionRoot.ts') {
      for (const constructorName of compositionOnlyConstructors) {
        addMatches(
          violations,
          source,
          relativePath,
          new RegExp(`\\bnew\\s+${constructorName}\\s*\\(`, 'g'),
          () => `constructs ${constructorName} outside the composition root`,
        )
      }
    }

    addMatches(
      violations,
      source,
      relativePath,
      /\bnew\s+(?:ModpackService|InstanceService)\s*\(/g,
      () => 'constructs a removed legacy owner',
    )

    if (relativePath !== 'electron/infrastructure/instances/jsonControlPlaneStore.ts') {
      addMatches(
        violations,
        source,
        relativePath,
        /\b(?:writeFileSync|writeFile)\s*\([^\n]*(?:instance-control-plane|modpacks(?:-metadata)?)\.json/g,
        () => 'writes control-plane files outside JsonControlPlaneStore',
      )
    }

    if (relativePath.startsWith('src/')) {
      addMatches(
        violations,
        source,
        relativePath,
        /\b(?:instancePath|resolvePath)\b/g,
        (match) => `restores renderer filesystem authority via ${match[0]}`,
      )
    }
  }

  const preloadPath = path.join(projectRoot, 'electron/preload.ts')
  if (!fs.existsSync(preloadPath)) {
    violations.push('electron/preload.ts:1 typed preload entry is missing')
  } else {
    const preload = fs.readFileSync(preloadPath, 'utf8')
    const exposedNames = [...preload.matchAll(/contextBridge\.exposeInMainWorld\(\s*['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
    if (exposedNames.length !== 1 || exposedNames[0] !== 'api') {
      violations.push(`electron/preload.ts:1 must expose exactly one global named api; found: ${exposedNames.join(', ') || 'none'}`)
    }
  }

  return [...new Set(violations)].sort()
}

function main() {
  const violations = collectArchitectureViolations(defaultRoot)
  if (violations.length > 0) {
    console.error('[architecture] Boundary violations:')
    for (const violation of violations) console.error(`- ${violation}`)
    process.exit(1)
  }

  console.log('[architecture] OK (one control-plane owner; composition-only construction; path-free typed renderer boundary)')
}

module.exports = { collectArchitectureViolations }

if (require.main === module) main()
