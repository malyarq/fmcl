# План возрождения FriendLauncher

Дата аудита: 2026-08-03. База: `v0.6.0`, ветка подготовки `v0.7.0`.

## Решение по стеку

Переписывать приложение с нуля не нужно. TypeScript, React и Electron подходят продукту: ему нужны локальная файловая система, Java-процессы, нативные диалоги, системное хранилище секретов и кроссплатформенная упаковка. Основная проблема была не в языке или движке, а в размытых trust boundary, небезопасной автоматизации релиза, накопленном UI-долге и отсутствии честного release gate. Полный rewrite уничтожил бы проверенную доменную логику и сотни тестов, не устранив эти причины.

Правильная стратегия: сохранить стек, сузить IPC и файловые границы, заменить действительно проблемные зависимости, разрезать крупные сервисы и выпускать небольшими проверяемыми итерациями.

## P0 — безопасность и целостность данных

- [x] Закрыть path traversal в updater, datapack и launch-путях.
- [x] Ограничить удалённые URL публичным HTTPS и разрешёнными CDN там, где контракт известен.
- [x] Сделать загрузки потоковыми, ограничить размер и проверять hash до атомарного rename.
- [x] Ввести единую политику ZIP: лимиты, zip-slip, symlink, duplicate, encryption, zip bomb.
- [x] Разрешать `app:saveFile` только для пути, выбранного в нативном save-dialog, один раз и с TTL.
- [x] Убрать access/client tokens из renderer-модели аккаунта; мигрировать plaintext в Electron `safeStorage`.
- [x] Валидировать launch/network IPC payload на входе main process.
- [x] Включить Chromium sandbox у main и console window.
- [x] Заменить уязвимый `@xmcl/nat-api` на поддерживаемый `@achingbrain/nat-port-mapper`.
- [ ] Закрыть DNS rebinding проверкой фактических адресов соединения.
- [x] Заменить `adm-zip` на потоковые `yauzl`/`yazl` без открытого advisory и блокировать production audit на уровне high.
- [ ] Удалить generic IPC bridge и legacy `window.*` API после инвентаризации вызовов.

## P0 — сборка и релиз

- [x] Закрепить Node 24/npm 11, обновить Electron, electron-builder, electron-updater, Vite и безопасные транзитивные версии.
- [x] Вернуть unit/type/lint/contracts/IPC/audit/build gates в CI.
- [x] Добавить macOS Chromium visual-regression job и выгрузку diff при падении.
- [x] Переписать release script: clean tree до мутаций, SemVer, без shell interpolation и `git add -A`, dry-run, push только по флагу.
- [x] Собирать платформы независимо, а GitHub Release создавать один раз после успешной матрицы.
- [x] Публиковать неподписанные Windows/macOS artifacts с явным предупреждением в релизе; использовать signing secrets, когда они настроены.
- [ ] При необходимости настроить реальные сертификаты, Apple notarization и проверку подписи установленных артефактов.
- [ ] Добавить SBOM, checksum-файл и provenance/attestation для релизных файлов.
- [ ] Проверять автообновление с предыдущей подписанной версии на staging release channel.

## P1 — надёжность launcher и modpack

- [x] Отделить hard success создания локального modpack от вторичных metadata/settings refresh ошибок.
- [x] Свести secondary modpack surfaces к единой ширине, search/filter geometry, counters и inline degraded state.
- [x] Убрать дублирующий Import action из browser home.
- [x] Сделать обновление приложения consent-based: auto-check не начинает загрузку, пользователь нажимает Download.
- [ ] Ввести транзакции и rollback journal для install/update/import/delete.
- [ ] Сделать единую очередь загрузок с cancellation, resume, retry budget, disk-space preflight и checksum status.
- [ ] Перенести CPU/IO-heavy manifest diff, archive scan и large directory scan из Electron main thread в worker threads.
- [ ] Добавить блокировку конкурентных операций над одним instance и идемпотентное восстановление после crash.
- [ ] Покрыть реальные установки Vanilla/Forge/Fabric/NeoForge ограниченной nightly matrix.

## P1 — архитектура

- [ ] Разделить `modpackService.ts` на lifecycle, metadata, import/export и content transaction services.
- [ ] Свести duplicated path validation к одному capability-based filesystem API.
- [ ] Версионировать IPC contracts и генерировать preload/renderer bindings из одной схемы.
- [ ] Удалить explicit `any` на security и persistence boundaries; `unknown` валидировать схемой.
- [ ] Оформить ADR для runtime, IPC, archive policy, account-secret storage, updater и release channel.
- [ ] Добавить structured logging с correlation id и redaction токенов/локальных персональных путей.

## P1 — UX и доступность

- [x] Сделать Settings и Multiplayer взаимоисключающими overlay.
- [x] Исправить Escape/focus trap у вложенных modal.
- [x] Добавить accessible names window controls, tab semantics multiplayer и клавиатурное копирование room code.
- [x] Локализовать и адаптировать Console, убрать прямой raw IPC, добавить feedback экспорта/копирования.
- [x] Убрать жёстко зашитые `Enabled`/OptiFine labels.
- [ ] Пройти WCAG keyboard/screen-reader аудит всех dialog, tabs, toast, progress и error states.
- [ ] Проверить responsive layout на минимальном окне, 125–200% zoom и длинном русском тексте.
- [ ] Унифицировать destructive confirmations и показывать точный объект/последствия операции.
- [ ] Добавить понятный recovery screen после crash и ссылку на экспорт диагностического bundle.

## P2 — продуктовые доработки

- [ ] Решить судьбу CurseForge: полноценный API/auth/download contract либо убрать пункт навигации.
- [ ] Добавить release channels stable/beta с явным opt-in и rollback.
- [ ] Добавить backup policy для миров и modpack перед update/delete, retention и restore preview.
- [ ] Улучшить accounts: expiry/re-auth state, logout/revoke, weak-keyring warning, offline fallback.
- [ ] Добавить server favorites/history, ping diagnostics и понятное различие FriendTunnel/LAN/UPnP.
- [ ] Добавить conflict/dependency preview перед установкой mod и отчёт о несовместимости loader/game version.
- [ ] Сделать export/import reproducible: lockfile с hashes, loader/runtime metadata и diff preview.
- [ ] Добавить privacy-first crash report: локальный preview, redaction и только явная отправка.

## Документация

- [x] Обновить README, development contract и known issues под фактическое состояние.
- [x] Зафиксировать этот единый backlog с приоритетами и критериями выхода.
- [ ] Написать threat model и security response policy.
- [ ] Написать release/signing/notarization runbook и rollback procedure.
- [ ] Обновить architecture/contracts map после удаления legacy IPC.
- [ ] Добавить troubleshooting для Java, auth, downloads, modloader, UPnP и update.
- [ ] Добавить CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, CHANGELOG и third-party notices.

## Release criteria для `v0.7.0`

Стабильный `v0.7.0` допустим, когда проходят `npm ci`, `npm run verify`, production build на трёх ОС, macOS visual closeout и ограниченный full-install smoke. Production audit не должен содержать high или critical findings. В этом репозитории стабильные artifacts могут быть неподписанными; GitHub Release обязан явно предупреждать, что macOS и Windows могут показать сообщение о неизвестном разработчике. Signing, notarization и проверка установленного обновления остаются последующим hardening, но не блокируют публикацию.
