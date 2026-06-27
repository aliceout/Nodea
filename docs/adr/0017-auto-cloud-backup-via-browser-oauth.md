# 0017 — Auto cloud backup pushes from the browser to an OAuth app-folder

- **Status**: Accepted
- **Date**: 2026-06

## Context

ADR-0016 gave Nodea a portable, phrase-sealed `.age` backup, produced
**client-side** and downloaded by hand. The gap: it only exists if the user
remembers to click "export" and stash the file somewhere. A real backup is
**automatic** and **off-site**.

Two hard constraints from the security model shape every option, before any
provider is even named:

1. **The `.age` is already E2E-encrypted (ADR-0016).** The destination sees
   only an opaque ciphertext blob — it cannot read the journal whatever it is.
   So the choice of host is a *practical* one (reliability, friction,
   credentials), not a confidentiality one. Sending the blob to Google or
   Dropbox does **not** weaken the model.
2. **Sealing needs the main key, in an unlocked session.** Producing the blob
   requires decrypting every module *and* deriving the BIP39 seal phrase from
   the HMAC sub-key — both exist only in the browser, post-unlock. The server
   holds no key, so it **cannot** seal, cannot schedule, cannot ever run this on
   a cron. "Auto" is therefore necessarily *"while the user is in the app"*, not
   a background server job.

The target audience uses **online consumer storage** (Dropbox, Google Drive,
OneDrive), not desktop sync clients — so a "write to a local synced folder" path
(File System Access API) was dropped: without a desktop sync client behind it,
it writes to local disk only, which is not off-site. iCloud Drive and Proton
Drive are excluded outright: neither exposes a public third-party file API
(Apple's CloudKit JS only reaches an app-private container, not the
user-visible Drive).

## Decision

**Auto backup pushes the `.age` straight from the browser to a per-provider
app-folder over the provider's REST API. No server involvement at any step.**

- **Direct browser → provider.** Dropbox, Google Drive and Microsoft Graph all
  support **OAuth2 PKCE public clients with CORS** on their token, refresh and
  upload endpoints, so the whole flow — consent, token exchange, refresh,
  upload — runs in the browser. The api gains **no new endpoint** (no
  `/auth/*`, no proxy). The server never sees a token nor the blob.
- **App-folder scope only.** Dropbox *App folder*, Google `drive.file`, OneDrive
  `approot`. The app can read/write **only its own backups**, never the rest of
  the user's Drive. This is free attack-surface reduction and is also why Google
  `drive.file` stays a **non-sensitive** scope (lighter verification than the
  broad `drive` scope).
- **PKCE, no client secret.** The `client_id` is public frontend config; PKCE
  removes the need for a secret, so nothing confidential ships in the bundle or
  the repo.
- **The refresh token is the one new secret, sealed under the main key.** It
  lives in the **encrypted preferences** (a `cloudBackup` field), never as
  server plaintext. Direct consequence, consistent with constraint 2: the token
  is only legible in an unlocked session, so auto backup can only fire there —
  exactly the model we are forced into anyway.
- **Trigger = on unlock, if stale.** When the app unlocks (data decrypted, main
  key present), it checks `lastBackupAt`; if older than **24 h**, it seals a
  fresh `.age` and pushes it in the background. One check, no scheduler, key
  guaranteed present.
- **Retention = a single rolling file.** `nodea-backup-latest.age`, overwritten
  every push. No history, no prune logic.
- **One provider at a time, seam at the second.** Dropbox lands first as
  concrete code; the common `{ connect, refresh, upload }` provider interface is
  extracted when the Google adapter arrives — two implementations justify the
  abstraction, one does not.

## Consequences

**Positive:**

- **Zero new backend.** No endpoint, no server-side token storage, no proxy, no
  new `/auth/*` to rate-limit. The api stays unaware the feature exists — fewer
  moving parts, smaller blast radius.
- **Security model untouched.** The destination only ever holds the same opaque
  `.age` the user could already download. App-folder scope means even a leaked
  token reaches only the backups, not the wider Drive.
- **The forced constraint became the simple design.** "Server can't seal" ruled
  out the complex path (background jobs, server-held tokens) and left the
  trivial one (check-on-unlock). The limitation did the architecture work.
- **Break-glass intact.** It is the ADR-0016 `.age` unchanged — still openable
  with the standard `age` CLI if Nodea disappears.

**Negative:**

- **No backup while logged out.** Auto only fires in an unlocked session; a user
  who never opens the app stops being backed up. Inherent to E2E (no server
  key), not fixable here — surfaced in the UI as "dernière sauvegarde le …".
- **A `client_id` + redirect URI per provider must be registered** in each
  provider's developer console, and Google `drive.file`, though non-sensitive,
  still needs a verification pass before production. Ops the user owns, not code.
- **Single rolling file = no history.** A corruption that survives one cycle
  overwrites the only good copy. Accepted for v1; dated retention is a local
  change to the upload step when wanted.
- **Token refresh depends on the provider.** Access tokens are short-lived
  (~1–4 h); each trigger refreshes first. A revoked/expired refresh token
  surfaces as "reconnecter <provider>", not a silent failure.

## Alternatives considered

- **Server-side scheduled backup.** The obvious "auto" shape — a cron pushing
  nightly. Impossible: the server has no main key, so it can neither decrypt the
  data nor derive the seal phrase. Not a trade-off, a hard block.
- **Server proxies the upload** (browser → api → provider). Would centralise
  token handling, but the api would then hold provider tokens and a new endpoint
  to rate-limit, for zero gain — the provider APIs are already browser-reachable
  (CORS + PKCE). Rejected as pure added surface.
- **File System Access API → local synced folder.** Zero credentials, but only
  off-site if a desktop sync client mirrors the folder; the target audience does
  not run one, so it degrades to "save to local disk". Dropped.
- **Trigger on logout / on every change.** Logout purges the key mid-push
  (fragile, and misses users who just close the tab); per-change hooks touch
  every module's write path for marginal freshness. On-unlock-if-stale is the
  robust minimum.
- **iCloud Drive / Proton Drive adapters.** No public third-party file API for
  either. CloudKit JS reaches only an app-private container (not the visible
  Drive) and needs Apple Developer Program + Sign in with Apple. Excluded.

## When to revisit

- If a provider drops CORS/PKCE on a needed endpoint, that one adapter needs a
  thin server proxy — local to that adapter, not a reversal of the decision.
- If users want **history** (multiple restore points), swap the single rolling
  file for dated names + keep-last-N at the upload step; nothing else changes.
- If a non-browser trigger is ever needed (true offline auto), it would require
  giving the server a key — a different security model and its own ADR, not an
  edit to this one.
- `age` recipient-key mode (ADR-0016's note) would let a future "seal to a Nodea
  public key" coexist with this push path unchanged.
