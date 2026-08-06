import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { download } from '@xmcl/file-transfer';
import { extractZipSafely, openValidatedZip } from '../../../security/archivePolicy';
import { assertPublicHttpsUrl, getPublicHttpsDispatcher } from '../../../security/remoteUrls';
import type { InstanceSourceMetadata } from '../../../domains/instances/instanceTypes';
import type { ModpackConfig } from '../../instances/types';

export type ProviderDownloadPort = Readonly<{
  download(input: Readonly<{ urls: readonly string[]; destination: string; sha1?: string; label: string }>): Promise<void>;
}>;

export type ProviderArchivePort = Readonly<{
  extract(sourcePath: string, destinationPath: string, label: string): Promise<void>;
}>;

export type ProviderContentPort = Readonly<{
  createTemporaryDirectory(prefix: string): string;
  removeDirectory(directory: string): void;
  exists(filePath: string): boolean;
  readText(filePath: string): string;
  writeText(filePath: string, contents: string): void;
  ensureDirectory(directory: string): void;
  copyFile(sourcePath: string, destinationPath: string): void;
  readDirectory(directory: string): readonly Readonly<{ name: string; directory: boolean }>[];
}>;

export type ProviderStagedInstall = Readonly<{
  config: ModpackConfig;
  source: Readonly<Omit<InstanceSourceMetadata, 'createdAt' | 'updatedAt'>>;
  content: Readonly<{ instanceId: string; descriptor: 'manifest.json' | 'modrinth.index.json' }>;
  missing: readonly Readonly<{ path: string; reason: string }>[];
}>;

export const nodeProviderDownloadPort: ProviderDownloadPort = {
  download: async ({ urls, destination, sha1, label }) => await download({
    url: urls.map((url) => assertPublicHttpsUrl(url, label)),
    destination,
    // The lookup guard runs at connection time, closing DNS-rebinding paths.
    dispatcher: getPublicHttpsDispatcher(),
    ...(sha1 === undefined ? {} : { validator: { algorithm: 'sha1', hash: sha1 } }),
  }),
};

export const nodeProviderArchivePort: ProviderArchivePort = {
  extract: async (sourcePath, destinationPath, label) => {
    const zip = await openValidatedZip(sourcePath, label);
    try { await extractZipSafely(zip, destinationPath); } finally { zip.close(); }
  },
};

export const nodeProviderContentPort: ProviderContentPort = {
  createTemporaryDirectory: (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix)),
  removeDirectory: (directory) => fs.rmSync(directory, { recursive: true, force: true }),
  exists: fs.existsSync,
  readText: (filePath) => fs.readFileSync(filePath, 'utf8'),
  writeText: (filePath, contents) => { fs.mkdirSync(path.dirname(filePath), { recursive: true }); fs.writeFileSync(filePath, contents); },
  ensureDirectory: (directory) => fs.mkdirSync(directory, { recursive: true }),
  copyFile: (sourcePath, destinationPath) => { fs.mkdirSync(path.dirname(destinationPath), { recursive: true }); fs.copyFileSync(sourcePath, destinationPath); },
  readDirectory: (directory) => fs.readdirSync(directory, { withFileTypes: true }).map((entry) => ({ name: entry.name, directory: entry.isDirectory() })),
};

export * from './curseforgeInstaller';
export * from './modrinthInstaller';
