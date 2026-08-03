# Security policy

## Supported versions

Security fixes are made on `main` and released for the latest stable release only. Older releases are not supported; reproduce an issue on the latest stable release before reporting when it is safe to do so.

## Report a vulnerability

Do **not** open a public issue with exploit details, credentials, private server addresses, or user data.

Use [GitHub private vulnerability reporting](https://github.com/malyarq/fmcl/security/advisories/new). Include:

- affected FriendLauncher version and operating system;
- impact and the trust boundary that is crossed;
- minimal reproduction steps or a proof of concept;
- whether the issue has been disclosed elsewhere;
- suggested remediation, if known.

Remove real account tokens, passwords, cookies, signing material, and personal data. Use synthetic values in the reproduction.

The maintainer will investigate privately, coordinate a fix and release where warranted, and credit the reporter if requested. There is no guaranteed response-time SLA. Please allow a reasonable remediation period before public disclosure.

Ordinary crashes, UI regressions, and non-sensitive bugs belong in [GitHub Issues](https://github.com/malyarq/fmcl/issues/new). The implementation threat model and known residual risks are documented in [docs/en/security.md](docs/en/security.md) and [docs/en/known-issues.md](docs/en/known-issues.md).
