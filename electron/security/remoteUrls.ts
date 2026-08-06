import net from 'node:net';
import dns, { type LookupAddress } from 'node:dns';
import { Agent, Pool, type Dispatcher } from 'undici';

const MAX_REMOTE_URL_LENGTH = 2_048;
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  '0.0.0.0',
]);

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b, c] = parts;
  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 192 && b === 0)
    || (a === 192 && b === 88 && c === 99)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function isPrivateIpv6(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || /^fe[89ab]/.test(normalized)
    || normalized.startsWith('ff')
    || normalized.startsWith('2001:db8:')
    || normalized === '2001:db8') {
    return true;
  }

  const [left = '', right = '', ...extra] = normalized.split('::');
  if (extra.length > 0) return true;
  const leftParts = left ? left.split(':') : [];
  const rightParts = right ? right.split(':') : [];
  const hasCompression = normalized.includes('::');
  const missingParts = 8 - leftParts.length - rightParts.length;
  if ((!hasCompression && missingParts !== 0) || (hasCompression && missingParts < 1)) return true;

  const parts = [
    ...leftParts,
    ...Array.from({ length: missingParts }, () => '0'),
    ...rightParts,
  ].map((part) => Number.parseInt(part, 16));
  if (parts.length !== 8 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)) {
    return true;
  }

  const isMappedIpv4 = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  const isCompatibleIpv4 = parts.slice(0, 6).every((part) => part === 0);
  if (isMappedIpv4 || isCompatibleIpv4) {
    const ipv4 = `${parts[6] >> 8}.${parts[6] & 0xff}.${parts[7] >> 8}.${parts[7] & 0xff}`;
    return isPrivateIpv4(ipv4);
  }

  return false;
}

function isBlockedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (BLOCKED_HOSTNAMES.has(normalized) || normalized.endsWith('.localhost') || normalized.endsWith('.local')) {
    return true;
  }

  const ipVersion = net.isIP(normalized);
  if (ipVersion === 4) return isPrivateIpv4(normalized);
  if (ipVersion === 6) return isPrivateIpv6(normalized);
  return false;
}

const publicHttpsDispatcher = new Agent({
  factory(origin, options) {
    if (new URL(origin).protocol !== 'https:') {
      throw new Error('Public download redirects must keep using HTTPS.');
    }
    return new Pool(origin, options);
  },
  connect: {
    lookup(hostname, options, callback) {
      dns.lookup(hostname, { ...options, all: true }, (error, addresses) => {
        if (error) {
          callback(error, '', 0);
          return;
        }

        const resolved = addresses as LookupAddress[];
        if (resolved.length === 0 || resolved.some(({ address }) => isBlockedHost(address))) {
          const lookupError = new Error('Remote URL resolved to a private, link-local, or reserved address.') as NodeJS.ErrnoException;
          lookupError.code = 'EACCES';
          callback(lookupError, '', 0);
          return;
        }

        if (options.all) {
          callback(null, resolved, 0);
          return;
        }

        const [selected] = resolved;
        callback(null, selected.address, selected.family);
      });
    },
  },
});

export function assertPublicHttpsUrl(
  candidate: unknown,
  label: string,
  options: { allowedHostSuffixes?: readonly string[] } = {},
): string {
  if (typeof candidate !== 'string' || !candidate.trim() || candidate.length > MAX_REMOTE_URL_LENGTH) {
    throw new Error(`${label} must be a non-empty URL no longer than ${MAX_REMOTE_URL_LENGTH} characters.`);
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }

  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} must use HTTPS.`);
  }
  if (!parsed.hostname || parsed.username || parsed.password) {
    throw new Error(`${label} must not contain credentials and must include a host.`);
  }
  if (isBlockedHost(parsed.hostname)) {
    throw new Error(`${label} must not target localhost, private, link-local, or reserved addresses.`);
  }

  const allowedHostSuffixes = options.allowedHostSuffixes?.map((host) => host.toLowerCase());
  if (allowedHostSuffixes?.length) {
    const hostname = parsed.hostname.toLowerCase().replace(/\.$/, '');
    const allowed = allowedHostSuffixes.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`));
    if (!allowed) {
      throw new Error(`${label} must use an approved download host.`);
    }
  }

  return parsed.toString();
}

export function getPublicHttpsDispatcher(): Dispatcher {
  return publicHttpsDispatcher;
}

type NativeFetchOptions = NonNullable<Parameters<typeof globalThis.fetch>[1]>;
type PublicFetchOptions = Omit<NativeFetchOptions, 'redirect'> & {
  maxRedirections?: number;
};

export async function fetchPublicHttpsUrl(
  candidate: unknown,
  label: string,
  options: PublicFetchOptions = {},
): Promise<Response> {
  const { maxRedirections = 5, ...requestOptions } = options;
  const method = requestOptions.method?.toUpperCase() ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') {
    throw new Error(`${label} fetch only supports GET or HEAD requests.`);
  }
  let currentUrl = assertPublicHttpsUrl(candidate, label);

  for (let redirectCount = 0; redirectCount <= maxRedirections; redirectCount += 1) {
    const response = await globalThis.fetch(currentUrl, {
      ...requestOptions,
      dispatcher: publicHttpsDispatcher,
      redirect: 'manual',
    } as NativeFetchOptions);

    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return response;
    }

    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw new Error(`${label} redirect is missing a location.`);
    if (redirectCount === maxRedirections) throw new Error(`${label} redirected too many times.`);

    currentUrl = assertPublicHttpsUrl(new URL(location, currentUrl).toString(), `${label} redirect`);
  }

  throw new Error(`${label} redirected too many times.`);
}
