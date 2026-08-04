export interface ShareAPI {
  generateCode(modpackId: string): Promise<string>
}
