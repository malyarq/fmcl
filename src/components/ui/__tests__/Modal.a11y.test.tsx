// @vitest-environment jsdom

import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Modal } from '../Modal';

function mockMatchMedia(matches = false) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('Modal accessibility', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    document.body.className = '';
  });

  it('renders an accessible dialog, traps focus, and restores focus on close', async () => {
    const Harness = () => {
      const [isOpen, setIsOpen] = useState(false);

      return (
        <div>
          <button type="button" onClick={() => setIsOpen(true)}>
            Open modal
          </button>
          <button type="button">Outside action</button>
          <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Settings dialog">
            <input autoFocus aria-label="Account name" />
            <button type="button">Save changes</button>
          </Modal>
        </div>
      );
    };

    render(<Harness />);

    const trigger = screen.getByRole('button', { name: 'Open modal' });
    const focusSpy = vi.spyOn(trigger, 'focus');
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = await screen.findByRole('dialog', { name: 'Settings dialog' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');

    const input = screen.getByRole('textbox', { name: 'Account name' });
    const save = screen.getByRole('button', { name: 'Save changes' });
    const close = screen.getByRole('button', { name: 'Close dialog' });

    await waitFor(() => {
      expect(document.activeElement).toBe(input);
    });

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(save);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(close);

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    await waitFor(() => {
      expect(focusSpy).toHaveBeenCalled();
    });
  });
});
