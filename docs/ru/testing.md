# Тестирование

## Обзор

В проекте используются только **full installation** тесты — они проверяют, что лаунчер корректно устанавливает версии Minecraft и модлоадеры (vanilla, Forge, Fabric, NeoForge).

## Full installation тесты

### Запуск

```bash
# Все этапы (vanilla + все модлоадеры)
npm run test:full

# Отдельные этапы
npm run test:full:vanilla   # только vanilla
npm run test:full:forge     # Forge
npm run test:full:fabric    # Fabric
npm run test:full:neoforge  # NeoForge
```

### Прямой вызов скрипта

```bash
node scripts/test-full.js [опции]
```

Опции:
- `--stage=<stage>` — этап: `vanilla`, `forge`, `fabric`, `neoforge` (по умолчанию: все)
- `--provider=<id>` — провайдер загрузки: `auto`, `mojang`, `bmclapi` (по умолчанию: `auto`)
- `--limit=<N>` — ограничить количество версий
- `--only=<versions>` — конкретные версии через запятую (например, `1.20.1,1.19.2`)

Примеры:
```bash
node scripts/test-full.js --stage=forge --limit=5
node scripts/test-full.js --only=1.20.1,1.19.2
node scripts/test-full.js --provider=bmclapi
```

Результаты и логи сохраняются в `%APPDATA%/FriendLauncher/logs/full-installation/` (или аналог на других ОС).

## CI

Full installation тесты в CI не запускаются (требуют Java, загрузки артефактов и времени). В пайплайне выполняются только lint, typecheck, contracts и IPC allowlist проверки (см. `.github/workflows/ci.yml`).
