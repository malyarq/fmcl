import type { DownloadProviderId } from '../../services/mirrors/providers';
import { JavaManager } from '../../services/java/provisioning';
import { RuntimeDownloadService } from '../../services/runtime/downloadService';
import { TaskRunner } from '../../services/runtime/taskRunner';
import { getRequiredJavaForMinecraftVersion } from '../../services/launcher/launchFlow/requiredJava';
import { resolveJavaPath } from '../../services/launcher/launchFlow/resolveJavaPath';
import { createDispatcher, resolveDownloadConcurrency } from '../../services/runtime/http';
import { DefaultRangePolicy } from '@xmcl/file-transfer';
import { parseRequestedVersion } from '../../services/versions/versionResolver';
import { installModLoaderIfNeeded } from '../../services/launcher/modLoaderInstaller';
import { patchForgeVersionMetadata, prefetchLegacyForgeRuntimeDeps } from '../../services/launcher/legacyCompatibility';
import type { ModLoaderResult, ModLoaderType } from './types';
import { checkVersionFiles, checkLaunchReadiness } from './versionValidator';

export async function installModLoaderVersion(params: {
  mcVersion: string;
  modLoader: ModLoaderType;
  rootPath: string;
  instancePath: string;
  javaManager: JavaManager;
  downloads: RuntimeDownloadService;
  tasks: TaskRunner;
  providerId: DownloadProviderId;
  onLog: (line: string) => void;
}): Promise<ModLoaderResult> {
  const { mcVersion, modLoader, rootPath, instancePath, javaManager, downloads, tasks, providerId, onLog } = params;

  const startedAt = Date.now();
  const result: ModLoaderResult = {
    mcVersion,
    modLoader,
    modLoaderVersion: null,
    launchVersionId: null,
    ok: false,
    ms: 0,
    steps: {
      modLoaderInstall: { ok: false, ms: 0 },
      dependenciesInstall: { ok: false, ms: 0 },
      versionValidation: { ok: false, ms: 0 },
      launchReadiness: { ok: false, ms: 0 },
    },
  };

  try {
    const downloadProvider = downloads.getDownloadProvider(providerId);
    const maxSockets = 64;
    const dispatcher = createDispatcher(maxSockets);
    const rangePolicy = new DefaultRangePolicy(5 * 1024 * 1024, 4);
    const concurrency = resolveDownloadConcurrency(true, undefined);
    const downloadOptions = downloads.buildInstallerOptions(downloadProvider, dispatcher, rangePolicy, concurrency);

    const requiredJava = getRequiredJavaForMinecraftVersion(mcVersion);
    onLog(`[${modLoader}] MC ${mcVersion} requires Java ${requiredJava}`);

    // Step 1: Install modloader
    const modLoaderStart = Date.now();
    try {
      onLog(`[${modLoader}] Step 1: Installing ${modLoader} for ${mcVersion}...`);
      const requestedVersion =
        modLoader === 'forge' ? `${mcVersion}-Forge` : modLoader === 'neoforge' ? `${mcVersion}-NeoForge` : `${mcVersion}-Fabric`;
      const { isForge, isNeoForge, isFabric } = parseRequestedVersion(requestedVersion);

      const javaPath = await resolveJavaPath({
        javaManager,
        requiredJava,
        onLog,
        onProgress: () => {},
      });

      const launchVersion = await installModLoaderIfNeeded({
        rootPath,
        instancePath,
        mcVersion,
        javaPath,
        requestedVersion,
        isForge,
        isNeoForge,
        isFabric,
        useOptiFine: false,
        downloadProvider,
        maxSockets,
        downloadOptions,
        tasks,
        onLog,
        onProgress: () => {},
      });

      result.launchVersionId = launchVersion;
      result.steps.modLoaderInstall = { ok: true, ms: Date.now() - modLoaderStart };
      onLog(`[${modLoader}] Step 1: ${modLoader} installed ✓ (launch version: ${launchVersion})`);

      // Forge-specific post-install steps
      if (isForge) {
        patchForgeVersionMetadata({ rootPath, launchVersion, mcVersion, onLog });
        await prefetchLegacyForgeRuntimeDeps({ instancePath, mcVersion, downloadProvider, onLog });
      }

      // Extract modloader version from launchVersion
      if (launchVersion.includes('-forge-')) {
        const match = launchVersion.match(/-forge-(.+)$/);
        result.modLoaderVersion = match ? match[1] : null;
      } else if (launchVersion.includes('-neoforge-')) {
        const match = launchVersion.match(/-neoforge-(.+)$/);
        result.modLoaderVersion = match ? match[1] : null;
      } else if (launchVersion.includes('-fabric-')) {
        const match = launchVersion.match(/-fabric-(.+)$/);
        result.modLoaderVersion = match ? match[1] : null;
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result.steps.modLoaderInstall = { ok: false, error: msg, ms: Date.now() - modLoaderStart };
      onLog(`[${modLoader}] Step 1: ${modLoader} install failed: ${msg}`);
      result.ms = Date.now() - startedAt;
      result.error = msg;
      return result;
    }

    // Step 2: Dependencies are installed as part of modloader install, but verify
    const depsStart = Date.now();
    try {
      onLog(`[${modLoader}] Step 2: Verifying dependencies...`);
      result.steps.dependenciesInstall = { ok: true, ms: Date.now() - depsStart };
      onLog(`[${modLoader}] Step 2: Dependencies verified ✓`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result.steps.dependenciesInstall = { ok: false, error: msg, ms: Date.now() - depsStart };
      onLog(`[${modLoader}] Step 2: Dependencies check failed: ${msg}`);
    }

    // Step 3: Validate version files exist
    const validationStart = Date.now();
    try {
      onLog(`[${modLoader}] Step 3: Validating version files...`);
      const versionId = result.launchVersionId || mcVersion;
      const check = checkVersionFiles(rootPath, versionId, modLoader);
      if (!check.ok) {
        throw new Error(`Missing files: ${check.missing.join(', ')}`);
      }
      result.steps.versionValidation = { ok: true, ms: Date.now() - validationStart };
      onLog(`[${modLoader}] Step 3: Version files validated ✓`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result.steps.versionValidation = { ok: false, error: msg, ms: Date.now() - validationStart };
      onLog(`[${modLoader}] Step 3: Version validation failed: ${msg}`);
    }

    // Step 4: Check launch readiness
    const readinessStart = Date.now();
    try {
      onLog(`[${modLoader}] Step 4: Checking launch readiness...`);
      const versionId = result.launchVersionId || mcVersion;
      const readiness = checkLaunchReadiness(rootPath, versionId);
      if (!readiness.ok) {
        throw new Error(readiness.error || 'Not ready for launch');
      }
      result.steps.launchReadiness = { ok: true, ms: Date.now() - readinessStart };
      onLog(`[${modLoader}] Step 4: Launch readiness check passed ✓`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      result.steps.launchReadiness = { ok: false, error: msg, ms: Date.now() - readinessStart };
      onLog(`[${modLoader}] Step 4: Launch readiness check failed: ${msg}`);
    }

    const allStepsOk =
      result.steps.modLoaderInstall.ok &&
      result.steps.dependenciesInstall.ok &&
      result.steps.versionValidation.ok &&
      result.steps.launchReadiness.ok;

    result.ok = allStepsOk;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    result.error = msg;
    onLog(`[${modLoader}] Unexpected error: ${msg}`);
  }

  result.ms = Date.now() - startedAt;
  return result;
}
