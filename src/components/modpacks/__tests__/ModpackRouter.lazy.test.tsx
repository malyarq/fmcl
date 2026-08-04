// @vitest-environment jsdom

import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import routerSource from '../ModpackRouter.tsx?raw';
import { ModpackRouter } from '../ModpackRouter';
import { DEFAULT_MODPACK_BROWSER_STATE } from '../../../features/modpacks/hooks/useModpackNavigation';
import { usePersistentModpackNavigation } from '../../../features/modpacks/navigation/ModpackNavigationContext';
import { ModpackNavigationProvider } from '../../../features/modpacks/navigation/ModpackNavigationProvider';

const browserModuleGate = vi.hoisted(() => {
  let releaseModule: () => void = () => undefined;
  const pendingModule = new Promise<void>((resolve) => {
    releaseModule = resolve;
  });

  return {
    pendingModule,
    releaseModule: () => releaseModule(),
  };
});

vi.mock('../ModpackBrowser', async () => {
  await browserModuleGate.pendingModule;
  return {
    ModpackBrowser: ({ initialState }: { initialState: typeof DEFAULT_MODPACK_BROWSER_STATE }) => (
      <div>{`Browser query: ${initialState.query}`}</div>
    ),
  };
});

vi.mock('../ModpackList', () => ({ ModpackList: () => <div>Modpack list</div> }));
vi.mock('../ModpackDetails', () => ({ ModpackDetails: () => <div>Modpack details</div> }));
vi.mock('../../../features/instances/hooks/useInstanceInvalidation', () => ({
  useInstanceInvalidation: () => ({ invalidateInstance: vi.fn(), invalidateInstances: vi.fn() }),
}));

function NavigationProbe() {
  const { view } = usePersistentModpackNavigation();
  return (
    <output data-testid="navigation-probe">
      {view.type === 'browser' ? `browser:${view.state.query}` : view.type}
    </output>
  );
}

describe('ModpackRouter lazy route boundary', () => {
  it('keeps controllers eager while rare route surfaces load behind one accessible boundary', () => {
    expect(routerSource).toMatch(/lazy\(\(\) => import\('\.\/ModpackBrowser'\)/);
    expect(routerSource).toMatch(/lazy\(\(\) => import\('\.\/ModpackCreationWizard'\)/);
    expect(routerSource).toMatch(/lazy\(\(\) => import\('\.\/AddModPage'\)/);
    expect(routerSource).toMatch(/<Suspense fallback=\{<ModpackRouteLoadingState \/>\}>/);
    expect(routerSource).toMatch(/role="status"/);
    expect(routerSource).not.toMatch(/import \{ ModpackBrowser \} from '\.\/ModpackBrowser'/);
    expect(routerSource).not.toMatch(/import \{ AddModPage \} from '\.\/AddModPage'/);
    expect(routerSource).toMatch(/usePersistentModpackNavigation\(\)/);
  });

  it('keeps the current browser view and provider lifetime while its surface chunk resolves', async () => {
    render(
      <ModpackNavigationProvider
        initialView={{
          type: 'browser',
          state: { ...DEFAULT_MODPACK_BROWSER_STATE, query: 'retained-query' },
        }}
      >
        <NavigationProbe />
        <ModpackRouter />
      </ModpackNavigationProvider>,
    );

    const navigationProbe = screen.getByTestId('navigation-probe');
    expect(navigationProbe.textContent).toBe('browser:retained-query');
    expect(screen.getAllByRole('status', { name: 'Loading' })).toHaveLength(1);

    await act(async () => browserModuleGate.releaseModule());

    expect(await screen.findByText('Browser query: retained-query')).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Loading' })).toBeNull();
    expect(screen.getByTestId('navigation-probe')).toBe(navigationProbe);
    expect(navigationProbe.textContent).toBe('browser:retained-query');
  });
});
