## Development (English)

---

## Commands

From `package.json`:

- `npm run dev` — start Vite (Electron is handled by the Vite Electron plugin config)
- `npm run build` — `tsc` + `vite build` + `electron-builder`
- `npm run lint` — ESLint (warnings are treated as failure)
- `npm run preview` — preview Vite build
- `npm run release` — release script
- `npm run postinstall` — fixes XMCL bytebuffer via `scripts/postinstall-fix-xmcl-bytebuffer.cjs`

### Testing

Full installation tests verify that the launcher can install Minecraft versions and modloaders correctly:

- `npm run test:full` — run all installation tests (vanilla + all modloaders)
- `npm run test:full:vanilla` — test vanilla installation only
- `npm run test:full:forge` — test Forge installation
- `npm run test:full:fabric` — test Fabric installation
- `npm run test:full:neoforge` — test NeoForge installation

You can also use the test script directly with additional options:

```bash
node scripts/test-full.js [options]
```

Options:
- `--stage=<stage>` — Test stage: `vanilla`, `forge`, `fabric`, `neoforge` (default: all)
- `--provider=<id>` — Download provider: `auto`, `mojang`, `bmclapi` (default: `auto`)
- `--limit=<N>` — Limit number of versions to test (default: unlimited)
- `--only=<versions>` — Comma-separated list of specific versions to test (e.g., `1.20.1,1.19.2`)

Examples:
```bash
# Test only Forge with a limit of 5 versions
node scripts/test-full.js --stage=forge --limit=5

# Test specific versions
node scripts/test-full.js --only=1.20.1,1.19.2

# Test with a specific download provider
node scripts/test-full.js --provider=bmclapi
```

Test results and logs are saved to `%APPDATA%/FriendLauncher/logs/full-installation/` (or equivalent on other platforms).

---

## Contract discipline during refactors

Before/after changing IPC or preload:

- keep `contracts-map.md` accurate
- keep `src/vite-env.d.ts` accurate
- prefer using `src/services/ipc/*` inside renderer

---

## Notes on recent refactors (structure)

- UI splits: prefer extracting large UI files into small components under a dedicated folder (e.g. `src/components/sidebar/*`, `src/components/layout/*`, settings pieces under `src/components/settings/*`).
- Main-process splits: if a domain grows large, extract helpers into a subfolder and keep a thin facade (e.g. `electron/services/launcher/forge/*`, `electron/services/launcher/modLoaders/*`, `electron/services/network/*`).

---

## Line endings (Windows)

If you see Git warnings like “LF will be replaced by CRLF”, consider standardizing with a `.gitattributes` later. For now: avoid mixing line endings within the same file.

