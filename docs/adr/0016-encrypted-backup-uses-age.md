# 0016 — Encrypted account backup uses the `age` format (passphrase mode)

- **Status**: Accepted
- **Date**: 2026-06

## Context

The account data panel (`Compte → Données`) already ships a **plaintext**
export: a client-side JSON of every module's decrypted entries, for RGPD
portability. It satisfies "give me my data" but is not a safe *backup* — it
is cleartext.

The ask: a **portable, encrypted backup** that

1. is **independent of the account** — re-importable into a *brand new*
   account, so it survives losing the original one (a real disaster-recovery
   need, not just "download my data");
2. **keeps** the existing plaintext export alongside it;
3. **blocks** a weak passphrase rather than warning (a weak passphrase leaves
   the file brute-forceable offline);
4. avoids lock-in — the data should be recoverable even without Nodea.

(1) rules out sealing under the account's main key or any session-derived
key: the backup must be sealed under a **user-chosen passphrase** that
derives nothing from the account.

Two formats were on the table for the envelope:

- a **home-made envelope** reusing Nodea's stack — Argon2id (via `@noble/hashes`)
  + AES-256-GCM, a small binary header we'd spec ourselves;
- the **`age` standard** (passphrase mode) — scrypt + ChaCha20-Poly1305, via
  `age-encryption` (a.k.a. *typage*, Filippo Valsorda's official TypeScript
  port of `age`).

On raw primitives the two are a wash: Argon2id is a touch more modern than
scrypt, AES-GCM and ChaCha20-Poly1305 are equivalent AEADs. The difference is
**composition** — crypto breaks at the joints (nonce reuse, AAD, key
wrapping), not the algorithms — and that is exactly what a home-made envelope
would own and we alone would review.

## Decision

**Seal the encrypted backup as an `age` file in passphrase mode, via
`age-encryption@0.3.0`.**

Structure — "Option 2", an **opaque** container:

```
nodea-backup-YYYY-MM-DD.age           # one binary age file, passphrase-sealed
  └─ (ciphertext) ─ ZIP                # revealed only after decryption
       ├─ manifest.json               # { format, version, app, exported_at, modules[] }
       ├─ modules/mood.json           # one JSON per module
       ├─ modules/journal.json
       └─ modules/hrt_lab_results.json …
```

- The `.age` file is a single opaque blob. The per-module structure lives
  *inside* the ciphertext — the outer file leaks no module list nor
  per-module sizes, and being binary it doesn't invite hand-editing.
- The passphrase is **unrelated to** the account password, the main key, and
  every wrapped-KEK factor. That independence is what makes the backup
  portable across accounts.
- **zxcvbn ≥ 3 is enforced at the UI** (`BackupExportPanel`) as a hard block,
  not a warning — without the account password's character-class rules, which
  would wrongly reject a strong multi-word passphrase. The crypto layer
  (`core/crypto/backup-crypto`) stays a pure primitive with no opinion on
  passphrase quality.
- The crypto + ZIP run **client-side only** (`age` + `fflate`, lazy-imported);
  the server never sees the plaintext or the passphrase.

The plaintext export is **kept unchanged**; the backup is purely additive.

## Consequences

**Positive:**

- **The risky part is borrowed, not invented.** `age` is a reviewed,
  specced format with multiple interoperable implementations — its
  composition (the joints where hand-rolled crypto fails) is vetted. "Don't
  roll your own crypto" applied to the *format*, not just the primitives.
- **Break-glass longevity.** Even if Nodea disappears, the backup decrypts
  with the standard `age` CLI → you get the ZIP → your JSON. A user's backup
  outlives the app.
- **Less code to own.** No bespoke binary header to spec, version, and test —
  the library handles the envelope; we only own the inner ZIP layout
  (`backup-pack.ts`, unit-tested independently of the crypto).
- **Trustworthy dependency.** `age-encryption` is by `age`'s own author, and
  its entire dependency tree is the `@noble`/`@scure` family (paulmillr,
  audited) — the same lineage as `@scure/bip39`, already in the tree.

**Negative:**

- **A second crypto stack.** age uses scrypt + ChaCha20-Poly1305, whereas the
  rest of Nodea is Argon2id + AES-GCM + HKDF. The divergence is **isolated to
  this one feature**, but it is one more primitive set and one more dependency
  to keep trusted. This was the sole argument for the home-made route; it lost
  to the composition + longevity wins for a *backup* specifically.
- **scrypt work factor is the library default (logN = 18).** Adequate once a
  strong passphrase is enforced; not independently tunable the way our
  Argon2id parameters are.

## Alternatives considered

- **Home-made envelope (Argon2id + AES-GCM).** Consistent with our stack, zero
  new crypto dependency (Argon2id was already reachable via `@noble/hashes`),
  full control. Rejected: for a *backup*, a reviewed standard's vetted
  composition + break-glass recoverability outweigh stack purity, and a
  Nodea-only format has no recovery path if Nodea is gone.
- **A visible `.zip` of per-module *encrypted* files** (ZIP-of-`.enc` +
  manifest). Allows partial decryption, but the outer container is a
  recognisable archive that "invites opening", and it leaks the module list +
  per-module sizes as cleartext ZIP metadata. Rejected for the opaque blob.
- **A single encrypted JSON, no per-module split.** Simplest, but the user
  explicitly wanted a per-module layout (manageable as data grows, browsable
  after decryption). The per-module ZIP *inside* the opaque blob gives that
  without exposing structure outside.

## Known limitation — cross-account reference remap (follow-up)

The "re-importable into a brand new account" guarantee (requirement #1) is
**faithful for 10 of the 12 collections**, and fully faithful for a
same-account restore (ids are stable). The two exceptions are
`habits_logs.itemRid` and `library_reviews.itemRid`, which reference their
parent (a habit item / a book) by the parent's **server id**. On a restore
into a *different* account the parents are re-created with fresh ids, so
those two child collections import successfully but their links dangle
(habit heatmaps empty, reviews not attached to their book). The data itself
is not lost. HRT cross-references survive because they join by product
*name*, not id.

Fixing this requires threading each record's server id through the export so
the restore can build an old-id → new-id map and rewrite the child
`itemRid` (restoring parents before children). That changes the export
record shape and is scoped as a **dedicated follow-up PR** (with its own
review) rather than bundled here. Until then the limitation is documented in
`Architecture.md` §7.3 and accepted for v1.

## When to revisit

- If `age-encryption` stalls (unmaintained / unaudited divergence), reassess —
  the inner ZIP layout is library-agnostic, so swapping the envelope is local
  to `core/crypto/backup-crypto`.
- If we ever want **recipient-key** backups (seal to another Nodea identity's
  public key instead of a passphrase), `age` already supports X25519
  recipients natively — a reason this choice ages well, not a reason to
  revisit.
