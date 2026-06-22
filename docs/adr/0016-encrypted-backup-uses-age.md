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

## Update (2026-06) — the phrase is a derived, versioned BIP39 phrase

The seal passphrase is no longer **chosen** by the user, nor generated
fresh per export. Nodea **derives** a 12-word BIP39 phrase from the
account's HMAC sub-key over a version-tagged label
(`core/crypto/backup-phrase.ts`), shows it once, and confirms it via a
transcription quiz (re-type 3 random words, words hidden) — the same
`MnemonicReveal` flow as the account recovery code. This supersedes two
points above:

- the **zxcvbn ≥ 3 block is gone** — a 128-bit derived phrase is strong by
  construction, so there's no weak passphrase to reject (the crypto layer
  stays opinion-free). The former `BackupExportPanel` launcher mentioned
  above is also gone: export is now one split-button in the Données tab
  (encrypted `.age` → `/backup`, plain `.json` → `/export`);
- the requirement that the phrase **"derives nothing from the account"** is
  dropped. It now derives from the main key — but the property that
  mattered (portability) is preserved differently: the user still
  transcribes the words (quiz-confirmed) and types them at restore, so the
  `.age` still opens in a brand-new account. Deriving only removes the need
  to **store** the phrase, never the need to **keep** it. No extra
  exposure: anyone able to derive it already holds the main key (hence the
  plaintext data).

**Stable + rotatable.** Being deterministic in `(main key, version)`,
every `.age` made at the same version opens with the **same** 12 words —
the user notes them once and never faces "which phrase opens which file".
`version` is a non-secret counter in the encrypted preferences
(`backupPhraseVersion`, absent ⇒ 1); a future "rotate my backup phrase"
action (e.g. on suspected exposure) bumps it, deriving a fresh phrase for
**future** exports while existing files keep the phrase of the version
they were sealed under. Still `age` passphrase mode throughout.

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

## Cross-host reference remap — resolved in #155

> **Status update (issue #155).** The limitation below is **fixed**. Kept
> here for the decision trail; see `Architecture.md` §7.3 and
> `import-export/relink.ts` for the implementation.

The original limitation: the "re-importable into a brand new account"
guarantee was faithful for a same-account restore (ids are stable) but the
relations that reference a parent by **server id** dangled on a restore into
a *different* account / host, where parents are re-created with fresh ids —
`library_reviews.itemRid` → book, `habits_logs.itemRid` → habit, and (also
an id ref, contrary to the original note) `hrt_admin_logs.scheduleId` →
schedule. Children imported but their links pointed nowhere.

The fix avoids changing the stored record shape: on export each child is
stamped with its parent's **stable content key** (the parent's existing
`getNaturalKey`, carried in the export-only `__parentKey` field); on import
parents are recreated first, a `naturalKey → newServerId` index is built per
referenced parent (covering pre-existing *and* freshly imported parents),
and each child's reference is rewritten — unless it already points at a live
parent on this host (same-host idempotency). A child is never dropped: an
unresolved required link stays a recoverable orphan, an unresolved optional
link (`scheduleId`) is cleared. No schema change, no backfill; old exports
without `__parentKey` fall back to same-host behaviour.

## When to revisit

- If `age-encryption` stalls (unmaintained / unaudited divergence), reassess —
  the inner ZIP layout is library-agnostic, so swapping the envelope is local
  to `core/crypto/backup-crypto`.
- If we ever want **recipient-key** backups (seal to another Nodea identity's
  public key instead of a passphrase), `age` already supports X25519
  recipients natively — a reason this choice ages well, not a reason to
  revisit.
