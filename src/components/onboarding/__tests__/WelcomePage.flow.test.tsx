// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WelcomePage } from '../WelcomePage'

const completeMock = vi.fn()
const tourMock = vi.fn()
const multiplayerMock = vi.fn()
const settingsMock = vi.fn()
const setLanguageMock = vi.fn()
const setUIModeMock = vi.fn()

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    language: 'en',
    setLanguage: setLanguageMock,
    setUIMode: setUIModeMock,
    t: (key: string) => ({
      'onboarding.welcome.title': 'What do you want to do first?',
      'onboarding.welcome.intro': 'Choose an outcome.',
      'onboarding.welcome.language': 'Interface language',
      'onboarding.welcome.play_now': 'Play Minecraft',
      'onboarding.welcome.play_now_desc': 'Play offline now.',
      'onboarding.welcome.play_now_action': 'Open launcher',
      'onboarding.welcome.play_together': 'Play with a friend',
      'onboarding.welcome.play_together_desc': 'Use Burrow Link.',
      'onboarding.welcome.play_together_action': 'Open Burrow Link',
      'onboarding.welcome.modpacks': 'Use a modpack',
      'onboarding.welcome.modpacks_desc': 'Import or create a pack.',
      'onboarding.welcome.modpacks_action': 'Open modpacks',
      'onboarding.welcome.account_note': 'Offline works immediately.',
      'onboarding.welcome.tour': 'Show a short tour',
      'general.settings': 'Settings',
    }[key] ?? key),
    getAccentStyles: () => ({ className: '', style: undefined }),
    getAccentHex: () => '#10b981',
  }),
}))

describe('WelcomePage flow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
      }),
    })
  })

  it('opens as a labelled modal and keeps keyboard focus inside it', async () => {
    render(
      <>
        <button type="button">Background action</button>
        <WelcomePage
          onComplete={completeMock}
          onStartTour={tourMock}
          onShowMultiplayer={multiplayerMock}
          onShowSettings={settingsMock}
        />
      </>,
    )

    const dialog = screen.getByRole('dialog', { name: 'What do you want to do first?' })
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(screen.getByRole('group', { name: 'Interface language' })).toBeTruthy()

    const languageControl = screen.getByRole('button', { name: 'en' })
    await waitFor(() => expect(document.activeElement).toBe(languageControl))

    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('routes directly to the selected first outcome', () => {
    render(
      <WelcomePage
        onComplete={completeMock}
        onStartTour={tourMock}
        onShowMultiplayer={multiplayerMock}
        onShowSettings={settingsMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Open launcher' }))
    expect(completeMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Open Burrow Link' }))
    expect(multiplayerMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Open modpacks' }))
    expect(setUIModeMock).toHaveBeenCalledWith('modpacks')
    expect(completeMock).toHaveBeenCalledTimes(2)
  })

  it('lets the user switch language or explicitly ask for help', () => {
    render(
      <WelcomePage
        onComplete={completeMock}
        onStartTour={tourMock}
        onShowMultiplayer={multiplayerMock}
        onShowSettings={settingsMock}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'ru' }))
    expect(setLanguageMock).toHaveBeenCalledWith('ru')

    fireEvent.click(screen.getByRole('button', { name: 'Show a short tour' }))
    expect(tourMock).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(settingsMock).toHaveBeenCalledTimes(1)
  })
})
