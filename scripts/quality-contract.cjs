/* global console, process, __dirname */
const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.join(__dirname, '..')
const RESULT_VERSION = 1

const sourceStages = [
  ['node-preflight', 'node', ['scripts/assert-node24.cjs']],
  ['unit', 'npm', ['test']],
  ['lint', 'npm', ['run', 'lint']],
  ['typecheck', 'npx', ['tsc', '-p', 'tsconfig.json', '--noEmit']],
  ['docs', 'npm', ['run', 'docs:check']],
  ['contracts', 'npm', ['run', 'contracts:check']],
  ['ipc', 'npm', ['run', 'ipc:check']],
  ['legacy-import', 'npm', ['run', 'legacy-import:check']],
  ['architecture', 'npm', ['run', 'architecture:check']],
  ['dependency-graph', 'node', ['scripts/check-dependency-graph.cjs']],
  ['complexity', 'node', ['scripts/check-complexity.cjs', '--check', 'quality/budgets/complexity-ratchet.json']],
  ['audit', 'npm', ['run', 'audit:prod']],
  ['fault-matrix', 'npm', ['run', 'test:faults']],
  ['bundle', 'npm', ['run', 'quality:bundle']],
  ['performance', 'npm', ['run', 'quality:performance']],
  ['accessibility', 'npm', ['run', 'quality:accessibility']],
]

const knownStages = new Set([...sourceStages.map(([name]) => name), 'package-smoke', 'release-evidence'])

function assertReleaseInputs(inputs) {
  const required = ['releaseDir', 'version', 'tag', 'commit', 'report']
  const missing = required.filter((key) => typeof inputs[key] !== 'string' || inputs[key].length === 0)
  if (missing.length > 0) throw new Error(`release profile requires ${missing.join(', ')}`)
}

function createQualityPlan({ profile = 'pr', inputs = {} } = {}) {
  if (!['pr', 'release'].includes(profile)) throw new Error(`Unknown quality profile: ${profile}`)
  const stages = sourceStages.map(([name, command, args]) => ({ name, command, args: [...args] }))
  if (profile === 'release') {
    assertReleaseInputs(inputs)
    stages.push(
      { name: 'package-smoke', command: 'npm', args: ['run', 'smoke:package', '--', '--release-dir', inputs.releaseDir, '--version', inputs.version] },
      { name: 'release-evidence', command: 'npm', args: ['run', 'release:evidence', '--', '--artifacts-dir', inputs.releaseDir, '--version', inputs.version, '--tag', inputs.tag, '--commit', inputs.commit, '--output', inputs.report] },
    )
  }
  return { schemaVersion: RESULT_VERSION, profile, stages }
}

function validatePlan(plan) {
  if (!plan || !Array.isArray(plan.stages)) throw new Error('quality plan must contain stages')
  for (const stage of plan.stages) {
    if (!knownStages.has(stage?.name)) throw new Error(`Unknown stage: ${stage?.name}`)
    if (typeof stage.command !== 'string' || stage.command.length === 0) throw new Error(`Missing command for stage: ${stage.name}`)
    if (!Array.isArray(stage.args)) throw new Error(`Missing arguments for stage: ${stage.name}`)
  }
}

function resolveRuntimeCommand(command, args, runtime = { node: process.execPath, npmCli: process.env.npm_execpath }) {
  if (command === 'node') return { command: runtime.node, args }
  if ((command === 'npm' || command === 'npx') && typeof runtime.npmCli === 'string' && runtime.npmCli.length > 0) {
    return { command: runtime.node, args: [runtime.npmCli, ...(command === 'npx' ? ['exec', '--'] : []), ...args] }
  }
  return { command, args }
}

function defaultRun(command, args) {
  const resolved = resolveRuntimeCommand(command, args)
  const result = childProcess.spawnSync(resolved.command, resolved.args, { cwd: projectRoot, stdio: 'inherit' })
  return { exitCode: typeof result.status === 'number' ? result.status : 1 }
}

function writeResult(outputFile, result) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true })
  fs.writeFileSync(outputFile, `${JSON.stringify(result, null, 2)}\n`)
}

function runQualityPlan({ plan, run = defaultRun, outputFile = path.join(projectRoot, 'quality/evidence/quality-contract.json'), now = () => Date.now() } = {}) {
  validatePlan(plan)
  const startedAt = new Date().toISOString()
  const stages = []
  for (const stage of plan.stages) {
    const started = now()
    const execution = run(stage.command, stage.args)
    const exitCode = Number.isInteger(execution?.exitCode) ? execution.exitCode : 1
    const record = { name: stage.name, command: [stage.command, ...stage.args].join(' '), exitCode, status: exitCode === 0 ? 'passed' : 'failed', durationMs: Math.max(0, now() - started) }
    stages.push(record)
    if (exitCode !== 0) {
      const failed = { schemaVersion: RESULT_VERSION, profile: plan.profile ?? 'custom', startedAt, completedAt: new Date().toISOString(), status: 'failed', stages }
      writeResult(outputFile, failed)
      return failed
    }
  }
  const passed = { schemaVersion: RESULT_VERSION, profile: plan.profile ?? 'custom', startedAt, completedAt: new Date().toISOString(), status: 'passed', stages }
  writeResult(outputFile, passed)
  return passed
}

function validatePackageScripts(scripts) {
  const errors = []
  for (const [name, command] of Object.entries(scripts ?? {})) {
    if (typeof command !== 'string') continue
    if (name !== 'quality:check' && /npm run quality:check\b/.test(command)) errors.push(`${name} must not invoke quality:check`) 
    if (new RegExp(`npm run ${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(command)) errors.push(`${name} recursively invokes itself`)
  }
  return errors
}

function parseArgs(args) {
  const profile = args.find((value) => value.startsWith('--profile='))?.slice('--profile='.length) ?? 'pr'
  const dryRun = args.includes('--dry-run')
  const values = {}
  for (const name of ['releaseDir', 'version', 'tag', 'commit', 'report']) {
    const index = args.indexOf(`--${name}`)
    if (index !== -1) values[name] = args[index + 1]
  }
  return { profile, dryRun, inputs: values }
}

function main() {
  try {
    const parsed = parseArgs(process.argv.slice(2))
    const plan = createQualityPlan({ profile: parsed.profile, inputs: parsed.inputs })
    if (parsed.dryRun) return console.log(JSON.stringify(plan, null, 2))
    const result = runQualityPlan({ plan })
    process.exitCode = result.status === 'passed' ? 0 : 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

if (require.main === module) main()

module.exports = { RESULT_VERSION, createQualityPlan, resolveRuntimeCommand, runQualityPlan, validatePackageScripts, validatePlan }
