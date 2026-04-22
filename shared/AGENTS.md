# AGENTS.md — `shared/`

## Scope
This directory contains contracts and types used by both Electron and the renderer.

## Where To Look
- IPC channel names: `contracts/ipcChannels.ts`
- Renderer API surface: `contracts/windowApi.ts`, `contracts/ipcRenderer.ts`
- Feature contracts: `contracts/account.ts`, `contracts/launcher.ts`, `contracts/modpacks.ts`, `contracts/mods.ts`, `contracts/resourcePacks.ts`, `contracts/shaders.ts`, `contracts/worlds.ts`, `contracts/settings.ts`, `contracts/share.ts`
- Shared constants: `constants.ts`
- Cross-process types: `types/*`

## Working Rules
- Keep shared contracts framework-neutral and serializable.
- Do not put Electron-only or React-only runtime logic here.
- When a contract changes, update the matching preload bridge, IPC handler, renderer wrapper, and docs in the same task.
- Prefer extending existing feature contract files over creating overlapping contract shapes.

## Verification
- `npx tsc --noEmit`
- `npm run contracts:check`
- `npm run ipc:check`
