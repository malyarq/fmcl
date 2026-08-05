# Регламент релиза

FriendLauncher использует неизменяемые SemVer-теги и GitHub workflow, запускаемый только вручную. RC публикуется как prerelease и workflow не назначает его `latest`. Локальная команда может подготовить доказательства или, после отдельного явного решения, создать тег; публиковать релиз она не уполномочена.

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
npx electron-builder --publish never --mac --win --linux
npm run release -- <version> --dry-run
```

Первая команда готовит три ожидаемых артефакта в `release/<version>`, но ничего не публикует. Если cross-build недоступен, используйте нативный runner нужной платформы. Затем dry run использует общий release profile на Node 24, запускает доступный package smoke, записывает checksums и release evidence, создаёт schema-valid pre-push report и проверяет его точное соответствие версии, тегу, текущему commit и подготовленным артефактам. Он не создаёт commit, тег, push, удалённую операцию или GitHub Release. Обычно report находится в `quality/evidence/prepush-release-report.json`; этот ignored локальный файл нужно пересоздавать после любого изменения candidate commit или артефактов.

## Проверить доказательства

До любого release-действия просмотрите pre-push report. В нём указаны точные version/tag/commit, все этапы quality profile, пути к артефактам и SHA-256 checksums, platform smoke с причинами unsupported runner, статус signing/notarization, known failures и неизменяемый rollback action.

Checksums подтверждают только целостность артефактов. Локальный report — это evidence для решения, а не security boundary, доказательство издателя или разрешение на публикацию. Текущие артефакты macOS и Windows неподписаны, если platform verification evidence не говорит обратного; нельзя выводить подпись из checksum или успешного запуска. Диалоги Gatekeeper и SmartScreen зависят от ОС и репутации: их проверяют вручную на целевой платформе и фиксируют отдельно.

## Тег и запуск публикации

После отдельного одобрения точного report helper может создать подходящий аннотированный локальный тег только при наличии report и буквального значения локального approval:

```bash
npm run release -- <version> --report quality/evidence/prepush-release-report.json --approval approve-local-release
```

`--push` остаётся отдельным удалённым действием и сам по себе ничего не публикует. Helper отклоняет отсутствующий, невалидный, устаревший, несоответствующий или неодобренный report до создания тега или push. Локальное approval не даёт права на публикацию в GitHub и не отменяет review.

Перед dispatch публикации администратор репозитория настраивает **Settings → Environments → `release-publication`**:

1. Добавляет required reviewers.
2. Ограничивает deployment разрешёнными release refs.
3. Проверяет, что gate применяется к job `publish`.

Код репозитория не может создать или гарантировать эти правила защиты. Когда candidate tag уже доступен, maintainer вручную запускает **Build and Release** через `workflow_dispatch` и передаёт точный тег. Workflow самостоятельно checkout'ит тег, проверяет version/commit, заново валидирует artifact, checksum, smoke и schema-valid report, а затем ждёт protected Environment `release-publication` перед единственным publish job. Один push тега не запускает публикацию.

## Ошибка и откат

- RC остаётся prerelease и non-latest, пока отдельный одобренный stable-процесс не решит иначе.
- Если evidence, smoke или OS trust-поведение не проходит, отзовите релиз или снимите с `latest`, где это разрешено хостом, разберитесь и выпустите новый patch, когда всё готово.
- Никогда не перемещайте и не перезаписывайте существующий stable tag или asset. Не заменяйте байты под уже существующей версией.
- Пересоздавайте report при смене candidate commit или набора артефактов: старый report намеренно отклоняется как устаревший.
