// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacyFeedbackCard } from '../PrivacyFeedbackCard';
import { buildGitHubIssueUrl, buildSafeIssueBody } from '../issueReport';
import pkg from '../../../../package.json';

const mocks = vi.hoisted(() => ({
  capture: vi.fn().mockResolvedValue('sent'),
  open: vi.fn().mockResolvedValue({ status: 'opened' }),
  setEnabled: vi.fn(),
  readinessCheck: vi.fn().mockResolvedValue({
    overall: 'attention',
    checks: [
      { id: 'storage', status: 'ready', code: 'ready' },
      { id: 'network', status: 'warning', code: 'unreachable' },
    ],
  }),
}));

vi.mock('../../../contexts/SettingsContext', () => ({
  useSettings: () => ({
    language: 'ru',
    t: (key: string) => ({
      'privacy.title': 'Приватность и обратная связь',
      'privacy.description': 'Описание',
      'privacy.analytics_title': 'Отправлять анонимную статистику использования',
      'privacy.analytics_description': 'Только безопасные события',
      'privacy.analytics_ready': 'Аналитика доступна',
      'privacy.analytics_unavailable': 'Аналитика недоступна',
      'feedback.preview': 'Посмотреть безопасную диагностику',
      'feedback.open_github': 'Сообщить о проблеме на GitHub',
      'feedback.open_failed': 'Ошибка открытия',
      'feedback.consent_notice': 'Ничего не отправляется автоматически',
    }[key] ?? key),
  }),
}));

vi.mock('../../../contexts/ToastContext', () => ({
  useToast: () => ({ error: vi.fn() }),
}));

vi.mock('../../analytics/AnalyticsProvider', () => ({
  useAnalytics: () => ({ capture: mocks.capture, configured: true, enabled: false, setEnabled: mocks.setEnabled }),
}));

vi.mock('../../../services/ipc/externalLinksIPC', () => ({
  externalLinksIPC: { open: mocks.open },
}));

describe('PrivacyFeedbackCard', () => {
  beforeEach(() => {
    mocks.capture.mockClear();
    mocks.open.mockClear();
    mocks.setEnabled.mockClear();
    mocks.readinessCheck.mockClear();
    Object.defineProperty(window, 'api', {
      configurable: true,
      value: { systemReadiness: { check: mocks.readinessCheck } },
    });
  });

  it('keeps consent off and shows the exact safe report before GitHub opens', async () => {
    render(<PrivacyFeedbackCard />);

    const toggle = screen.getByRole('switch', { name: 'Отправлять анонимную статистику использования' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(mocks.setEnabled).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText('Посмотреть безопасную диагностику'));
    expect(screen.getByText(new RegExp(`Burrow: ${pkg.version.replaceAll('.', '\\.')}`))).toBeTruthy();
    expect(screen.queryByText(/nickname|token|\/Users\//i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Сообщить о проблеме на GitHub' }));
    await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1));
    expect(mocks.readinessCheck).toHaveBeenCalledTimes(1);
    const request = mocks.open.mock.calls[0][0] as { url: string };
    const body = new URL(request.url).searchParams.get('body') ?? '';
    expect(body).toContain('## Безопасная диагностика');
    expect(body).toContain('Готовность системы: storage:ready, network:unreachable');
    expect(body).not.toContain('/Users/');
    expect(mocks.capture).toHaveBeenCalledWith('feedback_opened', { source: 'launcher_settings' });
  });

  it('builds a bounded GitHub URL from reviewed fields only', () => {
    const body = buildSafeIssueBody({
      analyticsEnabled: true,
      language: 'en',
      platform: 'windows',
      readiness: {
        overall: 'blocked',
        checks: [{ id: 'storage', status: 'blocked', code: 'unwritable' }],
      },
    });
    const url = buildGitHubIssueUrl(body);
    const russianUrl = buildGitHubIssueUrl(
      buildSafeIssueBody({ analyticsEnabled: false, language: 'ru', platform: 'macos' }),
    );

    expect(url.length).toBeLessThan(2048);
    expect(russianUrl.length).toBeLessThan(2048);
    expect(new URL(url).origin).toBe('https://github.com');
    expect(body).toContain(`Burrow: ${pkg.version}`);
    expect(body).toContain('OS: windows');
    expect(body).toContain('System readiness: storage:unwritable');
    expect(body).not.toContain('/Users/');
  });
});
