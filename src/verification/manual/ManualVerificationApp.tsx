import { Profiler, type ProfilerOnRenderCallback, useCallback, useMemo, useState } from 'react';
import { ManualVerificationNavigation, ManualVerificationScenarios } from './scenarios';
import { type ManualVerificationView, getManualVerificationView } from './views';
import { manualPerformanceProfilerRecorder } from './performanceProfiler';

type VerificationStatus = {
  view: ManualVerificationView;
  ready: boolean;
  step: 'mounting' | 'rendered';
  message: string;
};

export function ManualVerificationApp() {
  const params = new URLSearchParams(window.location.search);
  const view = getManualVerificationView(params.get('view'));
  const isViewportBoundProof = view === 'phase-41-surfaces-en' || view === 'phase-41-surfaces-ru';

  const [status, setStatus] = useState<VerificationStatus>({
    view,
    ready: view === 'overview',
    step: view === 'overview' ? 'rendered' : 'mounting',
    message: view === 'overview' ? 'Behavior-driven manual verification hub rendered.' : 'Mounting behavior verification scenario...',
  });

  const markReady = useCallback((message: string) => {
    setStatus({
      view,
      ready: true,
      step: 'rendered',
      message,
    });
  }, [view]);

  const onRender = useCallback<ProfilerOnRenderCallback>((_id, phase, actualDuration, baseDuration, startTime, commitTime) => {
    manualPerformanceProfilerRecorder.record({
      route: view,
      phase,
      actualDuration,
      baseDuration,
      startTime,
      commitTime,
    });
  }, [view]);

  const statusJson = useMemo(() => JSON.stringify(status), [status]);

  return (
    <div className={isViewportBoundProof ? 'h-screen overflow-hidden bg-background text-foreground' : 'min-h-screen bg-background text-foreground'}>
      <div className={isViewportBoundProof ? 'mx-auto flex h-full min-h-0 max-w-7xl flex-col gap-6 px-6 py-6' : 'mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-6'}>
        <header className="surface-panel rounded-3xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="kicker-label">Manual Verification Harness</div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">Burrow Manual Verification</h1>
              <p className="max-w-3xl text-sm leading-6 text-secondary">
                Behavior-driven browser entry for live launcher proof routes. Ready-state is granted only when observable route checks pass, so screenshot review, DOM capture, and manual signoff point at the same product evidence instead of static wording alone.
              </p>
            </div>
            <div className="surface-muted rounded-2xl px-4 py-3 text-sm">
              <div className="font-semibold text-foreground">Status</div>
              <div className="mt-1 text-secondary">{status.message}</div>
            </div>
          </div>
          <div className="mt-4">
            <ManualVerificationNavigation activeView={view} />
          </div>
        </header>

        <Profiler id="manual-verification-route" onRender={onRender}>
          <main className={isViewportBoundProof ? 'min-h-0 flex-1 overflow-hidden' : 'flex-1'}>
            <ManualVerificationScenarios view={view} onReady={markReady} />
          </main>
        </Profiler>

        <pre id="verification-status" className="hidden">
          {statusJson}
        </pre>
      </div>
    </div>
  );
}
