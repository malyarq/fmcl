# История изменений / Changelog

Здесь кратко описан текущий публичный релиз. Подробная история разработки остаётся в Git, а [GitHub Releases](https://github.com/malyarq/burrow/releases) служит основным источником установочных файлов.

This file summarizes the current public release. Git history remains the detailed development record, and [GitHub Releases](https://github.com/malyarq/burrow/releases) is the canonical source for downloadable artifacts.

## Не выпущено / Unreleased

После v0.12.0 изменений нет. / No changes after v0.12.0.

## [0.12.0] — 2026-08-08

### Русский

#### Добавлено

- Двуязычный русско-английский лаунчер для обычного Minecraft и управляемых модпаков.
- Приглашения Burrow Link для совместной игры, обмен модпаками, резервное копирование настроек, пошаговое знакомство с приложением и необязательная приватная аналитика.
- Пакеты для Windows, macOS и Linux с контрольными суммами и автоматизированными проверками запуска на каждой платформе.

#### Изменено

- Идентификатор приложения, каталог пользовательских данных, маркер схемы, временные рабочие каталоги и публичные протоколы приведены к единой айдентике Burrow.
- Приглашения, коды обмена модпаками, резервные копии настроек, обновления пакетов и анонимная аналитика используют только актуальные форматы Burrow.
- До появления внешних пользователей удалены устаревшие пространства имён и ветки миграции старых форматов.

#### Безопасность

- Усилена защита окон Electron, IPC-валидации, навигации, архивов, загрузок, хранения учётных данных, обновлений и изоляции renderer-процесса.
- Анонимная аналитика выключена до явного согласия и отправляет только разрешённые продуктовые события без профилей пользователей, геоданных по IP, путей, аккаунтов, журналов и секретов игровых комнат.

#### Выпуск

- Тег создаётся последним: точный коммит публикуется только после успешной сборки пакетов и обязательных проверок на всех платформах.
- Подпись издателя и notarization для macOS пока не настроены; предупреждения операционных систем описаны в релизе и руководстве пользователя.

### English

#### Added

- A bilingual Russian/English launcher for vanilla Minecraft and managed modpacks.
- Burrow Link multiplayer invitations, modpack sharing, settings backup, guided onboarding, and privacy-first optional analytics.
- Cross-platform Windows, macOS, and Linux packages with checksums and automated native smoke evidence.

#### Changed

- Standardized the application ID, user-data directory, persistent schema marker, temporary workspaces, and public protocols on the Burrow identity.
- Made invitations, modpack share codes, settings backups, package upgrades, and anonymous analytics use only their current Burrow formats.
- Removed pre-public migration branches and obsolete namespaces before external adoption.

#### Security

- Hardened Electron windows, IPC validation, navigation, archives, downloads, credential storage, updater behavior, and renderer isolation.
- Anonymous analytics stays disabled until explicit consent and sends only allowlisted product events without persons, IP-derived location, paths, accounts, logs, or room secrets.

#### Release

- Release publication is tag-last: every platform package and required check must finish before the exact commit is tagged and published.
- Publisher signing and macOS notarization are not configured; the release notes and user guide state the resulting operating-system warnings.
