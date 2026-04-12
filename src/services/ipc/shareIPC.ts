import type { ShareAPI } from '@shared/contracts/share'
import { toIpcError } from './ipcError'

type NamespacedShareApi = Window['api']['share']
type LegacyShareApi = Window['share']

function getShareApi(): NamespacedShareApi | LegacyShareApi | undefined {
  if (typeof window === 'undefined') return undefined
  if (window.api?.share) return window.api.share
  if (window.share) return window.share
  return undefined
}

function requireShareApi(methodName: string): ShareAPI {
  const api = getShareApi()
  if (!api) {
    throw new Error(`[shareIPC] share API is not available (method: ${methodName})`)
  }
  return api
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const error = toIpcError({ namespace: 'shareIPC', method: methodName }, err)
    console.error(error)
    throw error
  }
}

export const shareIPC = {
  isAvailable(): boolean {
    return Boolean(getShareApi())
  },

  generateCode(modpackId: string): ReturnType<ShareAPI['generateCode']> {
    return call('generateCode', () => requireShareApi('generateCode').generateCode(modpackId))
  },

  importCode(code: string): ReturnType<ShareAPI['importCode']> {
    return call('importCode', () => requireShareApi('importCode').importCode(code))
  },
}

export type ShareIPC = typeof shareIPC
