export interface ExternalLinkRequest {
  url: string
  context?: string
}

export type ExternalLinkOpenStatus = 'opened' | 'cancelled' | 'blocked'

export interface ExternalLinkOpenResult {
  status: ExternalLinkOpenStatus
  url: string
  reason?: string
}

export interface ExternalLinksAPI {
  open(request: ExternalLinkRequest): Promise<ExternalLinkOpenResult>
}
