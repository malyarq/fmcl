import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Updater } from '../instanceUpdater';

function manifestResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('Updater', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
  });

  it('rejects manifest paths that escape the modpack root', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-updater-'));
    tempDirs.push(root);
    const body = Buffer.from('owned', 'utf8');
    const fetchMock = vi.fn().mockResolvedValue(manifestResponse({
      name: 'Unsafe',
      files: [{
        path: '../outside.txt',
        hash: crypto.createHash('sha1').update(body).digest('hex'),
        size: body.length,
        url: 'https://cdn.example.com/outside.txt',
      }],
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new Updater(root).sync('https://updates.example.com/manifest.json', vi.fn()))
      .rejects.toThrow('stay inside');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fs.existsSync(path.join(path.dirname(root), 'outside.txt'))).toBe(false);
  });

  it('downloads atomically and verifies declared size and SHA-1', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-updater-'));
    tempDirs.push(root);
    const body = Buffer.from('verified content', 'utf8');
    const hash = crypto.createHash('sha1').update(body).digest('hex');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(manifestResponse({
        name: 'Safe',
        files: [{ path: 'mods/example.jar', hash, size: body.length, url: 'https://cdn.example.com/example.jar' }],
      }))
      .mockResolvedValueOnce(new Response(body, {
        status: 200,
        headers: { 'content-length': String(body.length) },
      }));
    vi.stubGlobal('fetch', fetchMock);

    await new Updater(root).sync('https://updates.example.com/manifest.json', vi.fn());

    expect(fs.readFileSync(path.join(root, 'mods', 'example.jar'), 'utf8')).toBe('verified content');
    expect(fs.readdirSync(path.join(root, 'mods'))).toEqual(['example.jar']);
  });

  it('removes partial files when integrity verification fails', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'burrow-updater-'));
    tempDirs.push(root);
    const body = Buffer.from('tampered', 'utf8');
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(manifestResponse({
        name: 'Mismatch',
        files: [{ path: 'mods/example.jar', hash: '0'.repeat(40), size: body.length, url: 'https://cdn.example.com/example.jar' }],
      }))
      .mockResolvedValueOnce(new Response(body, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(new Updater(root).sync('https://updates.example.com/manifest.json', vi.fn()))
      .rejects.toThrow('hash mismatch');
    expect(fs.existsSync(path.join(root, 'mods', 'example.jar'))).toBe(false);
    expect(fs.readdirSync(path.join(root, 'mods'))).toEqual([]);
  });
});
