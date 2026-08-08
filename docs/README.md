# Документация Burrow

Русский — основной язык документации проекта. Английские версии полностью описывают то же поведение; окончательным источником истины остаются код, тесты и файлы автоматизации.

[Русский](#русский) · [English](#english)

## Русский

### Пользователям

- [Руководство](ru/user-guide.md) — установка, первый запуск, обновления и сохранность данных
- [Решение проблем](ru/troubleshooting.md) — запуск, Java, контент, сеть и обновления
- [Известные проблемы](ru/known-issues.md) — подтверждённые ограничения стабильной версии
- [Приватность и аналитика](ru/privacy.md) — согласие, точный состав событий, хранение и обратная связь

### Разработчикам

- [Разработка](ru/development.md) — окружение, команды и рабочий процесс
- [Тестирование](ru/testing.md) — unit, visual, installation, CI и release-проверки
- [Архитектура](ru/architecture.md) — границы процессов и ответственность каталогов
- [Кодстайл](ru/code-style.md) — проверяемые инженерные правила
- [IPC-контракты](ru/contracts.md) и [карта контрактов](ru/contracts-map.md)
- [Дизайн-система](ru/design-system.md) — токены, общие компоненты и доступность
- [Участие в разработке](../CONTRIBUTING.md)

### Мейнтейнерам

- [Выпуск релиза](ru/releasing.md)
- [Модель безопасности](ru/security.md) и [политика сообщения об уязвимостях](../SECURITY.md)
- [Продуктовый ограничитель](ru/roadmap.md)
- [История изменений](../CHANGELOG.md)
- [Уведомления о сторонних компонентах](../THIRD_PARTY_NOTICES.md)

## English

English documentation mirrors the Russian source and describes the same product behavior.

### Players

- [User guide](en/user-guide.md) — installation, first launch, updates, and data safety
- [Troubleshooting](en/troubleshooting.md) — common launch, Java, content, network, and update failures
- [Known issues](en/known-issues.md) — confirmed limitations in the current stable release
- [Privacy and analytics](en/privacy.md) — opt-in telemetry, exact event fields, retention, and feedback behavior

### Contributors

- [Development](en/development.md) — environment, commands, and day-to-day workflow
- [Testing](en/testing.md) — unit, visual, installation, CI, and release checks
- [Architecture](en/architecture.md) — process boundaries and directory ownership
- [Code style](en/code-style.md) — reviewable engineering rules
- [IPC contracts](en/contracts.md) and [contract map](en/contracts-map.md)
- [Design system](en/design-system.md) — tokens, shared components, and accessibility rules
- [Contributing](../CONTRIBUTING.md)

### Maintainers

- [Release runbook](en/releasing.md)
- [Security model](en/security.md) and [reporting policy](../SECURITY.md)
- [Product gate](en/roadmap.md)
- [Changelog](../CHANGELOG.md)
- [Third-party notices](../THIRD_PARTY_NOTICES.md)

## Правила поддержки

- Сначала обновляйте русскую версию документа, затем синхронизируйте английское зеркало.
- Не храните датированные планы как актуальную документацию продукта: завершённая работа остаётся в истории Git.
- Сверяйте команды с `package.json`, а процессы выпуска — с `.github/workflows/`.
- После изменения карты IPC-каналов запускайте `npm run contracts:check`.
- Сохраняйте локальные Markdown-ссылки рабочими.
