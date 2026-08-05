/* global console, process, __dirname */
const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const { validateQualityBaseline } = require('./collect-quality-baseline.cjs')

const defaultRoot = path.join(__dirname, '..')
const defaultBaselinePath = path.join(defaultRoot, 'quality', 'baselines', 'node24-vite.json')
const defaultBudgetPath = path.join(defaultRoot, 'quality', 'budgets', 'renderer-performance.json')

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertExactKeys(value, keys, label) {
  if (!isPlainObject(value)) throw new Error(`${label} must be a plain object`)
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) throw new Error(`${label} has unexpected field ${key}`)
  }
  for (const key of keys) {
    if (!(key in value)) throw new Error(`${label} is missing required field ${key}`)
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a non-empty string`)
}

function assertNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`)
}

function validateEnvironment(environment, label, includeCommit = true) {
  const keys = ['node', 'npm', 'vite', 'platform', 'architecture']
  if (includeCommit) keys.push('commit', 'capturedAt')
  assertExactKeys(environment, keys, label)
  for (const key of keys) assertNonEmptyString(environment[key], `${label}.${key}`)
  if (!environment.node.startsWith('24.')) throw new Error(`${label}.node must be Node.js 24.x`)
  if (includeCommit && (!/^[0-9a-f]{40}$/i.test(environment.commit) || Number.isNaN(Date.parse(environment.capturedAt)))) {
    throw new Error(`${label} has invalid commit or capture timestamp`)
  }
}

function validateChunks(chunks, label, requireLimits = false) {
  if (!Array.isArray(chunks) || chunks.length === 0) throw new Error(`${label} must contain at least one chunk`)
  let previous = ''
  for (const [index, chunk] of chunks.entries()) {
    const keys = requireLimits
      ? ['logicalPath', 'rawBytes', 'gzipBytes', 'rawLimit', 'gzipLimit']
      : ['logicalPath', 'rawBytes', 'gzipBytes']
    assertExactKeys(chunk, keys, `${label}[${index}]`)
    assertNonEmptyString(chunk.logicalPath, `${label}[${index}].logicalPath`)
    if (chunk.logicalPath <= previous) throw new Error(`${label} must be sorted by unique logicalPath`)
    previous = chunk.logicalPath
    assertNonNegativeInteger(chunk.rawBytes, `${label}[${index}].rawBytes`)
    assertNonNegativeInteger(chunk.gzipBytes, `${label}[${index}].gzipBytes`)
    if (requireLimits) {
      assertNonNegativeInteger(chunk.rawLimit, `${label}[${index}].rawLimit`)
      assertNonNegativeInteger(chunk.gzipLimit, `${label}[${index}].gzipLimit`)
    }
  }
}

function validateBundleManifest(manifest) {
  assertExactKeys(manifest, ['environment', 'chunks', 'startedAt', 'completedAt'], 'bundle manifest')
  validateEnvironment(manifest.environment, 'bundle manifest.environment')
  validateChunks(manifest.chunks, 'bundle manifest.chunks')
  for (const field of ['startedAt', 'completedAt']) {
    assertNonEmptyString(manifest[field], `bundle manifest.${field}`)
    if (Number.isNaN(Date.parse(manifest[field]))) throw new Error(`bundle manifest.${field} must be an ISO timestamp`)
  }
  if (Date.parse(manifest.completedAt) < Date.parse(manifest.startedAt)) {
    throw new Error('bundle manifest.completedAt must not predate startedAt')
  }
}

function validateBundleBudget(budget) {
  assertExactKeys(budget, ['schemaVersion', 'bundle', 'runtime'], 'renderer performance budget')
  if (budget.schemaVersion !== 1) throw new Error('renderer performance budget.schemaVersion must equal 1')
  assertExactKeys(budget.bundle, ['environment', 'tolerancePercent', 'chunks'], 'renderer performance budget.bundle')
  validateEnvironment(budget.bundle.environment, 'renderer performance budget.bundle.environment', false)
  if (typeof budget.bundle.tolerancePercent !== 'number' || !Number.isFinite(budget.bundle.tolerancePercent) || budget.bundle.tolerancePercent < 0) {
    throw new Error('renderer performance budget.bundle.tolerancePercent must be a non-negative finite number')
  }
  validateChunks(budget.bundle.chunks, 'renderer performance budget.bundle.chunks', true)
  if (!isPlainObject(budget.runtime)) throw new Error('renderer performance budget.runtime must be a plain object')
}

function getEnvironmentIdentity(environment) {
  return ['node', 'npm', 'vite', 'platform', 'architecture'].map((key) => `${key}=${environment[key]}`).join(', ')
}

function compareEnvironment(expected, actual, label) {
  const failures = []
  // Renderer bytes are portable output of the pinned Node/npm/Vite toolchain.
  // Host platform and architecture remain recorded provenance, but they are
  // not allowed to make the same bundle uncheckable on CI/native release jobs.
  for (const key of ['node', 'npm', 'vite']) {
    if (expected[key] !== actual[key]) {
      failures.push(`${label} environment mismatch for ${key}: actual=${actual[key]} expected=${expected[key]}`)
    }
  }
  return failures
}

function indexChunks(chunks) {
  return new Map(chunks.map((chunk) => [chunk.logicalPath, chunk]))
}

function checkBundle({ baseline, budget, manifest, outputDir, expectedCommit, now = () => new Date() }) {
  validateQualityBaseline(baseline)
  validateBundleBudget(budget)
  validateBundleManifest(manifest)
  const failures = []
  const currentCommit = expectedCommit || childProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: defaultRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()

  if (!fs.existsSync(outputDir) || !fs.statSync(outputDir).isDirectory()) {
    failures.push(`renderer output is missing: ${outputDir}`)
  } else if (fs.statSync(outputDir).mtimeMs < Date.parse(manifest.startedAt)) {
    failures.push(`renderer output is stale: ${outputDir} predates manifest startedAt=${manifest.startedAt}`)
  }
  if (manifest.environment.commit !== currentCommit) {
    failures.push(`bundle manifest commit mismatch: actual=${manifest.environment.commit} expected=${currentCommit}`)
  }
  failures.push(...compareEnvironment(baseline.environment, budget.bundle.environment, 'budget'))
  failures.push(...compareEnvironment(baseline.environment, manifest.environment, 'manifest'))

  const baselineChunks = indexChunks(baseline.chunks)
  const budgetChunks = indexChunks(budget.bundle.chunks)
  const manifestChunks = indexChunks(manifest.chunks)
  for (const logicalPath of baselineChunks.keys()) {
    if (!budgetChunks.has(logicalPath)) failures.push(`budget silently dropped baseline chunk: ${logicalPath}`)
    if (!manifestChunks.has(logicalPath)) failures.push(`manifest silently dropped baseline chunk: ${logicalPath}`)
  }
  for (const logicalPath of budgetChunks.keys()) {
    if (!baselineChunks.has(logicalPath)) failures.push(`budget has unknown chunk: ${logicalPath}`)
    if (!manifestChunks.has(logicalPath)) failures.push(`manifest silently dropped budget chunk: ${logicalPath}`)
  }
  for (const logicalPath of manifestChunks.keys()) {
    if (!baselineChunks.has(logicalPath)) failures.push(`manifest has unknown chunk: ${logicalPath}`)
  }
  for (const [logicalPath, actual] of manifestChunks.entries()) {
    const baselineChunk = baselineChunks.get(logicalPath)
    const budgetChunk = budgetChunks.get(logicalPath)
    if (!baselineChunk || !budgetChunk) continue
    if (actual.rawBytes > budgetChunk.rawLimit) {
      failures.push(`${logicalPath} raw budget breach: actual=${actual.rawBytes} baseline=${baselineChunk.rawBytes} limit=${budgetChunk.rawLimit}`)
    }
    if (actual.gzipBytes > budgetChunk.gzipLimit) {
      failures.push(`${logicalPath} gzip budget breach: actual=${actual.gzipBytes} baseline=${baselineChunk.gzipBytes} limit=${budgetChunk.gzipLimit}`)
    }
  }

  failures.sort()
  return {
    failures,
    ignoredEvidence: {
      kind: 'renderer-bundle-budget',
      environment: manifest.environment,
      baselineEnvironment: baseline.environment,
      budgetEnvironment: budget.bundle.environment,
      outputDir,
      checkedAt: now().toISOString(),
      chunks: manifest.chunks,
      verdict: failures.length === 0 ? 'pass' : 'fail',
      failures,
      environmentIdentity: getEnvironmentIdentity(manifest.environment),
    },
  }
}

function readJson(filePath, label) {
  if (!fs.existsSync(filePath)) throw new Error(`${label} is missing: ${filePath}`)
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    throw new Error(`${label} is invalid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function writeEvidence(evidencePath, evidence) {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true })
  fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`)
}

function parseArgs(args) {
  const values = {}
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!['--manifest', '--baseline', '--budget', '--output', '--evidence'].includes(flag) || !value) {
      throw new Error('Expected --manifest, --baseline, --budget, --output, and --evidence arguments.')
    }
    values[flag.slice(2)] = value
  }
  return values
}

function main(args = process.argv.slice(2)) {
  try {
    const values = parseArgs(args)
    const outputDir = path.resolve(defaultRoot, values.output || 'dist')
    const result = checkBundle({
      baseline: readJson(path.resolve(defaultRoot, values.baseline || defaultBaselinePath), 'bundle baseline'),
      budget: readJson(path.resolve(defaultRoot, values.budget || defaultBudgetPath), 'renderer performance budget'),
      manifest: readJson(path.resolve(defaultRoot, values.manifest), 'bundle manifest'),
      outputDir,
    })
    const evidencePath = path.resolve(defaultRoot, values.evidence || path.join('dist', 'fmcl-bundle-budget-evidence.json'))
    writeEvidence(evidencePath, result.ignoredEvidence)
    if (result.failures.length > 0) throw new Error(result.failures.join('\n'))
    console.log(JSON.stringify(result.ignoredEvidence, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = {
  checkBundle,
  validateBundleBudget,
  validateBundleManifest,
}
