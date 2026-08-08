/* global console, process, __dirname */
const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const { collectQualityEnvironment } = require('./assert-node24.cjs')
const { collectChunkMeasurements } = require('./collect-quality-baseline.cjs')

const defaultRoot = path.join(__dirname, '..')

function readCommit(cwd) {
  return childProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

function createQualityBundlePlan({ cwd = defaultRoot, startedAt = new Date(), getCommit = readCommit } = {}) {
  const viteCliPath = path.join(cwd, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!fs.existsSync(viteCliPath)) throw new Error(`Installed Vite CLI is missing: ${viteCliPath}`)
  const commit = getCommit(cwd)
  if (!/^[0-9a-f]{40}$/i.test(commit)) throw new Error('Unable to resolve the current Git commit for the renderer bundle build.')
  const outputDir = 'dist'
  return {
    startedAt,
    commit,
    preflight: { command: process.execPath, args: ['scripts/assert-node24.cjs'] },
    cleanOutput: outputDir,
    build: {
      command: process.execPath,
      args: [viteCliPath, 'build', '--manifest'],
      env: { ...process.env, NODE_ENV: 'production', BURROW_RENDERER_ONLY: '1' },
    },
    manifestPath: path.join(outputDir, 'burrow-bundle-manifest.json'),
    check: {
      command: process.execPath,
      args: ['scripts/check-bundle.cjs', '--manifest', path.join(outputDir, 'burrow-bundle-manifest.json'), '--baseline', 'quality/baselines/node24-vite.json', '--budget', 'quality/budgets/renderer-performance.json', '--output', outputDir, '--evidence', path.join(outputDir, 'burrow-bundle-budget-evidence.json')],
    },
  }
}

function writeBundleManifest({ cwd, plan, completedAt = new Date() }) {
  const outputDir = path.join(cwd, plan.cleanOutput)
  const viteManifestPath = path.join(outputDir, '.vite', 'manifest.json')
  if (!fs.existsSync(viteManifestPath)) throw new Error(`Vite manifest is missing after renderer build: ${viteManifestPath}`)
  const environment = collectQualityEnvironment({ cwd })
  if (environment.commit !== plan.commit) throw new Error(`Renderer build commit changed during quality:bundle: ${environment.commit}`)
  const manifest = {
    environment,
    chunks: collectChunkMeasurements(JSON.parse(fs.readFileSync(viteManifestPath, 'utf8')), outputDir),
    startedAt: plan.startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  }
  const outputPath = path.join(cwd, plan.manifestPath)
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`
  fs.writeFileSync(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`)
  fs.renameSync(temporaryPath, outputPath)
  return outputPath
}

function assertCleanCheckout(cwd) {
  for (const args of [['diff', '--quiet'], ['diff', '--cached', '--quiet']]) {
    try {
      childProcess.execFileSync('git', args, { cwd, stdio: 'ignore' })
    } catch {
      throw new Error('quality:bundle requires a clean checked-out commit.')
    }
  }
}

function runQualityBundle({ cwd = defaultRoot, startedAt = new Date() } = {}) {
  const plan = createQualityBundlePlan({ cwd, startedAt })
  assertCleanCheckout(cwd)
  childProcess.execFileSync(plan.preflight.command, plan.preflight.args, { cwd, stdio: 'inherit' })
  const outputDir = path.join(cwd, plan.cleanOutput)
  fs.rmSync(outputDir, { recursive: true, force: true })
  childProcess.execFileSync(plan.build.command, plan.build.args, { cwd, env: plan.build.env, stdio: 'inherit' })
  writeBundleManifest({ cwd, plan })
  childProcess.execFileSync(plan.check.command, plan.check.args, { cwd, env: plan.build.env, stdio: 'inherit' })
}

function main() {
  try {
    runQualityBundle()
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = {
  assertCleanCheckout,
  createQualityBundlePlan,
  runQualityBundle,
  writeBundleManifest,
}
