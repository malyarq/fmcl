import type { Task } from '@xmcl/task';
import type { TaskProgressData } from '@shared/types';
import { RuntimeDownloadService } from './downloadService';

/**
 * Executes XMCL tasks and maps progress/errors to our IPC-friendly progress model.
 * Extracted from `LauncherManager` during step 0.
 */
export class TaskRunner {
  private taskLogProgress = new Map<string, { bytes: number; percent: number }>();
  private taskLastSeen = new Map<string, { at: number; progress: number; total: number }>();
  private taskLastProgressChangeAt = new Map<string, number>();
  private taskLastLogAt = new Map<string, number>();

  constructor(private readonly downloads: RuntimeDownloadService) {}

  private normalizeTaskType(task: Task, overrideType?: string): string {
    if (overrideType) return overrideType;
    const label = `${task.path}.${task.name}`.toLowerCase();
    if (label.includes('asset')) return 'assets';
    if (label.includes('native')) return 'natives';
    if (label.includes('library')) return 'classes';
    if (label.includes('forge')) return 'Forge';
    if (label.includes('optifine')) return 'OptiFine';
    return 'download';
  }

  private formatTaskError(err: unknown): string[] {
    if (!err) return ['Unknown error'];
    const errObj = err && typeof err === 'object' ? (err as { errors?: unknown[] }) : null;
    if (errObj && 'errors' in errObj && Array.isArray(errObj.errors)) {
      return errObj.errors.map((e: unknown, index: number) => {
        const message = e instanceof Error ? e.message : String(e);
        return `(${index + 1}/${errObj.errors!.length}) ${message}`;
      });
    }
    if (err instanceof Error && err.cause) {
      const message = err.message ?? String(err);
      const causeMessage = err.cause instanceof Error ? err.cause.message : String(err.cause);
      return [`${message} (cause: ${causeMessage})`];
    }
    return [err instanceof Error ? err.message : String(err)];
  }

  private emitTaskProgress(task: Task, onProgress: (data: TaskProgressData) => void, overrideType?: string) {
    const total = typeof task.total === 'number' ? task.total : 0;
    const progress = typeof task.progress === 'number' ? task.progress : 0;
    if (total <= 0) return;
    onProgress({
      type: this.normalizeTaskType(task, overrideType),
      task: progress,
      total,
    });
  }

  private logDownloadProgress(task: Task, onLog: (data: string) => void) {
    const total = typeof task.total === 'number' ? task.total : 0;
    const progress = typeof task.progress === 'number' ? task.progress : 0;
    if (total <= 0) return;
    const key = task.path;
    const last = this.taskLogProgress.get(key) ?? { bytes: 0, percent: 0 };
    const deltaBytes = progress - last.bytes;
    const percent = Math.max(0, Math.min(100, Math.round((progress / total) * 100)));
    const deltaPercent = percent - last.percent;
    const lastLogAt = this.taskLastLogAt.get(key) ?? 0;
    const nowAt = Date.now();
    const timeSinceLog = nowAt - lastLogAt;
    const shouldLog = deltaBytes >= 512 * 1024 || deltaPercent >= 5 || progress === total || timeSinceLog >= 10_000;
    if (!shouldLog) return;
    this.taskLogProgress.set(key, { bytes: progress, percent });
    this.taskLastLogAt.set(key, nowAt);

    const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)}MB`;
    onLog(`[Download] ${task.path}: ${percent}% (${mb(progress)} / ${mb(total)})`);
  }

  public async runTaskWithProgress<T>(
    task: Task<T>,
    onProgress: (data: TaskProgressData) => void,
    onLog: (data: string) => void,
    label: string,
    overrideType?: string,
    onSubtaskStart?: (task: Task) => void
  ): Promise<T> {
    // Each run should be isolated; otherwise stale tasks from previous runs
    // can confuse watchdog reporting (and even cancellation decisions).
    this.taskLogProgress.clear();
    this.taskLastSeen.clear();
    this.taskLastProgressChangeAt.clear();
    this.taskLastLogAt.clear();

    const now = () => Date.now();
    const formatMs = (ms: number) => `${Math.max(0, Math.round(ms / 1000))}s`;

    const WATCHDOG_INTERVAL_MS = 5_000;
    const WARN_STALL_MS = 30_000;
    const CANCEL_STALL_MS = 120_000;

    let rootStartedAt = now();
    let watchdog: NodeJS.Timeout | null = null;

    const startWatchdog = () => {
      if (watchdog) return;
      watchdog = setInterval(() => {
        const ts = now();
        const rootKey = task.path;
        const rootLastProgressAt = this.taskLastProgressChangeAt.get(rootKey) ?? rootStartedAt;
        const rootIdle = ts - rootLastProgressAt;
        if (rootIdle < WARN_STALL_MS) return;

        // Find the "most stuck" known task (prefer deeper tasks).
        let stuckKey: string | null = null;
        let stuckIdle = 0;
        for (const [k] of this.taskLastSeen.entries()) {
          const lastProgressAt = this.taskLastProgressChangeAt.get(k) ?? rootStartedAt;
          const idle = ts - lastProgressAt;
          if (idle > stuckIdle) {
            stuckIdle = idle;
            stuckKey = k;
          }
        }

        const suffix = stuckKey ? ` (last update: ${formatMs(stuckIdle)} ago @ ${stuckKey})` : '';
        if (rootIdle >= CANCEL_STALL_MS) {
          onLog(`[Task] No byte progress for ${formatMs(rootIdle)} — cancelling stuck task${suffix}`);
          try {
            const cancellable = task as unknown as { cancel?: () => void; abort?: () => void };
            if (typeof cancellable.cancel === 'function') cancellable.cancel();
            else if (typeof cancellable.abort === 'function') cancellable.abort();
          } catch {
            // ignore
          }
          return;
        }

        // Soft warning: keep the user informed without failing immediately.
        onLog(`[Task] Still working... no byte progress for ${formatMs(rootIdle)}${suffix}`);
      }, WATCHDOG_INTERVAL_MS);
    };

    const stopWatchdog = () => {
      if (!watchdog) return;
      clearInterval(watchdog);
      watchdog = null;
    };

    return task.startAndWait({
      onStart: (t) => {
        // Record initial "heartbeat" for watchdog.
        const total = typeof t.total === 'number' ? t.total : 0;
        const progress = typeof t.progress === 'number' ? t.progress : 0;
        const ts = now();
        this.taskLastSeen.set(t.path, { at: ts, progress, total });
        // For watchdog: treat start as "progress moment" so we can warn/cancel if it never moves.
        this.taskLastProgressChangeAt.set(t.path, ts);
        startWatchdog();

        if (t.path === t.name) {
          onLog(label);
          return;
        }
        if (onSubtaskStart) onSubtaskStart(t);
        const depth = t.path.split('.').length;
        // XMCL sometimes nests work under 3 segments (e.g. install.version.json) without progress events.
        // Logging these starts improves transparency during "silent" CPU/network steps.
        if (depth <= 3) {
          onLog(`[Task] ${t.path} started`);
        }
      },
      onUpdate: (t) => {
        // Heartbeat even if progress does not change (some tasks don't expose totals early).
        const total = typeof t.total === 'number' ? t.total : 0;
        const progress = typeof t.progress === 'number' ? t.progress : 0;
        const key = t.path;
        const ts = now();
        const prev = this.taskLastSeen.get(key);
        this.taskLastSeen.set(key, { at: ts, progress, total });
        // Track real progress movement (bytes / units). Some tasks emit updates without changing progress.
        if (!prev || progress > prev.progress || total !== prev.total) {
          this.taskLastProgressChangeAt.set(key, ts);
        }
        // If we're in a deep stage but bytes don't move for long, we at least keep updating "at".
        // (Watchdog uses the most recent update timestamp per task path.)

        this.emitTaskProgress(t, onProgress, overrideType);
        const label = `${t.path}.${t.name}`.toLowerCase();
        const looksLikeNetwork =
          label.includes('download') || label.includes('library') || label.includes('asset') || label.includes('client') || label.includes('server');
        if (looksLikeNetwork) {
          this.logDownloadProgress(t, onLog);
        }
      },
      onFailed: (t, err) => {
        stopWatchdog();
        const messages = this.formatTaskError(err);
        if (t.path === t.name) {
          onLog(`[ERROR] ${label} failed: ${messages.join(' | ')}`);
        } else {
          onLog(`[ERROR] ${t.path} failed: ${messages.join(' | ')}`);
        }
        this.downloads.recordBadHosts(err, onLog);
      },
      onSucceed: (t) => {
        stopWatchdog();
        if (t.path === t.name) onLog(`${label} done.`);
      },
    });
  }
}

