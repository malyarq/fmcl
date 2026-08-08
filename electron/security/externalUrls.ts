import { dialog, shell, type BrowserWindow, type MessageBoxOptions } from 'electron'
import type { ExternalLinkOpenResult, ExternalLinkRequest } from '@shared/contracts/externalLinks'

type ExternalUrlDisposition = 'direct' | 'confirm' | 'block'

type ClassifiedExternalUrl = {
  disposition: ExternalUrlDisposition
  normalizedUrl: string
  hostname?: string
  reason?: string
}

const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:'])
const BLOCKED_EXTERNAL_PROTOCOLS = new Set(['javascript:', 'data:', 'file:'])
const TRUSTED_EXTERNAL_HOSTS = new Set([
  'github.com',
  'modrinth.com',
  'www.modrinth.com',
  'curseforge.com',
  'www.curseforge.com',
])

function normalizeExternalUrl(url: URL): string {
  const normalized = url.toString()
  if (normalized.endsWith('/') && !url.search && !url.hash) {
    return normalized.slice(0, -1)
  }

  return normalized
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.$/, '')
}

function isTrustedExternalHost(hostname: string): boolean {
  const normalizedHost = normalizeHostname(hostname)
  if (TRUSTED_EXTERNAL_HOSTS.has(normalizedHost)) {
    return true
  }

  return normalizedHost.endsWith('.modrinth.com') || normalizedHost.endsWith('.curseforge.com')
}

export function classifyExternalUrl(candidate: string): ClassifiedExternalUrl {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(candidate)
  } catch {
    return {
      disposition: 'block',
      normalizedUrl: candidate,
      reason: 'Burrow blocked this link because it is not a valid URL.',
    }
  }

  const normalizedUrl = normalizeExternalUrl(parsedUrl)

  if (BLOCKED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) {
    return {
      disposition: 'block',
      normalizedUrl,
      reason: `Burrow blocked this link because the ${parsedUrl.protocol} scheme is not allowed.`,
    }
  }

  if (!ALLOWED_EXTERNAL_PROTOCOLS.has(parsedUrl.protocol)) {
    return {
      disposition: 'block',
      normalizedUrl,
      reason: 'Burrow only opens external HTTP and HTTPS links.',
    }
  }

  if (!parsedUrl.hostname) {
    return {
      disposition: 'block',
      normalizedUrl,
      reason: 'Burrow blocked this link because it does not include a hostname.',
    }
  }

  if (parsedUrl.username || parsedUrl.password) {
    return {
      disposition: 'block',
      normalizedUrl,
      reason: 'Burrow blocked this link because embedded credentials are not allowed.',
    }
  }

  const hostname = normalizeHostname(parsedUrl.hostname)
  if (parsedUrl.protocol === 'https:' && isTrustedExternalHost(hostname)) {
    return {
      disposition: 'direct',
      normalizedUrl,
      hostname,
    }
  }

  return {
    disposition: 'confirm',
    normalizedUrl,
    hostname,
    reason: parsedUrl.protocol === 'http:'
      ? 'This link uses insecure HTTP, so Burrow requires confirmation before opening it.'
      : undefined,
  }
}

async function confirmExternalUrl(
  request: ExternalLinkRequest,
  classification: ClassifiedExternalUrl,
  parentWindow?: BrowserWindow,
): Promise<boolean> {
  const detailLines = [
    classification.reason,
    request.context ? `Context: ${request.context}` : undefined,
    classification.hostname ? `Domain: ${classification.hostname}` : undefined,
    `URL: ${classification.normalizedUrl}`,
    '',
    'Only known trusted domains open without confirmation.',
  ].filter(Boolean)

  const options: MessageBoxOptions = {
    type: 'warning',
    buttons: ['Open link', 'Cancel'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
    message: 'Open external link?',
    detail: detailLines.join('\n'),
  }
  const { response } = parentWindow
    ? await dialog.showMessageBox(parentWindow, options)
    : await dialog.showMessageBox(options)

  return response === 0
}

async function showBlockedExternalUrl(
  request: ExternalLinkRequest,
  classification: ClassifiedExternalUrl,
  parentWindow?: BrowserWindow,
): Promise<void> {
  const detailLines = [
    classification.reason ?? 'Burrow blocked this external link.',
    request.context ? `Context: ${request.context}` : undefined,
    `URL: ${classification.normalizedUrl}`,
  ].filter(Boolean)

  const options: MessageBoxOptions = {
    type: 'error',
    buttons: ['OK'],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    message: 'Blocked external link',
    detail: detailLines.join('\n'),
  }

  if (parentWindow) {
    await dialog.showMessageBox(parentWindow, options)
    return
  }

  await dialog.showMessageBox(options)
}

export async function openExternalUrl(
  request: ExternalLinkRequest,
  options: {
    parentWindow?: BrowserWindow
    showBlockedDialog?: boolean
  } = {},
): Promise<ExternalLinkOpenResult> {
  const classification = classifyExternalUrl(request.url)

  if (classification.disposition === 'block') {
    if (options.showBlockedDialog !== false) {
      await showBlockedExternalUrl(request, classification, options.parentWindow)
    }

    return {
      status: 'blocked',
      url: classification.normalizedUrl,
      reason: classification.reason,
    }
  }

  if (classification.disposition === 'confirm') {
    const confirmed = await confirmExternalUrl(request, classification, options.parentWindow)
    if (!confirmed) {
      return {
        status: 'cancelled',
        url: classification.normalizedUrl,
        reason: classification.reason,
      }
    }
  }

  await shell.openExternal(classification.normalizedUrl)

  return {
    status: 'opened',
    url: classification.normalizedUrl,
  }
}
