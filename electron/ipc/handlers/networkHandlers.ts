import { ipcMain, type BrowserWindow } from 'electron'
import type { NetworkService } from '../../services/network/networkService'
import type { LogSender } from '../logThrottler'
import { validateBoundedString, validateEnum, validateInteger } from '../validation/privilegedPayloads'

const NETWORK_MODES = ['hyperswarm', 'xmcl_lan', 'xmcl_upnp_host'] as const

function validatePort(value: unknown, label: string): number {
  return validateInteger(value, label, { min: 1, max: 65_535 })
}

export function registerNetworkHandlers(deps: {
  window: BrowserWindow
  networkService: NetworkService
  sendLog: LogSender
}) {
  const { window, networkService, sendLog } = deps

  ipcMain.removeHandler('network:host')
  ipcMain.handle('network:host', async (_evt, port: unknown) => {
    return await networkService.hostTunnel(validatePort(port, 'LAN port'), (msg) => {
      sendLog(msg)
    })
  })

  ipcMain.removeHandler('network:join')
  ipcMain.handle('network:join', async (_evt, code: unknown) => {
    return await networkService.joinTunnel(validateBoundedString(code, 'Room code', { maxLength: 512 }), (msg) => {
      sendLog(msg)
    })
  })

  ipcMain.removeHandler('network:stop')
  ipcMain.handle('network:stop', async () => {
    return await networkService.stop((msg) => {
      sendLog(msg)
    })
  })

  // --- Network mode + XMCL LAN/Ping/UPnP (step 6) ---
  ipcMain.removeHandler('network:getMode')
  ipcMain.handle('network:getMode', async () => {
    return networkService.getMode()
  })

  ipcMain.removeHandler('network:setMode')
  ipcMain.handle('network:setMode', async (_evt, mode: unknown) => {
    networkService.setMode(validateEnum(mode, 'Network mode', NETWORK_MODES))
    return { ok: true }
  })

  ipcMain.removeHandler('network:ping')
  ipcMain.handle('network:ping', async (_evt, host: unknown, port?: unknown) => {
    return await networkService.ping(
      validateBoundedString(host, 'Server host', { maxLength: 253 }),
      port === undefined ? 25565 : validatePort(port, 'Server port'),
    )
  })

  let lanUnsubscribe: undefined | (() => void)
  const cleanupLanForwarding = () => {
    lanUnsubscribe?.()
    lanUnsubscribe = undefined
    // Best-effort: ensure we don't keep background listeners/sockets after the window is gone.
    void networkService.lanStop().catch(() => undefined)
  }

  // Ensure we don't leak listeners across window lifecycles.
  window.once('closed', cleanupLanForwarding)

  ipcMain.removeHandler('network:lanStart')
  ipcMain.handle('network:lanStart', async () => {
    await networkService.lanStart('udp4')

    // forward discover events to renderer (keep a single listener per window)
    lanUnsubscribe?.()
    lanUnsubscribe = networkService.onLanDiscover((e) => {
      if (!window.isDestroyed()) window.webContents.send('network:lan-discover', e)
    })

    return { ok: true } as const
  })

  ipcMain.removeHandler('network:lanStop')
  ipcMain.handle('network:lanStop', async () => {
    await networkService.lanStop()
    lanUnsubscribe?.()
    lanUnsubscribe = undefined
    return { ok: true }
  })

  ipcMain.removeHandler('network:lanBroadcast')
  ipcMain.handle('network:lanBroadcast', async (_evt, motd: unknown, port: unknown) => {
    await networkService.lanBroadcast(
      validateBoundedString(motd, 'LAN message', { maxLength: 256 }),
      validatePort(port, 'LAN port'),
    )
    return { ok: true }
  })

  ipcMain.removeHandler('network:upnpMapTcp')
  ipcMain.handle('network:upnpMapTcp', async (_evt, publicPort: unknown, privatePort: unknown) => {
    return await networkService.upnpMapTcp(
      validatePort(publicPort, 'Public port'),
      validatePort(privatePort, 'Private port'),
    )
  })

  ipcMain.removeHandler('network:upnpUnmapTcp')
  ipcMain.handle('network:upnpUnmapTcp', async (_evt, publicPort: unknown) => {
    return await networkService.upnpUnmapTcp(validatePort(publicPort, 'Public port'))
  })
}
