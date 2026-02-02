# Ревью на наличие монолитов

Обзор крупных файлов и компонентов, которые несут несколько ответственностей или объём кода, и рекомендации по разбиению.

---

## 1. Frontend (src)

### 1.1 `ModpackDetails.tsx` (~825 строк) — **явный монолит**

**Что внутри одного файла:**
- **Три вкладки:** «Информация», «Моды», «Настройки» — весь UI и логика вкладок в одном компоненте.
- **Много состояния:** `metadata`, `loading`, `activeTab`, `showUpdateModal`, `hasUpdate`, `mods`, `loadingMods`, `modSearchQuery`, `modFilterStatus`, `modpackConfig`, `descriptionDraft`.
- **Десятки обёрток над контекстом:** `handleSetMemoryGb`, `handleSetJavaPath`, `handleSetVmOptions`, `handleSetGameExtraArgs`, `handleSetGameResolution`, `handleSetAutoConnectServer`, `handleSetRuntimeMinecraft`, `handleSetRuntimeLoader`, `handleSetUseOptiFine` и т.д.
- **Разная доменная логика:** загрузка метаданных, проверка обновлений, загрузка списка модов, загрузка конфига для настроек, сохранение описания, удаление, дублирование, экспорт.

**Рекомендации:**
- Вынести вкладки в отдельные компоненты:
  - `ModpackDetailsInfoTab` — описание, источник, кнопка «Сохранить описание».
  - `ModpackDetailsModsTab` — поиск/фильтр модов, список модов, включение/выключение, удаление.
  - `ModpackDetailsSettingsTab` — версия MC, лоадер, OptiFine, `GameTab` (память, Java, VM args, разрешение, авто-подключение).
- Вынести общую шапку: `ModpackDetailsHeader` (иконка, название, версия, лоадер, автор, табы).
- Собрать все `handleSet*` в один хук `useModpackDetailsConfig(modpackId, isSelectedModpack, ...)`, который возвращает один объект с полями и сеттерами.
- Нижний блок кнопок (Play, Update, Duplicate, Export, Delete) можно оставить в `ModpackDetails` или вынести в `ModpackDetailsActions`.

---

### 1.2 `ModpackList.tsx` (~602 строки) — **монолит**

**Что внутри:**
- Кастомный хук `useModpackListValues()` для отписки от лишних обновлений контекста.
- Внутренний компонент `ModpackListComponentInternal` с загрузкой, hotkeys, контекстным меню, drag & drop.
- Локальные компоненты: `ModpackCardSkeleton`, `ModpackCard` (крупный кусок JSX и логики).
- Вся логика списка: загрузка, синхронизация с контекстом, выбор, удаление, перетаскивание файлов, контекстное меню.

**Рекомендации:**
- Вынести `ModpackCard` и `ModpackCardSkeleton` в отдельные файлы, например `ModpackCard.tsx`, `ModpackCardSkeleton.tsx`.
- Вынести `useModpackListValues` в `features/modpacks/hooks/useModpackListValues.ts` (или в папку рядом с `ModpackList`).
- Логику drag & drop и контекстного меню можно оставить в `ModpackList` или вынести в хук `useModpackListDragDrop` / `useModpackListContextMenu`.

---

### 1.3 `SimplePlayDashboard.tsx` (~473 строки) — **средний монолит**

**Что внутри:**
- Логика «пасхалки» по клику на логотип (частота кликов, таймауты, частицы).
- Генерация и анимация частиц (`Particles`, `generateParticles`).
- Блок запуска (версия, ник, лоадер, RAM, офлайн).
- Блок «последняя игра» и кнопки (мультиплеер, настройки, «играть последнее»).

**Рекомендации:**
- Вынести генерацию/состояние частиц и обработчик клика по логотипу в хук `useLogoEasterEgg()` или в мелкий компонент `LogoWithEasterEgg`.
- Вынести блок «последняя игра» в компонент `LastGameBlock`.
- Основной блок запуска уже получает `launch`/`runtime`/`actions` — можно оставить как есть или разбить на подкомпоненты по зонам (версия/ник, лоадер/RAM, кнопки).

---

### 1.4 `ModpackCreationWizard.tsx` (~444 строки)

**Что внутри:**
- Три шага мастера в одном компоненте.
- Состояние черновика в `localStorage`, валидация имени, шаги 1–2–3 с разным UI.

**Рекомендации:**
- Вынести шаги в компоненты: `WizardStepName`, `WizardStepRuntime`, `WizardStepReview` (или по текущим шагам 1/2/3).
- Вынести логику черновика в хук `useModpackCreationDraft(DRAFT_STORAGE_KEY)` (load/save draft, default draft).

---

### 1.5 `AddModModal.tsx` (~428 строк), `AddModPage.tsx` (~389 строк)

Один сценарий «поиск мода → выбор версии → установка». Размер большой, но ответственность одна. При желании можно вынести:
- поиск и список результатов в подкомпонент или хук `useModSearch`;
- выбор версии — в `ModVersionSelector` или оставить внутри.

---

### 1.6 `ModpackBrowser.tsx` (~379 строк)

**Что внутри:**
- Платформа (CurseForge/Modrinth), поиск, сортировка, фильтры (MC, лоадер), пагинация, избранное (`localStorage`).
- Список результатов и переход к установке/превью импорта.

**Рекомендации:**
- Вынести состояние поиска/фильтров/пагинации в хук `useModpackBrowserState` или `useModpackSearch`.
- Вынести избранное в хук `useModpackFavorites()` (load/save/toggle).
- Список карточек можно вынести в `ModpackBrowserList` с пропсами `results`, `onSelect`, `onInstall`, `favorites`, `onToggleFavorite`.

---

### 1.7 `ModpackList.tsx` — дублирование с модалками

Есть и модалки (`InstallModpackModal`, `CreateModpackModal`, `ExportModpackModal`, …), и страницы (`InstallModpackPage`, `ExportModpackPage`, …). Если сценарии совпадают, стоит унифицировать: либо страницы как единственный путь, либо модалки, чтобы не дублировать логику в двух местах.

---

## 2. Backend (electron)

### 2.1 `electron/services/modpacks/modpackService.ts` (~601 строка) — **перегруженный сервис**

**Что делает один класс:**
- Метаданные: get/update, list with metadata, create with metadata, delete (включая метаданные).
- Конфиг: наследует от `BaseModpackService` (list, create, rename, duplicate, delete, config load/save).
- Экспорт: из инстанса в манифест, в CurseForge/Modrinth/ZIP (делегирует в `exporters`, но точка входа одна).
- Импорт: getModpackInfoFromFile, importModpack (файл → инстанс + установка модов через platformService).
- Моды: getMods, addMod, removeMod, update (в т.ч. вызов платформы и скачивание).

**Рекомендации:**
- Оставить `ModpackService` фасадом, но выделить доменные подсервисы/модули:
  - **Metadata** — всё, что про `ModpackMetadata` (get, update, list with metadata, create with metadata) можно сгруппировать в отдельный модуль или класс `ModpackMetadataService`, который использует `storage` и базовый список модпаков.
  - **Export** — уже есть папка `exporters`; в `ModpackService` оставить только тонкие обёртки (exportModpack, exportModpackFromInstance).
  - **Import** — уже есть `importers`; в сервисе — только вызов импорта + обновление конфига/метаданных.
  - **Mods** — getMods/addMod/removeMod/update логично держать в одном месте, но можно вынести в `ModpackModsService` или в отдельный файл `modpackMods.ts` с чистыми функциями, если хочется уменьшить размер класса.
- Цель: уменьшить размер одного файла и явно разделить «метаданные», «конфиг», «экспорт», «импорт», «моды».

---

### 2.2 `electron/services/mods/platform/modPlatformService.ts` (~450 строк) — **две платформы в одном классе**

**Что внутри:**
- Поиск модов (Modrinth + CurseForge).
- Получение версий (Modrinth + CurseForge).
- Установка мода (скачивание, распаковка, копирование в инстанс) для обеих платформ.

**Рекомендации:**
- Ввести два адаптера: `ModrinthModAdapter` и `CurseForgeModAdapter` с общим интерфейсом (search, getVersions, install).
- `ModPlatformService` оставить фасадом: по платформе из запроса выбирает нужный адаптер и вызывает его. Так проще тестировать и добавлять новые платформы.

---

### 2.3 `electron/ipc/handlers/modpacksHandlers.ts` (~299 строк)

В одном файле регистрируются все IPC-хендлеры для модпаков: list, config, metadata, search, import, export, mods и т.д. Это один «монолит по регистрации», а не по логике.

**Рекомендации:**
- Разбить по доменам, например:
  - `modpacksListHandlers.ts` — list, listWithMetadata, getSelected, setSelected, create, rename, duplicate, delete.
  - `modpacksConfigHandlers.ts` — getConfig, saveConfig.
  - `modpacksMetadataHandlers.ts` — getMetadata, updateMetadata.
  - `modpacksSearchHandlers.ts` — searchCurseForge, searchModrinth, getCurseForgeVersions, getModrinthVersions.
  - `modpacksImportExportHandlers.ts` — import, getImportPreview, export и т.д.
  - `modpacksModsHandlers.ts` — getMods, addMod, removeMod, update (если есть).
- В `ipcManager` (или в одном `modpacksHandlers.ts`) только импортировать и вызывать эти группы. Так проще искать хендлеры и уменьшается размер одного файла.

---

## 3. Краткая сводка

| Место | Файл | Строк | Оценка | Главная рекомендация |
|-------|------|-------|--------|----------------------|
| src | `ModpackDetails.tsx` | ~825 | Монолит | Разбить на вкладки + хук конфига + шапка/действия |
| src | `ModpackList.tsx` | ~602 | Монолит | Вынести карточку, скелетон, хук списка |
| src | `SimplePlayDashboard.tsx` | ~473 | Средний | Вынести пасхалку/частицы и блок «последняя игра» |
| src | `ModpackCreationWizard.tsx` | ~444 | Средний | Шаги по компонентам, черновик в хук |
| src | `AddModModal.tsx` / `AddModPage.tsx` | 389–428 | Приемлемо | По желанию — хук поиска, компонент выбора версии |
| src | `ModpackBrowser.tsx` | ~379 | Средний | Хуки поиска и избранного, отдельный список |
| electron | `modpackService.ts` | ~601 | Перегружен | Метаданные/моды в отдельные модули, фасад оставить |
| electron | `modPlatformService.ts` | ~450 | Две платформы | Адаптеры Modrinth/CurseForge, фасад |
| electron | `modpacksHandlers.ts` | ~299 | Много хендлеров | Разбить по доменам (list, config, metadata, search, import/export, mods) |

Приоритет по разумному порядку рефакторинга:
1. **ModpackDetails** — самый тяжёлый компонент, разбиение по вкладкам и хуку конфига даст быстрый выигрыш.
2. **ModpackList** — вынос карточки и хука уменьшит файл и упростит чтение.
3. **modpackService** — выделение метаданных и (по желанию) модов в отдельные модули.
4. **modpacksHandlers** — разбиение по доменам для удобства навигации и поддержки.

После этого можно по необходимости браться за `SimplePlayDashboard`, `ModpackCreationWizard`, `ModpackBrowser` и `modPlatformService`.
