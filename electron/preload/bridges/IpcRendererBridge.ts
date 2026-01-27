import { ipcRenderer } from 'electron'
import type { AllowedIpcChannel, IpcRendererAPI } from '@shared/contracts'
import { allowedIpcChannelSet } from '@shared/contracts/ipcChannels'

function assertAllowed(channel: string): asserts channel is AllowedIpcChannel {
  if (!allowedIpcChannelSet.has(channel)) {
    throw new Error(`[ipcRendererBridge] Blocked IPC channel: ${channel}`)
  }
}

// Bridge raw IPC when higher-level wrappers are not available.
export const ipcRendererBridge: IpcRendererAPI = {
  on(channel, listener) {
    assertAllowed(channel)
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(channel, listener) {
    assertAllowed(channel)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ipcRenderer.off(channel, listener as any)
  },
  send(channel, ...args) {
    assertAllowed(channel)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ipcRenderer.send(channel, ...(args as any[]))
  },
  invoke(channel, ...args) {
    assertAllowed(channel)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ipcRenderer.invoke(channel, ...(args as any[]))
  },
}
