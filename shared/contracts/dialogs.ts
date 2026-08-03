export interface ShowSaveDialogOptions {
  title?: string
  defaultPath?: string
  filters?: Array<{ name: string; extensions: string[] }>
}

export interface ShowOpenDialogOptions {
  title?: string
  filters?: Array<{ name: string; extensions: string[] }>
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>
}

export interface SaveDialogResult {
  canceled: boolean
  filePath?: string
  error?: string
}

export interface OpenDialogResult {
  canceled: boolean
  filePaths: string[]
  error?: string
}

export interface DialogsAPI {
  showSaveDialog: (options: ShowSaveDialogOptions) => Promise<SaveDialogResult>
  showOpenDialog: (options: ShowOpenDialogOptions) => Promise<OpenDialogResult>
  getDesktopPath: () => Promise<string>
  saveFile: (filePath: string, content: string) => Promise<{ ok: boolean }>
}
