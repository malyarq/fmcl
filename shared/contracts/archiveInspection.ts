import type { ModpackManifest } from '../types/modpack';

/** Dedicated renderer-safe capability for selecting and previewing local archives. */
export const ARCHIVE_INSPECTION_CHANNELS = {
  select: 'archiveInspection:select',
} as const;

export type ArchiveInspectionFormat = 'curseforge' | 'modrinth' | 'zip' | 'multimc' | null;

export type ArchiveManifestMetadata = Readonly<{
  format: ArchiveInspectionFormat;
  manifest: ModpackManifest | null;
  error?: string;
}>;

export type SelectedArchiveInspection = ArchiveManifestMetadata & Readonly<{
  status: 'selected';
  /** Opaque, single-use main-process capability; never a filesystem path. */
  archiveRef: string;
}>;

export type ArchiveInspectionResponse = SelectedArchiveInspection | Readonly<{ status: 'cancelled' }>;

export type ArchiveInspectionAPI = Readonly<{
  select(): Promise<ArchiveInspectionResponse>;
}>;
