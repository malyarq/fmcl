import type { CompositionShutdownReport } from './compositionRoot';

export type ApplicationShutdownReport = Readonly<{
  composition: CompositionShutdownReport;
  failures: readonly { owner: 'ipc' | 'auth-server' | 'tray'; message: string }[];
}>;

export class ApplicationLifecycle {
  private shutdownPromise?: Promise<ApplicationShutdownReport>;

  constructor(private readonly dependencies: {
    unregisterIpc(): void;
    shutdownComposition(): Promise<CompositionShutdownReport>;
    stopAuthServer(): Promise<void>;
    destroyTray(): void;
  }) {}

  public shutdown(): Promise<ApplicationShutdownReport> {
    if (!this.shutdownPromise) this.shutdownPromise = this.runShutdown();
    return this.shutdownPromise;
  }

  private async runShutdown(): Promise<ApplicationShutdownReport> {
    const failures: Array<ApplicationShutdownReport['failures'][number]> = [];
    try { this.dependencies.unregisterIpc(); }
    catch (error) { failures.push(failure('ipc', error)); }

    let composition: CompositionShutdownReport = { failures: [] };
    try { composition = await this.dependencies.shutdownComposition(); }
    catch (error) { composition = { failures: [{ owner: 'operations', message: safeMessage(error) }] }; }

    try { await this.dependencies.stopAuthServer(); }
    catch (error) { failures.push(failure('auth-server', error)); }
    try { this.dependencies.destroyTray(); }
    catch (error) { failures.push(failure('tray', error)); }
    return { composition, failures };
  }
}

function failure(owner: ApplicationShutdownReport['failures'][number]['owner'], error: unknown) {
  return { owner, message: safeMessage(error) } as const;
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 240) : 'Cleanup failed';
}

