## Разработка (Русский)

---

## Команды

Требования: Node.js 24 и npm 11. Выполните `nvm use`, для воспроизводимой установки используйте `npm ci`.

Из `package.json`:

- `npm run dev` — старт Vite (Electron поднимается через конфиг плагина Vite/Electron)
- `npm run build` — `tsc` + `vite build` + `electron-builder`
- `npm run lint` — ESLint (warnings считаются падением)
- `npm run verify` — unit, lint, type, IPC contract и production audit gates
- `npm run audit:prod` — падение на critical advisory production-зависимостей
- `npm run test:visual:closeout` — визуальный baseline macOS Chromium
- `npm run preview` — предпросмотр Vite build
- `npm run release -- 0.7.0 --dry-run` — release preflight без изменений
- `npm run release -- 0.7.0` — локальный commit и tag; `--push` добавляется только после ревью
- `npm run postinstall` — фикс XMCL bytebuffer через `scripts/postinstall-fix-xmcl-bytebuffer.cjs`

### Тестирование

Полные тесты установки проверяют, что лаунчер корректно устанавливает версии Minecraft и модлоадеры:

- `npm run test:full` — запустить все тесты установки (vanilla + все модлоадеры)
- `npm run test:full:vanilla` — тест только установки vanilla
- `npm run test:full:forge` — тест установки Forge
- `npm run test:full:fabric` — тест установки Fabric
- `npm run test:full:neoforge` — тест установки NeoForge

Также можно использовать скрипт напрямую с дополнительными опциями:

```bash
node scripts/test-full.js [опции]
```

Опции:
- `--stage=<stage>` — Этап теста: `vanilla`, `forge`, `fabric`, `neoforge` (по умолчанию: все)
- `--provider=<id>` — Провайдер загрузки: `auto`, `mojang`, `bmclapi` (по умолчанию: `auto`)
- `--limit=<N>` — Ограничить количество версий для тестирования (по умолчанию: без ограничений)
- `--only=<versions>` — Список конкретных версий через запятую (например, `1.20.1,1.19.2`)

Примеры:
```bash
# Тест только Forge с ограничением в 5 версий
node scripts/test-full.js --stage=forge --limit=5

# Тест конкретных версий
node scripts/test-full.js --only=1.20.1,1.19.2

# Тест с конкретным провайдером загрузки
node scripts/test-full.js --provider=bmclapi
```

Сценарий использует изолированную временную папку user-data и не может перезаписать рабочую установку FMCL. Результаты и логи печатаются во время прогона и удаляются вместе с временной папкой при завершении.

---

## Дисциплина контрактов при рефакторинге

До/после изменений IPC или preload:

- поддерживай `contracts-map.md` актуальным
- поддерживай `src/vite-env.d.ts` актуальным
- в renderer предпочитай `src/services/ipc/*`

---

## Заметки по структуре после рефакторингов

- UI: большие компоненты режем на маленькие и кладём в папки по домену/виджету (например `src/components/sidebar/*`, `src/components/layout/*`, части настроек в `src/components/settings/*`).
- Main-process: если домен разрастается, выносим хелперы в подпапку и оставляем тонкий фасад (например `electron/services/launcher/forge/*`, `electron/services/launcher/modLoaders/*`, `electron/services/network/*`).

---

## Переводы строк (Windows)

Если видишь предупреждения Git вида “LF will be replaced by CRLF”, имеет смысл позже стандартизировать это через `.gitattributes`. Пока что: не смешивай разные переводы строк внутри одного файла.
