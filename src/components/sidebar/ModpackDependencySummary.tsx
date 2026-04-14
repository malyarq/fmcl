import { cn } from '../../utils/cn';
import {
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
}) {
  const { runtime, t, className } = props;

  return (
    <div className={cn('surface-muted rounded-2xl border border-border/70 p-4', className)} data-testid="modpack-dependency-summary">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-secondary">
        {translateWithFallback(t, 'modpacks.runtime_dependencies', 'Runtime dependencies')}
      </p>
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
        {runtime.modLoader?.version ? (
          <div className="flex items-center justify-between gap-4">
            <dt className="text-xs font-medium uppercase tracking-wide text-secondary">
              {translateWithFallback(t, 'modpacks.loader_version', 'Modloader Version')}
            </dt>
            <dd className="text-sm font-semibold text-foreground">
              {runtime.modLoader.version}
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}
