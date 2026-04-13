// @vitest-environment jsdom

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundLayer } from '../BackgroundLayer';

const initParticlesEngineMock = vi.fn();
const loadSlimMock = vi.fn();

type BackgroundMockConfig = {
  type: string;
  video?: {
    url: string;
    autoPause: boolean;
    volume: number;
  };
  particles?: {
    type: string;
    speed: number;
    intensity: number;
  };
};

const settingsState: {
  customTheme: {
    background: BackgroundMockConfig;
    colors: {
      background: string;
    };
  };
  disableAnimations: boolean;
} = {
  customTheme: {
    background: {
      type: 'video',
      video: {
        url: 'file:///background.mp4',
        autoPause: true,
        volume: 0,
      },
    },
    colors: {
      background: '#000000',
    },
  },
  disableAnimations: false,
};

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => settingsState,
}));

vi.mock('@tsparticles/react', () => ({
  default: () => <div data-testid="particles-layer" />,
  initParticlesEngine: (...args: unknown[]) => initParticlesEngineMock(...args),
}));

vi.mock('@tsparticles/slim', () => ({
  loadSlim: (...args: unknown[]) => loadSlimMock(...args),
}));

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

describe('BackgroundLayer reduced motion handling', () => {
  beforeEach(() => {
    mockMatchMedia(false);
    settingsState.disableAnimations = false;
    settingsState.customTheme = {
      background: {
        type: 'video',
        video: {
          url: 'file:///background.mp4',
          autoPause: true,
          volume: 0,
        },
      },
      colors: {
        background: '#000000',
      },
    };
    initParticlesEngineMock.mockReset().mockResolvedValue(undefined);
    loadSlimMock.mockReset().mockResolvedValue(undefined);
  });

  it('renders a static atmospheric backdrop when reduced motion is preferred for video backgrounds', () => {
    mockMatchMedia(true);

    render(<BackgroundLayer />);

    expect(screen.getByTestId('background-static-fallback')).toBeTruthy();
    expect(document.querySelector('video')).toBeNull();
  });

  it('skips particle engine initialization when launcher animations are disabled', () => {
    settingsState.disableAnimations = true;
    settingsState.customTheme = {
      background: {
        type: 'particles',
        particles: {
          type: 'stars',
          speed: 2,
          intensity: 40,
        },
      },
      colors: {
        background: '#000000',
      },
    };

    render(<BackgroundLayer />);

    expect(screen.getByTestId('background-static-fallback')).toBeTruthy();
    expect(screen.queryByTestId('particles-layer')).toBeNull();
    expect(initParticlesEngineMock).not.toHaveBeenCalled();
  });
});
