/* global console, process, __dirname */
const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const zlib = require('node:zlib')

const { collectQualityEnvironment } = require('./assert-node24.cjs')

const defaultRoot = path.join(__dirname, '..')
const defaultOutputDir = path.join(defaultRoot, 'dist')
const defaultManifestPath = path.join(defaultOutputDir, '.vite', 'manifest.json')
const defaultBaselinePath = path.join(defaultRoot, 'quality', 'baselines', 'node24-vite.json')
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

function assertPositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer`)
}

function readNodeMajor(node) {
  const match = /^(\d+)\./.exec(node)
  return match ? Number.parseInt(match[1], 10) : Number.NaN
}

function validateEnvironment(environment) {
  assertExactKeys(environment, ['node', 'npm', 'vite', 'platform', 'architecture', 'commit', 'capturedAt'], 'environment')
  if (typeof environment.node !== 'string' || readNodeMajor(environment.node) !== 24) {
    throw new Error(`Node.js 24.x is required for quality evidence (current: ${environment.node}).`)
  }
  for (const field of ['npm', 'vite', 'platform', 'architecture', 'commit', 'capturedAt']) {
    if (typeof environment[field] !== 'string' || environment[field].length === 0) {
      throw new Error(`environment.${field} must be a non-empty string`)
    }
  }
  if (Number.isNaN(Date.parse(environment.capturedAt))) {
    throw new Error('environment.capturedAt must be an ISO timestamp')
  }
}

function validateQualityBaseline(baseline) {
  assertExactKeys(baseline, ['schemaVersion', 'environment', 'chunks'], 'baseline')
  if (baseline.schemaVersion !== 1) throw new Error('baseline.schemaVersion must equal 1')
  validateEnvironment(baseline.environment)
  if (!Array.isArray(baseline.chunks) || baseline.chunks.length === 0) {
    throw new Error('baseline.chunks must contain at least one renderer chunk')
  }

  let previousPath = ''
  for (const [index, chunk] of baseline.chunks.entries()) {
    assertExactKeys(chunk, ['logicalPath', 'rawBytes', 'gzipBytes'], `baseline.chunks[${index}]`)
    if (typeof chunk.logicalPath !== 'string' || chunk.logicalPath.length === 0) {
      throw new Error(`baseline.chunks[${index}].logicalPath must be a non-empty string`)
    }
    if (chunk.logicalPath <= previousPath) {
      throw new Error('baseline.chunks must be sorted by unique logicalPath')
    }
    previousPath = chunk.logicalPath
    assertPositiveInteger(chunk.rawBytes, `baseline.chunks[${index}].rawBytes`)
    assertPositiveInteger(chunk.gzipBytes, `baseline.chunks[${index}].gzipBytes`)
  }
}

function readManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) throw new Error(`Vite manifest is missing: ${manifestPath}`)
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    if (!isPlainObject(manifest)) throw new Error('manifest root must be an object')
    return manifest
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('manifest root')) throw error
    throw new Error(`Vite manifest is malformed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function resolveOutputFile(outputDir, generatedPath) {
  const resolvedOutputDir = path.resolve(outputDir)
  const outputFile = path.resolve(outputDir, generatedPath)
  if (outputFile !== resolvedOutputDir && !outputFile.startsWith(`${resolvedOutputDir}${path.sep}`)) {
    throw new Error(`Vite manifest chunk escapes output directory: ${generatedPath}`)
  }
  return outputFile
}

function collectChunkMeasurements(manifest, outputDir) {
  const chunks = []
  for (const [manifestKey, entry] of Object.entries(manifest)) {
    if (!isPlainObject(entry) || typeof entry.file !== 'string' || !entry.file.endsWith('.js')) continue
    const outputFile = resolveOutputFile(outputDir, entry.file)
    if (!fs.existsSync(outputFile)) throw new Error(`Vite manifest chunk is missing from output: ${entry.file}`)
    const contents = fs.readFileSync(outputFile)
    const logicalPath = typeof entry.src === 'string' ? entry.src : (typeof entry.name === 'string' ? entry.name : manifestKey)
    chunks.push({
      logicalPath,
      rawBytes: contents.byteLength,
      gzipBytes: zlib.gzipSync(contents).byteLength,
    })
  }

  chunks.sort((left, right) => {
    if (left.logicalPath < right.logicalPath) return -1
    if (left.logicalPath > right.logicalPath) return 1
    return 0
  })
  for (let index = 1; index < chunks.length; index += 1) {
    if (chunks[index - 1].logicalPath === chunks[index].logicalPath) {
      throw new Error(`Vite manifest has duplicate logical chunk path: ${chunks[index].logicalPath}`)
    }
  }
  if (chunks.length === 0) throw new Error('Vite manifest contains no renderer JavaScript chunks')
  return chunks
}

function collectQualityBaseline({ environment, manifestPath = defaultManifestPath, outputDir = defaultOutputDir }) {
  validateEnvironment(environment)
  const baseline = {
    schemaVersion: 1,
    environment,
    chunks: collectChunkMeasurements(readManifest(manifestPath), outputDir),
  }
  validateQualityBaseline(baseline)
  return baseline
}

function writeQualityBaseline(baseline, baselinePath = defaultBaselinePath) {
  validateQualityBaseline(baseline)
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true })
  const temporaryPath = `${baselinePath}.${process.pid}.${Date.now()}.tmp`
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(baseline, null, 2)}\n`)
    fs.renameSync(temporaryPath, baselinePath)
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true })
    throw error
  }
}

function buildRenderer(cwd = defaultRoot) {
  const viteCliPath = path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(viteCliPath)) throw new Error(`Installed Vite CLI is missing: ${viteCliPath}`)
  childProcess.execFileSync(process.execPath, [viteCliPath, 'build', '--manifest'], {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })
}

function buildAndWriteQualityBaseline({
  cwd = defaultRoot,
  baselinePath = defaultBaselinePath,
  environment = collectQualityEnvironment({ cwd }),
  build = buildRenderer,
} = {}) {
  validateEnvironment(environment)
  build(cwd)
  const baseline = collectQualityBaseline({
    environment,
    manifestPath: path.join(cwd, 'dist', '.vite', 'manifest.json'),
    outputDir: path.join(cwd, 'dist'),
  })
  writeQualityBaseline(baseline, baselinePath)
  return baseline
}

function checkBaseline(baselinePath = defaultBaselinePath) {
  if (!fs.existsSync(baselinePath)) throw new Error(`Quality baseline is missing: ${baselinePath}`)
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
  validateQualityBaseline(baseline)
  return baseline
}

function main(args = process.argv.slice(2)) {
  try {
    const baseline = args[0] === '--check'
      ? checkBaseline(args[1])
      : buildAndWriteQualityBaseline()
    if (args[0] && args[0] !== '--check') throw new Error(`Unknown argument: ${args[0]}`)
    if (args[0] === '--check' && !args[1]) throw new Error('Expected a baseline path after --check')
    console.log(JSON.stringify(baseline, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = {
  buildAndWriteQualityBaseline,
  collectChunkMeasurements,
  collectQualityBaseline,
  validateQualityBaseline,
  writeQualityBaseline,
}
