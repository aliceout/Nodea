# Security Policy

Nodea is end-to-end encrypted journaling software. A bug in the crypto layer, the auth flow, or the server's response shape can silently break the privacy guarantee. We take this seriously, and we'd rather hear about a vulnerability quietly than read about it on Twitter.

## Reporting a vulnerability

**Please do not open a public GitHub issue for security reports.**

Use one of the following private channels:

1. **GitHub Security Advisories** (preferred) — go to the [Security tab](https://github.com/aliceout/Nodea/security) of this repo, click **Report a vulnerability**, and fill the form. The advisory stays private between you and the maintainers until we coordinate disclosure.
2. **Direct contact** — if GitHub Security Advisories isn't an option for you, contact the maintainer listed on the repo via the email visible on their GitHub profile.

When reporting, please include:

- A description of the issue and its impact (what an attacker could do).
- Steps to reproduce, or a minimal proof-of-concept.
- The affected version (commit SHA visible at `/version` on a running instance, or branch name).
- Your name / handle if you'd like credit; otherwise we keep you anonymous.

## What we'll do

- **Acknowledge within 7 days.** Single-maintainer project, no on-call rotation — please be patient if it slips a little.
- **Assess within 30 days.** We'll confirm whether it reproduces, scope it (impact, affected versions), and propose a fix timeline.
- **Coordinate disclosure.** Default policy is **90 days** from initial report to public disclosure, or earlier if a fix is shipped. We'll keep you in the loop and credit you in the advisory + `CHANGELOG.md` unless you prefer anonymity.
- **No bug bounty.** Nodea is a self-funded open-source project; we can't pay for findings. We can credit you publicly and answer technical questions during the fix.

## Scope

**In scope:**

- The official server code (`packages/api/`, including OPAQUE / WebAuthn / TOTP / session flows).
- The web bundle served by the official instance (`packages/web/`, crypto helpers, response handling, key-material lifecycle).
- The shared schemas (`packages/shared/`) when they affect server-side validation.
- The deployment manifests in `infra/` (docker-compose, nginx config) when they introduce attack surface.
- Cryptographic invariants documented in `docs/Security.md` — e.g. main key never leaves WebCrypto, HMAC guards never persisted, HKDF domain separation.

**Out of scope:**

- **Self-hosted instances** misconfigured by their operator (default-password DB, exposed Mailpit, etc.). Those are operator bugs; report them to whoever runs the instance.
- **Third-party services** wired in by self-hosters (SMTP relays, reverse proxies). Report to the upstream vendor.
- **Social engineering** against maintainers or contributors.
- **Theoretical attacks** with no realistic threat model (e.g. nation-state with full client compromise — see `docs/Security.md` §6 about the web supply-chain limit, which is acknowledged and not a bug).
- **Automated scanner output** without analysis — please confirm the finding reproduces against the official build before reporting.

## Public security model

The full threat model, crypto invariants, and known limitations live at [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech) and in [`docs/Security.md`](../docs/Security.md). Read those before reporting — saves time on both sides.

## Hall of fame

Researchers who responsibly disclosed a finding will be listed here, with their permission, after coordinated disclosure.

_(empty — be the first)_
