# AGENTS.md — `src/`

## Scope
This directory owns the renderer: app composition, pages, feature UI, contexts, hooks, IPC wrappers, and manual verification screens.

## Where To Look
- Renderer boot: `main.tsx`
- Top-level composition and routing shell: `App.tsx`, `components/AppLayout.tsx`
- Shared shell UI: `components/TitleBar.tsx`, `components/Sidebar.tsx`, `components/layout/*`
- Classic/simple play flows: `components/SimplePlayDashboard.tsx`, `features/launch/*`, `features/launcher/*`
- Modpack flows: `components/modpacks/*`, `features/modpacks/*`
- Settings/theme/localization: `components/settings/*`, `contexts/SettingsContext.tsx`, `contexts/settings/i18n.ts`, `locales/en.json`, `locales/ru.json`
- Accounts/multiplayer/share/screenshots/updater: `features/accounts/*`, `features/multiplayer/*`, `features/share/*`, `features/screenshots/*`, `features/updater/*`
- IPC wrappers used by UI: `services/ipc/*`
- Manual verification harness: `verification/manual/*`

## Working Rules
- Prefer editing the smallest feature area that owns the screen or behavior.
- UI code should go through `services/ipc/*` rather than calling `window.api` directly.
- When changing strings, update both `locales/en.json` and `locales/ru.json`.
- When fixing a regression, inspect nearby `__tests__` first; many renderer behaviors already have targeted tests.
- Keep theme, accessibility, and responsive behavior consistent with existing tests around the same component.

## Verification
- `npx eslint src/`
- `npx vitest run src/components src/features src/utils`

## Cleanup
- Avoid leaving manual verification servers, watch-mode tests, or browser sessions running.
- If you opened `npm run dev` only for UI inspection, stop it before handoff.
