# AGENTS.md — FriendLauncher (FMCL)

## Project Overview
Electron-based Minecraft launcher with P2P multiplayer (FriendTunnel).
Stack: Electron + React + TypeScript + TailwindCSS + Vite.

## Directory Structure
- `electron/` — Main process (services, IPC handlers, preload bridges)
- `src/` — Renderer process (React UI components, contexts, features)
- `shared/` — Shared contracts and types (IPC channels, API types)
- `docs/` — Documentation (EN/RU)

## Build & Verify Commands
- `npx tsc --noEmit` — TypeScript type check (MUST pass)
- `npx eslint src/` — Lint frontend (MUST have 0 errors, warnings OK)
- `npx eslint electron/` — Lint backend
- `npm run dev` — Run dev server (Vite + Electron)
- `npm run build` — Production build

## Coding Standards
- Use TypeScript strict mode. Never use `any` — use `unknown` or specific types.
- IPC contracts defined in `shared/contracts/` and registered in `electron/ipc/ipcManager.ts`.
- Preload bridges in `electron/preload/bridges/` expose API via `window.api.*`.
- Frontend IPC wrappers in `src/services/ipc/` — UI code should NOT call `window.*` directly.
- React hooks must follow rules-of-hooks strictly (no conditional hooks).
- Use `useCallback` for functions passed to `useEffect` dependencies.
- All user-facing strings in `src/locales/en.json` and `src/locales/ru.json`.
- Update `docs/ru/contracts-map.md` when adding/changing IPC channels.
- Update both `docs/en/roadmap.md` AND `docs/ru/roadmap.md` when completing features.

## Known Issues (fix these first)
See `docs/KNOWN_ISSUES.md` for current bugs and warnings.

## Testing
- No test framework configured yet. When adding tests, use Vitest.
- Run tests with: `npx vitest run`

## Git
- Atomic commits: 1 feature/fix = 1 commit
- Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
