# Архитектура

FriendLauncher — десктопное Electron-приложение с React renderer, собранным через Vite. Все нативные возможности принадлежат main process; там же собирается один канонический домен инстансов. Renderer получает типизированные операции без доступа к файловой системе.

```mermaid
flowchart LR
  UI["React renderer\nsrc/"] --> W["Типизированные обёртки\nsrc/services/ipc/"]
  W --> P["Узкие preload capabilities\nelectron/preload/"]
  P --> I["Валидация и IPC handlers\nelectron/ipc/"]
  I --> C["Composition root\nelectron/app/compositionRoot.ts"]
  C --> A["InstanceApplication\nelectron/domains/instances/"]
  C --> O["OperationRunner\nelectron/services/operations/"]
  A --> CP["JsonControlPlaneStore\nelectron/infrastructure/instances/"]
  A --> AD["Внедрённые filesystem и launch adapters"]
  O --> AD
  SC["Общие контракты\nshared/contracts/"] -. типы .-> W
  SC -. типы .-> P
  SC -. типы .-> I
```

## Границы процессов

### Renderer (`src/`)

Renderer отвечает за интерфейс, переводы, состояние представления и координацию функций. Он работает с `nodeIntegration: false`, `contextIsolation: true` и включённым Electron sandbox.

Правила:

- Не импортировать Node.js или Electron.
- Не принимать и не восстанавливать корень лаунчера, пути инстансов и архивов или путь к Java executable.
- Использовать обёртки `src/services/ipc/*`; не размазывать `window.api.*` по дереву компонентов.
- Любую пользовательскую строку добавлять в `src/locales/en.json` и `src/locales/ru.json`.
- Launch UI живёт в одном дереве `src/features/launcher/`; параллельной реализации launcher быть не должно.

### Preload (`electron/preload.ts`, `electron/preload/bridges/`)

Preload — граница возможностей между renderer и main. Он экспортирует ровно один global — `window.api` из `shared/contracts/windowApi.ts`. Каждый его элемент — узкий семантический контракт. Raw-методы `invoke`, `send`, `on` и `off` renderer-коду недоступны.

Непрозрачный ID не является замаскированным путём. Ссылки на архив привязаны к sender, имеют срок жизни и используются один раз. ID установки Java краткоживущие и привязаны к корню лаунчера, для которого выполнялось сканирование.

### Main process (`electron/`)

Main process отвечает за lifecycle, окна, нативные диалоги, Java-процессы, загрузки, архивы, аккаунты, игровые файлы, обновления и multiplayer networking.

- `electron/app/` — bootstrap и единственный production composition root
- `electron/domains/instances/` — канонические команды, состояние, порты и application service инстансов
- `electron/infrastructure/instances/` — control-plane и filesystem adapters
- `electron/services/operations/` — staged-операции, журнал, root lock и recovery
- `electron/services/*` — узкие content, provider, launcher, account, network и updater services
- `electron/ipc/` — валидация входов и регистрация handlers
- `electron/security/` — правила путей, URL, архивов, разрешений и save-path
- `electron/preload/` — типизированные возможности renderer

`electron/app/bootstrap.ts` один раз создаёт весь граф, восстанавливает зарегистрированные операции до открытия handlers и передаёт внедрённые зависимости в `IPCManager`. Production handlers и services не создают собственные instance store, application или operation runner.

### Общие контракты (`shared/`)

- `shared/contracts/*` описывает preload-интерфейсы и сериализуемые IPC DTO.
- `shared/contracts/ipcChannels.ts` содержит allowlist каналов.
- `shared/contracts/windowApi.ts` задаёт всю поддерживаемую поверхность `window.api`.
- `shared/types/*` содержит данные, общие для процессов.

Не создавайте вторую копию cross-process типа в renderer или main. Публичные запросы операций не могут содержать `rootPath` или `filePath`.

## Граф владения

| Домен | Канонический владелец в main process | Владелец в renderer |
| --- | --- | --- |
| Lifecycle инстансов и выбранное состояние | `electron/domains/instances/instanceApplication.ts` с `electron/infrastructure/instances/jsonControlPlaneStore.ts` | `src/features/instances/InstanceQueryProvider.tsx` и сфокусированные selector, invalidation и command hooks |
| Transactional import, export, install, update, duplicate, delete | `electron/services/operations/operationRunner.ts` и operation adapters | `src/features/operations/`, `operationsIPC.ts` и feature, которая запускает операцию |
| Файлы модов и регистрация manifest | `electron/services/mods/instanceModContentService.ts`, `manifestContentInstaller.ts` | типизированные content adapters в `src/features/content/` и instance-scoped поверхности деталей |
| Запуск и Java | `electron/services/launcher/`, `electron/services/java/`, внедрённые instance/launch ports | `src/features/launcher/`, `src/components/SimplePlayDashboard.tsx` |
| Каталог и установка контента провайдеров | `electron/services/mods/platform/` и provider operation adapters | `useModpackBrowserCatalog`, типизированные content adapters и семантические IPC wrappers |
| Аккаунты | `electron/services/account/` | `src/features/accounts/` |
| Мультиплеер | `FriendTunnelService`, `LanDiscoveryService` и `PortMappingService` в `electron/services/network/` | единый live capability controller в `src/features/multiplayer/` |
| Обновления | `electron/services/updater/` | `src/features/updater/` |
| Ресурспаки, шейдеры, миры, датапаки, скриншоты | узкие services и проверяемые handlers в `electron/services/` и `electron/ipc/handlers/` | modpack detail/content features |

Разделения на базовый instance store и унаследованный modpack facade больше нет. `InstanceApplication` — единственный публичный владелец control-plane чтений и команд. Семантические services зависят от его портов и добавляют только собственное поведение для контента.

## Владение workflow в renderer

```mermaid
flowchart TD
  AP["AppProviders"] --> IQ["InstanceQueryProvider\nодно каноническое query-хранилище"]
  IQ --> IS["Сфокусированные selectors и команды"]
  IS --> SH["Sidebar и launcher shell"]
  IS --> ML["Список установленных сборок"]
  IS --> MD["Details и Classic"]
  AP --> OR["OperationRecoveryProvider"]
  OR --> RI["Inbox восстановления при запуске"]
  NAV["ModpackNavigationProvider"] --> ER["AppRecoveryBoundary без reload"]
  ER --> ROUTER["AppLayout и ModpackRouter"]
  FLOW["Feature-владелец изменения"] --> SESSION["useOperationSession"]
  SESSION --> POLICY["operationTerminalPolicy"]
  POLICY --> INV["Каноническая invalidation и честная презентация"]
  CONTENT["Routed, modal и Classic вход контента"] --> ADAPTER["Adapter модов, ресурспаков или шейдеров"]
  ADAPTER --> STATE["useContentAcquisitionState"]
  STATE --> SURFACE["ContentAcquisitionSurface"]
```

### Каноническое состояние инстансов

`AppProviders` монтирует ровно один `InstanceQueryProvider`. Его store делает один запрос каталога и публикует список инстансов и выбранный ID из одного ответа. Snapshots по ID удерживаются только пока есть потребители; параллельные чтения и invalidation объединяются, устаревшие поколения игнорируются, а записи конфигурации сериализуются по инстансу до канонической invalidation.

Shell, список установленных сборок, Details, Classic, Settings и launch-код читают сфокусированные selectors из `src/features/instances/hooks/`. Команды проходят через семантические services в `src/contexts/instances/services/` и возвращаются к тому же provider через явную invalidation. `ModpackContext`, aggregate compatibility hook, локального store выбранного инстанса и запасного list cache нет.

### Операции и восстановление

Каждая feature изменения владеет своим вызовом `useOperationSession`; hook отвечает за освобождение subscription, отмену, порядок terminal callbacks, reset и явный retry. `operationTerminalPolicy.ts` — единственный классификатор устойчивого commit, канонической invalidation и presentation success. Degraded-результат после commit может инвалидировать состояние, но не может выбрать инстанс, закрыть поверхность или заявить об успехе.

`OperationRecoveryProvider` один раз монтируется внутри query provider. Он принимает только внутренне согласованные очищенные записи восстановления, инвалидирует завершённую операцию не более одного раза и даёт просмотр, запоминаемое закрытие и безопасную навигацию. Панель восстановления не монтируется в отдельном окне отладочной консоли. Provider не восстанавливает скрытые входные данные и не запускает общий повтор операции. Использованный archive reference и истёкшее разрешение native save требуют нового действия пользователя.

`ModpackNavigationProvider` расположен выше `AppRecoveryBoundary`, поэтому маршрут и back history переживают восстановление на месте. Feature boundary обновляет канонические инстансы и recovery inbox без перезагрузки renderer. Полный reload renderer может запросить только provider-free bootstrap boundary после невосстановимой bootstrap-ошибки.

### Границы контента и поверхностей

Моды, ресурспаки и шейдеры используют общие `useContentAcquisitionState` и `ContentAcquisitionSurface`, но сохраняют типизированные adapters для реальной семантики provider, runtime, локального файла, manifest и retry. Partial commit оставляет только неуспешные логические элементы. Уже записанный файл не скачивается повторно только из-за ошибки последующей invalidation или регистрации manifest.

Список установленных сборок, browser, creation, Classic, Appearance и Details разделены на controller/state и render-focused модули. Постоянные владельцы навигации и settings остаются вне `Suspense`. List, Details, Appearance и Storage загружаются сразу; опциональные маршруты модпаков и тяжёлые вкладки Downloads, Launcher, Accounts и Statistics загружаются лениво только там, где границу оправдали production bundle measurements. Каждый fallback — подписанный polite status, который не подменяет состояние маршрута.

## Networking и application lifecycle

В networking нет глобального изменяемого mode и смешанного god service. `networkMode` выбранного instance выбирает только renderer surface; каждая capability main-процесса независимо владеет ресурсами и типизированным lifecycle snapshot:

```mermaid
flowchart LR
  UI["Multiplayer controller"] --> T["FriendTunnelService\nновый Hyperswarm на сессию"]
  UI --> L["LanDiscoveryService\nодно поколение XMCL socket"]
  UI --> U["PortMappingService\nвладелец gateway и mappings"]
  T --> TS["discovery + peer links + TCP bridge + muxers"]
  L --> LS["bind + точный listener + broadcast/ping"]
  U --> US["coalesced discovery + owned mappings"]
```

FriendTunnel проверяет room code фиксированного размера, подключает обработчик соединений до discovery flush, отменяет ожидающие peer waits и дожидается уничтожения discovery, локального TCP server, sockets и swarm. Mux parser ограничивает frames и буфер, отвергает неверные переходы command/session, выделяет session ID без коллизий и локализует protocol fault в peer connection. Remote close не отправляет повторный close.

LAN start/stop сериализованы, а очистка listener захватывает точное поколение XMCL. Ответ ping копируется в ограниченный serializable DTO. UPnP объединяет параллельный gateway discovery, удаляет mapping state только после успешного unmap и вызывает `gateway.stop()` для полной очистки. Ошибка очистки остаётся типизированным failed state, а не ложным idle. Сбой одной capability не останавливает две другие.

Session truth приходит из main snapshots и subscriptions. В local storage остаются только выбранная вкладка, порт и введённый room code; старые сохранённые room/mapped-port удаляются и не могут восстановить фантомную активную сессию.

### Порядок startup и shutdown

Обычный startup выполняется так:

```text
Electron ready
  -> запустить или проверить локальный AuthServer
  -> собрать один composition root
  -> восстановить operation journals
  -> создать window и tray
  -> установить application lifecycle owner
  -> зарегистрировать IPC handlers
```

Первый `before-quit` отменяется, пока выполняется один общий shutdown promise:

```text
закрыть IPC admission
  -> закрыть admission OperationRunner и дождаться durable terminal records
  -> закрыть admission InstanceApplication и дождаться принятых config writes
  -> независимо остановить FriendTunnel, LAN и UPnP
  -> остановить принадлежащий приложению AuthServer
  -> уничтожить tray
  -> повторно вызвать app.quit под completion guard
```

Повторные запросы quit используют тот же promise. Ошибки очистки собираются, не пропуская независимых owners. Запущенный Minecraft process намеренно независим и не завершается при закрытии лаунчера. `app.exit()` применяется только после явной очистки при ошибке startup или в изолированном full-install test, потому что Electron пропускает обычные quit events для этого API.

## Каноническое устойчивое состояние

Единственный поддерживаемый control-plane документ инстансов — `<launcher-root>/instance-control-plane.json`. `JsonControlPlaneStore` читает и записывает его через версионированный `AtomicJsonStore`: запись создаётся рядом с целевым файлом, синхронизируется и публикуется атомарным rename, а предыдущий корректный документ сохраняется как `.bak`. Повреждённый или неподдерживаемый документ не перезаписывается и остаётся доступен для восстановления.

Обычное чтение никогда не смотрит в legacy state и ничего там не переписывает. Только явная подготовка может прочитать `modpacks.json`, `modpacks-metadata.json` и `modpack.json` каждого инстанса. Она валидирует полный legacy-граф, атомарно публикует один канонический snapshot с migration provenance и на повторных запусках считает canonical primary или backup авторитетным. Пересоздаваемые кэши и сторонние форматы Minecraft намеренно не входят в control-plane контракт.

## Lifecycle транзакции и recovery

Многофайловые изменения проходят один lifecycle:

```text
валидация публичной команды
  -> разрешение launcher root и нативных ссылок в main
  -> получение root mutation lock
  -> запись в приватный staging
  -> проверка staged-результата
  -> сохранение backup при необходимости
  -> публикация изменений файловой системы
  -> commit канонической команды InstanceApplication
  -> публикация sanitised operation snapshot
```

`OperationRunner` отвечает за очередь, отмену, журнал, root lock и зарегистрированные recovery-команды. Журнал может содержать внутренние пути main process, необходимые для восстановления; публичные контракты операций и renderer wrappers — нет. Активные операции доступны только renderer-процессу, который их запустил. Восстановленные snapshots sanitised, terminal и read-only.

Archive import использует непрозрачный `archiveRef`; renderer не получает выбранный путь. Archive export — единственное намеренное исключение для публичного native save: `outputPath` создаётся диалогом main process, авторизуется для sender, один раз потребляется operation handler и далее хранится только во внутренних recovery-данных main. После перезапуска незавершённый export переходит в `recovery-required`, потому что недоверенный журнал не может заново создать истёкшее разрешение на запись.

### Протокол root mutation lock

Разрушительные root-wide операции используют протокол v3 в `.fmcl-operations/locks`. Неизменяемые записи Lamport bakery (`choosing` и `ticket`) выбирают одного writer; каждая запись содержит случайный token и уникальный путь к локальному Node socket владельца. Contender удаляет запись только когда socket однозначно отказал или отклонил token. Таймауты и неоднозначные ошибки локальной сети считаются live и блокируют операцию. Протокол не опирается на PID reuse или прошедшее время и безопасен при suspend процесса.

После победы writer удерживает атомарно опубликованный canonical bridge `mutation.lock` весь callback. Marker `mutation.lock.v3` задаёт границу offline upgrade: перед обновлением до v3, откатом или смешиванием сборок остановите все процессы FMCL с общим custom launcher root. Pre-v3 marker не reclaim-ится; операция fail-closed завершается `ROOT_LOCK_OFFLINE_UPGRADE_REQUIRED`.

## Направление зависимостей

Разрешённое направление:

```text
renderer feature
  -> renderer IPC wrapper
  -> preload semantic capability
  -> validated IPC handler
  -> dependency из composition root
  -> application port или узкий service
  -> infrastructure adapter / операционная система / provider
```

Обратные импорты запрещены. Domain-код не импортирует renderer, preload, регистрацию IPC, Electron или нативные модули Node. Infrastructure и native services реализуют порты, направленные внутрь; создаёт их только composition root.

## Автоматически проверяемые инварианты

`npm run architecture:check` содержит fixture-тесты, которые падают при появлении:

- удалённых legacy owners, stores, transports, aliases и второго launch tree;
- создания canonical store, application service или operation runner вне composition root и тестов;
- Node/Electron imports в instance domain;
- прямой записи control-plane вне `JsonControlPlaneStore`;
- renderer authority через `instancePath`, `resolvePath` и публичные operation `rootPath`/`filePath`;
- импортов удалённого mixed `modpacks` transport.
- восстановления удалённого network god service, переиспользуемого Hyperswarm manager, глобального mode sync или helpers с сохранённой active-session truth.

Дополнительные инварианты безопасности:

- Данные renderer считаются недоверенными на каждой границе main process.
- Дочерние имена и provider IDs валидируются до разрешения путей в main.
- Удалённые URL проходят общую policy, архивы — единую archive policy.
- Секреты аккаунтов остаются в main и шифруются Electron `safeStorage`, когда он доступен.
- Внешняя навигация запрещена внутри приложения и проходит через проверяемый external-link handler.
- Обновление приложения скачивается только после согласия пользователя.

Подробности: [модель безопасности](security.md), [карта IPC-контрактов](contracts-map.md) и [известные проблемы](known-issues.md).

## Несколько инстансов в разработке

В production работает один экземпляр приложения: повторный запуск фокусирует существующее окно и сохраняет единый канонический профиль. В dev можно намеренно запустить второй локальный процесс с суффиксом в Electron `userData`. Порты локальных helper-сервисов зависят от номера инстанса; не добавляйте фиксированный порт в обход этой модели. Процессы, намеренно использующие один launcher root, сериализуются root mutation protocol.

## Изменение cross-process функции

Проверьте весь путь:

1. общий контракт и allowlist каналов;
2. preload bridge и тип `window.api`;
3. валидацию и handler в main process;
4. application port или узкий semantic service;
5. injection в composition root;
6. renderer wrapper и UI consumer;
7. тесты и обе языковые карты контрактов.

Перед ревью запустите `npm run verify`, `npm run contracts:check`, `npm run ipc:check` и `npm run architecture:check`.
