# FriendLauncher Roadmap

## Latest Release

- Release: `v0.6.0`
- Theme: Feedback-Driven Stabilization And Expansion
- Status: shipped on `2026-04-21`
- Current planning state: no active milestone; the next milestone starts from this shipped baseline

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
| 28. Product Restraint And Native Shell Truth | Shipped | Native shell behavior, restrained identity, scoped update signals, and truthful reopen-state recovery |
| 29. Modpack Workflow Simplification And Runtime Truth | Shipped | Compact catalog controls, cleaner details hierarchy, config-first runtime truth, and stable async create/add recovery |
| 30. Settings Truth And Honest Personalization | Shipped | Deterministic preset runtime, compact settings shell, honest control placement, and bounded preset-adjacent customization |
| 31. Guided Content Browsers And Capability Expansion | Shipped | Canonical guided entry, explicit in-route local `.zip` fallback, honest shader capability guidance, named recoverable failure states, and bounded-scope closeout proof |

## Residual Notes

- The milestone audit passed with all scoped requirements satisfied.
- Browser-based manual walkthroughs were not rerun during this archive closeout, so real-shell sampling remains release-signoff debt rather than an implementation gap.
