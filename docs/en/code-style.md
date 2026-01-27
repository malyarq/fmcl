## Code style (English)

This project aims for **boring consistency**. If in doubt, follow nearby code.

---

## TypeScript

- **No `any`** (lint is `--max-warnings 0`). Prefer:
  - **`unknown`** + narrow, or
  - proper interfaces/types.
- Prefer **explicit domain types** in `src/contexts/*/types.ts` and `electron/**/types.ts`.
- **Public surfaces must be typed**:
  - `window.*` → `src/vite-env.d.ts`
  - IPC wrappers → `src/services/ipc/*`

---

## React / UI

- Prefer **small components** with clear props.
- Keep business logic out of UI:
  - UI → calls `src/services/ipc/*` or context actions.
  - Pure logic → `utils/` or `contexts/<domain>/utils`.
- Use hooks for side effects; avoid doing heavy work in render.

---

## Electron / IPC

- IPC wiring should stay thin:
  - register: `electron/ipc/ipcManager.ts`
  - handlers: `electron/ipc/handlers/*`
- Channel names and payload shapes are contracts.
  - If changed, update `contracts-map.md` and `src/vite-env.d.ts`.

---

## Naming and file layout

- Keep **domain folders** for domain logic: `electron/services/<domain>`, `src/contexts/<domain>`.
- Keep **wiring folders** for wiring: `electron/ipc`, `electron/preload`, `src/services/ipc`.
- Avoid “god files”: if a file owns multiple domains, split it.

---

## Localization

- Any user-facing string should go through `t('...')` and be present in:
  - `src/locales/en.json`
  - `src/locales/ru.json`

