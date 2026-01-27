## Кодстайл (Русский)

Цель — **предсказуемая консистентность**. Если сомневаешься — смотри как сделано рядом.

---

## TypeScript

- **Без `any`** (lint c `--max-warnings 0`). Вместо этого:
  - **`unknown`** + сужение типов, или
  - нормальные интерфейсы/типы.
- Доменные типы держим в `src/contexts/*/types.ts` и `electron/**/types.ts`.
- **Публичные поверхности обязаны быть типизированы**:
  - `window.*` → `src/vite-env.d.ts`
  - IPC-обёртки → `src/services/ipc/*`

---

## React / UI

- Предпочитай **небольшие компоненты** с понятными props.
- Бизнес-логику держим вне UI:
  - UI → вызывает `src/services/ipc/*` или actions из контекстов.
  - “Чистая” логика → `utils/` или `contexts/<domain>/utils`.
- Сайд-эффекты — в хуках; не делай тяжёлую работу в render.

---

## Electron / IPC

- IPC wiring должен быть тонким:
  - регистрация: `electron/ipc/ipcManager.ts`
  - handlers: `electron/ipc/handlers/*`
- Имена каналов и payload’ы — контракты.
  - Любые изменения требуют обновления `contracts-map.md` и `src/vite-env.d.ts`.

---

## Имена и раскладка файлов

- Доменные папки — для доменной логики: `electron/services/<domain>`, `src/contexts/<domain>`.
- Папки “проводки” — для wiring: `electron/ipc`, `electron/preload`, `src/services/ipc`.
- Избегай “god files”: если файл отвечает за несколько доменов — разбивай.

---

## Локализация

- Любая строка для пользователя должна идти через `t('...')` и присутствовать в:
  - `src/locales/en.json`
  - `src/locales/ru.json`

