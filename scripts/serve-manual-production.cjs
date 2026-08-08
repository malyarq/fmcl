/* global console, process, __dirname */
const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const REQUIRED_NODE_MAJOR = 24
const defaultRoot = path.join(__dirname, '..')
const previewProofName = 'burrow-production-preview.json'

function readNodeMajor(version) {
  const match = /^v?(\d+)\./.exec(version)
  return match ? Number.parseInt(match[1], 10) : Number.NaN
}

function requireProductionEnvironment(processInfo, environment) {
  if (readNodeMajor(processInfo.versions?.node || processInfo.version) !== REQUIRED_NODE_MAJOR) {
    throw new Error(`Node.js ${REQUIRED_NODE_MAJOR}.x is required for the production manual preview.`)
  }
  if (environment.NODE_ENV !== 'production') {
    throw new Error('Manual production preview requires NODE_ENV=production.')
  }
}

function resolveViteCli(cwd) {
  const viteCliPath = path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(viteCliPath)) throw new Error(`Installed Vite CLI is missing: ${viteCliPath}`)
  return viteCliPath
}

function createProductionPreviewPlan({
  cwd = defaultRoot,
  port = 4174,
  processInfo = process,
  environment = process.env,
  getCommit = (root) => childProcess.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
} = {}) {
  requireProductionEnvironment(processInfo, environment)
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Production preview port is invalid: ${port}`)
  }

  const commit = getCommit(cwd)
  if (!/^[0-9a-f]{40}$/i.test(commit)) {
    throw new Error('Unable to prove the checked-out Git commit for the production manual preview.')
  }

  const viteCliPath = resolveViteCli(cwd)
  const buildEnv = {
    ...environment,
    NODE_ENV: 'production',
    BURROW_RENDERER_ONLY: '1',
    BURROW_MANUAL_PROFILING: '1',
  }

  return {
    build: {
      command: processInfo.execPath,
      args: [viteCliPath, 'build', '--manifest'],
      env: buildEnv,
    },
    preview: {
      command: processInfo.execPath,
      args: [viteCliPath, 'preview', '--host', '127.0.0.1', '--port', String(port)],
      env: buildEnv,
    },
    proof: { commit, mode: 'production', profiling: true },
  }
}

function previewProofPath(outputDir) {
  return path.join(outputDir, previewProofName)
}

function writeProductionPreviewProof(outputDir, proof) {
  fs.mkdirSync(outputDir, { recursive: true })
  const outputPath = previewProofPath(outputDir)
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`
  try {
    fs.writeFileSync(temporaryPath, `${JSON.stringify(proof, null, 2)}\n`)
    fs.renameSync(temporaryPath, outputPath)
  } catch (error) {
    if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath, { force: true })
    throw error
  }
  return outputPath
}

function verifyProductionPreviewOutput({ outputDir = path.join(defaultRoot, 'dist'), expectedCommit }) {
  const manualHtmlPath = path.join(outputDir, 'manual-verification.html')
  const manifestPath = path.join(outputDir, '.vite', 'manifest.json')
  if (!fs.existsSync(manualHtmlPath)) throw new Error(`Production manual verification output is missing: ${manualHtmlPath}`)
  if (!fs.existsSync(manifestPath)) throw new Error(`Production Vite asset manifest is missing: ${manifestPath}`)

  const html = fs.readFileSync(manualHtmlPath, 'utf8')
  if (/\/src\//.test(html)) throw new Error('Production manual verification output still references source-only URLs.')

  let manifest
  let proof
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    proof = JSON.parse(fs.readFileSync(previewProofPath(outputDir), 'utf8'))
  } catch (error) {
    throw new Error(`Production manual preview proof is invalid or missing: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    throw new Error('Production Vite asset manifest must be an object.')
  }
  if (!proof || proof.mode !== 'production' || proof.profiling !== true || proof.commit !== expectedCommit) {
    throw new Error('Production manual preview proof does not match the checked-out commit.')
  }
}

function assertCleanCheckout(cwd) {
  for (const args of [['diff', '--quiet'], ['diff', '--cached', '--quiet']]) {
    try {
      childProcess.execFileSync('git', args, { cwd, stdio: 'ignore' })
    } catch {
      throw new Error('Production manual preview requires a clean checked-out commit.')
    }
  }
}

function runProductionPreview(options = {}) {
  const cwd = options.cwd || defaultRoot
  const plan = createProductionPreviewPlan({ ...options, cwd })
  assertCleanCheckout(cwd)
  childProcess.execFileSync(plan.build.command, plan.build.args, {
    cwd,
    env: plan.build.env,
    stdio: 'inherit',
  })
  const outputDir = path.join(cwd, 'dist')
  writeProductionPreviewProof(outputDir, plan.proof)
  verifyProductionPreviewOutput({ outputDir, expectedCommit: plan.proof.commit })
  return childProcess.spawn(plan.preview.command, plan.preview.args, {
    cwd,
    env: plan.preview.env,
    stdio: 'inherit',
  })
}

function readPort(args) {
  if (args.length === 0) return 4174
  if (args.length === 2 && args[0] === '--port' && /^\d+$/.test(args[1])) return Number.parseInt(args[1], 10)
  throw new Error('Expected only --port <1024-65535>.')
}

function main(args = process.argv.slice(2)) {
  try {
    const child = runProductionPreview({ port: readPort(args) })
    for (const signal of ['SIGINT', 'SIGTERM']) {
      process.on(signal, () => child.kill(signal))
    }
    child.on('exit', (code) => {
      process.exitCode = code ?? 1
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = {
  createProductionPreviewPlan,
  verifyProductionPreviewOutput,
  writeProductionPreviewProof,
}
