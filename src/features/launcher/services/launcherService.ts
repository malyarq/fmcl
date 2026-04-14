export type LauncherProgressEvent = { type: string; task: number; total: number };

export type LaunchStage = 'idle' | 'preparing' | 'downloading' | 'launching' | 'waiting' | 'running' | 'failed';

export interface LaunchStatusSnapshot {
  stage: LaunchStage;
  title: string;
  detail: string;
}

const PROGRESS_TYPES = new Set(['assets', 'natives', 'classes', 'Forge', 'Fabric', 'NeoForge', 'OptiFine', 'download']);

const LOG_PREFIX_PATTERN = /^\[[^\]]+\]\s*/;
const DIVIDER_PATTERN = /^═+$/;

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function isTrackableProgressType(type: string) {
  return PROGRESS_TYPES.has(type) || type.startsWith('Java');
}

export function toPercent(task: number, total: number) {
  if (!Number.isFinite(task) || !Number.isFinite(total) || total <= 0) return 0;
  return (task / total) * 100;
}

export function isForceRestartAllowed(stage: LaunchStage) {
  return stage === 'waiting' || stage === 'running';
}

export function getLaunchActionLabel(stage: LaunchStage, t: (key: string) => string) {
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

export function getLaunchStageTitle(stage: LaunchStage, t: (key: string) => string) {
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

export function getProgressLabel(type: string, t: (key: string) => string) {
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

export function getProgressStatus(progress: LauncherProgressEvent, t: (key: string) => string): LaunchStatusSnapshot {
  const percent = Math.round(toPercent(progress.task, progress.total));
  return {
    stage: 'downloading',
    title: getLaunchStageTitle('downloading', t),
    detail: `${getProgressLabel(progress.type, t)} - ${percent}%`,
  };
}

function cleanLogLine(log: string) {
  return log.replace(LOG_PREFIX_PATTERN, '').trim();
}

function isDividerLog(log: string) {
  return DIVIDER_PATTERN.test(log.trim());
}

export function getLaunchStatusFromLog(log: string, t: (key: string) => string): LaunchStatusSnapshot | null {
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
      detail: translateWithFallback(t, 'status.running_detail', 'Minecraft is running. Live game logs will appear here.'),
    };
  }

  if (normalized.includes('[launch] launching minecraft')) {
    return {
      stage: 'launching',
      title: getLaunchStageTitle('launching', t),
      detail: translateWithFallback(t, 'status.launching_detail', 'Starting the Minecraft process.'),
    };
  }

  if (normalized.startsWith('[auth]')) {
    return {
      stage: 'launching',
      title: getLaunchStageTitle('launching', t),
      detail,
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
      detail,
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
      detail,
    };
  }

  return null;
}
