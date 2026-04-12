import { afterEach } from 'vitest';

afterEach(async () => {
  if (!('document' in globalThis)) {
    return;
  }

  const { cleanup } = await import('@testing-library/react');
  cleanup();
});
