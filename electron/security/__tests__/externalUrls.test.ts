import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  dialog: { showMessageBox: vi.fn() },
  shell: { openExternal: vi.fn() },
}));

import { classifyExternalUrl } from '../externalUrls';

describe('external URL classification', () => {
  it('opens the exact GitHub host directly for the in-app feedback flow', () => {
    expect(classifyExternalUrl('https://github.com/malyarq/fmcl/issues/new?title=bug')).toMatchObject({
      disposition: 'direct',
      hostname: 'github.com',
    });
  });

  it('does not extend GitHub trust to lookalike or subdomain hosts', () => {
    expect(classifyExternalUrl('https://github.com.example.test/malyarq/fmcl')).toMatchObject({ disposition: 'confirm' });
    expect(classifyExternalUrl('https://pages.github.com/malyarq/fmcl')).toMatchObject({ disposition: 'confirm' });
  });

  it('still blocks credentials and active non-HTTP schemes', () => {
    expect(classifyExternalUrl('https://user:pass@github.com/malyarq/fmcl')).toMatchObject({ disposition: 'block' });
    expect(classifyExternalUrl('javascript:alert(1)')).toMatchObject({ disposition: 'block' });
  });
});
