// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { createElement } from 'react';
import { describe, expect, it } from 'vitest';
import { CLASSIC_MODPACK_ID } from '@shared/constants';

describe('Vitest harness', () => {
  it('renders a React element in jsdom and resolves shared aliases', () => {
    render(createElement('span', null, `Burrow ${CLASSIC_MODPACK_ID}`));

    expect(screen.getByText(`Burrow ${CLASSIC_MODPACK_ID}`)).toBeTruthy();
  });
});
