# Crypto-adjacent dependency audit

**Updated:** 2026-04-28 (Auth-Roadmap Phase 8 — cleanup + audit
final).

This document vendors the audit references and trust signals for
every crypto-adjacent dependency Nodea ships in the auth surface.
Per CLAUDE.md (« Crypto-adjacent deps — read the source before
accepting »), each new addition is reviewed before it lands ; this
file is the running summary so a reviewer / auditor doesn't have to
re-trace each lib individually.

Versions are **pinned** (no `^` / `~`) per the same policy. Bumps
go through their own PR and update this doc.

---

## `@serenity-kit/opaque` — 1.1.0

**Where:** `packages/api`, `packages/web`. Drives the OPAQUE
password-authenticated key exchange (Auth-Roadmap Phase 2C/D,
Auth-Spec §13.1).

**Maintainer:** Serenity Notes (Nik Graf et al.,
[serenity-kit](https://github.com/serenity-kit) on GitHub). Active
project shipping a privacy-focused note-taking app on top of the
same primitive.

**Underlying primitive:** WASM binding to
[`opaque-ke`](https://github.com/facebook/opaque-ke), the Rust
reference implementation of the OPAQUE asymmetric PAKE
(IETF CFRG draft → RFC publication track).

**Audit references:**
- `opaque-ke` underwent a Cure53 audit during its Facebook tenure
  ([archived report](https://opaque.research.fb.com/) — public
  summary of findings).
- The protocol itself is the IETF CFRG-recommended OPAQUE variant
  (3DH); standardisation is in progress under the CFRG OPAQUE
  workgroup.

**Trust signal:** library is small (single export surface),
deterministic between client + server, no transport of plaintext
password. We use the v1.x stable API ; major-version bumps will
trigger a re-review.

**Risk we accept:** rotating `OPAQUE_SERVER_SETUP` invalidates
every existing envelope (issue #39 tracks the per-envelope
versioning that lifts that constraint).

---

## `@simplewebauthn/server` — 13.3.0
## `@simplewebauthn/browser` — 13.3.0

**Where:** `packages/api`, `packages/web`. Drives WebAuthn
registration + authentication ceremonies for passkeys
(Auth-Roadmap Phase 4, Auth-Spec §9). Both packages share the
same major version on purpose — mismatched majors break the
challenge round-trip in subtle ways.

**Maintainer:**
[MasterKale (Matthew Miller)](https://github.com/MasterKale).
Single-maintainer project but has been the de facto WebAuthn
library in the Node ecosystem since 2020 ; widely used by major
players (Cloudflare, Auth0, Stripe).

**Audit references:**
- No formal third-party audit published. The library tracks the
  W3C WebAuthn L2 + L3 spec closely and is actively maintained
  ([release cadence](https://github.com/MasterKale/SimpleWebAuthn/releases)
  shows monthly minors).
- The PRF extension surface (which Nodea relies on for KEK
  derivation) is implemented per the
  [W3C Secure Payment Confirmation / PRF extension draft](https://w3c.github.io/webauthn/#prf-extension)
  and matches what Chromium and Safari ship.

**Trust signal:** zero CVEs filed against the package as of this
audit. Code is auditable (TS, no native bindings on the server
side, single dependency on `@simplewebauthn/types`).

**Risk we accept:** PRF extension support is uneven across
authenticators (cf. our own findings during Phase 4 testing —
Bitwarden/Vaultwarden + Firefox didn't surface PRF). The library
exposes the gap honestly via `clientExtensionResults`, so we can
detect non-PRF passkeys at enrollment and downgrade gracefully.

---

## `otplib` — 13.4.0

**Where:** `packages/api`. Drives TOTP code generation +
verification for the second-factor flow (Auth-Roadmap Phase 5B,
Auth-Spec §8).

**Maintainer:**
[Yeoman](https://github.com/yeojz/otplib) — long-standing project
(first release 2014, current major v13 since 2023). Single
maintainer but widely depended-on (npm shows several million
weekly downloads in the broader ecosystem of TOTP-using packages).

**Audit references:**
- RFC 6238 / RFC 4226 compliant ; the test vectors from the RFCs
  are part of the package's own test suite.
- No formal third-party audit published. The implementation is
  thin (HMAC-SHA1 step + base32 codec) so the trusted-computing-
  base is small.

**Trust signal:** zero CVEs filed against `otplib` as of this
audit. We use only `otplib`'s `generate` / `verify` (not the
heavier `Authenticator` / `HOTP` classes), keeping the surface
small.

**Risk we accept:** SHA-1 in HMAC is by-spec for compatibility
with every major authenticator app (Google Auth, Bitwarden,
Aegis, …). We verify with a ±1-window skew + last-window anti-
replay (cf. `auth/totp.ts`).

---

## Other crypto-adjacent deps (lighter touch)

These don't materialise security-critical primitives but live in
the auth path's neighbourhood and warrant a quick callout :

| Package | Version | Where | Note |
|---|---|---|---|
| `@scure/bip39` | 2.2.0 | `packages/web` | Recovery code mnemonic. `paulmillr/scure-bip39` — well-audited, dependency of every modern wallet. |
| `qrcode` | 1.5.4 | `packages/web` | TOTP QR rendering only (no security claim — the secret is in the URI either way). |
| `zod` | (workspace pin) | shared | Body validation. Not crypto, but the matrix gate hinges on `safeParse` rejecting malformed proofs ; widely audited. |

Any future addition that touches `core/crypto/*`, OPAQUE, WebAuthn,
or TOTP must extend this list with the same shape (maintainer,
audit references, trust signal, risks).
