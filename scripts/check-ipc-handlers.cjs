/* global console, process, __dirname */
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..')

function readText(absPath) {
  return fs.readFileSync(absPath, 'utf8')
}

function listFilesRecursive(dirAbs) {
  const out = []
  const stack = [dirAbs]
  while (stack.length) {
    const cur = stack.pop()
    const entries = fs.readdirSync(cur, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(cur, e.name)
      if (e.isDirectory()) stack.push(p)
      else out.push(p)
    }
  }
  return out
}

function loadAllowedChannels() {
  const text = readText(path.join(root, 'shared/contracts/ipcChannels.ts'))
  const re = /'([a-z0-9-]+:[a-z0-9-]+)'/gi
  const channels = new Set()
  let m
  while ((m = re.exec(text)) !== null) channels.add(m[1])
  if (channels.size === 0) throw new Error('No IPC channels parsed from ipcChannels.ts')
  return channels
}

function findIpcMainHandleChannels(tsText) {
  const out = new Set()
  // ipcMain.handle('channel:name', ...)
  const re = /\bipcMain\.handle\s*\(\s*'([a-z0-9-]+:[a-z0-9-]+)'\s*,/gi
  let m
  while ((m = re.exec(tsText)) !== null) out.add(m[1])
  return out
}

function findIpcMainOnChannels(tsText) {
  const out = new Set()
  // ipcMain.on('channel:name', ...)
  // ipcMain.once('channel:name', ...)
  const re = /\bipcMain\.(?:on|once)\s*\(\s*'([a-z0-9-]+:[a-z0-9-]+)'\s*,/gi
  let m
  while ((m = re.exec(tsText)) !== null) out.add(m[1])
  return out
}

function findWebContentsSendChannels(tsText) {
  const out = new Set()
  // win.webContents.send('channel:name', ...)
  // window.webContents.send('channel:name', ...)
  // anything.webContents.send('channel:name', ...)
  const re = /\bwebContents\.send\s*\(\s*'([a-z0-9-]+:[a-z0-9-]+)'\s*,/gi
  let m
  while ((m = re.exec(tsText)) !== null) out.add(m[1])
  return out
}

function findIpcRendererChannels(tsText) {
  const out = new Set()
  // ipcRenderer.invoke/send/on/once('channel:name', ...)
  const re = /\bipcRenderer\.(?:invoke|send|on|once)\s*\(\s*'([a-z0-9-]+:[a-z0-9-]+)'\s*,/gi
  let m
  while ((m = re.exec(tsText)) !== null) out.add(m[1])
  return out
}

function main() {
  const allowed = loadAllowedChannels()

  const electronDir = path.join(root, 'electron')
  const files = listFilesRecursive(electronDir).filter((p) => p.endsWith('.ts'))

  const usedHandles = new Set()
  const usedMainOn = new Set()
  const usedSends = new Set()
  const usedRenderer = new Set()
  const offenders = []

  for (const f of files) {
    const text = readText(f)
    const foundHandles = findIpcMainHandleChannels(text)
    const foundMainOn = findIpcMainOnChannels(text)
    const foundSends = findWebContentsSendChannels(text)
    const foundRenderer = findIpcRendererChannels(text)

    for (const ch of foundHandles) {
      usedHandles.add(ch)
      if (!allowed.has(ch)) offenders.push({ kind: 'ipcMain.handle', channel: ch, file: path.relative(root, f) })
    }
    for (const ch of foundMainOn) {
      usedMainOn.add(ch)
      if (!allowed.has(ch)) offenders.push({ kind: 'ipcMain.on/once', channel: ch, file: path.relative(root, f) })
    }
    for (const ch of foundSends) {
      usedSends.add(ch)
      if (!allowed.has(ch)) offenders.push({ kind: 'webContents.send', channel: ch, file: path.relative(root, f) })
    }
    for (const ch of foundRenderer) {
      usedRenderer.add(ch)
      if (!allowed.has(ch)) offenders.push({ kind: 'ipcRenderer.*', channel: ch, file: path.relative(root, f) })
    }
  }

  if (offenders.length) {
    console.error('[ipc] Found IPC channels not in allowlist:')
    offenders.sort((a, b) => a.channel.localeCompare(b.channel) || a.file.localeCompare(b.file))
    for (const o of offenders) console.error(`- ${o.kind}: ${o.channel} (${o.file})`)
    process.exit(1)
  }

  console.log(
    `[ipc] OK (${usedHandles.size} ipcMain.handle + ${usedMainOn.size} ipcMain.on/once + ${usedSends.size} webContents.send + ${usedRenderer.size} ipcRenderer.* channels validated)`
  )
}

main()

