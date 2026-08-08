# Разработка

## Требования

- Node.js 24.x — версия закреплена в `.nvmrc` и проверяется через `package.json#engines`
- npm 11.x — версия закреплена в `package.json#packageManager`
- Git
- Системные инструменты, которые нужны electron-builder для сборки установщиков
- Java и сетевой доступ только для необязательного full-installation harness

```bash
nvm use
npm ci
```

`npm ci` автоматически запускает проверяемый compatibility postinstall для XMCL. Не нужно повторно выполнять `npm run postinstall`, если вы специально не отлаживаете этот patch.

## Основные команды

| Команда | Назначение |
| --- | --- |
| `npm run dev` | Запустить Vite и Electron в режиме разработки. После проверки процесс нужно остановить. |
| `npm test` | Один раз запустить Vitest: unit, component, service, security и smoke тесты. |
| `npm run lint` | Проверить репозиторий ESLint; warning считается ошибкой. |
| `npx tsc -p tsconfig.json --noEmit` | Проверить типы без записи build output. |
| `npm run docs:check` | Проверить ссылки, обязательные файлы, ссылку на последний релиз, индекс и зеркала EN/RU. |
| `npm run contracts:check` | Сравнить задокументированные IPC-каналы с allowlist. |
| `npm run ipc:check` | Найти IPC-вызовы, которых нет в allowlist. |
| `npm run audit:prod` | Упасть при high или critical advisory production-зависимости. |
| `npm run verify` | Запустить unit, lint, typecheck, проверки документации/контрактов, IPC и production audit. |
| `npm run test:visual:closeout` | Сравнить macOS Chromium screenshots с эталонами. |
| `npm run test:full` | Запустить реальную установку Minecraft и модлоадеров. |
| `npm run build -- --publish never` | Собрать приложение локально без публикации. |
| `npm run preview` | Показать только собранный renderer в браузере; это не рабочий Electron launcher. |

Границы и требования проверок описаны в [документе о тестировании](testing.md).

## Обычный рабочий процесс

1. Начните с чистого и актуального `main`.
2. Прочитайте ближайший `AGENTS.md` для изменяемой части проекта.
3. Перед правкой изучите существующий компонент или сервис и соседние тесты.
4. Cross-process изменение синхронизируйте в shared contract, preload, validation/handler, service, renderer wrapper и UI.
5. Добавьте тесты соразмерно риску.
6. Сначала запустите узкие проверки, затем `npm run verify` перед коммитом.
7. Для UI запустите visual regression, для release/packaging изменений — локальную упаковку.

## Структура исходников

- `src/` — React renderer, contexts, feature UI, переводы и типизированные IPC-обёртки
- `electron/` — main process, preload, handlers, security policies и сервисы
- `shared/` — общие контракты и типы
- `tests/` — общая настройка тестов, smoke и Playwright visual tests
- `scripts/` — release, contracts, compatibility и installation helpers
- `docs/` — документация для пользователей, разработчиков и мейнтейнера

Границы процессов подробно описаны в [архитектуре](architecture.md).

## Окружение и секреты

- Не коммитьте provider keys, account tokens, сертификаты, пароли и локальные абсолютные пути.
- В официальных сборках каталог CurseForge намеренно отключён. Локальный `CURSEFORGE_API_KEY` подходит только для разработки и не решает вопрос публичного распространения.
- Секреты подписи необязательны и сейчас не настроены. Не передавайте electron-builder пустые `CSC_*` variables. На macOS команда `npm run build` использует ad-hoc подпись, только если нет Developer ID или явно заданной подписи: локальная сборка запускается, но не становится пригодной для доверенной публикации или notarization.
- `VITE_POSTHOG_PROJECT_TOKEN` включает необязательный analytics client, работающий только после согласия пользователя. Это публичный ingestion token, а не персональный API key. `VITE_POSTHOG_HOST` по умолчанию равен `https://eu.i.posthog.com`; разрешены только HTTPS-хосты.
- Для стабильной release-сборки нужна repository variable `POSTHOG_PROJECT_TOKEN`. В проекте PostHog должен быть выключен сбор IP; это облачное свойство проверяет владелец релиза, а не код репозитория.

## Renderer и Electron

- Renderer-код не импортирует Node.js или Electron.
- Новые cross-process вызовы идут через `window.api` и `src/services/ipc/*`.
- Handler в main process валидирует вход renderer перед вызовом сервиса.
- `npm run dev` — долгоживущий процесс с Electron helpers; после ручной проверки его нужно закрыть.

## Подготовка релиза

Используйте ещё не существующую версию. Текущий релиз — `v0.12.0`; сама команда остаётся одинаковой для следующих релизов:

```bash
npm run release -- <version> --dry-run
```

Dry run не меняет tracked-файлы, commits, tags и remotes, но запускает проверки и упаковку, поэтому обновляет ignored build output. Полный процесс с `latest`, GitHub Actions, checksums и rollback описан в [release runbook](releasing.md).
