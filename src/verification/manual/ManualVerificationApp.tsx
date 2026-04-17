import { useCallback, useMemo, useState } from 'react';
import { ManualVerificationNavigation, ManualVerificationScenarios } from './scenarios';
import { type ManualVerificationView, getManualVerificationView } from './views';

type VerificationStatus = {
  view: ManualVerificationView;
  ready: boolean;
  step: 'mounting' | 'rendered';
  message: string;
};

export function ManualVerificationApp() {
  const params = new URLSearchParams(window.location.search);
  const view = getManualVerificationView(params.get('view'));

  const [status, setStatus] = useState<VerificationStatus>({
    view,
    ready: view === 'overview',
    step: view === 'overview' ? 'rendered' : 'mounting',
    message: view === 'overview' ? 'Manual verification hub rendered.' : 'Mounting scenario...',
  });

  const markReady = useCallback((message: string) => {
    setStatus({
      view,
      ready: true,
      step: 'rendered',
      message,
    });
  }, [view]);

  const statusJson = useMemo(() => JSON.stringify(status), [status]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-6">
        <header className="surface-panel rounded-3xl p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="kicker-label">Milestone v0.4.0</div>
              <h1 className="text-3xl font-black tracking-tight text-foreground">FriendLauncher Manual Verification</h1>
              <p className="max-w-3xl text-sm leading-6 text-secondary">
                Stable browser entry for milestone walkthroughs. Each view mounts real launcher components on deterministic fixture data so live screenshots and DOM dumps stay reusable beyond one phase.
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

        <main className="flex-1">
          <ManualVerificationScenarios view={view} onReady={markReady} />
        </main>

        <pre id="verification-status" className="hidden">
          {statusJson}
        </pre>
      </div>
    </div>
  );
}
