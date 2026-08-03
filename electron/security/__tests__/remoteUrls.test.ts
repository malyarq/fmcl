import { describe, expect, it } from 'vitest';
import { assertPublicHttpsUrl } from '../remoteUrls';

describe('assertPublicHttpsUrl', () => {
  it('accepts public HTTPS download URLs', () => {
    expect(assertPublicHttpsUrl('https://cdn.modrinth.com/data/file.zip', 'Download URL')).toBe(
      'https://cdn.modrinth.com/data/file.zip',
    );
  });

  it.each([
    'http://example.com/file.zip',
    'https://localhost/file.zip',
    'https://127.0.0.1/file.zip',
    'https://10.0.0.1/file.zip',
    'https://169.254.169.254/latest/meta-data',
    'https://100.64.0.1/file.zip',
    'https://192.0.2.1/file.zip',
    'https://198.51.100.1/file.zip',
    'https://203.0.113.1/file.zip',
    'https://[::1]/file.zip',
    'https://[::ffff:127.0.0.1]/file.zip',
    'https://[::ffff:a9fe:a9fe]/latest/meta-data',
    'https://[::7f00:1]/file.zip',
    'https://[ff02::1]/file.zip',
    'https://[2001:db8::1]/file.zip',
  ])('blocks insecure or private targets: %s', (url) => {
    expect(() => assertPublicHttpsUrl(url, 'Download URL')).toThrow();
  });

  it('enforces an explicit CDN allowlist when requested', () => {
    expect(() => assertPublicHttpsUrl('https://example.com/file.zip', 'Download URL', {
      allowedHostSuffixes: ['cdn.modrinth.com'],
    })).toThrow('approved download host');
  });
});
