import pkg from '../../../package.json';
import { detectAnalyticsPlatform } from '../analytics/analyticsClient';

const ISSUE_URL = 'https://github.com/malyarq/fmcl/issues/new';

export function buildSafeIssueBody(options: {
  analyticsEnabled: boolean;
  language: 'en' | 'ru';
  platform: ReturnType<typeof detectAnalyticsPlatform>;
}): string {
  const { analyticsEnabled, language, platform } = options;
  const lines = language === 'ru'
    ? [
        '## Что произошло',
        '<!-- Опишите фактический результат. -->',
        '',
        '## Что ожидалось',
        '<!-- Опишите ожидаемый результат. -->',
        '',
        '## Шаги воспроизведения',
        '1. ',
        '',
        '## Безопасная диагностика',
        `- FMCL: ${pkg.version}`,
        `- ОС: ${platform}`,
        `- Язык интерфейса: ${language}`,
        `- Анонимная аналитика: ${analyticsEnabled ? 'включена' : 'выключена'}`,
        '',
        '> Перед отправкой не добавляйте токены, никнеймы, коды комнат, приватные адреса серверов или личные пути к файлам.',
      ]
    : [
        '## What happened',
        '<!-- Describe the actual result. -->',
        '',
        '## What did you expect',
        '<!-- Describe the expected result. -->',
        '',
        '## Reproduction steps',
        '1. ',
        '',
        '## Safe diagnostics',
        `- FMCL: ${pkg.version}`,
        `- OS: ${platform}`,
        `- Interface language: ${language}`,
        `- Anonymous analytics: ${analyticsEnabled ? 'enabled' : 'disabled'}`,
        '',
        '> Before submitting, do not add tokens, nicknames, room codes, private server addresses, or personal filesystem paths.',
      ];

  return lines.join('\n');
}

export function buildGitHubIssueUrl(body: string): string {
  const url = new URL(ISSUE_URL);
  url.searchParams.set('title', '[Bug]: ');
  url.searchParams.set('body', body);
  return url.toString();
}
