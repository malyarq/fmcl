# Privacy and analytics

Burrow is designed to work without analytics. Anonymous product analytics is **off by default** and starts only after the user enables it in **Settings → Launcher → Privacy and Feedback**. Disabling it stops future events and deletes the local random analytics identifier.

## Optional analytics

Official builds use PostHog EU Cloud for a small, reviewed event allowlist:

| Event | Properties |
| --- | --- |
| Application opened | Burrow version, operating-system family, interface language, and simple/modpacks UI mode |
| Minecraft launch started | Burrow version, operating-system family, and modloader family |
| Minecraft launch succeeded or failed | Burrow version, operating-system family, modloader family, and a bounded failure stage |
| Onboarding shown or action selected | Burrow version, operating-system family, and a bounded action such as play, modpacks, Burrow Link, settings, or optional tour |
| Modpack operation finished | Burrow version, operating-system family, bounded operation kind, and bounded result; no project, instance, file, or provider identifiers |
| Burrow Link lifecycle | Burrow version, operating-system family, host/join role, and a bounded start, peer-connected, or failure stage |
| Settings backup exported or imported | Burrow version and operating-system family only |
| GitHub feedback opened | Burrow version, operating-system family, and the fixed `launcher_settings` source |

Burrow creates a random installation identifier only after consent. It is not derived from hardware, an account, a nickname, or a filesystem path. Events are submitted as anonymous/personless PostHog events; Burrow does not call PostHog identify APIs. Every event sets `$geoip_disable: true` so PostHog skips GeoIP enrichment.

Burrow does **not** send account data, nicknames, access tokens, room codes, server addresses, Minecraft paths, file names, logs, form contents, error messages, screenshots, session recordings, advertising identifiers, or precise location. The integration does not load the PostHog browser SDK, autocapture, cookies, heatmaps, or session replay.

Network delivery necessarily exposes connection metadata to the analytics processor. The Burrow PostHog project must use the EU region with IP capture disabled and must retain analytics for no longer than 12 months. Repository code cannot independently verify that hosted project setting, so it is part of the release-owner checklist.

## Feedback reports

The **Report a problem on GitHub** action builds a local preview containing only the Burrow version, operating-system family, interface language, and analytics preference. Nothing is submitted automatically. The user reviews and edits the draft in GitHub and explicitly submits it under GitHub's own terms.

Never add credentials, account identifiers, room codes, private server addresses, personal filesystem paths, or security-vulnerability details to a public issue. Report vulnerabilities through [private vulnerability reporting](https://github.com/malyarq/burrow/security/advisories/new).

## Control and questions

- Leave analytics disabled to send no product events.
- Disable analytics later to stop collection and remove the local random identifier.
- Remove a GitHub issue or comment through GitHub if you submitted information there.
- Ask a privacy question through a [GitHub issue](https://github.com/malyarq/burrow/issues/new) without including private data.

This document describes the current implementation. Material collection changes require updated code, tests, translations, and this notice before release.
