# AGENTS.md — `electron/`

## Scope
This directory owns the main process: app bootstrap, BrowserWindow creation, preload exposure, IPC handlers, and native services.

## Where To Look
- App startup and lifecycle: `app/bootstrap.ts`, `app/lifecycle.ts`
- Window creation, title bar, preload wiring: `window/windowManager.ts`
- Preload entry and exposed browser APIs: `preload.ts`, `preload/bridges/*`
- IPC channel registration: `ipc/ipcManager.ts`
- Channel handlers: `ipc/handlers/*`
- Feature services:
  - launching: `services/launcher/*`
  - instances and files: `services/instances/*`
  - mods/resource packs/shaders/worlds/screenshots: `services/mods/*`, `services/resourcePacks/*`, `services/shaders/*`, `services/screenshots/*`
  - updater/account/share/stats: `services/updater/*`, `services/account/*`, `services/sharing/*`, `services/stats/*`

## Working Rules
- Keep Node access out of the renderer. Extend preload bridges instead of loosening BrowserWindow security.
- If you change an IPC surface, update all of these in one pass:
  - `shared/contracts/*`
  - `shared/contracts/windowApi.ts`
  - `preload/bridges/*` and `preload.ts`
  - `ipc/ipcManager.ts` plus the matching handler in `ipc/handlers/*`
  - renderer wrapper in `src/services/ipc/*`
  - `docs/ru/contracts-map.md`
- Prefer feature-local services over putting new logic directly into handlers.
- Check nearby tests under `services/**/__tests__` before changing persistence or launcher behavior.

## Verification
- `npx eslint electron/`
- `npx vitest run electron/services`

## Cleanup
- Do not leave Electron or Vite processes running after verification.
- If you opened an interactive session for main-process testing, stop it before handoff.
