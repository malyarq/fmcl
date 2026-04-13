// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WelcomePage } from '../WelcomePage'

const completeMock = vi.fn()
const skipMock = vi.fn()
const settingsMock = vi.fn()

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    t: (key: string) =>
      ({
        'onboarding.welcome.title': 'Welcome!',
        'onboarding.welcome.badge': 'Launcher setup',
        'onboarding.welcome.feature_modpacks.title': 'Modpack Management',
        'onboarding.welcome.feature_modpacks.desc': 'Import and manage modpacks from CurseForge and Modrinth',
        'onboarding.welcome.feature_multiplayer.title': 'Multiplayer Tunnel',
        'onboarding.welcome.feature_multiplayer.desc': 'Play with friends through a secure tunnel without port forwarding',
        'onboarding.welcome.feature_customization.title': 'Customization',
        'onboarding.welcome.feature_customization.desc': 'Dark/light theme, accent colors, and more',
        'onboarding.welcome.quick_start.title': 'Quick Start:',
        'onboarding.welcome.quick_start.step1': 'Start in Classic for a quick launch, or switch to Modpacks when you want a curated pack.',
        'onboarding.welcome.quick_start.step2': 'Set your nickname, Minecraft version, and modloader in the sidebar.',
        'onboarding.welcome.quick_start.step3': 'Press "Play", or open Settings to tune theme, accounts, and launcher behavior.',
        'onboarding.welcome.customize_title': 'Make it yours',
        'onboarding.welcome.customize_desc': 'Start with a clean launcher shell, then adjust theme, accent, background effects, and account setup in Settings.',
        'onboarding.welcome.get_started': 'Get Started',
        'onboarding.welcome.skip': 'Skip',
        'general.settings': 'Settings',
      }[key] ?? key),
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
  }),
}))

describe('WelcomePage flow', () => {
  beforeEach(() => {
    completeMock.mockReset()
    skipMock.mockReset()
    settingsMock.mockReset()
  })

  it('describes the real default first-run flow instead of pointing users to modpacks first', () => {
    render(
      <WelcomePage
        onComplete={completeMock}
        onSkip={skipMock}
        onShowSettings={settingsMock}
      />
    )

    expect(screen.getByText(/Start in Classic for a quick launch/i)).toBeTruthy()
    expect(screen.queryByText('Select or create a modpack')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Get Started' }))
    expect(completeMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(settingsMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))
    expect(skipMock).toHaveBeenCalledTimes(1)
  })
})
