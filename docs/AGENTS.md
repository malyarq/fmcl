# AGENTS.md — `docs/`

## Scope
This directory contains product and engineering documentation in English and Russian.

## Where To Look
- Architecture: `en/architecture.md`, `ru/architecture.md`
- Development/testing/code style: `en/development.md`, `ru/development.md`, `en/testing.md`, `ru/testing.md`, `en/code-style.md`, `ru/code-style.md`
- Contracts: `en/contracts.md`, `ru/contracts.md`, `en/contracts-map.md`, `ru/contracts-map.md`
- Roadmaps: `en/roadmap.md`, `ru/roadmap.md`
- Known product issues: `KNOWN_ISSUES.md`

## Working Rules
- If a document exists in both `en` and `ru`, keep both versions aligned unless the task explicitly requests a single-language update.
- IPC/channel changes must be reflected in `ru/contracts-map.md`; update the English counterpart too when the change affects shared terminology or structure.
- When a feature is completed, update both roadmap files.
- Put screenshot-based audits and one-off QA reports in `docs/ru/` or `docs/en/` with a descriptive dated filename.

## Cleanup
- Remove or clearly label temporary notes before finishing.
- Do not leave draft files with unclear purpose at the repo root.
