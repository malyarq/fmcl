import type { ShareAPI } from '@shared/contracts/share'
import { toIpcError } from './ipcError'

function getShareApi(): ShareAPI | undefined {
  if (typeof window === 'undefined') return undefined
  return window.api?.share
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

}

export type ShareIPC = typeof shareIPC
