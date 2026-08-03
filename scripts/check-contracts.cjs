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
  const maps = [
    ['English', loadDocsChannels('docs/en/contracts-map.md')],
    ['Russian', loadDocsChannels('docs/ru/contracts-map.md')],
  ]

  let hasMismatch = false
  for (const [language, documented] of maps) {
    const missingInDocs = diff(allowed, documented)
    const missingInAllowlist = diff(documented, allowed)

    if (!missingInDocs.length && !missingInAllowlist.length) continue
    hasMismatch = true
    console.error(`[contracts] ${language} map mismatch`)
    if (missingInDocs.length) {
      console.error('\nMissing in docs (present in allowlist):')
      for (const c of missingInDocs) console.error(`- ${c}`)
    }
    if (missingInAllowlist.length) {
      console.error('\nMissing in allowlist (present in docs):')
      for (const c of missingInAllowlist) console.error(`- ${c}`)
    }
  }

  if (hasMismatch) process.exit(1)

  console.log(`[contracts] OK (${allowed.size} channels in each language map)`)
}

main()
