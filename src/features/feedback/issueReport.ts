import pkg from '../../../package.json';
import { detectAnalyticsPlatform } from '../analytics/analyticsClient';
import type { SystemReadinessReport } from '@shared/contracts';

const ISSUE_URL = 'https://github.com/malyarq/burrow/issues/new';

export function buildSafeIssueBody(options: {
  analyticsEnabled: boolean;
  language: 'en' | 'ru';
  platform: ReturnType<typeof detectAnalyticsPlatform>;
  readiness?: SystemReadinessReport | null;
}): string {
  const { analyticsEnabled, language, platform, readiness } = options;
  const readinessCodes = readiness?.checks.map(({ id, code }) => `${id}:${code}`).join(', ');
  const lines = language === 'ru'
    ? [
        '## Что произошло',
        '<!-- Что получилось? -->',
        '',
        '## Что ожидалось',
        '<!-- Что ожидали? -->',
        '',
        '## Шаги воспроизведения',
        '1. ',
        '',
        '## Безопасная диагностика',
        `- Burrow: ${pkg.version}`,
        `- ОС: ${platform}`,
        `- Язык: ${language}`,
        `- Аналитика: ${analyticsEnabled ? 'включена' : 'выключена'}`,
        ...(readinessCodes ? [`- Готовность системы: ${readinessCodes}`] : []),
        '',
        '> Не добавляйте секреты и персональные данные.',
      ]
    : [
        '## What happened',
        '<!-- Actual result -->',
        '',
        '## What did you expect',
        '<!-- Expected result -->',
        '',
        '## Reproduction steps',
        '1. ',
        '',
        '## Safe diagnostics',
        `- Burrow: ${pkg.version}`,
        `- OS: ${platform}`,
        `- Language: ${language}`,
        `- Analytics: ${analyticsEnabled ? 'enabled' : 'disabled'}`,
        ...(readinessCodes ? [`- System readiness: ${readinessCodes}`] : []),
        '',
        '> Do not add secrets or personal data.',
      ];

  return lines.join('\n');
}

export function buildGitHubIssueUrl(body: string): string {
  const url = new URL(ISSUE_URL);
  url.searchParams.set('title', '[Bug]: ');
  url.searchParams.set('body', body);
  return url.toString();
}
