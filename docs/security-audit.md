# Security audit — baseline

> **Statut** : audit baseline. Posé pour combler la référence
> obligatoire de [`CLAUDE.md`](../CLAUDE.md) §Documentation
> (« cross-check before closing any related task »). Couvre le
> code crypto, les flows d'authentification, le risque de fuite
> en réponse serveur, l'historique git, l'audit deps et la
> conformité au security-checklist de CLAUDE.md.
>
> **Mise à jour** : à chaque PR sécurité, ouvrir ce doc, vérifier
> que la zone concernée n'a pas régressé, et bumper la date de
> revue ci-dessous. Quand un finding est clos, le déplacer dans
> la section « Findings résolus » avec le commit qui livre le
> correctif.
>
> **Date de la baseline** : 2026-04-30. **Prochaine revue
> obligatoire** : à la livraison d'Auth Phase 5+, ou dans 6 mois,
> selon ce qui arrive en premier.

L'app est e2e encrypted : la clé maîtresse est dérivée côté
navigateur via OPAQUE, le serveur ne stocke que des ciphertexts +
des HMAC guards, jamais de plaintext, jamais de clé. Tout finding
qui peut affaiblir cette ligne est traité comme critique.

---

## Verdict global

**0 findings ouverts. 2 fixés à la baseline. 1 warning
documenté (design choice).** Le socle crypto et les
middlewares d'auth sont solides ; les deux failles
opérationnelles trouvées au moment de poser la baseline ont
été comblées dans le même cycle.

| # | Sévérité | Finding | Statut |
|---|---|---|---|
| 1 | 🚨 Critique | Guards loggés dans les logs Hono via le query string | ✅ Fixé (cf. Findings résolus) |
| 2 | 🚨 Haute | Atomicité d'invite non testée concurrent | ✅ Fixé (cf. Findings résolus) |
| 3 | ⚠️ Note | `modules_config` exempté de guard (design intentionnel) | ✅ Documenté |

---

## Findings ouverts

*(aucun finding ouvert à la baseline)*

---

## Findings résolus

### ✅ Finding 1 — Guards loggés dans les logs Hono *(résolu 2026-04-30)*

**Commits** : middleware
[`packages/api/src/middleware/sanitize-log-url.ts`](../packages/api/src/middleware/sanitize-log-url.ts)
+ wire dans [`app.ts`](../packages/api/src/app.ts) +
[`sanitize-log-url.test.ts`](../packages/api/src/middleware/sanitize-log-url.test.ts)
(10 tests).

**Stratégie retenue** : option 1 du fix (sanitiser dans le
printer, pas dans la requête). Le middleware Hono `logger()`
accepte une fonction d'impression custom — on lui passe un
`redactingPrintFunc` qui regex-remplace `?d=…` et `?token=…`
par `__redacted__` avant d'appeler `console.log`. Le query
string réel n'est jamais touché côté handler — seule la
sortie console est redactée.

Liste actuelle des params redactés :
  - `d=` — guard HMAC du collection-factory
  - `token=` — magic-link / reset / activation tokens

À étendre quand de nouveaux params auth surfaceront. Test
fige le contrat (preserve les non-secrets, redacte les
secrets, gère first/middle/last position dans la query).

### ✅ Finding 2 — Atomicité d'invite : test concurrent *(résolu 2026-04-30)*

**Commit** : test ajouté dans
[`packages/api/src/test/auth-register-v2.test.ts`](../packages/api/src/test/auth-register-v2.test.ts)
— « rejects a second concurrent invite consumption (atomicity) ».

Le test drive deux `/start` en parallèle (les deux passent —
`/start` ne consomme pas l'invite), puis race deux `/finish`
en `Promise.all`. Postgres serialise via `SELECT … FOR
UPDATE` ; un winner / un loser. Le test vérifie :

  - Statuses : exactement un 200, l'autre 401 (ou 400
    `email_taken` si le loser slip past l'invite check et
    hit le unique constraint sur `users.email`).
  - `invites.used_by` pointe sur exactement un user.
  - Une seule ligne `users` existe pour cet email.

Filet futur : si quelqu'un retire `.for('update')` du
[`consumeInviteAndCreateUser`](../packages/api/src/auth/invites.ts)
le test devient flaky (parfois 2 × 200), CI rouge.

---

## Sweep par zone

### 1. Crypto — ✅ Solide

| Vérification | Verdict | Évidence |
|---|---|---|
| HKDF domain separation (`nodea:aes` vs `nodea:hmac`) | ✅ | [`core/crypto/hkdf.ts:15-17`](../packages/web/src/core/crypto/hkdf.ts) + dérivation parallèle dans [`key-material.ts:39-42`](../packages/web/src/core/crypto/key-material.ts) |
| CryptoKey jamais loggée / persistée | ✅ | Grep `console.log.*key`, `localStorage.*key`, `window.*key` → aucun match. State Zustand en mémoire seule. |
| Source unique pour base64 / random | ✅ | [`core/crypto/base64.ts`](../packages/web/src/core/crypto/base64.ts) est l'unique source. Lint rule `no-restricted-syntax` bloque `crypto.subtle.*` hors `core/crypto/`. |
| Branded types respectés | ✅ | [`packages/shared/src/crypto-types.ts`](../packages/shared/src/crypto-types.ts) : `Base64`, `Base64Url`, `CipherIV`, `EncryptedBlob`, `AesMainKey`, `HmacMainKey` |
| Wipe semantics documentées | ✅ | `wipeRawBytes` dans [`key-material.ts:78-84`](../packages/web/src/core/crypto/key-material.ts) zéroe les bytes sources, doc explicite que CryptoKey ne peut pas l'être |
| Guard timing-safe | ✅ | [`middleware/require-guard.ts:51-75`](../packages/api/src/middleware/require-guard.ts) — timing-safe compare |

### 2. Auth — ✅ Solide

| Vérification | Verdict | Évidence |
|---|---|---|
| Mutations via guard middleware | ✅ | Single source : [`api/src/collections/registry.ts:32`](../packages/api/src/collections/registry.ts). Factory dans [`collection-factory.ts:99,134`](../packages/api/src/routes/collection-factory.ts) wire `requireGuard` automatiquement. Adding a collection → guard automatique. |
| Atomicité invite | ✅ | Code correct (`SELECT FOR UPDATE` dans transaction) + test concurrent dans [`auth-register-v2.test.ts`](../packages/api/src/test/auth-register-v2.test.ts) — voir Finding 2 résolu. |
| Rate-limiting `/auth/*` | ✅ | [`middleware/rate-limit.ts`](../packages/api/src/middleware/rate-limit.ts) appliqué partout : register start/finish/activate, login, MFA, recovery, change-password. Audit grep des routes confirme. |
| Session cookies | ✅ | `httpOnly: true, sameSite: 'Lax', secure: COOKIE_SECURE, signed` — [`auth/cookies.ts:10`](../packages/api/src/auth/cookies.ts) |
| Password hashing | ✅ | OPAQUE via `@serenity-kit/opaque@1.1.0` — Ristretto255-SHA512-Argon2id, Cure53-audited. |
| Logout invalide la session immédiatement | ✅ | [`auth/session.ts:181-182`](../packages/api/src/auth/session.ts) — `db.delete()` synchrone avant la 200. |

### 3. Réponses serveur — ✅ Pas de fuite

- [`collection-factory.ts:28-35`](../packages/api/src/routes/collection-factory.ts)
  expose `toView()` qui strip `guard` explicitement avant tout
  retour. Seuls `id, module_user_id, cipher_iv, payload` sortent.
- [`auth-account.ts /me`](../packages/api/src/routes/auth-account.ts)
  renvoie `wrappedMainKey` + `wrappedKekPassword` **à
  l'utilisateur·rice authentifié·e seulement** (qui en a besoin
  pour déchiffrer). Pas une fuite — c'est le contrat.
- [`admin.ts GET /admin/users`](../packages/api/src/routes/admin.ts)
  sélectionne `id, email, username, role, onboardingStatus,
  createdAt, updatedAt` uniquement. **Aucune colonne crypto** —
  vérifié par lecture du `db.select(...)`.

### 4. Historique git — ✅ Clean

`.env.example` ne contient que des placeholders documentaires
(`POSTGRES_PASSWORD=nodea_dev`, `COOKIE_SECRET=ci_cookie_…`).
Aucune valeur réelle. Grep historique sur
`secret|api_key|token=|password=` ne ramène que des fixtures de
tests + de la doc.

### 5. Dépendances — ✅ 1 vuln dev-only

**`pnpm audit --prod`** (avril 2026) :

```
1 HIGH vulnerability
  - playwright (e2e package, dev-only)
    < 1.55.1 — SSL cert validation in browser downloads (GHSA-7mvr-c777-76hp)
```

→ Dev-only, pas dans le bundle prod. Bumper quand pratique.

**Deps crypto-adjacentes** (toutes pinned, audits OK) :

| Package | Version | Verdict |
|---|---|---|
| `@serenity-kit/opaque` | 1.1.0 | ✅ Cure53-audited |
| `@simplewebauthn/server` | 13.3.0 | ✅ Maintenu activement |
| `@simplewebauthn/browser` | 13.3.0 | ✅ Maintenu activement |
| `@scure/bip39` | 2.2.0 | ✅ Reference impl |
| `argon2-wasm` | (legacy) | À retirer si plus consommé — confirmer |

### 6. Cross-check avec security-checklist CLAUDE.md

| Item | Évidence | ✓ |
|---|---|---|
| No `any` in TS | ESLint `@typescript-eslint/no-explicit-any: 'error'` (cf. `eslint.config.mjs`) | ✅ |
| No string interpolation in DB queries | Drizzle `eq(table.field, value)` partout, audit grep zéro raw SQL | ✅ |
| All record mutations through guard | `collections/registry.ts` single-source, factory automatique | ✅ |
| Multi-table writes wrapped in transaction | Auth routes wrappent invite + user + opaque dans `db.transaction(tx => …)` | ✅ |
| No secrets / keys in localStorage | Drafts chiffrés avant storage, pas de raw key persistée | ✅ |
| No `window.mainKey` global | Zustand store en mémoire, pas de leak global trouvé | ✅ |
| Réponses serveur n'incluent pas `guard` ou `encrypted_key` autres users | Strip dans `toView()`, admin route ne select pas les colonnes crypto | ✅ |
| Rate limit sur `/auth/*` | Tous les endpoints couverts (register, login, MFA, recovery, change-password) | ✅ |
| HKDF domain separation + branded types | Confirmés au §1 ci-dessus | ✅ |

→ **9 / 9 cases du checklist respectées.**

---

## Notes de design

### `modules_config` exempté de guard

[`api/src/routes/modules-config.ts`](../packages/api/src/routes/modules-config.ts)
n'utilise **pas** le middleware `requireGuard` — uniquement
`requireUser`. C'est intentionnel et documenté dans
[`CLAUDE.md`](../CLAUDE.md) §Backend rules :

> `modules_config` is keyed PK on `user_id` and does not need
> a guard; `requireUser` is sufficient.

La table porte un PK sur `user_id` (1:1, pas de records
multiples), donc le guard (qui authentifie un record précis)
n'apporte rien — il y a un seul record par user. ✅ Documenté,
pas une régression.

---

## Convention de mise à jour

À chaque PR sécurité :

1. Ouvrir ce fichier, repérer la zone concernée (§1-6).
2. Si la PR touche du crypto / auth / cookies / DB query / log :
   confirmer que les vérifications existantes ne régressent pas.
3. Si la PR introduit un finding nouveau, l'ajouter en
   « Findings ouverts ».
4. Si la PR clôt un finding, le déplacer en « Findings résolus »
   avec le commit-hash + la date.
5. Bumper la « Date de la baseline » au passage si l'audit
   est repassé en entier.

Quand le doc devient trop lourd (> 500 lignes), envisager de
splitter par zone (`security-audit/crypto.md`, `auth.md`, etc.)
plutôt que d'archiver les findings résolus.
