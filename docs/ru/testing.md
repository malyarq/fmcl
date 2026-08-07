# Тестирование

В FriendLauncher используется несколько уровней проверок. Ни одна локальная команда не может доказать работу на всех ОС, провайдерах, роутерах, Java runtime и путях установленного обновления.

## Уровни проверок

| Уровень | Команда | Что проверяется | Есть в CI |
| --- | --- | --- | --- |
| Unit/component/service/security | `npm test` | Vitest-файлы в `src/`, `electron/`, `shared/` и не-visual части `tests/` | Да |
| Lint | `npm run lint` | ESLint без warning | Да |
| Типы | `npx tsc -p tsconfig.json --noEmit` | TypeScript renderer, shared и main process | Да |
| Документация | `npm run docs:check` | Локальные ссылки, обязательные файлы, ссылка на последний релиз, индекс и зеркала EN/RU | Да |
| Документация контрактов | `npm run contracts:check` | Allowlist IPC-каналов против обеих карт | Да |
| IPC allowlist | `npm run ipc:check` | Literal Electron IPC calls против allowlist | Да |
| Безопасность зависимостей | `npm run audit:prod` | High и critical production advisory | Да |
| Visual regression | `npm run test:visual:closeout` | Семь детерминированных экранов в macOS Chromium | Да, отдельный job |
| Packaging smoke | `npm run build -- --publish never` | TypeScript, Vite и упаковка electron-builder | Да |
| Реальная установка | `npm run test:full` | Minecraft/modloader metadata, загрузки, Java и установка | Нет |
| Реальный запуск игры | `npm run smoke:game` | Установка актуальной vanilla, production-путь запуска, сигналы renderer и загруженных ресурсов | Нет |
| Установленное приложение | Вручную | Installer, первый запуск, OS warning, update и сеть/роутер | Нет |

## Стандартная проверка

```bash
npm run verify
```

Команда запускает unit tests, lint, typecheck, проверки документации и контрактов, IPC checks и production audit. Она намеренно **не** запускает visual regression, упаковку electron-builder и full-install harness.

## Vitest

Полный прогон:

```bash
npm test
```

Один файл во время разработки:

```bash
npx vitest run src/path/to/example.test.tsx
```

Тест лучше хранить рядом с защищаемым поведением, обычно в `__tests__`. Общие smoke tests лежат в `tests/`.

## Visual regression

Один раз установите закреплённый браузер:

```bash
npx playwright install chromium
```

Сравнение с эталонами:

```bash
npm run test:visual:closeout
```

Обновление эталонов допустимо только после просмотра результата:

```bash
npm run test:visual:closeout -- --update-snapshots
```

Эталоны намеренно относятся к Darwin и лежат в `tests/visual/manual-closeout.spec.ts-snapshots/`. Playwright запускает сервер с `FMCL_RENDERER_ONLY=1`: это проверка детерминированных UI-state, а не нативного поведения Electron.

## Полная установка Minecraft

Harness собирает приложение, создаёт изолированную временную папку Electron user-data, выполняет установку, сохраняет результат и удаляет временную папку при завершении.

```bash
npm run test:full
npm run test:full:vanilla
npm run test:full:forge
npm run test:full:fabric
npm run test:full:neoforge
npm run smoke:game
```

`smoke:game` устанавливает одну актуальную vanilla-версию, запускает её с тестовым офлайн-профилем через production-путь лаунчера, ждёт одновременно запуска LWJGL renderer и загрузки ресурсов, ненадолго удерживает процесс и затем завершает всё дерево процессов игры. `.github/workflows/game-smoke.yml` вручную запускает ту же ограниченную проверку на Windows, Linux и macOS и сохраняет журнал и JSON-доказательство. Она намеренно отделена от обычного CI и публикации релиза: загрузки Mojang и запуск графики медленные и зависят от внешней среды.

Прямые параметры:

```bash
node scripts/test-full.js --stage=forge --limit=5
node scripts/test-full.js --only=1.20.1,1.19.2
node scripts/test-full.js --provider=bmclapi
```

Поддерживаются:

- `--stage=vanilla|forge|fabric|neoforge`
- `--provider=auto|mojang|bmclapi`
- `--limit=<count>`
- `--only=<comma-separated versions>`

Для harness нужны Node 24, загрузки Java/runtime, сеть, место на диске и заметно больше времени, чем для unit suite. Изоляция временной папки обязательна: тест не должен затрагивать пользовательские данные.

## CI и release gates

`.github/workflows/ci.yml` запускается на push в `main` и pull request. Он выполняет стандартные проверки, packaging build и отдельный macOS Chromium visual job.

`.github/workflows/release.yml` проверяет версию, запускает tests/lint/type/contracts/IPC/audit и Linux build smoke, затем независимо собирает Windows, Linux и macOS. Один GitHub Release публикуется только после успеха всех платформ.

Сам release workflow не запускает full-install harness или visual job. Перед UI-heavy stable tag нужен зелёный CI на `main` и ограниченные ручные проверки из [release runbook](releasing.md).

## Какие проверки выбирать

- Только документация: `npm run docs:check`, `npm run contracts:check` при изменении карты и `git diff --check`.
- Renderer: targeted Vitest, `npm run verify`, visual regression и ручной Electron-run, если важно нативное поведение.
- Main process или IPC: targeted service/security tests, `npm run verify` и packaging smoke.
- Dependencies или release workflow: `npm ci`, `npm run verify`, packaging и проверка workflow.
- Java, modloader или installer: релевантные unit tests и ограниченный full-install run.
