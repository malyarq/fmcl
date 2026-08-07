export const SYSTEM_READINESS_CHANNELS = {
  check: 'systemReadiness:check',
} as const;

export type SystemReadinessCheckId = 'storage' | 'disk' | 'java' | 'network';
export type SystemReadinessStatus = 'ready' | 'info' | 'warning' | 'blocked';
export type SystemReadinessCode =
  | 'ready'
  | 'unwritable'
  | 'low-space'
  | 'automatic-download'
  | 'unreachable';

export type SystemReadinessCheck = Readonly<{
  id: SystemReadinessCheckId;
  status: SystemReadinessStatus;
  code: SystemReadinessCode;
}>;

export type SystemReadinessReport = Readonly<{
  overall: 'ready' | 'attention' | 'blocked';
  checks: readonly SystemReadinessCheck[];
}>;

export type SystemReadinessAPI = Readonly<{
  check(): Promise<SystemReadinessReport>;
}>;
