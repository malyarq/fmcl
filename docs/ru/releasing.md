# Регламент релиза

FriendLauncher использует запускаемый вручную GitHub workflow, который создаёт тег в самом конце. Защищённая публикация создаёт неизменяемый аннотированный SemVer-тег только после успешных проверок исходников, нативных сборок, package smoke, контрольных сумм и повторной проверки скачанных артефактов. Prerelease-версия публикуется как non-latest, обычная `MAJOR.MINOR.PATCH` становится последним стабильным релизом.

## Подготовить точного кандидата

Начните с чистой ветки. Версия кандидата коммитится до создания release report; release helper никогда не запускает `npm version` сам.

```bash
nvm use
npm ci
npm version <version> --no-git-tag-version --ignore-scripts
git add package.json package-lock.json
git commit -m "chore: prepare v<version> candidate"
```

Проверьте, что в `package.json` и `package-lock.json` одна версия, рабочий каталог чистый, а `v<version>` ещё не существует. Затем соберите локальные доказательства готовности:

```bash
npm run build -- --publish never --mac --win --linux
npm run release -- <version> --dry-run
```

Первая команда готовит три ожидаемых артефакта в `release/<version>`, но ничего не публикует. Если cross-build недоступен, соберите пакеты на нативных runner'ах и до dry run сложите точные DMG, NSIS installer и AppImage в этот каталог; отсутствующий пакет или пакет без хеша считается ошибкой, а не `unsupported-runner` evidence. Затем dry run использует общий release profile на Node 24, запускает доступный package smoke, записывает checksums и release evidence, создаёт schema-valid pre-push report и проверяет его точное соответствие версии, тегу, текущему commit и подготовленным артефактам. Он не создаёт commit, тег, push, удалённую операцию или GitHub Release. Обычно report находится в `quality/evidence/prepush-release-report.json`; этот ignored локальный файл нужно пересоздавать после любого изменения candidate commit или артефактов.

## Проверить доказательства

До любого release-действия просмотрите pre-push report. В нём указаны точные version/предлагаемый tag/commit, все этапы quality profile, пути к артефактам и SHA-256 checksums, platform smoke с причинами unsupported runner, статус signing/notarization, known failures и неизменяемый rollback action.

Checksums подтверждают только целостность артефактов. Локальный report — это evidence для решения, а не security boundary, доказательство издателя или разрешение на публикацию. Текущие macOS DMG и Windows-артефакты не подписаны издателем, если platform verification evidence не говорит обратного. Локальная ad-hoc подпись macOS-приложения не доказывает ни личность издателя, ни notarization; их нельзя выводить из checksum или успешного запуска. Диалоги Gatekeeper и SmartScreen зависят от ОС и репутации: их проверяют вручную на целевой платформе и фиксируют отдельно.

## Запуск публикации

Локальный helper только собирает evidence и никогда не создаёт и не отправляет тег. Закоммитьте подготовленную версию в `main`, зафиксируйте точный commit и запустите workflow с версией и commit:

```bash
COMMIT=$(git rev-parse HEAD)
gh workflow run release.yml -f version=<version> -f commit="$COMMIT"
```

Workflow отклоняет commit, который уже не является точным `origin/main`, несовпадающую версию в `package.json`, существующий тег или существующий GitHub Release. Не создавайте релизный тег локально заранее.

Перед dispatch публикации администратор репозитория настраивает **Settings → Environments → `release-publication`**:

1. Добавляет required reviewers.
2. Ограничивает deployment разрешёнными release refs.
3. Проверяет, что gate применяется к job `publish`.

Для официальной release-сборки также нужны GitHub repository variables:

- `POSTHOG_PROJECT_TOKEN` — публичный project token проекта PostHog EU;
- `POSTHOG_HOST` — необязательно; пустое значение использует `https://eu.i.posthog.com`.

До первого релиза откройте в PostHog **Settings → Project → General**, выключите сбор IP, не используйте person profiles и проверьте, что хранение не превышает 12 месяцев. Workflow не собирает релиз без project token, но облачные privacy-настройки владелец проверяет вручную.

Код репозитория не может создать или гарантировать эти правила защиты. Maintainer вручную запускает **Build and Release** через `workflow_dispatch` и передаёт закоммиченную версию вместе с точным 40-символьным commit из `main`. Workflow самостоятельно checkout'ит commit, на каждом нативном runner скачивает предыдущий опубликованный пакет, проверяет обновление на месте с сохранением пользовательских данных и отображением новой версии, затем валидирует артефакты, checksums, smoke и schema-valid evidence. До создания публичных объектов workflow ждёт protected Environment `release-publication`. Только этот job создаёт аннотированный тег и GitHub Release. Для стабильного релиза изменяемый тег `latest` переносится только после успешной публикации. Release notes собираются из всех записей `CHANGELOG.md` после предыдущего опубликованного стабильного релиза, поэтому брошенный тег не скрывает доставленные изменения.

Если загрузка артефактов падает до публикации, workflow удаляет свой draft и только что созданный тег. После публикации действует неизменяемость: тег и артефакты сохраняются, а последующая проблема исправляется новым patch-релизом.

## Ошибка и откат

- Prerelease-теги остаются non-latest; stable-теги становятся latest только через тот же защищённый publication job.
- Если evidence, smoke или OS trust-поведение не проходит, отзовите релиз или снимите с `latest`, где это разрешено хостом, разберитесь и выпустите новый patch, когда всё готово.
- Никогда не перемещайте и не перезаписывайте существующий stable tag или asset. Не заменяйте байты под уже существующей версией.
- Пересоздавайте report при смене candidate commit или набора артефактов: старый report намеренно отклоняется как устаревший.
