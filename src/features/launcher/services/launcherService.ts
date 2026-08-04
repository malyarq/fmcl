import { toDisplayErrorMessage } from '../../../utils/displayError';

export type LauncherProgressEvent = { type: string; task: number; total: number };
export type LoaderType = 'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'quilt';

export interface RecentLaunch {
  versionId: string;
  nickname: string;
  loader: Exclude<LoaderType, 'quilt'>;
  /** Resolved launch version used for the one-click repeat action. */
  launchVersion: string;
  timestamp: number;
}

const RECENT_LAUNCH_STORAGE_PREFIX = 'lastGame_';
const CLASSIC_RECENT_LAUNCH_LEGACY_KEY = 'simple_play_lastGame';

export function loadPlayerNickname(): string {
  try {
    return localStorage.getItem('nickname') || 'Player';
  } catch {
    return 'Player';
  }
}

export function savePlayerNickname(nickname: string): void {
  try {
    localStorage.setItem('nickname', nickname);
  } catch {
    // A disabled storage backend must not make launching unusable.
  }
}

function isRecentLaunch(value: unknown): value is RecentLaunch {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as RecentLaunch;
  return (
    typeof candidate.versionId === 'string'
    && typeof candidate.nickname === 'string'
    && typeof candidate.timestamp === 'number'
    && typeof candidate.launchVersion === 'string'
    && ['vanilla', 'forge', 'fabric', 'neoforge'].includes(candidate.loader)
  );
}

export function loadRecentLaunch(instanceId: string): RecentLaunch | null {
  try {
    let raw = localStorage.getItem(RECENT_LAUNCH_STORAGE_PREFIX + instanceId);
    if (!raw && instanceId === 'classic') {
      raw = localStorage.getItem(CLASSIC_RECENT_LAUNCH_LEGACY_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as unknown;
          if (parsed && typeof parsed === 'object' && typeof (parsed as RecentLaunch).timestamp === 'number') {
            saveRecentLaunch(instanceId, parsed as RecentLaunch);
            localStorage.removeItem(CLASSIC_RECENT_LAUNCH_LEGACY_KEY);
          }
        } catch {
          // Invalid compatibility data is ignored below.
        }
      }
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isRecentLaunch(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveRecentLaunch(instanceId: string, data: RecentLaunch): void {
  try {
    localStorage.setItem(RECENT_LAUNCH_STORAGE_PREFIX + instanceId, JSON.stringify(data));
  } catch {
    // Launch success must not be downgraded by optional history persistence.
  }
}

export function formatLastLaunch(timestamp: number, t: (key: string) => string): string {
  const launchedAt = new Date(timestamp);
  const now = new Date();
  const time = launchedAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (launchedAt.toDateString() === now.toDateString()) {
    return `${t('dashboard.last_launch_today') || 'Today'}, ${time}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (launchedAt.toDateString() === yesterday.toDateString()) {
    return `${t('dashboard.last_launch_yesterday') || 'Yesterday'}, ${time}`;
  }
  return launchedAt.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' });
}

export function isLoaderSupported(params: {
  loaderType: LoaderType;
  mcVersion: string;
  forgeVersions: string[];
  fabricVersions: string[];
  neoForgeVersions: string[];
}): boolean {
  const { loaderType, mcVersion, forgeVersions, fabricVersions, neoForgeVersions } = params;
  if (loaderType === 'forge') return forgeVersions.includes(mcVersion);
  if (loaderType === 'fabric') return fabricVersions.includes(mcVersion);
  if (loaderType === 'neoforge') return neoForgeVersions.includes(mcVersion);
  return true;
}

export function computeLaunchVersion(params: { loaderType: LoaderType; mcVersion: string }): string {
  const { loaderType, mcVersion } = params;
  if (loaderType === 'neoforge') return `${mcVersion}-NeoForge`;
  if (loaderType === 'forge') return `${mcVersion}-Forge`;
  if (loaderType === 'fabric') return `${mcVersion}-Fabric`;
  return mcVersion;
}

export function shouldDisableOptiFine(params: {
  useOptiFine: boolean;
  mcVersion: string;
  loaderType: LoaderType;
  optiFineVersions: string[];
}): boolean {
  const { useOptiFine, mcVersion, loaderType, optiFineVersions } = params;
  return useOptiFine && (loaderType !== 'forge' || !optiFineVersions.includes(mcVersion));
}

export type LaunchStage = 'idle' | 'preparing' | 'downloading' | 'launching' | 'waiting' | 'running' | 'failed';
export type LaunchStatusSource = 'lifecycle' | 'progress' | 'log';

export interface LaunchStatusSnapshot {
  stage: LaunchStage;
  title: string;
  detail: string;
}

const PROGRESS_TYPES = new Set(['assets', 'natives', 'classes', 'Forge', 'Fabric', 'NeoForge', 'OptiFine', 'download']);
const STAGE_RANK: Record<Exclude<LaunchStage, 'failed'>, number> = {
  idle: 0,
  preparing: 1,
  downloading: 2,
  launching: 3,
  waiting: 4,
  running: 5,
};

const LOG_PREFIX_PATTERN = /^\[[^\]]+\]\s*/;
const DIVIDER_PATTERN = /^═+$/;
type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function translateWithFallback(
  t: TranslateFn,
  key: string,
  fallback: string,
  params?: Record<string, string | number>,
) {
  const translated = t(key, params);
  return translated === key ? fallback : translated;
}

function getStageDetail(stage: Extract<LaunchStage, 'preparing' | 'downloading' | 'launching' | 'running'>, t: TranslateFn) {
  switch (stage) {
    case 'preparing':
      return translateWithFallback(t, 'status.preparing_detail', 'Checking runtime requirements and selected pack.');
    case 'downloading':
      return translateWithFallback(t, 'status.downloading_detail', 'Preparing game files and runtime dependencies.');
    case 'launching':
      return translateWithFallback(t, 'status.launching_detail', 'Starting the Minecraft process.');
    case 'running':
      return translateWithFallback(t, 'status.running_detail', 'Minecraft is running. Live game logs will appear here.');
  }
}

export function isTrackableProgressType(type: string) {
  return PROGRESS_TYPES.has(type) || type.startsWith('Java');
}

export function toPercent(task: number, total: number) {
  if (!Number.isFinite(task) || !Number.isFinite(total) || total <= 0) return 0;
  return (task / total) * 100;
}

export function getMeaningfulProgressPercent(progress: LauncherProgressEvent): number | null {
  const percent = toPercent(progress.task, progress.total);
  if (!Number.isFinite(percent)) return null;
  if (progress.total <= 0 || progress.task <= 0) return null;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function shouldApplyLaunchStatus(params: {
  currentStage: LaunchStage;
  nextStage: LaunchStage;
  source: LaunchStatusSource;
}) {
  const { currentStage, nextStage, source } = params;

  if (source !== 'log') {
    return true;
  }

  if (
    currentStage === nextStage &&
    (currentStage === 'preparing' || currentStage === 'downloading' || currentStage === 'launching')
  ) {
    return false;
  }

  if (currentStage === 'failed') {
    return nextStage === 'failed';
  }

  if (nextStage === 'failed') {
    return true;
  }

  if (currentStage === 'running') {
    return nextStage === 'running';
  }

  if (currentStage === 'waiting') {
    return nextStage === 'waiting' || nextStage === 'running';
  }

  if (nextStage === 'idle') {
    return currentStage === 'idle';
  }

  return STAGE_RANK[nextStage as Exclude<LaunchStage, 'failed'>] >= STAGE_RANK[currentStage as Exclude<LaunchStage, 'failed'>];
}

export function isForceRestartAllowed(stage: LaunchStage) {
  return stage === 'waiting' || stage === 'running';
}

export function getLaunchActionLabel(stage: LaunchStage, t: TranslateFn) {
  switch (stage) {
    case 'preparing':
      return translateWithFallback(t, 'status.preparing', 'Preparing launcher');
    case 'downloading':
      return translateWithFallback(t, 'status.downloading', 'Downloading');
    case 'launching':
      return translateWithFallback(t, 'status.launching', 'Launching game');
    case 'waiting':
      return translateWithFallback(t, 'status.waiting', 'Waiting for Minecraft');
    case 'running':
      return translateWithFallback(t, 'status.game_running', 'Game Running');
    default:
      return translateWithFallback(t, 'general.play', 'Play');
  }
}

export function getLaunchStageTitle(stage: LaunchStage, t: TranslateFn) {
  switch (stage) {
    case 'preparing':
      return translateWithFallback(t, 'status.preparing', 'Preparing launcher');
    case 'downloading':
      return translateWithFallback(t, 'status.downloading', 'Downloading');
    case 'launching':
      return translateWithFallback(t, 'status.launching', 'Launching game');
    case 'waiting':
      return translateWithFallback(t, 'status.waiting', 'Waiting for Minecraft');
    case 'running':
      return translateWithFallback(t, 'status.game_running', 'Game Running');
    case 'failed':
      return translateWithFallback(t, 'status.failed', 'Launch Failed');
    default:
      return '';
  }
}

export function getProgressLabel(type: string, t: TranslateFn) {
  if (type.startsWith('Java')) {
    return translateWithFallback(t, 'status.progress.java', 'Java runtime');
  }

  switch (type) {
    case 'assets':
      return translateWithFallback(t, 'status.progress.assets', 'Game assets');
    case 'natives':
      return translateWithFallback(t, 'status.progress.natives', 'Native libraries');
    case 'classes':
      return translateWithFallback(t, 'status.progress.classes', 'Game libraries');
    case 'Forge':
      return translateWithFallback(t, 'status.progress.forge', 'Forge');
    case 'Fabric':
      return translateWithFallback(t, 'status.progress.fabric', 'Fabric');
    case 'NeoForge':
      return translateWithFallback(t, 'status.progress.neoforge', 'NeoForge');
    case 'OptiFine':
      return translateWithFallback(t, 'status.progress.optifine', 'OptiFine');
    default:
      return translateWithFallback(t, 'status.progress.files', 'Game files');
  }
}

export function getProgressStatus(progress: LauncherProgressEvent, t: TranslateFn): LaunchStatusSnapshot {
  const percent = getMeaningfulProgressPercent(progress);
  const label = getProgressLabel(progress.type, t);
  return {
    stage: 'downloading',
    title: getLaunchStageTitle('downloading', t),
    detail: percent === null ? label : `${label} - ${percent}%`,
  };
}

function cleanLogLine(log: string) {
  return log.replace(LOG_PREFIX_PATTERN, '').trim();
}

function isDividerLog(log: string) {
  return DIVIDER_PATTERN.test(log.trim());
}

export function getLaunchStatusFromLog(log: string, t: TranslateFn): LaunchStatusSnapshot | null {
  if (!log || isDividerLog(log)) {
    return null;
  }

  const normalized = log.toLowerCase();
  const detail = cleanLogLine(log);

  if (normalized.startsWith('[fatal]') || normalized.startsWith('[error]')) {
    return {
      stage: 'failed',
      title: getLaunchStageTitle('failed', t),
      detail,
    };
  }

  if (normalized.startsWith('[game]')) {
    return {
      stage: 'running',
      title: getLaunchStageTitle('running', t),
      detail: getStageDetail('running', t),
    };
  }

  if (normalized.includes('[launch] launching minecraft')) {
    return {
      stage: 'launching',
      title: getLaunchStageTitle('launching', t),
      detail: getStageDetail('launching', t),
    };
  }

  if (normalized.startsWith('[auth]')) {
    return {
      stage: 'launching',
      title: getLaunchStageTitle('launching', t),
      detail: getStageDetail('launching', t),
    };
  }

  if (
    normalized.includes('resolving fabric loader version') ||
    normalized.includes('resolving neoforge version') ||
    normalized.includes('installing fabric') ||
    normalized.includes('installing dependencies') ||
    normalized.includes('ensuring minecraft') ||
    normalized.includes('preparing java') ||
    normalized.includes('[download]') ||
    normalized.includes('[assets]')
  ) {
    return {
      stage: 'downloading',
      title: getLaunchStageTitle('downloading', t),
      detail: getStageDetail('downloading', t),
    };
  }

  if (
    normalized.includes('starting launch sequence') ||
    normalized.includes('[version info]') ||
    normalized.startsWith('[java]') ||
    normalized.includes('using custom java') ||
    normalized.includes('java 21 ready') ||
    normalized.includes('java 17 ready') ||
    normalized.includes('legacy java 8')
  ) {
    return {
      stage: 'preparing',
      title: getLaunchStageTitle('preparing', t),
      detail: getStageDetail('preparing', t),
    };
  }

  return null;
}

export function getLauncherUnavailableDetail(t: TranslateFn) {
  return translateWithFallback(
    t,
    'status.launcher_unavailable',
    'Launcher API is unavailable. Reload the launcher shell and try again.',
  );
}

export function getLauncherSessionEndedLog(code: number, t: TranslateFn) {
  return code === 0
    ? translateWithFallback(t, 'status.session_ended', 'Minecraft session ended.')
    : translateWithFallback(
        t,
        'status.session_ended_with_code',
        'Minecraft session ended (exit code {{code}}).',
        { code },
      );
}

export function getVisibleLaunchFailureDetail(error: unknown, t: TranslateFn) {
  return toDisplayErrorMessage(
    error,
    translateWithFallback(t, 'status.failed_detail', 'Review the error and try launching again.'),
  );
}
