import { randomUUID } from 'node:crypto';
import { ipcMain } from 'electron';
import {
  JAVA_RUNTIME_CHANNELS,
  type JavaRuntimeInstallationDto,
  type JavaRuntimeSelectRequest,
} from '../../../shared/contracts/javaRuntime';
import type { InstanceApplication } from '../../domains/instances/instanceApplication';
import type { LauncherRoot } from '../../domains/instances/instanceTypes';
import type { DetectedJava } from '../../services/java/javaScanner';

const MAX_INSTALLATIONS_PER_SCAN = 64;
const MAX_ROOT_REGISTRIES = 4;
const INSTALLATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

type AuthorizedInstallation = Readonly<{
  executable: string;
  dto: JavaRuntimeInstallationDto;
}>;

export type JavaRuntimeHandlerDependencies = Readonly<{
  application: InstanceApplication;
  /** Main owns this root authority; renderer input is never consulted. */
  getDefaultInstanceRoot(): Promise<LauncherRoot>;
  scanJava(): Promise<readonly DetectedJava[]>;
  createInstallationId?(): string;
}>;

/**
 * Keeps native Java executable details inside the main process. Each scan
 * replaces only the requesting root's entries, invalidating its stale IDs.
 */
class JavaInstallationRegistry {
  private readonly entriesByRoot = new Map<LauncherRoot, Map<string, AuthorizedInstallation>>();

  public replace(root: LauncherRoot, detections: readonly DetectedJava[], nextId: () => string): readonly JavaRuntimeInstallationDto[] {
    const entries = new Map<string, AuthorizedInstallation>();
    const installations: JavaRuntimeInstallationDto[] = [];

    for (const detection of detections) {
      if (installations.length >= MAX_INSTALLATIONS_PER_SCAN) break;
      if (!this.isUsable(detection)) continue;

      const id = nextId();
      if (!INSTALLATION_ID_PATTERN.test(id) || entries.has(id)) continue;
      const dto: JavaRuntimeInstallationDto = {
        id,
        version: detection.version,
        majorVersion: detection.majorVersion,
        ...(detection.arch ? { arch: detection.arch } : {}),
      };
      entries.set(id, { executable: detection.path, dto });
      installations.push(dto);
    }

    if (this.entriesByRoot.has(root)) {
      this.entriesByRoot.delete(root);
    } else if (this.entriesByRoot.size >= MAX_ROOT_REGISTRIES) {
      const oldestRoot = this.entriesByRoot.keys().next().value;
      if (oldestRoot !== undefined) this.entriesByRoot.delete(oldestRoot);
    }
    this.entriesByRoot.set(root, entries);
    return installations;
  }

  public resolve(root: LauncherRoot, id: string): AuthorizedInstallation | undefined {
    return this.entriesByRoot.get(root)?.get(id);
  }

  private isUsable(detection: DetectedJava): boolean {
    return detection.valid
      && typeof detection.path === 'string'
      && detection.path.length > 0
      && typeof detection.version === 'string'
      && detection.version.length > 0
      && Number.isInteger(detection.majorVersion)
      && detection.majorVersion > 0;
  }
}

function unavailable(): Error {
  return new Error('Java runtime selection is unavailable. Scan again.');
}

function validateSelectionRequest(value: unknown): JavaRuntimeSelectRequest {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Java runtime selection request must be an object.');
  }

  const record = value as Record<string, unknown>;
  if (Object.keys(record).some((key) => key !== 'installationId')) {
    throw new Error('Java runtime selection request contains unsupported fields.');
  }

  if (typeof record.installationId !== 'string' || !INSTALLATION_ID_PATTERN.test(record.installationId)) {
    throw new Error('Java runtime selection request installation ID is invalid.');
  }

  return { installationId: record.installationId };
}

/** Registers the path-free Java scan and canonical selection IPC boundary. */
export function registerJavaRuntimeHandlers(deps: JavaRuntimeHandlerDependencies): void {
  const registry = new JavaInstallationRegistry();
  const nextId = deps.createInstallationId ?? randomUUID;

  ipcMain.removeHandler(JAVA_RUNTIME_CHANNELS.scan);
  ipcMain.handle(JAVA_RUNTIME_CHANNELS.scan, async (_event, request: unknown) => {
    if (typeof request !== 'object' || request === null || Array.isArray(request) || Object.keys(request).length !== 0) {
      throw new Error('Java runtime scan request must be empty.');
    }

    try {
      const root = await deps.getDefaultInstanceRoot();
      return registry.replace(root, await deps.scanJava(), nextId);
    } catch {
      throw new Error('Java runtime scan is unavailable.');
    }
  });

  ipcMain.removeHandler(JAVA_RUNTIME_CHANNELS.select);
  ipcMain.handle(JAVA_RUNTIME_CHANNELS.select, async (_event, request: unknown) => {
    const parsed = validateSelectionRequest(request);
    try {
      const root = await deps.getDefaultInstanceRoot();
      const installation = registry.resolve(root, parsed.installationId);
      if (!installation) throw unavailable();
      const state = await deps.application.read(root);
      if (state.status !== 'ready' || state.snapshot.selectedId === null) throw unavailable();
      const record = state.snapshot.records.find((candidate) => candidate.id === state.snapshot.selectedId);
      if (!record) throw unavailable();

      await deps.application.execute(root, {
        version: 1,
        type: 'save-config',
        id: record.id,
        config: {
          ...record.config,
          java: { executable: installation.executable },
        },
      });
      return { status: 'selected' as const };
    } catch (error) {
      if (error instanceof Error && error.message === unavailable().message) throw error;
      throw new Error('Java runtime selection is unavailable.');
    }
  });
}
