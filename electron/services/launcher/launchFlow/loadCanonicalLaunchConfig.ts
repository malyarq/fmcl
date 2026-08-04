import type { CanonicalInstanceRecord, InstanceEditableConfig } from '../../../domains/instances/instanceTypes';

/** The launch policy consumes the immutable configuration already read from canonical state. */
export function loadCanonicalLaunchConfig(record: CanonicalInstanceRecord): InstanceEditableConfig {
  return record.config;
}
