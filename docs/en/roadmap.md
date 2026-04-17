# FriendLauncher Roadmap

## Current Milestone

- Milestone: `v0.4.0`
- Theme: Launcher Truth And Product Polish
- Status: active, with Phases 15-17 complete and Phase 18 closeout underway
- Last updated: `2026-04-17`

## Why This Milestone Exists

FMCL already ships broad launcher coverage, but the screenshot-backed audit from `2026-04-14` exposed a smaller class of trust defects that still mattered in everyday use: contradictory launch states, stale loader summaries, broken-looking fallback art, raw localization keys, and a few remaining dense-surface navigation gaps. The `v0.4.0` milestone closes those defects without reopening the architecture or inventing new launcher scope.

## Verified Surface So Far

The active browser-backed walkthrough for this milestone now covers `manual-verification.html?view=dashboard`, `manual-verification.html?view=modpack-details`, and `manual-verification.html?view=phase-17-polish`. Together those views verify:

- branded fallback art on the classic hero when pack artwork is missing
- truthful loader summary on the active launch configuration
- localized waiting, downloading, and failure feedback on the launch surface
- visible read-only advanced settings while launch work is in flight
- pack-provided runtime dependencies, readable requirement copy, and dense detail navigation on modpack details
- branded fallback covers on catalog surfaces, coherent compact-nav active state, and Russian preset naming without raw settings keys

## Phase Status

| Phase | Status | Outcome |
|-------|--------|---------|
| 15. Launch Truth And Shared Surface Contracts | Complete | Branded fallback art, truthful loader summary, synchronized launch stages, localized runtime copy, and read-only busy-state settings |
| 16. Modpack Detail Integrity And Discoverable Dense Navigation | Complete | Dependency truth, readable requirement copy, and dense-screen detail navigation |
| 17. Catalog, Compact Nav, And Settings Localization Polish | Complete | Catalog legibility, fallback imagery, compact-nav truth, and remaining locale cleanup |
| 18. Verification And Release Truth | In progress | Focused automation, three-view browser proof, release-doc truth, and the final milestone gate |

## What `v0.4.0` Delivers So Far

- Launch progress no longer falls back to misleading `0%` states when progress is still indeterminate
- Classic launch feedback now stays aligned across CTA, status card, and runtime stage transitions
- Missing hero art resolves to an intentional FMCL fallback instead of a broken image treatment
- Advanced launch settings stay visible for reference while becoming read-only during active launch work
- Runtime settings and launch-adjacent controls now respect the active launcher language on the audited classic surface
- Modpack details now mark pack-provided runtime dependencies as satisfied and present readable requirement copy for mismatches
- Dense detail navigation no longer depends on default horizontal-tab scrolling to reach core modpack sections
- Catalog cards and compact navigation now keep fallback imagery and active-state truth coherent across the audited desktop shell
- Audited settings surfaces now present localized preset names and no longer leak raw localization keys on the shipped UI

## Remaining Closeout Work

Only the bounded Phase 18 closeout work remains before the milestone can be marked shipped:

- final repo-wide verification on `npm test`, `npm run lint`, `npx tsc --noEmit`, and `npm run build -- --publish never`
- any strictly bounded packaging-truth cleanup required by that gate, without reopening product scope
