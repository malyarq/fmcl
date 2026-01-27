import { ipcMain, type BrowserWindow } from 'electron'
import type { NetworkService } from '../../services/network/networkService'
import type { LogSender } from '../logThrottler'

export function registerNetworkHandlers(deps: {
  window: BrowserWindow
  networkService: NetworkService
  sendLog: LogSender
}) {
  const { window, networkService, sendLog } = deps

  ipcMain.removeHandler('network:host')
  ipcMain.handle('network:host', async (_evt, port) => {
    return await networkService.hostTunnel(port, (msg) => {
      sendLog(msg)
    })
  })

  ipcMain.removeHandler('network:join')
  ipcMain.handle('network:join', async (_evt, code) => {
    return await networkService.joinTunnel(code, (msg) => {
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
  ipcMain.handle('network:setMode', async (_evt, mode) => {
    networkService.setMode(mode)
    return { ok: true }
  })

  ipcMain.removeHandler('network:ping')
  ipcMain.handle('network:ping', async (_evt, host: string, port?: number) => {
    return await networkService.ping(host, port ?? 25565)
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
  ipcMain.handle('network:lanBroadcast', async (_evt, motd: string, port: number) => {
    await networkService.lanBroadcast(motd, port)
    return { ok: true }
  })

  ipcMain.removeHandler('network:upnpMapTcp')
  ipcMain.handle('network:upnpMapTcp', async (_evt, publicPort: number, privatePort: number) => {
    return await networkService.upnpMapTcp(publicPort, privatePort)
  })

  ipcMain.removeHandler('network:upnpUnmapTcp')
  ipcMain.handle('network:upnpUnmapTcp', async (_evt, publicPort: number) => {
    return await networkService.upnpUnmapTcp(publicPort)
  })
}

