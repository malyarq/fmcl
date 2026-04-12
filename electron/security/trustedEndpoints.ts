const ENDPOINT_PROTOCOLS = new Set(['http:', 'https:'])
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function normalizeEndpointUrl(url: URL): string {
  const normalized = url.toString()
  if (normalized.endsWith('/') && !url.search && !url.hash) {
    return normalized.slice(0, -1)
  }

  return normalized
}

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname.toLowerCase().replace(/\.$/, ''))
}

export function assertTrustedEndpointUrl(candidate: string, label: string): string {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(candidate)
  } catch {
    throw new Error(`${label} must be a valid URL.`)
  }

  if (!ENDPOINT_PROTOCOLS.has(parsedUrl.protocol)) {
    throw new Error(`${label} must use HTTPS, or HTTP only for localhost, 127.0.0.1, or ::1.`)
  }

  if (!parsedUrl.hostname) {
    throw new Error(`${label} must include a host.`)
  }

  if (parsedUrl.username || parsedUrl.password) {
    throw new Error(`${label} must not include embedded credentials.`)
  }

  if (parsedUrl.search) {
    throw new Error(`${label} must not include query parameters.`)
  }

  if (parsedUrl.hash) {
    throw new Error(`${label} must not include URL fragments.`)
  }

  if (parsedUrl.protocol === 'http:' && !isLoopbackHost(parsedUrl.hostname)) {
    throw new Error(`${label} must use HTTPS, or HTTP only for localhost, 127.0.0.1, or ::1.`)
  }

  return normalizeEndpointUrl(parsedUrl)
}
