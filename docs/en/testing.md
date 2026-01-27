# Testing

## Overview

The project uses only **full installation** tests. They verify that the launcher correctly installs Minecraft versions and modloaders (vanilla, Forge, Fabric, NeoForge).

## Full installation tests

### Running

```bash
# All stages (vanilla + all modloaders)
npm run test:full

# Individual stages
npm run test:full:vanilla   # vanilla only
npm run test:full:forge     # Forge
npm run test:full:fabric    # Fabric
npm run test:full:neoforge  # NeoForge
```

### Direct script invocation

```bash
node scripts/test-full.js [options]
```

Options:
- `--stage=<stage>` — Stage: `vanilla`, `forge`, `fabric`, `neoforge` (default: all)
- `--provider=<id>` — Download provider: `auto`, `mojang`, `bmclapi` (default: `auto`)
- `--limit=<N>` — Limit number of versions to test
- `--only=<versions>` — Comma-separated versions (e.g. `1.20.1,1.19.2`)

Examples:
```bash
node scripts/test-full.js --stage=forge --limit=5
node scripts/test-full.js --only=1.20.1,1.19.2
node scripts/test-full.js --provider=bmclapi
```

Results and logs are saved to `%APPDATA%/FriendLauncher/logs/full-installation/` (or equivalent on other OSes).

## CI

Full installation tests are not run in CI (they require Java, artifact downloads, and time). The pipeline runs only lint, typecheck, contracts, and IPC allowlist checks (see `.github/workflows/ci.yml`).
