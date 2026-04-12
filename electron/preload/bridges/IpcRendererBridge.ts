import { ipcRenderer, type IpcRendererEvent } from 'electron'
import type { AllowedIpcChannel, IpcRendererAPI } from '@shared/contracts'
import { allowedIpcChannelSet } from '@shared/contracts/ipcChannels'

function assertAllowed(channel: string): asserts channel is AllowedIpcChannel {
  if (!allowedIpcChannelSet.has(channel)) {
    throw new Error(`[ipcRendererBridge] Blocked IPC channel: ${channel}`)
  }
}

type BridgeListener = Parameters<IpcRendererAPI['on']>[1]
type ElectronListener = (event: IpcRendererEvent, ...args: unknown[]) => void

const listenerWrappers = new WeakMap<BridgeListener, Map<AllowedIpcChannel, ElectronListener>>()

function getWrappedListener(channel: AllowedIpcChannel, listener: BridgeListener): ElectronListener {
  let wrappers = listenerWrappers.get(listener)
  if (!wrappers) {
    wrappers = new Map()
    listenerWrappers.set(listener, wrappers)
  }

  let wrapped = wrappers.get(channel)
  if (!wrapped) {
    wrapped = (event, ...args) => listener(event, ...args)
    wrappers.set(channel, wrapped)
  }

  return wrapped
}

function takeWrappedListener(channel: AllowedIpcChannel, listener: BridgeListener): ElectronListener | undefined {
  const wrappers = listenerWrappers.get(listener)
  if (!wrappers) {
    return undefined
  }

  const wrapped = wrappers.get(channel)
  if (!wrapped) {
    return undefined
  }

  wrappers.delete(channel)
  if (wrappers.size === 0) {
    listenerWrappers.delete(listener)
  }

  return wrapped
}

// Bridge raw IPC when higher-level wrappers are not available.
export const ipcRendererBridge: IpcRendererAPI = {
  on(channel, listener) {
    assertAllowed(channel)
    return ipcRenderer.on(channel, getWrappedListener(channel, listener))
  },
  off(channel, listener) {
    assertAllowed(channel)
    const wrapped = takeWrappedListener(channel, listener)
    if (!wrapped) {
      return ipcRenderer
    }

    return ipcRenderer.off(channel, wrapped)
  },
  send(channel, ...args) {
    assertAllowed(channel)
    return ipcRenderer.send(channel, ...args)
  },
  invoke(channel, ...args) {
    assertAllowed(channel)
    return ipcRenderer.invoke(channel, ...args)
  },
}
