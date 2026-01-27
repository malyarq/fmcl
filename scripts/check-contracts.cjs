/* global console, process, __dirname */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')

function readText(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8')
}

function extractBacktickedTokens(md) {
  const out = new Set()
  const re = /`([^`]+)`/g
  let m
  while ((m = re.exec(md)) !== null) {
    out.add(m[1])
  }
  return out
}

function loadAllowedChannels() {
  const text = readText('shared/contracts/ipcChannels.ts')
  const start = text.indexOf('export const allowedIpcChannels = [')
  if (start === -1) throw new Error('allowedIpcChannels list not found')
  const slice = text.slice(start)
  // naive parse of single-quoted entries: 'channel:name'
  const re = /'([a-z0-9-]+:[a-z0-9-]+)'/gi
  const channels = new Set()
  let m
  while ((m = re.exec(slice)) !== null) {
    channels.add(m[1])
  }
  if (channels.size === 0) throw new Error('No IPC channels parsed from ipcChannels.ts')
  return channels
}

function loadDocsChannels(relPath) {
  const md = readText(relPath)
  const tokens = extractBacktickedTokens(md)
  const channels = new Set()
  for (const t of tokens) {
    if (/^[a-z0-9-]+:[a-z0-9-]+$/i.test(t)) channels.add(t)
  }
  return channels
}

function diff(a, b) {
  const onlyA = []
  for (const x of a) if (!b.has(x)) onlyA.push(x)
  onlyA.sort()
  return onlyA
}

function main() {
  const allowed = loadAllowedChannels()
  const ru = loadDocsChannels('docs/ru/contracts-map.md')
  const en = loadDocsChannels('docs/en/contracts-map.md')

  const docsUnion = new Set([...ru, ...en])

  const missingInDocs = diff(allowed, docsUnion)
  const missingInAllowlist = diff(docsUnion, allowed)

  if (missingInDocs.length || missingInAllowlist.length) {
    console.error('[contracts] Mismatch detected')
    if (missingInDocs.length) {
      console.error('\nMissing in docs (present in allowlist):')
      for (const c of missingInDocs) console.error(`- ${c}`)
    }
    if (missingInAllowlist.length) {
      console.error('\nMissing in allowlist (present in docs):')
      for (const c of missingInAllowlist) console.error(`- ${c}`)
    }
    process.exit(1)
  }

  console.log(`[contracts] OK (${allowed.size} channels)`)
}

main()

