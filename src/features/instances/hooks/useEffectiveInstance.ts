import { useMemo } from 'react';
import { CLASSIC_MODPACK_ID } from '../../../../shared/constants';
import { useUIMode } from '../../../contexts/SettingsContext';
import type { InstanceQueryState, SelectedInstance } from '../InstanceQueryProvider';
import { useInstanceSnapshot, useSelectedInstance } from './useInstanceSelectors';

/** Resolves the launch/display instance without introducing classic shadow state. */
export function useEffectiveInstance(): InstanceQueryState<SelectedInstance> {
  const { uiMode } = useUIMode();
  const selected = useSelectedInstance();
  const classic = useInstanceSnapshot(uiMode === 'simple' ? CLASSIC_MODPACK_ID : null);

  return useMemo(() => {
    if (uiMode !== 'simple') return selected;
    if (classic.status !== 'ready') return classic;
    return {
      status: 'ready',
      data: { id: CLASSIC_MODPACK_ID, snapshot: classic.data },
    };
  }, [classic, selected, uiMode]);
}
