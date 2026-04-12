import type { ExternalLinkRequest, ExternalLinksAPI } from '@shared/contracts/externalLinks'
import { toIpcError } from './ipcError'

type NamespacedExternalLinksApi = Window['api']['externalLinks']
type LegacyExternalLinksApi = Window['externalLinks']

function getExternalLinksApi(): NamespacedExternalLinksApi | LegacyExternalLinksApi | undefined {
  if (typeof window === 'undefined') return undefined
  if (window.api?.externalLinks) return window.api.externalLinks
  if (window.externalLinks) return window.externalLinks
  return undefined
}

function requireExternalLinksApi(methodName: string): ExternalLinksAPI {
  const api = getExternalLinksApi()
  if (!api) {
    throw new Error(`[externalLinksIPC] externalLinks API is not available (method: ${methodName})`)
  }

  return api
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const error = toIpcError({ namespace: 'externalLinksIPC', method: methodName }, err)
    console.error(error)
    throw error
  }
}

export const externalLinksIPC = {
  isAvailable(): boolean {
    return Boolean(getExternalLinksApi())
  },

  open(request: ExternalLinkRequest): ReturnType<ExternalLinksAPI['open']> {
    return call('open', () => requireExternalLinksApi('open').open(request))
  },
}

export type ExternalLinksIPC = typeof externalLinksIPC
