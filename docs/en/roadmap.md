# FriendLauncher Roadmap

## Current Milestone

- Milestone: `v0.5.0`
- Theme: Experience Reinvention And Brand Reset
- Status: Phase 24 complete, closeout verified, ready for milestone closure
- Last updated: `2026-04-19`

## Why This Milestone Exists

FMCL had reached the point where bugs were no longer only about correctness. The launcher was drifting visually and behaviorally: the shell could hide content, brand usage contradicted itself, dense routes fought for hierarchy, themes and locales were inconsistent, and degraded states still looked like technical leftovers. The `v0.5.0` milestone resets those surfaces into one deliberate, reviewable product language without expanding scope into new features.

## Verified Closeout Surface

The current closeout matrix is anchored on the browser-backed `manual-verification.html` seam and the committed `npm run test:visual:closeout` lane. The owned Phase 24 review set covers:

- `manual-verification.html?view=phase-24-home-closeout`
- `manual-verification.html?view=phase-24-modpacks-closeout`
- `manual-verification.html?view=phase-24-degraded-closeout`
- `manual-verification.html?view=phase-24-theme-dark`
- `manual-verification.html?view=phase-24-theme-light`
- `manual-verification.html?view=phase-24-locale-en`
- `manual-verification.html?view=phase-24-locale-ru`

Together those views verify:

- shared shell clearance and route-owned CTA hierarchy on the launcher home and modpack flows
- dense modpack browse and details surfaces under realistic desktop pressure
- representative degraded route and secondary-content failures on shipped productized fallback surfaces
- explicit dark/light comparison on the same shell-owned appearance surface
- explicit EN/RU comparison with visible dates, counts, translated copy, and secondary content

## Phase Status

| Phase | Status | Outcome |
|-------|--------|---------|
| 19. Baseline Stability, Scope, And Shell Invariants | Complete | Shared safe-zone shell contract, one primary action per context, and flow-first dense-route geometry |
| 20. Brand System, Shared Tokens, And Surface Migration | Complete | Canonical brand contract, shared launcher tokens, and neutral artwork fallback policy |
| 21. Dense Surface IA, Navigation, And CTA Hierarchy | Complete | Readable dense catalog and details routes plus truthful runtime summaries for create and edit flows |
| 22. Theme Truth And Interaction-State Fidelity | Complete | Legible dark/light states, consistent accent propagation, and locale-faithful metadata formatting |
| 23. Fallback, Error, And Placeholder Productization | Complete | Productized empty/degraded/error states and a recovery-first fatal crash surface |
| 24. Verification, Locale, And Release Truth | Complete | Curated closeout matrix, strict screenshot regression lane, release-truth sync, and final closeout verification |

## What `v0.5.0` Delivers

- The launcher shell now behaves like one coherent desktop frame instead of a stack of route-local spacing hacks.
- Brand usage is deliberate again: launcher surfaces, onboarding, and fallback states share one restrained visual language.
- Modpack flows stay readable under dense data, long labels, and constrained desktop widths without duplicating or hiding primary actions.
- Theme and locale differences are reviewable on purpose, not only discoverable by accident.
- Missing data, failed loads, and fatal crashes now communicate recovery-safe product truth instead of raw internals or decorative placeholders.
- Release proof is no longer anecdotal: it lives in a reusable manual matrix plus a committed Playwright screenshot lane.

## Bounded Residuals

- The production build still emits the existing large renderer chunk warning. It remains explicitly non-blocking at closeout because the final gate is green and no user-facing regression in this milestone depends on it.
