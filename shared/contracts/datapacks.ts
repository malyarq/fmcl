export interface DatapackInfo {
  fileName: string
  name: string
  description: string
  isEnabled: boolean
}

export interface DatapackSearchResultItem {
  project_id: string
  title: string
  description: string
  icon_url?: string | null
}

export interface DatapackSearchResult {
  hits: DatapackSearchResultItem[]
  total_hits: number
}

export interface DatapackVersion {
  id: string
}

export interface DatapacksAPI {
  search: (query: string, mcVersion?: string) => Promise<DatapackSearchResult>
  getVersions: (projectId: string) => Promise<DatapackVersion[]>
  listByInstanceId: (instanceId: string, worldFolder: string) => Promise<DatapackInfo[]>
  enableByInstanceId: (instanceId: string, worldFolder: string, fileName: string) => Promise<{ ok: boolean }>
  disableByInstanceId: (instanceId: string, worldFolder: string, fileName: string) => Promise<{ ok: boolean }>
  deleteByInstanceId: (instanceId: string, worldFolder: string, fileName: string) => Promise<{ ok: boolean }>
  installByInstanceId: (instanceId: string, worldFolder: string, versionId: string) => Promise<{ ok: boolean }>
}
