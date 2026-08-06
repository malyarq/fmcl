# Product gate

This document deliberately replaces the former phase-by-phase engineering roadmap. Shipped work belongs in the [changelog](../../CHANGELOG.md); technical contracts belong in the adjacent documentation; old implementation decisions remain in Git history.

## Current stop condition

Do not start another architecture milestone after the next release until at least **20 external users** have tried FriendLauncher and the maintainer has reviewed their opt-in usage and feedback. Fix observed installation, launch, update, recovery, and FriendTunnel failures before adding speculative subsystems.

## What still gates public confidence

- Run fresh-install, first-launch, Minecraft-launch, update, and uninstall smoke tests on Windows, macOS, and Linux.
- Register and integrate Microsoft authentication before claiming support for official accounts.
- Sign Windows packages and sign/notarize macOS packages when publisher credentials are available.
- Confirm the hosted PostHog project disables IP capture, does not create person profiles, and uses the documented retention limit.
- Enable CurseForge browsing only after API credentials, attribution, distribution terms, tests, and failure handling are complete.

These are product and distribution gates, not permission to begin another internal refactor. The next engineering priority must come from external evidence or a concrete security/reliability defect.
