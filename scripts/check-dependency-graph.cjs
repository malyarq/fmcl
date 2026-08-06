/* global console, process, __dirname */
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const defaultRoot = path.join(__dirname, '..')
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']
const deletedCentralNetworkOwners = [
  'electron/services/network/networkService.ts',
  'electron/services/network/networkManager.ts',
  'src/contexts/instances/hooks/useInstanceNetworkModeSync.ts',
]

function listSourceFiles(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  const stack = [directory]
  while (stack.length > 0) {
    const current = stack.pop()
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolutePath = path.join(current, entry.name)
      if (entry.isDirectory()) stack.push(absolutePath)
      else if (sourceExtensions.includes(path.extname(entry.name))) files.push(absolutePath)
    }
  }
  return files
}

function isProductionSource(relativePath) {
  return !relativePath.includes('/__tests__/')
    && !/\.(?:test|spec)\.[^.]+$/.test(relativePath)
}

function relative(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/')
}

function sourceKind(fileName) {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (fileName.endsWith('.js') || fileName.endsWith('.mjs') || fileName.endsWith('.cjs')) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function lineNumber(sourceFile, node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
}

function staticStringExpression(node) {
  if (ts.isStringLiteralLike(node)) return node.text
  if (ts.isParenthesizedExpression(node)) return staticStringExpression(node.expression)
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = staticStringExpression(node.left)
    const right = staticStringExpression(node.right)
    return left === undefined || right === undefined ? undefined : left + right
  }
  if (ts.isTemplateExpression(node)) {
    let value = node.head.text
    for (const span of node.templateSpans) {
      const expression = staticStringExpression(span.expression)
      if (expression === undefined) return undefined
      value += expression + span.literal.text
    }
    return value
  }
  return undefined
}

function isRendererGlobal(node) {
  return ts.isIdentifier(node) && (node.text === 'window' || node.text === 'globalThis')
}

function collectModuleReferences(absolutePath, source) {
  const sourceFile = ts.createSourceFile(absolutePath, source, ts.ScriptTarget.Latest, true, sourceKind(absolutePath))
  const imports = []
  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier
      && ts.isStringLiteralLike(node.moduleSpecifier)) {
      imports.push({ specifier: node.moduleSpecifier.text, line: lineNumber(sourceFile, node) })
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression && ts.isStringLiteralLike(node.moduleReference.expression)) {
      imports.push({ specifier: node.moduleReference.expression.text, line: lineNumber(sourceFile, node) })
    } else if (ts.isCallExpression(node) && node.arguments.length === 1 && ts.isStringLiteralLike(node.arguments[0])) {
      const dynamicImport = node.expression.kind === ts.SyntaxKind.ImportKeyword
      const commonJsRequire = ts.isIdentifier(node.expression) && node.expression.text === 'require'
      if (dynamicImport || commonJsRequire) {
        imports.push({ specifier: node.arguments[0].text, line: lineNumber(sourceFile, node) })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return imports
}

function collectGenericPreloadUses(absolutePath, source) {
  const sourceFile = ts.createSourceFile(absolutePath, source, ts.ScriptTarget.Latest, true, sourceKind(absolutePath))
  const lines = []
  function visit(node) {
    const direct = ts.isPropertyAccessExpression(node)
      && isRendererGlobal(node.expression) && node.name.text === 'api'
    const computed = ts.isElementAccessExpression(node)
      && isRendererGlobal(node.expression)
      && node.argumentExpression && staticStringExpression(node.argumentExpression) === 'api'
    if (direct || computed) lines.push(lineNumber(sourceFile, node))
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return lines
}

function collectUnsafeRendererLoaders(absolutePath, source) {
  const sourceFile = ts.createSourceFile(absolutePath, source, ts.ScriptTarget.Latest, true, sourceKind(absolutePath))
  const uses = []
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword
      && (node.arguments.length !== 1 || !ts.isStringLiteralLike(node.arguments[0]))) {
      uses.push({ line: lineNumber(sourceFile, node), reason: 'renderer uses non-literal dynamic import' })
    }
    if (ts.isIdentifier(node) && node.text === 'require') {
      const parent = node.parent
      const directLiteralCall = ts.isCallExpression(parent) && parent.expression === node
        && parent.arguments.length === 1 && ts.isStringLiteralLike(parent.arguments[0])
      if (!directLiteralCall) {
        uses.push({ line: lineNumber(sourceFile, node), reason: 'renderer aliases or dynamically uses CommonJS require' })
      }
    }
    if (ts.isElementAccessExpression(node) && isRendererGlobal(node.expression) && node.argumentExpression) {
      const property = staticStringExpression(node.argumentExpression)
      if (property === 'require') {
        uses.push({ line: lineNumber(sourceFile, node), reason: 'renderer accesses computed global require loader' })
      } else if (property === undefined) {
        uses.push({ line: lineNumber(sourceFile, node), reason: 'renderer accesses non-literal computed global capability' })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return uses
}

function resolveLocalImport(projectRoot, importerPath, specifier) {
  let unresolvedBase
  if (specifier.startsWith('.')) unresolvedBase = path.resolve(path.dirname(importerPath), specifier)
  else if (specifier === '@shared' || specifier.startsWith('@shared/')) {
    unresolvedBase = path.join(projectRoot, 'shared', specifier.slice('@shared'.length))
  } else {
    try {
      require.resolve(specifier, { paths: [path.dirname(importerPath), projectRoot] })
      return null
    } catch {
      const packageName = specifier.startsWith('@')
        ? specifier.split('/').slice(0, 2).join('/')
        : specifier.split('/')[0]
      return fs.existsSync(path.join(projectRoot, 'node_modules', packageName)) ? null : undefined
    }
  }

  const candidates = [
    unresolvedBase,
    ...sourceExtensions.map((extension) => `${unresolvedBase}${extension}`),
    ...sourceExtensions.map((extension) => path.join(unresolvedBase, `index${extension}`)),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || undefined
}

function tierFor(relativePath) {
  if (relativePath.startsWith('src/')) return 'renderer'
  if (relativePath.startsWith('shared/')) return 'shared'
  if (relativePath.startsWith('electron/app/')) return 'composition'
  if (relativePath.startsWith('electron/domains/')) return 'domain'
  if (relativePath.startsWith('electron/infrastructure/')) return 'infrastructure'
  if (relativePath === 'electron/preload.ts' || relativePath.startsWith('electron/preload/')) return 'preload'
  if (relativePath.startsWith('electron/ipc/')) return 'ipc'
  if (relativePath === 'electron/main.ts') return 'entrypoint'
  if (relativePath.startsWith('electron/')) return 'main-service'
  return 'unknown'
}

function isAllowedTierEdge(fromTier, toTier) {
  const allowedTargets = {
    renderer: new Set(['renderer', 'shared']),
    shared: new Set(['shared']),
    composition: new Set(['composition', 'domain', 'infrastructure', 'ipc', 'preload', 'main-service', 'shared']),
    domain: new Set(['domain', 'shared']),
    infrastructure: new Set(['infrastructure', 'domain', 'main-service', 'shared']),
    preload: new Set(['preload', 'shared']),
    ipc: new Set(['ipc', 'composition', 'domain', 'infrastructure', 'main-service', 'shared']),
    'main-service': new Set(['main-service', 'domain', 'infrastructure', 'shared']),
    entrypoint: new Set(['composition', 'preload', 'main-service', 'shared']),
  }
  return allowedTargets[fromTier] && allowedTargets[fromTier].has(toTier)
}

function isProviderSdk(specifier) {
  return specifier.startsWith('@xmcl/') || /(?:^|\/)(?:modrinth|curseforge)(?:\/|$)/i.test(specifier)
}

function isRendererPrivilegedModule(specifier) {
  return specifier === 'electron' || specifier === 'fs' || specifier === 'path' || specifier.startsWith('node:')
}

function isTypedPreloadSeam(relativePath) {
  return relativePath.startsWith('src/services/ipc/')
    || relativePath === 'src/verification/manual/mockEnvironment.ts'
}

function collectDependencyGraphViolations(projectRoot = defaultRoot) {
  const violations = []
  const productionFiles = ['src', 'shared', 'electron']
    .flatMap((directory) => listSourceFiles(path.join(projectRoot, directory)))
    .filter((absolutePath) => isProductionSource(relative(projectRoot, absolutePath)))

  for (const deletedOwner of deletedCentralNetworkOwners) {
    if (fs.existsSync(path.join(projectRoot, deletedOwner))) {
      violations.push(`${deletedOwner}:1 restores deleted central network owner`)
    }
  }

  for (const absolutePath of productionFiles) {
    const source = fs.readFileSync(absolutePath, 'utf8')
    const relativePath = relative(projectRoot, absolutePath)
    const fromTier = tierFor(relativePath)

    if (fromTier === 'renderer') {
      if (!isTypedPreloadSeam(relativePath)) {
        for (const line of collectGenericPreloadUses(absolutePath, source)) {
          violations.push(`${relativePath}:${line} renderer uses generic preload global window.api`)
        }
      }
      for (const use of collectUnsafeRendererLoaders(absolutePath, source)) {
        violations.push(`${relativePath}:${use.line} ${use.reason}`)
      }
    }

    for (const imported of collectModuleReferences(absolutePath, source)) {
      const { specifier, line } = imported
      if (fromTier === 'renderer' && isRendererPrivilegedModule(specifier)) {
        violations.push(`${relativePath}:${line} renderer imports privileged module ${specifier}`)
        continue
      }
      if (fromTier === 'renderer' && isProviderSdk(specifier)) {
        violations.push(`${relativePath}:${line} renderer imports provider SDK ${specifier}`)
        continue
      }

      const resolved = resolveLocalImport(projectRoot, absolutePath, specifier)
      if (resolved === undefined) {
        violations.push(`${relativePath}:${line} cannot resolve import ${specifier}`)
        continue
      }
      if (resolved === null) continue

      if (path.extname(resolved) === '.json') continue

      const targetPath = relative(projectRoot, resolved)
      const toTier = tierFor(targetPath)
      if (!isAllowedTierEdge(fromTier, toTier)) {
        const reason = fromTier === 'domain' || fromTier === 'infrastructure'
          ? `${fromTier} imports reverse tier ${targetPath}`
          : `${fromTier} imports non-${fromTier} tier ${targetPath}`
        violations.push(`${relativePath}:${line} ${reason}`)
      }
    }
  }

  return [...new Set(violations)].sort()
}

function main() {
  const violations = collectDependencyGraphViolations(defaultRoot)
  if (violations.length > 0) {
    console.error('[dependency-graph] Boundary violations:')
    for (const violation of violations) console.error(`- ${violation}`)
    process.exitCode = 1
    return
  }
  console.log('[dependency-graph] OK (typed renderer boundary and directed main-process tiers)')
}

module.exports = { collectDependencyGraphViolations }

if (require.main === module) main()
