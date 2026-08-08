// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTranslator } from '../../contexts/settings/i18n'
import mainSource from '../../main.tsx?raw'
import ErrorBoundary from '../ErrorBoundary'

function CrashOnRender({ error }: { error: Error }): null {
  throw error
}

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('ErrorBoundary recovery surface', () => {
  beforeEach(() => {
    window.localStorage.clear()
    consoleErrorSpy.mockClear()
  })

  afterAll(() => {
    consoleErrorSpy.mockRestore()
  })

  it('uses the runtime translator and hides raw crash internals by default outside providers', async () => {
    window.localStorage.setItem('settings_language', 'ru')
    const restart = vi.fn().mockResolvedValue(undefined)

    const error = new Error('Cannot read properties of undefined (reading "map")')
    error.stack = [
      'TypeError: Cannot read properties of undefined (reading "map")',
      '    at CrashOnRender (http://localhost:5173/src/components/CrashOnRender.tsx:7:11)',
      '    at renderWithHooks (/Users/test/burrow/node_modules/react-dom/cjs/react-dom-client.development.js:123:10)',
    ].join('\n')

    render(
      <ErrorBoundary mode="restart" onRestart={restart}>
        <CrashOnRender error={error} />
      </ErrorBoundary>,
    )

    expect(await screen.findByRole('heading', { name: 'Что-то пошло не так' })).toBeTruthy()
    expect(
      screen.getByText(
        'Burrow столкнулся с проблемой и закрыл этот экран. Перезапустите лаунчер, чтобы вернуться в стабильную сессию.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/Cannot read properties/i)).toBeNull()
    expect(screen.queryByText(/localhost:5173/i)).toBeNull()
    expect(screen.queryByText(/node_modules/i)).toBeNull()

    const restartButton = screen.getByRole('button', { name: 'Перезапустить лаунчер' })
    const copyButton = screen.getByRole('button', { name: 'Скопировать детали' })
    const toggleButton = screen.getByRole('button', { name: 'Технические детали' })

    expect(restartButton.getAttribute('data-variant')).toBe('primary')
    expect(copyButton.getAttribute('data-variant')).toBe('secondary')
    expect(toggleButton.getAttribute('data-variant')).toBe('ghost')
    expect(toggleButton.getAttribute('aria-expanded')).toBe('false')

    fireEvent.click(restartButton)
    await waitFor(() => expect(restart).toHaveBeenCalledTimes(1))

    fireEvent.click(toggleButton)

    await waitFor(() => {
      expect(screen.getByText(/localhost:5173/i)).toBeTruthy()
      expect(screen.getByText(/node_modules/i)).toBeTruthy()
      expect(screen.getByText(/Component stack:/i)).toBeTruthy()
    })

    expect(screen.getByRole('button', { name: 'Скрыть детали' }).getAttribute('aria-expanded')).toBe('true')
  })

  it('accepts an injected translator and falls back for suspicious recovery summaries', async () => {
    const t = createTranslator('en')
    const error = new Error('[modpacks] loadVersions failed: ${file.jarVersion}')
    error.stack = [
      'Error: [modpacks] loadVersions failed: ${file.jarVersion}',
      '    at CrashOnRender (http://localhost:5173/src/App.tsx:1:1)',
    ].join('\n')

    render(
      <ErrorBoundary mode="recover" onRecover={vi.fn()} t={t}>
        <CrashOnRender error={error} />
      </ErrorBoundary>,
    )

    expect(await screen.findByRole('heading', { name: 'Something Went Wrong' })).toBeTruthy()
    expect(
      screen.getByText(
        'Burrow closed this screen after an unexpected problem. Recover it in place to keep your current route.',
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/\$\{file\.jarVersion\}/)).toBeNull()
    expect(screen.getByRole('button', { name: 'Recover screen' })).toBeTruthy()
  })

  it('keeps a failed in-place recovery visible and redacts its native details by default', async () => {
    const recover = vi.fn().mockRejectedValue(new Error('/Users/private/launcher state unavailable'))

    render(
      <ErrorBoundary mode="recover" onRecover={recover} t={createTranslator('en')}>
        <CrashOnRender error={new Error('route failed')} />
      </ErrorBoundary>,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Recover screen' }))

    const alert = await screen.findByTestId('fatal-recovery-error')
    expect(alert.getAttribute('role')).toBe('alert')
    expect(alert.textContent).toContain('Burrow could not recover this screen')
    expect(alert.textContent).not.toContain('/Users/private')
    expect(screen.getByRole('button', { name: 'Recover screen' })).toBeTruthy()
  })

  it('mounts the outer boundary with an explicit typed bootstrap restart and no browser reload', () => {
    expect(mainSource).toContain('onRestart={restartAfterBootstrapFailure}')
    expect(mainSource).toContain('cacheIPC.reload()')
    expect(mainSource).not.toContain(['window', 'location', 'reload'].join('.'))
  })

  it('does not invent an action for an unowned boundary', async () => {
    render(
      <ErrorBoundary t={createTranslator('en')}>
        <CrashOnRender error={new Error('unowned boundary')} />
      </ErrorBoundary>,
    )

    expect(await screen.findByRole('heading', { name: 'Something Went Wrong' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Recover screen' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Restart Launcher' })).toBeNull()
  })
})
