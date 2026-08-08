# AGENTS.md — Burrow

## Project Purpose
Burrow is an Electron-based Minecraft launcher with vanilla play, modpacks, updater flows, account management, and Burrow Link multiplayer.

Stack: `Electron` + `React` + `TypeScript` + `TailwindCSS` + `Vite`.

## Start Here
- App shell and renderer boot: `src/main.tsx`, `src/App.tsx`, `src/components/AppLayout.tsx`
- Main process boot and windows: `electron/app/bootstrap.ts`, `electron/app/lifecycle.ts`, `electron/window/windowManager.ts`
- Preload and exposed browser APIs: `electron/preload.ts`, `electron/preload/bridges/*`
- IPC contract and handler registration: `shared/contracts/*`, `shared/contracts/windowApi.ts`, `electron/ipc/ipcManager.ts`, `electron/ipc/handlers/*`, `src/services/ipc/*`
- UI areas:
  - classic/simple play: `src/components/SimplePlayDashboard.tsx`, `src/components/Sidebar.tsx`
  - modpacks: `src/components/modpacks/*`, `src/features/modpacks/*`
  - settings/theme/i18n: `src/components/settings/*`, `src/contexts/SettingsContext.tsx`, `src/contexts/settings/i18n.ts`
  - accounts: `src/features/accounts/*`
  - multiplayer: `src/features/multiplayer/*`
- Current product limitations and QA context: `docs/KNOWN_ISSUES.md`, `docs/en/known-issues.md`, and `docs/ru/known-issues.md`

## Directory Guide
- `electron/` — main-process lifecycle, windows, preload, IPC handlers, native services. See `electron/AGENTS.md`.
- `src/` — renderer UI, contexts, features, IPC wrappers, manual verification UI. See `src/AGENTS.md`.
- `shared/` — contracts and types shared by main and renderer. See `shared/AGENTS.md`.
- `docs/` — architecture, roadmap, testing, contracts, known issues. See `docs/AGENTS.md`.
- Product direction and accepted limitations live in the mirrored roadmaps and known-issues documents under `docs/{en,ru}/`. Historical implementation detail belongs in Git history, not in an active planning tree.

## Build And Verify
- `npx tsc --noEmit` — TypeScript type check. Must pass after code changes.
- `npx eslint src/` — renderer lint.
- `npx eslint electron/` — main-process lint.
- `npx vitest run` — test suite.
- `npm run lint` — full lint with zero warnings.
- `npm run dev` — interactive Vite dev session. Use only when manual verification is necessary.
- `npm run build` — production build.

## Non-Negotiables
- Use TypeScript strict mode. Prefer exact types or `unknown`; any unavoidable explicit `any` must stay narrowly scoped, justified, and lint-clean.
- Define IPC contracts in `shared/contracts/*`, register channels in `electron/ipc/ipcManager.ts`, expose preload surface through `electron/preload/bridges/*` and `electron/preload.ts`, and consume them through `src/services/ipc/*`.
- Renderer UI should not call `window.*` APIs directly when an IPC wrapper exists.
- All user-facing strings belong in `src/locales/en.json` and `src/locales/ru.json`.
- Update both `docs/en/contracts-map.md` and `docs/ru/contracts-map.md` when adding or changing IPC channels.
- Update both `docs/en/roadmap.md` and `docs/ru/roadmap.md` only when product direction or accepted limitations change; completed work belongs in `CHANGELOG.md`.
- Run `npm run docs:check` after changing maintained Markdown documentation.
- Prefer nearby `__tests__` as the behavioral reference before changing a feature.

## Agent Workflow
- Read the nearest `AGENTS.md` before editing inside a subdirectory.
- Start from the narrowest relevant entrypoint instead of scanning the whole repository.
- For UI bugs, inspect the component, its hooks, its IPC wrapper, and nearby tests together.
- For IPC work, trace the full path in this order: shared contract -> preload bridge -> IPC handler -> renderer wrapper -> UI consumer.
- For documentation tasks, update both language variants when the document is mirrored in `docs/en` and `docs/ru`.

## Process Hygiene
- Do not leave long-lived processes, terminals, browser sessions, watchers, or spawned agents running after the task.
- Before final handoff, stop any `npm run dev`, `vite`, `electron`, `vitest --watch`, manual verification server, headless browser, or MCP watch that you started.
- Reuse an existing interactive session when possible; do not open duplicate dev servers for the same repo.
- If you are unsure what is still running, inspect with `ps -ax | rg '/Users/kszinikov/work/(fmcl|burrow)|vite|electron|vitest|playwright|chromium'` and stop only the processes started for this repo/task.
- If you spawned sub-agents, watches, or background PTY sessions, close or unwatch them before finishing.

## Git
- Make one commit for one finished, coherent result; do not preserve intermediate agent iterations as history.
- Write a short, concrete subject that explains the result without task context. Conventional prefixes are allowed, but the words after the prefix must carry the meaning.
- Never put phase, plan, wave, review, or agent-task numbers in commit messages. Avoid subjects such as `progress`, `checkpoint`, `address feedback`, or `continue work`.
- Add a body only when a maintainer needs the reason, migration consequence, or non-obvious tradeoff.
