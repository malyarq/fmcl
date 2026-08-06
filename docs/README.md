# FriendLauncher documentation

The documentation is split by audience and language. English and Russian variants describe the same behavior; code, tests, and workflow files remain the final source of truth.

[English](#english) · [Русский](#russian)

## English

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

## Maintenance rules

- Update both language variants when a mirrored document changes.
- Do not keep dated plans as current product documentation; Git history preserves completed planning material.
- Verify commands against `package.json` and workflows against `.github/workflows/`.
- Run `npm run contracts:check` after changing the IPC channel map.
- Keep local Markdown links valid.
