# Code style

Prefer predictable code that matches the surrounding module. ESLint and TypeScript are the enforceable baseline; this document records review rules that are not obvious from tooling.

## TypeScript

- Keep strict typing at process, filesystem, network, persistence, and provider boundaries.
- Prefer `unknown` plus validation over `any`.
- Existing, explicitly suppressed `any` is debt, not precedent. A new exception needs a narrow comment explaining the incompatible external boundary.
- Put cross-process interfaces in `shared/contracts/*` or `shared/types/*`; keep process-local types beside their domain.
- Use discriminated unions for state and outcomes instead of boolean combinations with ambiguous meaning.
- Treat errors from external libraries as `unknown` and convert them into a safe user-facing or diagnostic form.

`npm run lint` uses `--max-warnings 0`, so lint warnings fail the check.

## React and UI

- Keep components focused on presentation and interaction. Move provider, filesystem, and orchestration logic into a service, context, or feature hook.
- Do not perform heavy work during render.
- Effects must handle cancellation or stale async results when their inputs can change.
- Reuse components from `src/components/ui/` and semantic classes from `src/index.css`.
- Use stable keys derived from domain identity, not array indexes, when order can change.
- Every interactive element needs a visible label or accessible name and keyboard behavior.
- User-facing strings belong in both locale files and are retrieved through `t(...)`.

## Electron and IPC

For a new or changed cross-process operation, update the complete chain:

1. payload/result type in `shared/contracts/*`;
2. `BurrowApi` when the preload surface changes;
3. preload bridge in `electron/preload/bridges/*` and exposure in `electron/preload.ts`;
4. main-process input validation;
5. handler registration in `electron/ipc/*`;
6. domain service;
7. renderer wrapper in `src/services/ipc/*`;
8. focused tests;
9. both contract maps when a channel changes.

Do not introduce raw `ipcRenderer` usage in UI. Do not trust renderer paths, URLs, archive entries, identifiers, or numeric limits without main-process validation.

## Files and ownership

- Group code by domain, not by generic technical names such as `helpers2` or `common-new`.
- Keep IPC registration thin; business logic belongs in services.
- Split a file when it owns multiple independent domains or requires unrelated test setup, not merely because it crossed an arbitrary line count.
- Prefer existing central path, URL, archive, download, and UI policies over local copies.
- Keep tests near their owner in `__tests__`; repository-level smoke and visual tests belong in `tests/`.

## Errors and logging

- User messages explain what failed and what can be done next; logs may carry technical detail.
- Never log tokens, passwords, room codes, or complete sensitive account payloads.
- Avoid leaking personal absolute paths into public error reports.
- Preserve the original error as a cause or diagnostic detail where the boundary permits it.

## Documentation in code changes

- Update both English and Russian documents when behavior or a mirrored contract changes.
- Update the roadmap only for real scope or status changes; release history belongs in `CHANGELOG.md` and GitHub Releases.
- Comments should explain constraints and reasons, not restate the next line.

## Before commit

Run the relevant focused tests, then:

```bash
npm run verify
git diff --check
```

UI, packaging, and installation changes require the additional checks described in [Testing](testing.md).
