// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PrivacyFeedbackCard } from '../PrivacyFeedbackCard';
import { buildGitHubIssueUrl, buildSafeIssueBody } from '../issueReport';

const mocks = vi.hoisted(() => ({
  capture: vi.fn().mockResolvedValue('sent'),
  open: vi.fn().mockResolvedValue({ status: 'opened' }),
  setEnabled: vi.fn(),
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
  });

  it('keeps consent off and shows the exact safe report before GitHub opens', async () => {
    render(<PrivacyFeedbackCard />);

    const toggle = screen.getByRole('switch', { name: 'Отправлять анонимную статистику использования' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    fireEvent.click(toggle);
    expect(mocks.setEnabled).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByText('Посмотреть безопасную диагностику'));
    expect(screen.getByText(/FMCL: 0\.8\.1/)).toBeTruthy();
    expect(screen.queryByText(/nickname|token|\/Users\//i)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Сообщить о проблеме на GitHub' }));
    await waitFor(() => expect(mocks.open).toHaveBeenCalledTimes(1));
    const request = mocks.open.mock.calls[0][0] as { url: string };
    const body = new URL(request.url).searchParams.get('body') ?? '';
    expect(body).toContain('## Безопасная диагностика');
    expect(body).not.toContain('/Users/');
    expect(mocks.capture).toHaveBeenCalledWith('feedback_opened', { source: 'launcher_settings' });
  });

  it('builds a bounded GitHub URL from reviewed fields only', () => {
    const body = buildSafeIssueBody({ analyticsEnabled: true, language: 'en', platform: 'windows' });
    const url = buildGitHubIssueUrl(body);
    const russianUrl = buildGitHubIssueUrl(
      buildSafeIssueBody({ analyticsEnabled: false, language: 'ru', platform: 'macos' }),
    );

    expect(url.length).toBeLessThan(2048);
    expect(russianUrl.length).toBeLessThan(2048);
    expect(new URL(url).origin).toBe('https://github.com');
    expect(body).toContain('FMCL: 0.8.1');
    expect(body).toContain('OS: windows');
  });
});
