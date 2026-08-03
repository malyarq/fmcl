# IPC contracts

IPC is an internal application boundary between the sandboxed renderer and the Electron main process. It is not a public network API, but compatibility matters because renderer, preload, and main are built and shipped together.

## Sources of truth

| Concern | Source |
| --- | --- |
| Allowed channel names | `shared/contracts/ipcChannels.ts` |
| Preload domain types | `shared/contracts/*` |
| Supported namespaced surface | `shared/contracts/windowApi.ts` |
| Exposed capabilities | `electron/preload.ts`, `electron/preload/bridges/*` |
| Main-process behavior | `electron/ipc/ipcManager.ts`, `electron/ipc/handlers/*` |
| Boundary validation | `electron/ipc/validation/*` |
| Renderer access | `src/services/ipc/*` |
| Human-readable channel list | [Contract map](contracts-map.md) |

The TypeScript contracts and runtime validation are authoritative for payload shape. The channel map is a maintained index, not a substitute for code.

## Change checklist

When adding or changing a cross-process operation:

1. Define a typed request/result in `shared/contracts/*` or a shared domain type.
2. Add the channel to `shared/contracts/ipcChannels.ts` if a channel is required.
3. Expose the narrow capability through a domain preload bridge.
4. Add it to `FriendLauncherApi` when it belongs in `window.api`.
5. Validate every renderer-controlled value in the main process.
6. Register a thin handler that delegates to a domain service.
7. Add or update the renderer wrapper in `src/services/ipc/*`.
8. Cover success, invalid input, and failure behavior with focused tests.
9. Update both contract maps.
10. Run the checks below.

```bash
npm run contracts:check
npm run ipc:check
npm run architecture:check
npx tsc -p tsconfig.json --noEmit
```

## Compatibility rules

- Removing or renaming a channel or required field is breaking for the packaged app boundary.
- Adding an optional field is normally compatible when every consumer handles absence.
- Do not reuse an existing channel name for different semantics.
- Keep secrets and privileged filesystem data out of renderer-facing DTOs.
- UI code calls typed wrappers or a narrow `window.api.<domain>` capability; a generic renderer IPC API does not exist.

## Renderer surface

`window.api` is the only Electron capability global. Top-level aliases and the generic allowlisted renderer bridge were removed for v0.8.0. `npm run architecture:check` prevents raw channel strings, legacy globals, and restoration of the generic bridge in `src/`.
