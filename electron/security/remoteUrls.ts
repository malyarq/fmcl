import net from 'node:net';

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
