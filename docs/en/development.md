# Development

## Requirements

- Node.js 24.x — pinned by `.nvmrc` and enforced by `package.json#engines`
- npm 11.x — pinned by `package.json#packageManager`
- Git
- Platform packaging tools required by electron-builder when producing installers
- Java and network access only for the optional full-installation harness

```bash
nvm use
npm ci
```

`npm ci` runs the validated XMCL compatibility postinstall automatically. Do not run `npm run postinstall` a second time unless you are diagnosing that patch.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite and the development Electron app. Stop it when finished. |
| `npm test` | Run the Vitest unit, component, service, security, and smoke suite once. |
| `npm run lint` | Run ESLint over the repository; warnings fail the command. |
| `npx tsc -p tsconfig.json --noEmit` | Type-check without writing build output. |
| `npm run docs:check` | Validate maintained Markdown links, required files, latest-release link, index coverage, and EN/RU mirrors. |
| `npm run contracts:check` | Compare documented IPC channels with the channel allowlist. |
| `npm run ipc:check` | Reject IPC calls that are not present in the allowlist. |
| `npm run audit:prod` | Fail on high or critical production dependency advisories. |
| `npm run verify` | Run unit tests, lint, typecheck, documentation/contract checks, IPC checks, and production audit. |
| `npm run test:visual:closeout` | Compare the macOS Chromium screenshots with the committed baselines. |
| `npm run test:full` | Run the real Minecraft/modloader installation harness. |
| `npm run build -- --publish never` | Compile and package the application locally without publishing. |
| `npm run preview` | Preview only the built renderer in a browser; this is not a functional Electron launcher. |

See [Testing](testing.md) for the boundaries and prerequisites of each check.

## Daily workflow

1. Start from a clean, current `main`.
2. Read the nearest `AGENTS.md` for the area being changed.
3. Inspect the existing component/service and nearby tests before editing.
4. Keep cross-process changes aligned across shared contract, preload, validation/handler, service, renderer wrapper, and UI.
5. Add or update tests proportional to the change.
6. Run the narrowest relevant checks, then `npm run verify` before committing.
7. Run visual regression for UI changes and a packaging build for release or packaging changes.

## Source layout

- `src/` — React renderer, contexts, feature UI, translations, typed IPC wrappers
- `electron/` — Electron main process, preload, handlers, security policies, and services
- `shared/` — cross-process contracts and types
- `tests/` — shared test setup, smoke tests, and Playwright visual tests
- `scripts/` — release, contract, compatibility, and installation helpers
- `docs/` — player, contributor, and maintainer documentation

The full process boundary is described in [Architecture](architecture.md).

## Environment and secrets

- Never commit provider keys, account tokens, signing certificates, passwords, or local absolute paths.
- Official builds intentionally leave CurseForge browsing disabled; a local `CURSEFORGE_API_KEY` is for development only and does not make the public distribution contract complete.
- Release signing secrets are optional and currently not configured. Do not pass empty `CSC_*` values to electron-builder. On macOS, `npm run build` falls back to an ad-hoc signature only when no Developer ID or explicit signing identity is available; this makes the local build runnable but does not make it distributable or notarized.
- `VITE_POSTHOG_PROJECT_TOKEN` enables the optional, consent-gated analytics client. It is a public ingestion token, not a personal API key. `VITE_POSTHOG_HOST` defaults to `https://eu.i.posthog.com`; only HTTPS hosts are accepted.
- Stable release builds require the repository variable `POSTHOG_PROJECT_TOKEN`. The PostHog project must discard IP addresses; this hosted setting is checked by the release owner, not by repository code.

## Renderer and Electron behavior

- Renderer code must not import Node.js or Electron modules.
- New cross-process calls use `window.api` through `src/services/ipc/*`.
- Main-process handlers validate renderer input before calling a service.
- `npm run dev` is long-lived and may start Electron helper processes; close it after manual verification.

## Release preparation

Use a version that does not already exist. The current release candidate is `v0.9.0`; keep the command reusable for later releases:

```bash
npm run release -- <version> --dry-run
```

The dry run does not change tracked files, commits, tags, or remotes, but it does execute verification and packaging and therefore refreshes ignored build output. The authoritative workflow, including `latest`, GitHub Actions, checksums, and rollback, is in [Releasing](releasing.md).
