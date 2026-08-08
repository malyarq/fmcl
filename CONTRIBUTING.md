# Contributing to Burrow

Thanks for improving Burrow. Keep changes focused, testable, and consistent across the Electron boundary and the English/Russian documentation.

## Before starting

- Search existing [issues](https://github.com/malyarq/burrow/issues) and the [roadmap](docs/en/roadmap.md).
- For a security issue, stop and use the private process in [SECURITY.md](SECURITY.md).
- For a large behavior, format, migration, or dependency change, open an issue first so the contract can be agreed before implementation.
- Read the nearest `AGENTS.md` in the directory you change.

The repository currently has no project-wide open-source license. A public repository can be read and forked through GitHub, but that does not grant general redistribution or relicensing rights. Contributions are accepted only if you have the right to submit them.

## Set up

Use Node.js 24 and npm 11:

```bash
git clone https://github.com/malyarq/burrow.git
cd burrow
nvm use
npm ci
npm run verify
```

See [Development](docs/en/development.md) or [Разработка](docs/ru/development.md) for commands and repository layout.

## Change rules

- Preserve strict TypeScript and zero-warning ESLint.
- Put shared renderer/main types in `shared/contracts/*` or `shared/types/*`.
- For IPC changes, update the shared contract, channel allowlist, preload bridge, handler/validation, renderer wrapper, tests, and both contract maps.
- Do not access Node.js or Electron directly from renderer code.
- Validate untrusted URLs, paths, archives, identifiers, sizes, and enum values in the main process.
- Put user-visible text in both `src/locales/en.json` and `src/locales/ru.json`.
- Reuse the design tokens and shared components documented in [Design system](docs/en/design-system.md).
- Add tests proportional to risk. A bug fix should normally include a regression test.
- Update both `docs/en` and `docs/ru` variants when a mirrored document changes.
- Do not commit generated `dist`, `dist-electron`, `release`, `test-results`, local accounts, tokens, or machine-specific paths.

## Verify

At minimum:

```bash
npm run verify
npm run build -- --publish never
```

Use targeted tests while developing. Run visual regression for UI changes and the appropriate full-install stage for Minecraft, Java, loader, or download changes. The complete matrix is in [Testing](docs/en/testing.md).

## Commits and pull requests

- Use conventional commit prefixes such as `feat:`, `fix:`, `docs:`, `refactor:`, and `test:`.
- Keep one coherent change per commit; do not mix unrelated formatting or generated output.
- Explain the user impact, implementation boundary, tests run, screenshots for visible UI changes, and remaining risk.
- Do not include secrets, private account data, or exploit details in commits, CI logs, issues, or pull requests.

The maintainer may commit directly to `main`; external contributions are normally reviewed through a pull request. CI must pass before merge.
