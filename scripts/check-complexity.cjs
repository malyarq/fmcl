/* global console, process, __dirname */
const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const defaultRoot = path.join(__dirname, '..')
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const requiredNodeMajor = 24

function listSourceFiles(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  const stack = [directory]
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

function relative(projectRoot, absolutePath) {
  return path.relative(projectRoot, absolutePath).split(path.sep).join('/')
}

function categoryFor(relativePath) {
  if (relativePath.startsWith('src/')) return 'renderer'
  if (relativePath.startsWith('shared/')) return 'shared'
  if (relativePath.startsWith('electron/app/')) return 'electron-app'
  if (relativePath.startsWith('electron/domains/')) return 'electron-domain'
  if (relativePath.startsWith('electron/infrastructure/')) return 'electron-infrastructure'
  if (relativePath === 'electron/preload.ts' || relativePath.startsWith('electron/preload/')) return 'electron-preload'
  if (relativePath.startsWith('electron/ipc/')) return 'electron-ipc'
  return 'electron-service'
}

function scriptKind(fileName) {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (/\.(?:js|mjs|cjs)$/.test(fileName)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function countNonCommentLoc(source, fileName) {
  const scanner = ts.createScanner(ts.ScriptTarget.Latest, true, ts.LanguageVariant.Standard, source)
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName))
  const lines = new Set()
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = scanner.getTokenPos()
    const end = scanner.getTextPos()
    const firstLine = sourceFile.getLineAndCharacterOfPosition(start).line
    const lastLine = sourceFile.getLineAndCharacterOfPosition(Math.max(start, end - 1)).line
    for (let line = firstLine; line <= lastLine; line += 1) lines.add(line)
  }
  return lines.size
}

function isDecision(node) {
  return ts.isIfStatement(node)
    || ts.isConditionalExpression(node)
    || ts.isForStatement(node)
    || ts.isForInStatement(node)
    || ts.isForOfStatement(node)
    || ts.isWhileStatement(node)
    || ts.isDoStatement(node)
    || ts.isCatchClause(node)
    || ts.isCaseClause(node)
    || (ts.isBinaryExpression(node)
      && (node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        || node.operatorToken.kind === ts.SyntaxKind.BarBarToken
        || node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken))
}

function functionComplexity(functionNode) {
  let complexity = 1
  function visit(node) {
    if (node !== functionNode && ts.isFunctionLike(node)) return
    if (isDecision(node)) complexity += 1
    ts.forEachChild(node, visit)
  }
  if (functionNode.body) visit(functionNode.body)
  return complexity
}

function maxFunctionComplexity(source, fileName) {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName))
  let maximum = 0
  function visit(node) {
    if (ts.isFunctionLike(node)) maximum = Math.max(maximum, functionComplexity(node))
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return maximum
}

function collectComplexityInventory(projectRoot = defaultRoot) {
  return ['src', 'shared', 'electron']
    .flatMap((directory) => listSourceFiles(path.join(projectRoot, directory)))
    .map((absolutePath) => ({ absolutePath, path: relative(projectRoot, absolutePath) }))
    .filter(({ path: relativePath }) => isProductionSource(relativePath))
    .map(({ absolutePath, path: relativePath }) => {
      const source = fs.readFileSync(absolutePath, 'utf8')
      return {
        path: relativePath,
        category: categoryFor(relativePath),
        loc: countNonCommentLoc(source, absolutePath),
        maxFunctionComplexity: maxFunctionComplexity(source, absolutePath),
      }
    })
    .sort((left, right) => left.path.localeCompare(right.path))
}

function percentile90(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor((sorted.length - 1) * 0.9)]
}

function buildDefaults(inventory) {
  const grouped = new Map()
  for (const metric of inventory) {
    const metrics = grouped.get(metric.category) || []
    metrics.push(metric)
    grouped.set(metric.category, metrics)
  }
  return Object.fromEntries([...grouped.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([category, metrics]) => [
    category,
    {
      maxLoc: percentile90(metrics.map((metric) => metric.loc)),
      maxFunctionComplexity: percentile90(metrics.map((metric) => metric.maxFunctionComplexity)),
    },
  ]))
}

function npmVersion(projectRoot) {
  return childProcess.execFileSync('npm', ['--version'], { cwd: projectRoot, encoding: 'utf8' }).trim()
}

function commit(projectRoot) {
  return childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: projectRoot, encoding: 'utf8' }).trim()
}

function createRatchet(projectRoot = defaultRoot) {
  const inventory = collectComplexityInventory(projectRoot)
  const defaults = buildDefaults(inventory)
  const exceptions = Object.fromEntries(inventory
    .filter((metric) => metric.loc > defaults[metric.category].maxLoc
      || metric.maxFunctionComplexity > defaults[metric.category].maxFunctionComplexity)
    .map((metric) => [metric.path, {
      maxLoc: metric.loc,
      maxFunctionComplexity: metric.maxFunctionComplexity,
    }]))
  return {
    schemaVersion: 1,
    parser: {
      name: 'typescript',
      version: ts.version,
      loc: 'non-comment physical lines with TypeScript scanner tokens (multiline tokens count every occupied line)',
      complexity: 'cyclomatic v1: one per function plus if, conditional, loop, catch, case, &&, || and ?? branches',
    },
    ruleVersions: {
      loc: 'non-comment-physical-lines-v1',
      functionComplexity: 'cyclomatic-v1',
      defaults: 'p90-per-category-v1',
    },
    environment: {
      node: process.versions.node,
      npm: npmVersion(projectRoot),
      typescript: ts.version,
      platform: process.platform,
      architecture: process.arch,
      commit: commit(projectRoot),
      capturedAt: new Date().toISOString(),
    },
    defaults,
    exceptions,
    inventory,
  }
}

function assertRatchet(ratchet) {
  if (!ratchet || typeof ratchet !== 'object' || ratchet.schemaVersion !== 1
    || !ratchet.defaults || !ratchet.exceptions || !Array.isArray(ratchet.inventory)) {
    throw new Error('Complexity ratchet must provide schemaVersion, defaults, exceptions and inventory')
  }
}

function collectComplexityViolations(projectRoot = defaultRoot, ratchet) {
  assertRatchet(ratchet)
  const violations = []
  for (const metric of collectComplexityInventory(projectRoot)) {
    const pathEntry = ratchet.exceptions[metric.path]
    const defaultEntry = ratchet.defaults[metric.category]
    if (!pathEntry && !defaultEntry) {
      violations.push(`${metric.path} has no ${metric.category} default; add calibrated category ratchet entry`)
      continue
    }
    const allowance = pathEntry || defaultEntry
    const label = pathEntry ? 'path ratchet' : `${metric.category} default`
    const suffix = pathEntry ? '' : '; add path ratchet entry'
    if (!Number.isInteger(allowance.maxLoc) || !Number.isInteger(allowance.maxFunctionComplexity)) {
      violations.push(`${metric.path} has invalid ${label} allowance`)
      continue
    }
    if (metric.loc > allowance.maxLoc) {
      violations.push(`${metric.path} LOC ${metric.loc} exceeds ${label} ${allowance.maxLoc}${suffix}`)
    }
    if (metric.maxFunctionComplexity > allowance.maxFunctionComplexity) {
      violations.push(`${metric.path} maxFunctionComplexity ${metric.maxFunctionComplexity} exceeds ${label} ${allowance.maxFunctionComplexity}${suffix}`)
    }
  }
  return [...new Set(violations)].sort()
}

function assertNode24() {
  if (Number.parseInt(process.versions.node.split('.')[0], 10) !== requiredNodeMajor) {
    throw new Error(`Complexity evidence requires Node ${requiredNodeMajor}; found ${process.versions.node}`)
  }
}

function main(args = process.argv.slice(2)) {
  assertNode24()
  const [mode, filePath] = args
  if (mode === '--write' && filePath) {
    const target = path.resolve(defaultRoot, filePath)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, `${JSON.stringify(createRatchet(defaultRoot), null, 2)}\n`)
    console.log(`[complexity] Wrote calibrated ratchet ${relative(defaultRoot, target)}`)
    return
  }
  if (mode === '--check' && filePath) {
    const target = path.resolve(defaultRoot, filePath)
    const ratchet = JSON.parse(fs.readFileSync(target, 'utf8'))
    const violations = collectComplexityViolations(defaultRoot, ratchet)
    if (violations.length > 0) {
      console.error('[complexity] Ratchet violations:')
      for (const violation of violations) console.error(`- ${violation}`)
      process.exitCode = 1
      return
    }
    console.log(`[complexity] OK (${collectComplexityInventory(defaultRoot).length} production modules against ${relative(defaultRoot, target)})`)
    return
  }
  throw new Error('Usage: node scripts/check-complexity.cjs --write|--check quality/budgets/complexity-ratchet.json')
}

module.exports = { collectComplexityInventory, collectComplexityViolations, createRatchet }

if (require.main === module) {
  try { main() }
  catch (error) {
    console.error(`[complexity] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
