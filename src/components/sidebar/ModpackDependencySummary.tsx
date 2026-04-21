import { cn } from '../../utils/cn';
import {
  getModpackRuntimeStatusLabel,
  type ModpackRuntimeSummaryStatus,
} from '../../features/modpacks/hooks/useModpackRuntimeSummary';
import {
  getRuntimeDependencyWarningMessage,
  getModloaderDisplayLabel,
  type RuntimeDependencyState,
} from './modpackRuntimeDependencies';

function translateWithFallback(t: (key: string) => string, key: string, fallback: string) {
  const translated = t(key);
  return translated === key ? fallback : translated;
}

export function ModpackDependencySummary(props: {
  runtime: RuntimeDependencyState;
  t: (key: string) => string;
  className?: string;
  status?: ModpackRuntimeSummaryStatus;
}) {
  const { runtime, t, className, status } = props;
  const runtimeWarnings = runtime.warnings.map((warning) => getRuntimeDependencyWarningMessage(warning, t));
  const resolvedStatus =
    status ?? (!runtime.minecraftVersion ? 'error' : runtimeWarnings.length > 0 ? 'warning' : 'healthy');
  const statusToneClasses =
    resolvedStatus === 'healthy'
      ? 'border-border/70 bg-background/75 text-foreground'
      : resolvedStatus === 'warning'
        ? 'border-amber-500/35 bg-amber-500/12 text-amber-950 dark:text-amber-100'
        : 'border-red-500/35 bg-red-500/12 text-red-900 dark:text-red-100';

  return (
    <div className={cn('surface-muted rounded-2xl border border-border/70 p-4', className)} data-testid="modpack-dependency-summary">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
          {translateWithFallback(t, 'modpacks.runtime_dependencies', 'Runtime dependencies')}
        </p>
        <div className="flex items-center gap-2">
          <span
            className={cn('rounded-full border px-2.5 py-1 text-xs font-semibold', statusToneClasses)}
            data-testid="modpack-dependency-status"
            data-tone={resolvedStatus}
          >
            {getModpackRuntimeStatusLabel(resolvedStatus, t)}
          </span>
          <span
            className="rounded-full border border-border/70 bg-background/75 px-2.5 py-1 text-xs font-semibold text-foreground"
            data-testid="modpack-dependency-count"
          >
            {runtime.dependencyCount}
          </span>
        </div>
      </div>
      <dl className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-secondary">
            {translateWithFallback(t, 'modpacks.minecraft_version', 'Minecraft Version')}
          </dt>
          <dd className="text-sm font-semibold text-foreground">
            {runtime.minecraftVersion}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-xs font-medium uppercase tracking-wide text-secondary">
            {translateWithFallback(t, 'modpacks.loader', 'Modloader')}
          </dt>
          <dd className="text-sm font-semibold text-foreground">
            {getModloaderDisplayLabel(runtime.modLoader, t)}
          </dd>
        </div>
        {runtime.modLoader ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-secondary">
              {translateWithFallback(t, 'modpacks.loader_version', 'Modloader Version')}
            </dt>
            <dd className="text-sm font-semibold text-foreground">
              {runtime.modLoader.version ?? translateWithFallback(t, 'modpacks.dep_unverified', 'Unverified')}
            </dd>
          </div>
        ) : null}
        {runtime.useOptiFine ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-secondary">OptiFine</dt>
            <dd className="text-sm font-semibold text-foreground">Enabled</dd>
          </div>
        ) : null}
      </dl>
      {runtimeWarnings.length > 0 ? (
        <div
          className="mt-4 space-y-2 rounded-2xl border border-amber-500/35 bg-amber-500/10 px-3 py-3 text-sm text-foreground"
          data-testid="modpack-dependency-warnings"
        >
          {runtimeWarnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
    </div>
  );
}
