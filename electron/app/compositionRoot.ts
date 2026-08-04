import { randomUUID } from 'node:crypto';
import { AccountService } from '../services/account/accountService';
import { ContentManager } from '../services/content/contentManager';
import { InstanceApplication } from '../domains/instances/instanceApplication';
import type { LauncherRoot } from '../domains/instances/instanceTypes';
import { InstanceExporterService, type ArchiveExportContentPort } from '../services/instances/exporter/InstanceExporterService';
import { InstanceManifestManager } from '../services/instances/manifestManager';
import { getDefaultRootPath as getDefaultLauncherRootPath, getModpackDir } from '../services/instances/paths';
import { LauncherManager } from '../services/launcher/orchestrator';
import { MirrorsService } from '../services/mirrors/mirrorsService';
import { ModPlatformService } from '../services/mods/platform/modPlatformService';
import { InstanceModContentService } from '../services/mods/instanceModContentService';
import { ManifestContentInstaller } from '../services/mods/manifestContentInstaller';
import { javaScanner, type DetectedJava } from '../services/java/javaScanner';
import { getModpackInfoFromFile } from '../services/modpacks/importers';
import { NetworkManager } from '../services/network/networkManager';
import { NetworkService } from '../services/network/networkService';
import { createDeleteOperationAdapter } from '../services/operations/deleteOperation';
import { createDuplicateOperationAdapter } from '../services/operations/duplicateOperation';
import { createExportOperationAdapter } from '../services/operations/exportOperation';
import { createImportOperationAdapter } from '../services/operations/importOperation';
import { createShareImportOperationAdapter } from '../services/operations/shareImportOperation';
import { OperationRunner } from '../services/operations/operationRunner';
import { createLiveProviderInstallers, createProviderInstallOperationAdapters } from '../services/operations/providerInstallOperation';
import { createUpdateOperationAdapter } from '../services/operations/updateOperation';
import { ShareService, type ShareContentPort } from '../services/sharing/shareService';
import { StatisticsService } from '../services/stats/statisticsService';
import { exportToZip } from '../services/modpacks/exporters/zipExporter';
import { JsonControlPlaneStore } from '../infrastructure/instances/jsonControlPlaneStore';
import { createFilesystemInstanceAdapter } from '../infrastructure/instances/filesystemAdapter';
import { createLaunchAdapters, type LaunchAdapters } from '../infrastructure/instances/launchAdapters';
import { consumeArchiveReference } from '../security/archiveReferenceAuthorizations';
import type { ArchiveManifestMetadata } from '../../shared/contracts/archiveInspection';
import type { StorageMaintenanceCleanupResult, StorageMaintenanceStats } from '../../shared/contracts/storageMaintenance';

type StorageMaintenanceAdapter = Readonly<{
  getStats(): Promise<StorageMaintenanceStats>;
  cleanup(): Promise<StorageMaintenanceCleanupResult>;
}>;

export type HandlerComposition = Readonly<{
  application: InstanceApplication;
  getDefaultRootPath(): string;
  getDefaultInstanceRoot(): Promise<LauncherRoot>;
  scanJava(): Promise<readonly DetectedJava[]>;
  inspectArchive(filePath: string): Promise<ArchiveManifestMetadata>;
  launcher: LauncherManager;
  modPlatforms: ModPlatformService;
  instanceMods: InstanceModContentService;
  storageMaintenance: StorageMaintenanceAdapter;
  networkService: NetworkService;
  accountService: AccountService;
  mirrorsService: MirrorsService;
  statisticsService: StatisticsService;
  shareService: ShareService;
  operations: OperationRunner;
  consumeArchiveReference(ownerId: number, reference: string): string;
}>;

export type MainComposition = HandlerComposition & Readonly<{
  controlPlane: JsonControlPlaneStore;
  launchAdapters: LaunchAdapters;
  handlerDependencies: HandlerComposition;
  recoverOperations(): Promise<void>;
}>;

export type CompositionRootOptions = Readonly<{
  paths: Readonly<{ userDataPath: string; appDataPath: string }>;
  authServerUrl: string;
}>;

/**
 * The single main-process composition factory. Bootstrap is its only
 * production caller; consumers receive this graph rather than constructing
 * independent stores, runners, or application services.
 */
export function createCompositionRoot(options: CompositionRootOptions): MainComposition {
  if (!options.paths.userDataPath || !options.paths.appDataPath || !options.authServerUrl) {
    throw new Error('Composition root requires user-data, app-data, and auth-server dependencies');
  }

  const filesystem = createFilesystemInstanceAdapter();
  const launchAdapters = createLaunchAdapters();
  const controlPlane = new JsonControlPlaneStore((root) => root as unknown as string);
  const contentManager = new ContentManager(options.paths.userDataPath);
  const defaultRootPath = getDefaultLauncherRootPath();
  const manifestContentInstaller = new ManifestContentInstaller(contentManager);
  const storageMaintenance: StorageMaintenanceAdapter = {
    async getStats() {
      return await contentManager.getStats();
    },
    async cleanup() {
      return await contentManager.cleanup();
    },
  };
  const networkManager = new NetworkManager();
  const accountService = new AccountService(options.paths.userDataPath);
  const mirrorsService = new MirrorsService();
  const statisticsService = new StatisticsService();
  const networkService = new NetworkService(networkManager);
  const manifestManager = new InstanceManifestManager();
  const archiveContent: ArchiveExportContentPort = {
    async resolveRoot(rootPath) {
      return await filesystem.rootResolver.resolve(rootPath);
    },
    getInstanceDirectory(root, instanceId) {
      return getModpackDir(root as unknown as string, instanceId);
    },
  };
  const shareContent: ShareContentPort = {
    async resolveDefaultRoot(): Promise<LauncherRoot> {
      return await filesystem.rootResolver.resolve(defaultRootPath);
    },
    async loadManifest(root: LauncherRoot, instanceId: string) {
      return manifestManager.loadManifest(getModpackDir(root as unknown as string, instanceId));
    },
  };

  const application = new InstanceApplication({
    controlPlane,
    clock: { now: () => new Date().toISOString() },
    ids: { next: () => randomUUID() },
  });
  const instanceMods = new InstanceModContentService(defaultRootPath, application, filesystem.rootResolver);

  const initializedLauncher = new LauncherManager({
    instances: application,
    rootResolver: filesystem.rootResolver,
    launchAdapters,
    launcherRootPath: defaultRootPath,
    networkManager,
    authServerUrl: options.authServerUrl,
    accountService,
    mirrorsService,
    statisticsService,
  });
  const shareService = new ShareService(application, shareContent);
  const modPlatforms = new ModPlatformService(application, {
    async resolveRoot(rootPath) {
      return await filesystem.rootResolver.resolve(rootPath);
    },
    getModpackDir,
  });

  const instanceExporter = new InstanceExporterService(application, archiveContent);
  const operations = new OperationRunner([
    createDuplicateOperationAdapter(),
    createImportOperationAdapter(),
    createShareImportOperationAdapter({
      resolveShareCode: async (code) => await shareService.resolveShareCode(code),
      stageManifest: async (stagingRoot, destinationId, manifest) => {
        return await manifestContentInstaller.install(stagingRoot, destinationId, manifest, modPlatforms);
      },
    }),
    createUpdateOperationAdapter(),
    createDeleteOperationAdapter(),
    createExportOperationAdapter({
      platformService: modPlatforms,
      writeArchive: async ({ rootPath, instanceId, format, outputPath, options: exportOptions }) => {
        const hasInstanceExportOptions = exportOptions?.includeSaves !== undefined
          || exportOptions?.includeScreenshots !== undefined
          || exportOptions?.includeResourcePacks !== undefined
          || exportOptions?.includeShaders !== undefined
          || exportOptions?.includeMods !== undefined;
        if (format === 'multimc' || hasInstanceExportOptions) {
          await instanceExporter.exportInstance(rootPath, instanceId, format, outputPath, exportOptions);
          return;
        }
        await exportToZip(getModpackDir(rootPath, instanceId), outputPath);
      },
    }),
    ...createProviderInstallOperationAdapters({
      installers: createLiveProviderInstallers({
        curseforge: () => modPlatforms.getCurseForgeClient(),
        modrinth: () => modPlatforms.getModrinthClient(),
      }),
    }),
  ], {
    registryPath: options.paths.appDataPath,
    rootMutationCoordinator: {
      forRoot(rootPath) {
        const resolveRoot = async (): Promise<LauncherRoot> => await filesystem.rootResolver.resolve(rootPath);
        return {
          read: async () => await application.read(await resolveRoot()),
          prepare: async () => await controlPlane.prepareFromLegacy(await resolveRoot()),
          execute: async (command) => await application.execute(await resolveRoot(), command),
        };
      },
    },
  });

  const handlerDependencies: HandlerComposition = {
    application,
    getDefaultRootPath() {
      return defaultRootPath;
    },
    async getDefaultInstanceRoot(): Promise<LauncherRoot> {
      return await filesystem.rootResolver.resolve(defaultRootPath);
    },
    async scanJava(): Promise<readonly DetectedJava[]> {
      return await javaScanner.scanJava();
    },
    async inspectArchive(filePath: string): Promise<ArchiveManifestMetadata> {
      return await getModpackInfoFromFile(filePath);
    },
    launcher: initializedLauncher,
    modPlatforms,
    instanceMods,
    storageMaintenance,
    networkService,
    accountService,
    mirrorsService,
    statisticsService,
    shareService,
    operations,
    consumeArchiveReference,
  };

  return {
    ...handlerDependencies,
    controlPlane,
    launchAdapters,
    handlerDependencies,
    async recoverOperations(): Promise<void> {
      await operations.recoverRegistered(defaultRootPath);
    },
  };
}
