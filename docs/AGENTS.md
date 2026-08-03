# AGENTS.md — `docs/`

## Scope

This directory contains player, contributor, maintainer, architecture, and historical documentation in English and Russian.

## Current documentation

- Index: `docs/README.md`
- Player guides: `docs/{en,ru}/user-guide.md`, `troubleshooting.md`, `known-issues.md`
- Engineering: `architecture.md`, `development.md`, `testing.md`, `code-style.md`, `design-system.md`
- Contracts: `contracts.md`, `contracts-map.md`
- Maintainer guides: `releasing.md`, `security.md`, `roadmap.md`
- Historical material: `docs/archive/`

## Working rules

- Keep English and Russian variants aligned when a document is mirrored.
- Verify behavior against code, `package.json`, and `.github/workflows/*`; documentation is not allowed to override runtime truth.
- Update both contract maps when IPC channels change, then run `npm run contracts:check` and `npm run ipc:check`.
- Keep current guides free of phase numbers, temporary audit language, and completed milestone instructions.
- Move dated plans and one-off audits to `docs/archive/` with a clear historical notice.
- Do not invent signing status, support promises, platform support, or licensing terms.
- Check local Markdown links before finishing.
