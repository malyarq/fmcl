## Contracts (English)

This project has two public surfaces that must stay stable:

1) **IPC channel names + payload shapes** (renderer ↔ main)  
2) **`window.*` API** exposed by preload (renderer)

Canonical map (EN): [`docs/en/contracts-map.md`](./contracts-map.md).

---

## When you change IPC / preload

If you add/rename/remove something in:

- `electron/ipc/handlers/*`
- `electron/ipc/ipcManager.ts`
- `electron/preload.ts`
- `electron/preload/bridges/*`

You must also update:

- `docs/en/contracts-map.md` + `docs/ru/contracts-map.md` (contract map)
- `src/vite-env.d.ts` (renderer typings)
- `src/services/ipc/*` wrappers (preferred access path)

---

## Preferred access path in renderer

- **Do**: `src/services/ipc/<domain>IPC.ts`
- **Avoid**: direct `window.<bridge>.*` usage spread across UI
- **Avoid**: `window.ipcRenderer` escape hatch unless there is no alternative

If you use the escape hatch, add a note in `contracts-map.md` and consider introducing a typed wrapper instead.

---

## Versioning rule of thumb

- Renaming a channel or changing payload shapes is a **breaking change**.
- Adding a new optional field is usually **non-breaking**.

