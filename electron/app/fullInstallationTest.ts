import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { DownloadProviderId } from '../services/mirrors/providers';
import type { DownloadProvider } from '../services/mirrors/providers';
import { RuntimeDownloadService } from '../services/runtime/downloadService';
import { VersionListService } from '../services/versions/versionListService';
import { TaskRunner } from '../services/runtime/taskRunner';
import { VanillaService } from '../services/runtime/vanillaService';
import { JavaManager } from '../services/java/provisioning';
import { createDispatcher, resolveDownloadConcurrency } from '../services/runtime/http';
import { DefaultRangePolicy } from '@xmcl/file-transfer';
import type { TestSummary, ModLoaderType } from './tests/types';
import { nowIsoCompact, createFileLogger } from './tests/utils';
import { installVanillaVersion } from './tests/vanillaInstaller';
import { installModLoaderVersion } from './tests/modLoaderInstaller';
import { discoverVersions } from './tests/versionDiscovery';
import { saveSummary, logFinalSummary } from './tests/testReporter';

async function runVanillaStage(params: {
  vanillaVersions: string[];
  rootPath: string;
  vanilla: VanillaService;
  downloadProvider: DownloadProvider;
  downloadOptions: Record<string, unknown>;
  summary: TestSummary;
  jsonPath: string;
  onLog: (line: string) => void;
}): Promise<Set<string>> {
  const { vanillaVersions, rootPath, vanilla, downloadProvider, downloadOptions, summary, jsonPath, onLog } = params;

  onLog('═══════════════════════════════════════════════════════════');
  onLog(`[FullTest] STAGE 1: Installing ${vanillaVersions.length} vanilla versions...`);
  onLog('═══════════════════════════════════════════════════════════');

  for (const mcVersion of vanillaVersions) {
    onLog(`[Vanilla] Processing ${mcVersion}...`);
    const result = await installVanillaVersion({
      mcVersion,
      rootPath,
      vanilla,
      downloadProvider,
      downloadOptions,
      onLog,
    });

    summary.stages.vanilla.results.push(result);
    if (result.ok) {
      summary.stages.vanilla.okCount++;
    } else {
      summary.stages.vanilla.failCount++;
    }
    saveSummary(jsonPath, summary);
  }

  onLog('═══════════════════════════════════════════════════════════');
  onLog(`[FullTest] STAGE 1 COMPLETE: ${summary.stages.vanilla.okCount}/${summary.stages.vanilla.total} vanilla versions installed`);
  onLog('═══════════════════════════════════════════════════════════');

  // Filter to only versions where vanilla was successfully installed
  const installedVanillaVersions = new Set(
    summary.stages.vanilla.results.filter((r) => r.ok).map((r) => r.mcVersion)
  );
  onLog(`[FullTest] Successfully installed vanilla for ${installedVanillaVersions.size} versions`);

  return installedVanillaVersions;
}

async function runModLoaderStage(params: {
  modLoader: ModLoaderType;
  modLoaderVersions: string[];
  installedVanillaVersions: Set<string>;
  rootPath: string;
  instancePathPrefix: string;
  javaManager: JavaManager;
  downloads: RuntimeDownloadService;
  tasks: TaskRunner;
  providerId: DownloadProviderId;
  summary: TestSummary;
  jsonPath: string;
  onLog: (line: string) => void;
}): Promise<void> {
  const {
    modLoader,
    modLoaderVersions,
    installedVanillaVersions,
    rootPath,
    instancePathPrefix,
    javaManager,
    downloads,
    tasks,
    providerId,
    summary,
    jsonPath,
    onLog,
  } = params;

  const stageName = modLoader.charAt(0).toUpperCase() + modLoader.slice(1);
  const stageNumber = modLoader === 'fabric' ? 2 : modLoader === 'neoforge' ? 3 : 4;

  onLog('═══════════════════════════════════════════════════════════');
  onLog(`[FullTest] STAGE ${stageNumber}: Installing ${modLoaderVersions.length} ${stageName} versions...`);
  onLog('═══════════════════════════════════════════════════════════');

  for (const mcVersion of modLoaderVersions) {
    if (!installedVanillaVersions.has(mcVersion)) {
      onLog(`[${stageName}] Skipping ${mcVersion} (vanilla not installed or failed)`);
      continue;
    }

    onLog(`[${stageName}] Processing ${mcVersion}...`);
    const instancePath = path.join(rootPath, 'instances', `${instancePathPrefix}-${mcVersion}-${modLoader}`);
    fs.mkdirSync(instancePath, { recursive: true });
    fs.mkdirSync(path.join(instancePath, 'mods'), { recursive: true });

    const result = await installModLoaderVersion({
      mcVersion,
      modLoader,
      rootPath,
      instancePath,
      javaManager,
      downloads,
      tasks,
      providerId,
      onLog,
    });

    const stageKey = modLoader as keyof typeof summary.stages;
    summary.stages[stageKey].results.push(result);
    if (result.ok) {
      summary.stages[stageKey].okCount++;
    } else {
      summary.stages[stageKey].failCount++;
    }
    saveSummary(jsonPath, summary);
  }

  onLog('═══════════════════════════════════════════════════════════');
  onLog(
    `[FullTest] STAGE ${stageNumber} COMPLETE: ${summary.stages[modLoader as keyof typeof summary.stages].okCount}/${summary.stages[modLoader as keyof typeof summary.stages].total} ${stageName} versions installed`
  );
  onLog('═══════════════════════════════════════════════════════════');
}

function parseEnabledStages(stageRaw?: string): Set<string> {
  if (!stageRaw) {
    // Default: all stages
    return new Set(['vanilla', 'fabric', 'neoforge', 'forge']);
  }
  const stage = stageRaw.trim().toLowerCase();
  const validStages = ['vanilla', 'fabric', 'neoforge', 'forge'];
  
  if (!validStages.includes(stage)) {
    // Invalid stage, default to all
    return new Set(['vanilla', 'fabric', 'neoforge', 'forge']);
  }
  
  // Single stage selected
  // Modloader stages require vanilla, so include it automatically
  if (stage === 'fabric' || stage === 'neoforge' || stage === 'forge') {
    return new Set(['vanilla', stage]);
  }
  
  return new Set([stage]);
}

export interface TestConfig {
  stage?: string | null;
  provider?: string | null;
  limit?: string | null;
  only?: string | null;
}

export async function runFullInstallationTest(config?: TestConfig): Promise<number> {
  const rootPath = path.join(app.getPath('userData'), 'minecraft_data');
  const providerId = (config?.provider?.trim() as DownloadProviderId | undefined) || 'auto';
  const limitRaw = config?.limit?.trim();
  const limit = limitRaw ? Math.max(1, Number.parseInt(limitRaw, 10)) : null;
  const onlyRaw = config?.only?.trim();
  const enabledStages = parseEnabledStages(config?.stage?.trim());

  const stamp = nowIsoCompact();
  const outDir = path.join(app.getPath('userData'), 'logs', 'full-installation');
  const logPath = path.join(outDir, `full-installation-${stamp}.log`);
  const jsonPath = path.join(outDir, `full-installation-${stamp}.json`);
  const { log } = createFileLogger(logPath);

  const stageList = Array.from(enabledStages).join(', ');
  log(`[FullTest] Starting comprehensive installation test (staged approach)`);
  log(`[FullTest] rootPath=${rootPath}`);
  log(`[FullTest] providerId=${providerId}`);
  if (limit) log(`[FullTest] limit=${limit}`);
  if (onlyRaw) log(`[FullTest] only=${onlyRaw}`);
  log(`[FullTest] stages=${stageList}`);
  log(`[FullTest] Logs: ${logPath}`);
  log(`[FullTest] JSON: ${jsonPath}`);

  const downloads = new RuntimeDownloadService();
  const versionLists = new VersionListService(downloads);
  const tasks = new TaskRunner(downloads);
  const vanilla = new VanillaService(downloads, tasks);
  const javaManager = new JavaManager();

  // Discover Minecraft versions (only what's needed based on enabled stages)
  log(`[FullTest] Stage 0: Discovering Minecraft versions...`);

  const discovered = await discoverVersions({
    versionLists,
    providerId,
    enabledStages,
    onLog: log,
  });

  // Determine which vanilla versions to install
  let vanillaVersions: string[] = [];
  const onlyVanillaStage = enabledStages.has('vanilla') && enabledStages.size === 1;
  const modloaderStages = ['fabric', 'neoforge', 'forge'];
  const modloaderStagesCount = modloaderStages.filter((s) => enabledStages.has(s)).length;
  const vanillaWasExplicitlySelected = config?.stage?.trim().toLowerCase() === 'vanilla';
  
  if (onlyVanillaStage) {
    // If only vanilla is explicitly selected, use all release versions
    vanillaVersions = discovered.allReleaseVersions;
  } else if (vanillaWasExplicitlySelected && modloaderStagesCount > 0) {
    // If vanilla was explicitly selected together with modloaders, use all release versions
    vanillaVersions = discovered.allReleaseVersions;
  } else if (modloaderStagesCount > 0) {
    // If only modloader stages (vanilla auto-included), use only modloader-supported versions
    const modloaderVersions = new Set<string>();
    if (enabledStages.has('fabric') && discovered.fabricVersions.length > 0) {
      discovered.fabricVersions.forEach((v) => modloaderVersions.add(v));
    }
    if (enabledStages.has('neoforge') && discovered.neoforgeVersions.length > 0) {
      discovered.neoforgeVersions.forEach((v) => modloaderVersions.add(v));
    }
    if (enabledStages.has('forge') && discovered.forgeVersions.length > 0) {
      discovered.forgeVersions.forEach((v) => modloaderVersions.add(v));
    }
    vanillaVersions = Array.from(modloaderVersions).sort();
    log(`[FullTest] Installing vanilla only for modloader-supported versions: ${vanillaVersions.length} versions`);
  } else {
    // Fallback: use all release versions
    vanillaVersions = discovered.allReleaseVersions;
  }

  if (onlyRaw) {
    const wanted = onlyRaw.split(/[,\s]+/g).map((s) => s.trim()).filter(Boolean);
    const wantedSet = new Set(wanted);
    vanillaVersions = vanillaVersions.filter((v) => wantedSet.has(v));
    log(`[FullTest] Filtered to ${vanillaVersions.length} versions from --only option`);
  }

  if (limit) {
    vanillaVersions = vanillaVersions.slice(0, limit);
    log(`[FullTest] Limited to first ${limit} versions`);
  }

  log(`[FullTest] Total unique versions to install: ${vanillaVersions.length}`);

  // Initialize summary
  const summary: TestSummary = {
    ok: false,
    startedAt: new Date().toISOString(),
    providerId,
    rootPath,
    stages: {
      vanilla: { total: vanillaVersions.length, okCount: 0, failCount: 0, results: [] },
      fabric: { total: discovered.fabricVersions.length, okCount: 0, failCount: 0, results: [] },
      neoforge: { total: discovered.neoforgeVersions.length, okCount: 0, failCount: 0, results: [] },
      forge: { total: discovered.forgeVersions.length, okCount: 0, failCount: 0, results: [] },
    },
  };
  saveSummary(jsonPath, summary);

  const downloadProvider = downloads.getDownloadProvider(providerId);
  await downloads.warmupMirrors(downloadProvider);
  const maxSockets = 64;
  const dispatcher = createDispatcher(maxSockets);
  const rangePolicy = new DefaultRangePolicy(5 * 1024 * 1024, 4);
  const concurrency = resolveDownloadConcurrency(true, undefined);
  const downloadOptions = downloads.buildInstallerOptions(downloadProvider, dispatcher, rangePolicy, concurrency);

  // Stage 1: Install all vanilla versions (required for modloader stages)
  let installedVanillaVersions = new Set<string>();
  if (enabledStages.has('vanilla')) {
    installedVanillaVersions = await runVanillaStage({
      vanillaVersions,
      rootPath,
      vanilla,
      downloadProvider,
      downloadOptions,
      summary,
      jsonPath,
      onLog: log,
    });
  } else {
    // Vanilla is automatically included for modloader stages, so this shouldn't happen
    // But if it does, log a warning
    const needsVanilla = enabledStages.has('fabric') || enabledStages.has('neoforge') || enabledStages.has('forge');
    if (needsVanilla) {
      log(`[FullTest] WARNING: Modloader stages require vanilla, but vanilla stage was skipped.`);
      log(`[FullTest] This should not happen - vanilla is auto-included for modloader stages.`);
    }
  }

  // Stage 2: Install all Fabric versions
  if (enabledStages.has('fabric')) {
    await runModLoaderStage({
      modLoader: 'fabric',
      modLoaderVersions: discovered.fabricVersions,
      installedVanillaVersions,
      rootPath,
      instancePathPrefix: 'test',
      javaManager,
      downloads,
      tasks,
      providerId,
      summary,
      jsonPath,
      onLog: log,
    });
  }

  // Stage 3: Install all NeoForge versions
  if (enabledStages.has('neoforge')) {
    await runModLoaderStage({
      modLoader: 'neoforge',
      modLoaderVersions: discovered.neoforgeVersions,
      installedVanillaVersions,
      rootPath,
      instancePathPrefix: 'test',
      javaManager,
      downloads,
      tasks,
      providerId,
      summary,
      jsonPath,
      onLog: log,
    });
  }

  // Stage 4: Install all Forge versions
  if (enabledStages.has('forge')) {
    await runModLoaderStage({
      modLoader: 'forge',
      modLoaderVersions: discovered.forgeVersions,
      installedVanillaVersions,
      rootPath,
      instancePathPrefix: 'test',
      javaManager,
      downloads,
      tasks,
      providerId,
      summary,
      jsonPath,
      onLog: log,
    });
  }

  // Final summary
  const totalFail =
    summary.stages.vanilla.failCount +
    summary.stages.fabric.failCount +
    summary.stages.neoforge.failCount +
    summary.stages.forge.failCount;

  summary.ok = totalFail === 0;
  saveSummary(jsonPath, summary);

  logFinalSummary({
    summary,
    logPath,
    jsonPath,
    onLog: log,
  });

  return totalFail === 0 ? 0 : 2;
}
