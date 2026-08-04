// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTranslator } from '../../../../contexts/settings/i18n';
import { ResourcePacksTab } from '../ResourcePacksTab';

const listMock = vi.fn();

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: createTranslator('en'),
  }),
}));

vi.mock('../../../../contexts/ConfirmContext', () => ({
  useConfirm: () => ({
    confirm: vi.fn(),
  }),
}));

vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => ({
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    showToast: vi.fn(),
  }),
}));

vi.mock('../../../../services/ipc/resourcePacksIPC', () => ({
  resourcePacksIPC: {
    list: (...args: unknown[]) => listMock(...args),
    enable: vi.fn(),
    disable: vi.fn(),
    delete: vi.fn(),
    reorder: vi.fn(),
  },
}));

describe('ResourcePacksTab guided entry state', () => {
  beforeEach(() => {
    listMock.mockReset();
  });

  it('uses the guided-browser callback from the populated state action rail', async () => {
    const onAddResourcePack = vi.fn();

    listMock.mockResolvedValue([
      {
        fileName: 'faithful-64x.zip',
        name: 'Faithful 64x',
        description: 'Sharper textures.',
        iconUrl: null,
        isEnabled: true,
      },
    ]);

    render(
      <ResourcePacksTab
        instanceId="alpha"
        onAddResourcePack={onAddResourcePack}
      />,
    );

    expect(await screen.findByText('Faithful 64x')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /\+ add resource pack/i }));

    expect(onAddResourcePack).toHaveBeenCalledTimes(1);
  });

  it('keeps the same guided-browser action in the empty state', async () => {
    const onAddResourcePack = vi.fn();

    listMock.mockResolvedValue([]);

    render(
      <ResourcePacksTab
        instanceId="alpha"
        onAddResourcePack={onAddResourcePack}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /\+ add resource pack/i }));

    expect(onAddResourcePack).toHaveBeenCalledTimes(1);
  });
});
