# FriendLauncher Roadmap

## Latest Release

- Release: `v0.6.0`
- Theme: Feedback-Driven Stabilization And Expansion
- Status: shipped on `2026-04-21`
- Current planning state: active milestone `v0.7.0` — Direct Feedback Closure And Interface Cohesion

## Next Planned Release

- Planned release: `v0.7.0`
- Theme: Direct Feedback Closure And Interface Cohesion
- Source of truth: the current direct user-feedback audit for the launcher
- Goal: close the still-open direct feedback gaps around shell/sidebar drift, catalog and detail density, guided content reliability, settings predictability, and the lack of one shared control contract across the launcher
- Current progress: Phases `32-36` are complete, covering sidebar readability, native macOS shell truth, calmer fallback surfaces, truthful classic runtime labels, compact catalog shells, minimal card facts, above-the-fold details tabs, first-read runtime truth, one shared details content workspace, fixed create/add action rails, actionable async recovery, honest guided content runtime boundaries, lighter settings shells, visible preset runtime truth, aligned shared controls, and behavior-driven settings proof gating. Next steps: rerun manual verification on the recovered settings surface, then execute inserted Phase `36.1`.

## Why v0.6.0 Shipped

`v0.6.0` was a feedback-driven stabilization release. FMCL already had the broad launcher shape it needed, but the shipped product still felt noisy or untruthful in several critical places: shell behavior, modpack workflows, settings ownership, and content-management boundaries. This release removed that weirdness first and only then allowed one bounded capability expansion.

## What Landed

- The launcher shell now behaves more like a native desktop surface and stops competing with platform chrome or loud fallback branding.
- Modpack browsing, details, dependency state, and create/add flows are grounded in one smaller, more truthful runtime story.
- Settings now use one explicit appearance-state contract, one lighter shell hierarchy, and controls that explain their real scope instead of overclaiming broad personalization.
- Resource-pack and shader entry now route into the same in-app guided browser, that route carries its own explicit local `.zip` fallback, shader surfaces distinguish supported, needs-setup, unsupported, and unverified runtime states without overclaiming compatibility, and guided failures stay on-surface with named recovery paths.

## Phase Outcomes

| Phase | Status | Outcome |
|-------|--------|---------|
| 32. Shell Identity And Sidebar Cohesion | Complete | Text-first sidebar header, calmer fallback identity, and restrained macOS shell truth |
| 33. Classic Truth And Catalog Density Repair | Complete | Truthful classic labels, compact installed/remote catalogs, and coherent catalog action geometry |
| 34. Detail Hierarchy And Content Surface Cohesion | Complete | Above-the-fold details tabs, authoritative runtime truth, and one shared secondary content workspace |
| 35. Async Flow Reliability And Guided Content Honesty | Complete | Fixed create/add action rails, actionable mixed-success recovery, honest guided resource-pack and shader runtime guidance, and refreshed proof routes tied to the live async contract |
| 36. Settings Predictability And Shared Control Contract | Complete | Flattened settings shell chrome, preset-owned palette/runtime truth, centered shared controls, visible appearance-effect scope, and behavior-driven settings proof gating |
| 36.1. Modpack UAT Follow-up And Workspace Cohesion | Planned | Secondary workspace cohesion, calmer create-modpack recovery, and modpack spillover closure from the Phase 36 UAT session |

## Residual Notes

- Phase 36 automation is green, but a fresh manual verification pass is still required before milestone closeout can treat the recovered settings surface as signed off.
- Inserted Phase `36.1` remains open because Phase 36 UAT also exposed modpack workspace and create-flow spillover outside the settings-owned contract.
