import type { StatisticsAPI } from '@shared/contracts/statistics'
import { toIpcError } from './ipcError'

type NamespacedStatisticsApi = Window['api']['statistics']

function getStatisticsApi(): NamespacedStatisticsApi | undefined {
  if (typeof window === 'undefined') return undefined
  return window.api?.statistics
}

function requireStatisticsApi(methodName: string): StatisticsAPI {
  const api = getStatisticsApi()
  if (!api) {
    throw new Error(`[statisticsIPC] statistics API is not available (method: ${methodName})`)
  }
  return api
}

async function call<T>(methodName: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const error = toIpcError({ namespace: 'statisticsIPC', method: methodName }, err)
    console.error(error)
    throw error
  }
}

export const statisticsIPC = {
  getStats(): ReturnType<StatisticsAPI['getStats']> {
    return call('getStats', () => requireStatisticsApi('getStats').getStats())
  },

  exportStats(filePath: string): ReturnType<StatisticsAPI['exportStats']> {
    return call('exportStats', () => requireStatisticsApi('exportStats').exportStats(filePath))
  },
}

export type StatisticsIPC = typeof statisticsIPC
