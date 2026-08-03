import type { MirrorsAPI } from '@shared/contracts/mirrors'
import { toIpcError } from './ipcError'

function getMirrorsApi(): MirrorsAPI | undefined {
  if (typeof window === 'undefined') return undefined
  return window.api?.mirrors
}

function requireMirrorsApi(methodName: string): MirrorsAPI {
  const api = getMirrorsApi()
  if (!api) {
    throw new Error(`[mirrorsIPC] mirrors API is not available (method: ${methodName})`)
  }
  return api
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const error = toIpcError({ namespace: 'mirrorsIPC', method: methodName }, err)
    console.error(error)
    throw error
  }
}

export const mirrorsIPC = {
  isAvailable(): boolean {
    return Boolean(getMirrorsApi())
  },

  getMirrors(): ReturnType<MirrorsAPI['getMirrors']> {
    return call('getMirrors', () => requireMirrorsApi('getMirrors').getMirrors())
  },

  getSelectedMirror(): ReturnType<MirrorsAPI['getSelectedMirror']> {
    return call('getSelectedMirror', () => requireMirrorsApi('getSelectedMirror').getSelectedMirror())
  },

  addCustomMirror(name: string, rootUrl: string): ReturnType<MirrorsAPI['addCustomMirror']> {
    return call('addCustomMirror', () => requireMirrorsApi('addCustomMirror').addCustomMirror(name, rootUrl))
  },

  removeMirror(id: string): ReturnType<MirrorsAPI['removeMirror']> {
    return call('removeMirror', () => requireMirrorsApi('removeMirror').removeMirror(id))
  },

  selectMirror(id: string): ReturnType<MirrorsAPI['selectMirror']> {
    return call('selectMirror', () => requireMirrorsApi('selectMirror').selectMirror(id))
  },

  moveMirror(id: string, direction: Parameters<MirrorsAPI['moveMirror']>[1]): ReturnType<MirrorsAPI['moveMirror']> {
    return call('moveMirror', () => requireMirrorsApi('moveMirror').moveMirror(id, direction))
  },

  testSpeed(url: string): ReturnType<MirrorsAPI['testSpeed']> {
    return call('testSpeed', () => requireMirrorsApi('testSpeed').testSpeed(url))
  },

  setAutoSelect(enabled: boolean): ReturnType<MirrorsAPI['setAutoSelect']> {
    return call('setAutoSelect', () => requireMirrorsApi('setAutoSelect').setAutoSelect(enabled))
  },

  isAutoSelectEnabled(): ReturnType<MirrorsAPI['isAutoSelectEnabled']> {
    return call('isAutoSelectEnabled', () => requireMirrorsApi('isAutoSelectEnabled').isAutoSelectEnabled())
  },
}

export type MirrorsIPC = typeof mirrorsIPC
