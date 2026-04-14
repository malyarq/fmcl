# FriendLauncher Roadmap

## Current Milestone

- Milestone: `v0.3.0`
- Theme: Adaptive UX Hardening And Launcher Ergonomics
- Status: complete
- Last updated: `2026-04-14`

## Why This Milestone Exists

FMCL already had strong feature coverage, but everyday use still exposed trust gaps: layouts that did not adapt cleanly, preset themes that were not truthful in both modes, settings that felt over-nested, launch states that looked frozen, and modpack surfaces that still carried awkward or unstable interactions. The `v0.3.0` milestone closes those gaps without changing the core launcher architecture.

## Verified Launcher Surfaces

The live walkthrough for this milestone covered the launcher at `1440x1100` and `900x1180`:

- Welcome screen and onboarding tour
- Home dashboard and explicit launch-state feedback
- Settings, accounts, and skin-management continuity
- Modpack create, list, browser, details, export, and add-mod routes
- Share flow and import-share path
- Screenshots gallery and lightbox
- Utilities surfaces: mirrors and statistics
- Secondary content flow represented by datapack management

## Phase Status

| Phase | Status | Outcome |
|-------|--------|---------|
| 11. Adaptive Layout And Interaction Foundations | Complete | Responsive shell rhythm, anchored overlays, overflow-safe menus, and shipped fallback assets |
| 12. Theme Truth And Settings IA Simplification | Complete | Truthful preset themes across light and dark modes, better contrast, and flatter settings navigation |
| 13. Launch Trust And Modpack Workflow Ergonomics | Complete | Explicit launch stages, busy-state feedback, truthful modpack dependencies, and steadier browser or card flows |
| 14. Manual Verification And Release Truth | Complete | Multi-size browser walkthrough evidence, bounded follow-up capture, refreshed release docs, and a green final gate |

## What `v0.3.0` Delivers

- Adaptive layout and interaction safety across default and narrower desktop window sizes
- Consistent sizing rhythm for primary controls, cards, and overlays on refreshed surfaces
- Preset themes that actually repaint the launcher truthfully in light and dark mode without unreadable states
- Flatter settings navigation for common tasks instead of deep tab-inside-tab drilling
- Explicit launch progress and busy-state truth on the main play surface
- More dependable modpack creation, browsing, and installed-pack quick actions
- Placeholder and fallback asset cleanup on classic launcher surfaces
- Manual browser verification at multiple sizes as part of release truth, not optional polish

## Next Candidates

These are likely follow-ups after `v0.3.0`, not committed scope for this milestone:

- Automated visual-regression coverage for the reusable manual-verification seam
- Richer modpack metadata, dependency context, and changelog detail in browser and install flows
- Dedicated activity-center UX for downloads, installs, and background tasks
- Additional dashboard density or layout presets beyond the adaptive default shell
- Deeper account and session conveniences, plus a final audit of lower-traffic localization and fallback seams
