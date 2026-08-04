import { DefaultRangePolicy } from '@xmcl/file-transfer';
import type { DownloadProviderId } from '../mirrors/providers';
import type { AccountService } from '../account/accountService';
import type { MirrorsService } from '../mirrors/mirrorsService';
import type { StatisticsService } from '../stats/statisticsService';
import { JavaManager } from '../java/provisioning';
import { createDispatcher, resolveDownloadConcurrency } from '../runtime/http';
import { RuntimeDownloadService } from '../runtime/downloadService';
import { TaskRunner } from '../runtime/taskRunner';
import { VanillaService } from '../runtime/vanillaService';
import { logInstalledMods } from '../mods/logInstalledMods';
import { VersionListService } from '../versions/versionListService';
import { parseRequestedVersion } from '../versions/versionResolver';
import { patchUndiciThrowOnError } from '../../utils/undiciPatcher';
import { getRequiredJavaForMinecraftVersion } from './launchFlow/requiredJava';
import type { TaskProgressData, VersionEntry } from './types';
import type { LaunchGameOptions } from './orchestratorTypes';
import { prepareLaunchContext, ensureAuthInjector, createOfflineSession } from './preLaunchSetup';
import { installModLoaderIfNeeded } from './modLoaderInstaller';
import type { ChildProcess } from 'child_process';
import kill from 'tree-kill';
import { getFabricSupportedVersions, getForgeSupportedVersions, getNeoForgeSupportedVersions, getOptiFineSupportedVersions } from './versionResolver';
import { patchForgeVersionMetadata, prefetchLegacyForgeRuntimeDeps } from './legacyCompatibility';
import type { InstanceReadPort, LauncherRootResolver } from '../../domains/instances/ports';
import type { LaunchAdapters } from '../../infrastructure/instances/launchAdapters';

// Orchestrates game launch flow: Java, modloaders, auth, and runtime options.
export class LauncherManager {
  private currentGameProcess: ChildProcess | null = null;
  private javaManager: JavaManager;
  private readonly downloads: RuntimeDownloadService;
  private readonly versionLists: VersionListService;
  private readonly tasks: TaskRunner;
  private readonly vanilla: VanillaService;
  private readonly instances: InstanceReadPort;
  private readonly rootResolver: LauncherRootResolver;
  private readonly launchAdapters: LaunchAdapters;
  private readonly launcherRootPath: string;
  private readonly logInstalledMods: typeof logInstalledMods;

  private readonly authServerUrl: string;
  private readonly accountService?: AccountService;
  private readonly mirrorsService?: MirrorsService;
  private readonly statisticsService?: StatisticsService;

  constructor(deps: {
    javaManager?: JavaManager;
    downloads?: RuntimeDownloadService;
    versionLists?: VersionListService;
    tasks?: TaskRunner;
    vanilla?: VanillaService;
    instances: InstanceReadPort;
    rootResolver: LauncherRootResolver;
    launchAdapters: LaunchAdapters;
    launcherRootPath: string;
    logInstalledMods?: typeof logInstalledMods;

    authServerUrl?: string;
    accountService?: AccountService;
    mirrorsService?: MirrorsService;
    statisticsService?: StatisticsService;
  }) {
    patchUndiciThrowOnError();
    this.javaManager = deps?.javaManager ?? new JavaManager();

    this.mirrorsService = deps?.mirrorsService;
    this.downloads = deps?.downloads ?? new RuntimeDownloadService(this.mirrorsService);

    this.versionLists = deps?.versionLists ?? new VersionListService(this.downloads);
    this.tasks = deps?.tasks ?? new TaskRunner(this.downloads);
    this.vanilla = deps?.vanilla ?? new VanillaService(this.downloads, this.tasks);
    this.instances = deps.instances;
    this.rootResolver = deps.rootResolver;
    this.launchAdapters = deps.launchAdapters;
    this.launcherRootPath = deps.launcherRootPath;
    this.logInstalledMods = deps?.logInstalledMods ?? logInstalledMods;

    this.authServerUrl = deps?.authServerUrl ?? 'http://127.0.0.1:25530';
    this.accountService = deps?.accountService;
    this.statisticsService = deps?.statisticsService;
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
    const { rootPath, instanceId, instancePath, record, effective } = await prepareLaunchContext({
      instances: this.instances,
      rootResolver: this.rootResolver,
      native: this.launchAdapters,
      launcherRootPath: this.launcherRootPath,
      options,
    });

    const {
      requestedVersion,
      ramGb,
      effectiveJavaPath,
      effectiveVmOptions,
      effectiveMcArgs,
      effectiveResolution,
      effectiveServer,
      minRamGb,
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

    const javaPath = await this.launchAdapters.resolveJavaPath({
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
      instancePath,
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
      await prefetchLegacyForgeRuntimeDeps({ instancePath, mcVersion, downloadProvider, onLog });
    }

    await this.logInstalledMods(rootPath, onLog, instancePath);

    const { destInjectorPath } = await ensureAuthInjector({
      rootPath,
      modpackPath: instancePath,
      downloadProvider,
      maxSockets,
      onLog,
    });

    let resolvedAuthServerUrl = this.authServerUrl;
    let accessToken: string;
    let gameProfile: { id: string; name: string };

    const activeAccount = await this.accountService?.ensureActiveAccountValid();

    if (activeAccount?.type === 'third-party' && activeAccount.authServerUrl) {
      resolvedAuthServerUrl = activeAccount.authServerUrl;
      accessToken = activeAccount.accessToken!;
      gameProfile = { id: activeAccount.id, name: activeAccount.name };
      onLog(`[AUTH] Using Third-Party Account: ${activeAccount.name} (${activeAccount.authServerUrl})`);
    } else {
      // Offline (either explicit account or fallback nickname)
      const nickname = activeAccount?.name ?? options.nickname;
      const offlineUser = createOfflineSession(nickname);
      accessToken = offlineUser.accessToken;
      gameProfile = offlineUser.selectedProfile;
      onLog(`[AUTH] Using Offline Account: ${nickname}`);
    }

    onLog(`[LAUNCH] Launching Minecraft ${launchVersion}...`);
    onLog(`[LAUNCH] Java: ${javaPath}`);
    onLog(`[LAUNCH] RAM: Max ${ramGb}GB${minRamGb ? `, Min ${minRamGb}GB` : ''}`);

    const proc = await this.launchAdapters.spawnMinecraft({
      requiredJava,
      effectiveVmOptions,
      onLog,
      onClose,
      onGameStart,
      launchOptions: {
        gamePath: instancePath,
        resourcePath: rootPath,
        javaPath,
        version: launchVersion,
        gameProfile: gameProfile,
        accessToken: accessToken,
        userType: 'legacy',
        properties: {},
        resolution: effectiveResolution,
        server: effectiveServer,
        minMemory: minRamGb ? minRamGb * 1024 : 1024,
        maxMemory: ramGb * 1024,
        extraMCArgs: effectiveMcArgs,
        ignorePatchDiscrepancies: true,
        ignoreInvalidMinecraftCertificates: true,
        yggdrasilAgent: {
          jar: destInjectorPath,
          server: resolvedAuthServerUrl,
        },
        launcherName: 'FriendLauncher',
        launcherBrand: 'FriendLauncher',
      },
    });



    // Record launch statistics
    if (this.statisticsService) {
      try {
        this.statisticsService.recordLaunch(instanceId, record.name);
      } catch (e) {
        console.error('Failed to record launch stats:', e);
      }
    }
    const startTime = Date.now();

    this.currentGameProcess = proc;
    proc.on('close', (code) => {
      this.currentGameProcess = null;

      // Record play time statistics
      if (this.statisticsService) {
        try {
          const duration = Date.now() - startTime;
          this.statisticsService.recordPlayTime(duration, instanceId);
        } catch (e) {
          console.error('Failed to record play time stats:', e);
        }
      }

      onClose(code ?? 0);
    });
  }

  /** Kills the running game process and its entire tree (Java + children). */
  public async killGameProcess(): Promise<void> {
    const proc = this.currentGameProcess;
    this.currentGameProcess = null;
    const pid = proc?.pid;
    if (!pid) return;
    return new Promise((resolve) => {
      kill(pid, 'SIGKILL', (err) => {
        if (err) {
          try {
            proc?.kill('SIGKILL');
          } catch {
            // ignore
          }
        }
        resolve();
      });
    });
  }
  /** Writes data to the game process stdin if available. */
  public writeToGameStdin(data: string): void {
    if (this.currentGameProcess && this.currentGameProcess.stdin) {
      this.currentGameProcess.stdin.write(data);
    }
  }
}
