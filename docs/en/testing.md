# Testing

Burrow uses layered checks. No single local command proves every operating system, provider, router, Java runtime, and installed updater path.

## Test layers

| Layer | Command | What it covers | Runs in CI |
| --- | --- | --- | --- |
| Unit/component/service/security | `npm test` | Vitest files under `src/`, `electron/`, `shared/`, and non-visual `tests/` | Yes |
| Lint | `npm run lint` | ESLint with zero warnings | Yes |
| Type safety | `npx tsc -p tsconfig.json --noEmit` | Renderer, shared, and main-process TypeScript | Yes |
| Documentation | `npm run docs:check` | Local links, required files, latest-release link, index coverage, and EN/RU mirrors | Yes |
| Contract documentation | `npm run contracts:check` | Allowed IPC channel list against both contract maps | Yes |
| IPC allowlist | `npm run ipc:check` | Literal Electron IPC calls against the allowlist | Yes |
| Dependency security | `npm run audit:prod` | High and critical production advisories | Yes |
| Visual regression | `npm run test:visual:closeout` | Seven deterministic manual-verification views in macOS Chromium | Yes, separate job |
| Packaging smoke | `npm run build -- --publish never` | TypeScript, Vite, and electron-builder packaging | Yes |
| Real installation | `npm run test:full` | Minecraft and modloader metadata, downloads, Java, and installation | No |
| Real game launch | `npm run smoke:game` | Latest vanilla installation, production launch path, rendering and loaded-resource signals | No |
| Installed application | Manual | Installer, first launch, OS warnings, updates, router/network behavior | No |

## Default verification

```bash
npm run verify
```

This runs unit tests, lint, typecheck, documentation and contract checks, IPC checks, and the production audit. It intentionally does **not** run visual regression, electron-builder packaging, or the full installation harness.

## Vitest

Run the complete suite once:

```bash
npm test
```

Run one file while developing:

```bash
npx vitest run src/path/to/example.test.tsx
```

Tests should live beside the behavior they protect, usually in `__tests__`, unless they are repository smoke tests under `tests/`.

## Visual regression

Install the owned browser once:

```bash
npx playwright install chromium
```

Compare with committed baselines:

```bash
npm run test:visual:closeout
```

Update baselines only after reviewing the rendered result:

```bash
npm run test:visual:closeout -- --update-snapshots
```

The baselines are intentionally Darwin-specific and live in `tests/visual/manual-closeout.spec.ts-snapshots/`. The Playwright server uses `BURROW_RENDERER_ONLY=1`; it verifies deterministic UI states, not Electron-native behavior.

## Full Minecraft installation

The harness builds the application, creates an isolated temporary Electron user-data directory, runs installation work, records results, and removes the temporary directory on exit.

```bash
npm run test:full
npm run test:full:vanilla
npm run test:full:forge
npm run test:full:fabric
npm run test:full:neoforge
npm run smoke:game
```

`smoke:game` installs one current vanilla version, launches it with an offline test profile through the production launcher path, waits for both the LWJGL renderer and loaded-resource signals, holds the process briefly, and then terminates the whole game process tree. `.github/workflows/game-smoke.yml` runs the same bounded check manually on Windows, Linux, and macOS and preserves its log and JSON evidence. It is intentionally separate from normal CI and release publication because Mojang downloads and graphics startup are slow and externally dependent.

Direct options:

```bash
node scripts/test-full.js --stage=forge --limit=5
node scripts/test-full.js --only=1.20.1,1.19.2
node scripts/test-full.js --provider=bmclapi
```

Supported options:

- `--stage=vanilla|forge|fabric|neoforge`
- `--provider=auto|mojang|bmclapi`
- `--limit=<count>`
- `--only=<comma-separated versions>`

This harness requires Node 24, Java/runtime downloads, network access, disk space, and substantially more time than the unit suite. It is not a substitute for protecting user data: the isolation boundary must remain intact.

## CI and release gates

`.github/workflows/ci.yml` runs on `main` pushes and pull requests. It executes the default verification, a packaging build, and the separate macOS Chromium visual job.

`.github/workflows/release.yml` validates the version, runs tests/lint/type/contracts/IPC/audit and a Linux build smoke, then builds Windows, Linux, and macOS artifacts independently. It publishes one GitHub Release only if every platform succeeds.

The release workflow does not run the full-install harness or the visual job itself. Before tagging a UI-heavy stable release, require a green `main` CI run and perform the bounded manual platform checks in the [release runbook](releasing.md).

## Choosing checks

- Documentation only: `npm run docs:check`, `npm run contracts:check` if the map changed, and `git diff --check`.
- Renderer behavior: targeted Vitest, `npm run verify`, visual regression, and manual Electron inspection when native behavior matters.
- Main process or IPC: targeted service/security tests, `npm run verify`, and packaging smoke.
- Dependencies or release workflow: `npm ci`, `npm run verify`, packaging, and workflow review.
- Java, modloader, or installer behavior: relevant unit tests plus a bounded full-install run.
