export interface Datapack {
  fileName: string
  name: string
  description: string
  isEnabled: boolean
  path: string
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
  list: (instancePath: string, worldFolder: string) => Promise<Datapack[]>
  enable: (instancePath: string, worldFolder: string, fileName: string) => Promise<{ ok: boolean }>
  disable: (instancePath: string, worldFolder: string, fileName: string) => Promise<{ ok: boolean }>
  delete: (instancePath: string, worldFolder: string, fileName: string) => Promise<{ ok: boolean }>
  search: (query: string, mcVersion?: string) => Promise<DatapackSearchResult>
  install: (instancePath: string, worldFolder: string, versionId: string) => Promise<{ ok: boolean }>
  getVersions: (projectId: string) => Promise<DatapackVersion[]>
}
