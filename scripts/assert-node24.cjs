/* global console, process, __dirname */
const childProcess = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const REQUIRED_NODE_MAJOR = 24
const defaultRoot = path.join(__dirname, '..')

function readInstalledPackageVersion(packageName, cwd) {
  const packagePath = require.resolve(`${packageName}/package.json`, { paths: [cwd] })
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'))

  if (typeof packageJson.version !== 'string' || packageJson.version.length === 0) {
    throw new Error(`Installed ${packageName} package has no version`)
  }

  return packageJson.version
}

function readCommit(cwd) {
  return childProcess.execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

function readNpmVersion(cwd) {
  return childProcess.execFileSync('npm', ['--version'], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
}

function readNodeMajor(version) {
  const match = /^v?(\d+)\./.exec(version)
  return match ? Number.parseInt(match[1], 10) : Number.NaN
}

function collectQualityEnvironment({
  processInfo = process,
  cwd = defaultRoot,
  now = () => new Date(),
  getCommit = readCommit,
} = {}) {
  const node = processInfo.versions?.node || processInfo.version.replace(/^v/, '')
  const nodeMajor = readNodeMajor(node)

  if (nodeMajor !== REQUIRED_NODE_MAJOR) {
    throw new Error(`Node.js ${REQUIRED_NODE_MAJOR}.x is required for quality evidence (current: ${processInfo.version}).`)
  }

  const npm = processInfo.versions?.npm || readNpmVersion(cwd)
  if (typeof npm !== 'string' || npm.length === 0) {
    throw new Error('The active Node.js runtime does not expose an npm version.')
  }

  const commit = getCommit(cwd)
  if (typeof commit !== 'string' || commit.length === 0) {
    throw new Error('Unable to resolve the current Git commit for quality evidence.')
  }

  return {
    node,
    npm,
    vite: readInstalledPackageVersion('vite', cwd),
    platform: processInfo.platform,
    architecture: processInfo.arch,
    commit,
    capturedAt: now().toISOString(),
  }
}

function runPreflight(options) {
  try {
    return { exitCode: 0, output: JSON.stringify(collectQualityEnvironment(options), null, 2) }
  } catch (error) {
    return { exitCode: 1, error: error instanceof Error ? error.message : String(error) }
  }
}

function main() {
  const result = runPreflight()
  if (result.exitCode === 0) console.log(result.output)
  else console.error(result.error)
  process.exitCode = result.exitCode
}

if (require.main === module) main()

module.exports = {
  REQUIRED_NODE_MAJOR,
  collectQualityEnvironment,
  runPreflight,
}
