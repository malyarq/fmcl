import type { ModpackManifest } from '@shared/types'

export interface ShareAPI {
  generateCode(modpackId: string): Promise<string>
  importCode(code: string): Promise<ModpackManifest>
}
