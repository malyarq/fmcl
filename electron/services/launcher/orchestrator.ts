import { DefaultRangePolicy } from '@xmcl/file-transfer';
import type { DownloadProviderId } from '../mirrors/providers';
import { JavaManager } from '../java/provisioning';
import { NetworkManager } from '../network/networkManager';
import { createDispatcher, resolveDownloadConcurrency } from '../runtime/http';
import { RuntimeDownloadService } from '../runtime/downloadService';
import { TaskRunner } from '../runtime/taskRunner';
import { VanillaService } from '../runtime/vanillaService';
import { ModpackService } from '../modpacks/modpackService';
import { ModsService } from '../mods/modsService';
import { VersionListService } from '../versions/versionListService';
import { parseRequestedVersion } from '../versions/versionResolver';
import { patchUndiciThrowOnError } from '../../utils/undiciPatcher';
import { getRequiredJavaForMinecraftVersion } from './launchFlow/requiredJava';
import { resolveJavaPath } from './launchFlow/resolveJavaPath';
import type { TaskProgressData, VersionEntry } from './types';
import type { LaunchGameOptions } from './orchestratorTypes';
import { prepareLaunchContext, ensureAuthInjector, createOfflineSession } from './preLaunchSetup';
import { installModLoaderIfNeeded } from './modLoaderInstaller';
import { spawnMinecraft } from './launchFlow/spawnMinecraft';
import { getFabricSupportedVersions, getForgeSupportedVersions, getNeoForgeSupportedVersions, getOptiFineSupportedVersions } from './versionResolver';
import { patchForgeVersionMetadata, prefetchLegacyForgeRuntimeDeps } from './legacyCompatibility';

// Orchestrates game launch flow: Java, modloaders, auth, and runtime options.
export class LauncherManager {
  private javaManager: JavaManager;
  public networkManager: NetworkManager;
  private readonly downloads: RuntimeDownloadService;
  private readonly versionLists: VersionListService;
  private readonly tasks: TaskRunner;
  private readonly vanilla: VanillaService;
  private readonly instances: ModpackService;
  private readonly mods: ModsService;
  private readonly authServerUrl: string;

  constructor(deps?: {
    javaManager?: JavaManager;
    networkManager?: NetworkManager;
    downloads?: RuntimeDownloadService;
    versionLists?: VersionListService;
    tasks?: TaskRunner;
    vanilla?: VanillaService;
    instances?: ModpackService;
    mods?: ModsService;
    authServerUrl?: string;
  }) {
    patchUndiciThrowOnError();
    this.javaManager = deps?.javaManager ?? new JavaManager();
    this.networkManager = deps?.networkManager ?? new NetworkManager();
    this.downloads = deps?.downloads ?? new RuntimeDownloadService();
    this.versionLists = deps?.versionLists ?? new VersionListService(this.downloads);
    this.tasks = deps?.tasks ?? new TaskRunner(this.downloads);
    this.vanilla = deps?.vanilla ?? new VanillaService(this.downloads, this.tasks);
    this.instances = deps?.instances ?? new ModpackService();
    this.mods = deps?.mods ?? new ModsService();
    this.authServerUrl = deps?.authServerUrl ?? 'http://127.0.0.1:25530';
  }

  public async getVersionList(providerId?: DownloadProviderId) {
    return await this.versionLists.getVersionList(providerId);
  }

  public async getForgeSupportedVersions(providerId?: DownloadProviderId): Promise<string[]> {
    return await getForgeSupportedVersions({
      getVersionList: (id?: DownloadProviderId) => this.getVersionList(id) as unknown as Promise<{ versions: VersionEntry[] }>,
      providerId,
    });
  }

  public async getFabricSupportedVersions(): Promise<string[]> {
    return await getFabricSupportedVersions({
      getVersionList: () => this.getVersionList() as unknown as Promise<{ versions: VersionEntry[] }>,
    });
  }

  public async getOptiFineSupportedVersions(): Promise<string[]> {
    return await getOptiFineSupportedVersions({
      getVersionList: () => this.getVersionList() as unknown as Promise<{ versions: VersionEntry[] }>,
    });
  }

  public async getNeoForgeSupportedVersions(providerId?: DownloadProviderId): Promise<string[]> {
    return await getNeoForgeSupportedVersions({
      getVersionList: (id?: DownloadProviderId) => this.getVersionList(id) as unknown as Promise<{ versions: VersionEntry[] }>,
      providerId,
    });
  }

  public async launchGame(
    options: LaunchGameOptions,
    onLog: (data: string) => void,
    onProgress: (data: TaskProgressData) => void,
    onClose: (code: number) => void,
    onGameStart?: () => void
  ) {
    const { rootPath, modpackId, modpackPath, effective } = prepareLaunchContext({
      modpacks: this.instances,
      options,
    });
    // Legacy aliases for backward compatibility
    const instanceId = modpackId;
    const instancePath = modpackPath;

    const {
      requestedVersion,
      ramGb,
      effectiveJavaPath,
      effectiveVmOptions,
      effectiveMcArgs,
      effectiveResolution,
      effectiveServer,
    } = effective;

    const { isNeoForge, isForge, isFabric, mcVersion } = parseRequestedVersion(requestedVersion);

    onLog('═══════════════════════════════════════════════════════════');
    onLog(`[VERSION INFO] Launching version: ${requestedVersion}`);
    onLog(`[VERSION INFO] Minecraft version: ${mcVersion}`);
    onLog(`[VERSION INFO] Version type: ${isNeoForge ? 'NeoForge' : isForge ? 'Forge' : isFabric ? 'Fabric' : 'Vanilla'}`);
    if (instanceId) onLog(`[MODPACK] ${instanceId} @ ${instancePath}`);
    if (options.useOptiFine) {
      onLog(`[VERSION INFO] OptiFine: requested`);
    }
    onLog('═══════════════════════════════════════════════════════════');

    const downloadProvider = this.downloads.getDownloadProvider(options.downloadProvider);
    await this.downloads.warmupMirrors(downloadProvider);
    const maxSockets = options.maxSockets ?? 64;
    const dispatcher = createDispatcher(maxSockets);
    const rangePolicy = new DefaultRangePolicy(5 * 1024 * 1024, 4);
    const concurrency = resolveDownloadConcurrency(options.autoDownloadThreads ?? true, options.downloadThreads);

    const downloadOptions = this.downloads.buildInstallerOptions(downloadProvider, dispatcher, rangePolicy, concurrency);

    const requiredJava = getRequiredJavaForMinecraftVersion(mcVersion);
    if (requiredJava === 21) onLog(`Version ${mcVersion} requires Java 21.`);
    else if (requiredJava === 17) onLog(`Version ${mcVersion} requires Java 17.`);
    else onLog(`Version ${mcVersion} uses Legacy Java 8.`);

    const javaPath = await resolveJavaPath({
      javaManager: this.javaManager,
      requiredJava,
      customJavaPath: effectiveJavaPath,
      onLog,
      onProgress,
    });

    onLog(`Ensuring Minecraft ${mcVersion} is installed...`);
    await this.vanilla.ensureVanillaInstalled(mcVersion, rootPath, onLog, onProgress, downloadProvider, downloadOptions);

    const launchVersion = await installModLoaderIfNeeded({
      rootPath,
      instancePath: modpackPath,
      mcVersion,
      javaPath,
      requestedVersion,
      isForge,
      isNeoForge,
      isFabric,
      useOptiFine: options.useOptiFine,
      downloadProvider,
      maxSockets,
      downloadOptions,
      tasks: this.tasks,
      onLog,
      onProgress,
    });

    if (isForge) {
      patchForgeVersionMetadata({ rootPath, launchVersion, mcVersion, onLog });
      await prefetchLegacyForgeRuntimeDeps({ instancePath: modpackPath, mcVersion, downloadProvider, onLog });
    }

    await this.mods.logInstalledMods(rootPath, onLog, modpackPath);

    const { destInjectorPath } = await ensureAuthInjector({
      rootPath,
      modpackPath,
      downloadProvider,
      maxSockets,
      onLog,
    });
    const offlineUser = createOfflineSession(options.nickname);

    onLog(`[LAUNCH] Launching Minecraft ${launchVersion}...`);
    onLog(`[LAUNCH] Java: ${javaPath}`);
    onLog(`[LAUNCH] RAM: ${ramGb}GB`);

    await spawnMinecraft({
      requiredJava,
      effectiveVmOptions,
      onLog,
      onClose,
      onGameStart,
      launchOptions: {
        gamePath: modpackPath,
        resourcePath: rootPath,
        javaPath,
        version: launchVersion,
        gameProfile: offlineUser.selectedProfile,
        accessToken: offlineUser.accessToken,
        userType: 'legacy',
        properties: {},
        resolution: effectiveResolution,
        server: effectiveServer,
        minMemory: 1024,
        maxMemory: ramGb * 1024,
        extraMCArgs: effectiveMcArgs,
        ignorePatchDiscrepancies: true,
        ignoreInvalidMinecraftCertificates: true,
        yggdrasilAgent: {
          jar: destInjectorPath,
          server: this.authServerUrl,
        },
        launcherName: 'FriendLauncher',
        launcherBrand: 'FriendLauncher',
      },
    });
  }
}

