// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppOverlays } from '../useAppOverlays';

describe('useAppOverlays', () => {
  it('keeps settings and multiplayer mutually exclusive', () => {
    const { result } = renderHook(() => useAppOverlays());

    act(() => result.current.openSettings());
    expect(result.current.showSettings).toBe(true);
    expect(result.current.showMultiplayer).toBe(false);

    act(() => result.current.openMultiplayer());
    expect(result.current.showSettings).toBe(false);
    expect(result.current.showMultiplayer).toBe(true);

    act(() => result.current.closeSettings());
    expect(result.current.showMultiplayer).toBe(true);

    act(() => result.current.closeMultiplayer());
    expect(result.current.showSettings).toBe(false);
    expect(result.current.showMultiplayer).toBe(false);
  });
});
