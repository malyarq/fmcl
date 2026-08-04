/**
 * Renderer-safe Java runtime transport.
 *
 * Installation IDs are opaque, short-lived main-process capabilities. Native
 * executable details never cross this boundary.
 */
export const JAVA_RUNTIME_CHANNELS = {
  scan: 'javaRuntime:scan',
  select: 'javaRuntime:select',
} as const;

export type JavaRuntimeChannel = (typeof JAVA_RUNTIME_CHANNELS)[keyof typeof JAVA_RUNTIME_CHANNELS];

export type JavaRuntimeInstallationDto = Readonly<{
  id: string;
  version: string;
  majorVersion: number;
  arch?: string;
}>;

export type JavaRuntimeSelectRequest = Readonly<{
  installationId: string;
}>;

export type JavaRuntimeSelectResponse = Readonly<{
  status: 'selected';
}>;

/** Dedicated typed preload capability for Java discovery and selection. */
export type JavaRuntimeAPI = Readonly<{
  scan(): Promise<readonly JavaRuntimeInstallationDto[]>;
  select(request: JavaRuntimeSelectRequest): Promise<JavaRuntimeSelectResponse>;
}>;
