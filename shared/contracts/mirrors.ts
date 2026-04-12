import type { Mirror, MirrorMoveDirection } from '../types'

export interface MirrorsAPI {
  getMirrors(): Promise<Mirror[]>
  getSelectedMirror(): Promise<Mirror | undefined>
  addCustomMirror(name: string, rootUrl: string): Promise<Mirror>
  removeMirror(id: string): Promise<void>
  selectMirror(id: string): Promise<void>
  moveMirror(id: string, direction: MirrorMoveDirection): Promise<void>
  testSpeed(url: string): Promise<number>
  setAutoSelect(enabled: boolean): Promise<void>
  isAutoSelectEnabled(): Promise<boolean>
}
