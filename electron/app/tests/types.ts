import type { DownloadProviderId } from '../../services/mirrors/providers';

export type ModLoaderType = 'forge' | 'neoforge' | 'fabric' | 'vanilla';

export type VanillaResult = {
  mcVersion: string;
  ok: boolean;
  error?: string;
  ms: number;
};

export type ModLoaderResult = {
  mcVersion: string;
  modLoader: ModLoaderType;
  modLoaderVersion: string | null;
  launchVersionId: string | null;
  ok: boolean;
  error?: string;
  ms: number;
  steps: {
    modLoaderInstall: { ok: boolean; error?: string; ms: number };
    dependenciesInstall: { ok: boolean; error?: string; ms: number };
    versionValidation: { ok: boolean; error?: string; ms: number };
    launchReadiness: { ok: boolean; error?: string; ms: number };
  };
};

export type TestSummary = {
  ok: boolean;
  startedAt: string;
  providerId: DownloadProviderId;
  rootPath: string;
  stages: {
    vanilla: {
      total: number;
      okCount: number;
      failCount: number;
      results: VanillaResult[];
    };
    fabric: {
      total: number;
      okCount: number;
      failCount: number;
      results: ModLoaderResult[];
    };
    neoforge: {
      total: number;
      okCount: number;
      failCount: number;
      results: ModLoaderResult[];
    };
    forge: {
      total: number;
      okCount: number;
      failCount: number;
      results: ModLoaderResult[];
    };
  };
};
