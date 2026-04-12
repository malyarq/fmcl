# Known Issues / Известные проблемы

> Документ создан: 2026-04-12  
> Последний аудит: commit `c308053`

---

## 🔴 Критические (ESLint Errors)

### 1. `BackgroundLayer.tsx` — условный вызов React Hook
**Файл:** `src/components/layout/BackgroundLayer.tsx:70`  
**Ошибка:** `react-hooks/rules-of-hooks` — `useMemo` вызывается условно (после раннего `return`).  
**Влияние:** Может привести к краху компонента в рантайме при изменении условий рендеринга.  
**Решение:** Переместить `useMemo` выше раннего `return`, или реструктурировать компонент так, чтобы хуки всегда вызывались в одинаковом порядке.

### 2. `AccountsPage.tsx` — обращение к переменной до объявления
**Файл:** `src/features/accounts/AccountsPage.tsx:16`  
**Ошибка:** `react-hooks/immutability` — `loadAccounts` используется в `useEffect` до своего объявления.  
**Влияние:** В runtime JavaScript hoisting для `const` не поднимает значение — вызовет `ReferenceError`.  
**Решение:** Переместить объявление `loadAccounts` перед `useEffect`, или использовать `useCallback` и добавить в зависимости эффекта.

---

## 🟡 Предупреждения (ESLint Warnings)

### 3. `ShareModal.tsx` — setState внутри useEffect
**Файл:** `src/features/share/ShareModal.tsx:24`  
**Предупреждение:** `react-hooks/set-state-in-effect` — синхронный вызов `setLoading(true)` внутри `useEffect` вызывает каскадные ре-рендеры.  
**Решение:** Использовать `useReducer` или вынести логику в отдельный хук с `useTransition` / `startTransition`.

### 4. `StorageTab.tsx` — отсутствующая зависимость useEffect
**Файл:** `src/components/settings/tabs/StorageTab.tsx:39`  
**Предупреждение:** `react-hooks/exhaustive-deps` — `loadStats` отсутствует в массиве зависимостей.  
**Решение:** Обернуть `loadStats` в `useCallback` и добавить в зависимости, или вынести логику в эффект напрямую.

### 5. Множественные `@typescript-eslint/no-explicit-any`
**Файлы:**
- `src/components/layout/BackgroundLayer.tsx:143`
- `src/components/modpacks/ModpackList.tsx:299`
- `src/components/settings/tabs/AppearanceTab.tsx:48, 411`
- `src/features/accounts/AddAccountDialog.tsx:54`

**Решение:** Заменить `any` на конкретные типы или `unknown`.

---

## 🟠 Рассогласование документации (EN ↔ RU)

### 6. Roadmap EN отстаёт от RU
**Проблема:** В русском `roadmap.md` Фазы 5 (Темы, Фоны, Частицы) и Фазы 6 (Аккаунты, Зеркала, Статистика, Шаринг) отмечены как `[x]` (реализовано). В английском `roadmap.md` те же пункты всё ещё `[ ]` (не реализовано).  
**Затронуто:**
- Phase 5.1: Extended Themes (EN: `[ ]`, RU: `[x]`)
- Phase 5.2: Background Effects (EN: `[ ]`, RU: `[x]`)
- Phase 5.3: Additional UI Settings (EN: `[ ]`, RU: `[x]`)
- Phase 6.1: Custom Accounts (EN: `[ ]`, RU: `[x]`)
- Phase 6.2: Mirrors and CDN (EN: `[ ]`, RU: `[x]` — частично)
- Phase 6.3: Statistics (EN: `[ ]`, RU: `[x]` — частично)
- Phase 6.4: Social Features (EN: `[ ]`, RU: `[x]`)

**Решение:** Синхронизировать чекбоксы в `docs/en/roadmap.md` с `docs/ru/roadmap.md`.

---

## 🔵 Архитектурные замечания

### 7. Отсутствие тестов
**Проблема:** В проекте нет unit/integration тестов. При таком объёме кода (160+ файлов) это создаёт риск регрессий.  
**Решение:** Добавить хотя бы smoke-тесты для критических сервисов: `modpackService`, `instanceService`, `contentManager`, `shareService`.

### 8. `update_share_locales.cjs` — утилитарный скрипт в корне
**Проблема:** Одноразовый скрипт находится в корне проекта.  
**Решение:** Переместить в папку `scripts/` или удалить если больше не нужен.

### 9. Размер коммита
**Проблема:** Коммит `c308053` содержит 163 изменённых файла и +11000 строк. Это затрудняет code review и откат отдельных фич.  
**Рекомендация:** В будущем делать атомарные коммиты по фичам (1 фича = 1 коммит/PR).

---

## ✅ Что в порядке

- **TypeScript компиляция** — проходит без ошибок (`tsc --noEmit` ✅)
- **Структура проекта** — логичная, по фичам и слоям
- **Контракты** — IPC каналы определены через shared/contracts
- **Интернационализация** — ключи добавлены в обе локали (EN/RU)
- **Git** — корректно запушен на `origin/main`
