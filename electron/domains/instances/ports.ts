import type {
  CanonicalInstanceSnapshot,
  InstanceControlPlaneRead,
  LauncherRoot,
} from './instanceTypes';

/** The sole edge adapter allowed to turn untrusted root input into authority. */
export interface LauncherRootResolver {
  resolve(input: unknown): Promise<LauncherRoot>;
}

/** Persistence is root-capability scoped and owns no filesystem details in the domain. */
export interface InstanceControlPlanePort {
  read(root: LauncherRoot): Promise<InstanceControlPlaneRead>;
  commit(root: LauncherRoot, snapshot: CanonicalInstanceSnapshot): Promise<void>;
}

/** Read-only canonical state for main-process consumers such as launcher policy. */
export interface InstanceReadPort {
  read(root: LauncherRoot): Promise<InstanceControlPlaneRead>;
}

export interface InstanceClockPort {
  now(): string;
}

export interface InstanceIdPort {
  next(): string;
}

export interface InstanceApplicationPorts {
  controlPlane: InstanceControlPlanePort;
  clock: InstanceClockPort;
  ids: InstanceIdPort;
}
