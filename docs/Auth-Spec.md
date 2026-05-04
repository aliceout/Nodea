# Auth-Spec — Spécification complète Authentification + MFA

> **Précédence.** Code et doc = source unique de vérité (CLAUDE.md).
> Le code prime sur la spec en cas d'écart constaté → corriger le
> code OU la spec dans le même PR que la divergence est introduite.

---

## Table des matières

0. [Lecture rapide](#0-lecture-rapide)
1. [Vue d'ensemble](#1-vue-densemble)
2. [Threat model](#2-threat-model)
3. [Modèle cryptographique](#3-modèle-cryptographique)
4. [Schéma de base de données](#4-schéma-de-base-de-données)
5. [Cookies & sessions](#5-cookies--sessions)
6. [Matrice de re-auth](#6-matrice-de-re-auth)
7. [Flows complets](#7-flows-complets)
8. [TOTP — détails](#8-totp--détails)
9. [Passkey — détails](#9-passkey--détails)
10. [Service email](#10-service-email)
11. [Middlewares serveur](#11-middlewares-serveur)
13. [Algorithmes & paramètres figés](#13-algorithmes--paramètres-figés)
14. [Anti-patterns interdits](#14-anti-patterns-interdits)
15. [Test matrix](#15-test-matrix)
16. [Pièges récapitulés](#16-pièges-récapitulés)

---

## 0. Lecture rapide

### 0.1 État courant (post-Phase 8)

| Question | Réponse courte | Détail |
|---|---|---|
| Comment crée-t-on un compte ? | Form unique `email + password` ; activation via lien email magique avant que le compte soit utilisable | §7.1 |
| Comment fonctionnent les invitations ? | Admin entre une adresse e-mail, le serveur envoie un lien `?invite=<token>` ; pas de code à copier-coller | §7.1 |
| Qu'est-ce qui gate le login ? | `users.email_verified_at IS NOT NULL` + facteurs requis selon `security_mode` (Auth-Spec §6) | §7.2, §6 |
| Open registration ? | Toggle admin `open_registration`, défaut OFF | §7.1 |
| Qu'est-ce qui dérive la KEK ? | OPAQUE `export_key` (Phase 2) **ou** WebAuthn PRF (Phase 4) **ou** recovery code BIP39 (Phase 3) | §3.2 |
| Le TOTP dérive quelque chose ? | **Non** — gate de session uniquement, secret en clair serveur (cf. §2.3). | §2.3, §8 |
| Identifiant OPAQUE ? | `users.email` (changer l'email = re-register OPAQUE — la route le fera quand §7.6 sera complétée) | §7.6 |
| Combien de wraps de la KEK ? | 1 password + N passkeys PRF + 1 recovery code | §3.2 |
| Mode "Sécurité maximale" = split crypto ? | **Non**, gate UX uniquement | §2.3 |
| Yubikey sans PIN acceptée ? | **Non** — UV `'required'`, passkey sans déverrouillage refusée | §9.3 |
| Un opérateur serveur peut lire mes données ? | **Non** — la KEK n'est jamais côté serveur | §2.1 |
| Un opérateur serveur peut bypass TOTP ? | **Oui** (TOTP = serveur de confiance partielle) | §2.2 |
| Un serveur web compromis pourrait-il exfiltrer ma clé via JS injecté ? | **Limite inhérente du modèle web** — mitigée par SRI sur l'entry chunk + INTEGRITY.txt manifest publié à chaque release, recommandation explicite d'auto-hébergement pour usages sensibles | `nodea.app/docs/security/tech` (« Intégrité du bundle ») |

---

## 1. Vue d'ensemble

### 1.1 Objectifs

L'auth Nodea repose sur un modèle multi-facteurs E2E qui :

- préserve l'E2E **même quand le serveur est compromis** (vs juste
  "honest-but-curious") — KEK dérivée d'OPAQUE `export_key`, pas
  d'Argon2id côté serveur sur le password ;
- accepte les passkeys (WebAuthn) avec dérivation de KEK via PRF
  quand l'authenticator le supporte ;
- ajoute un gate TOTP optionnel pour les sessions ;
- offre un **chemin de récupération crypto** explicite (recovery
  code BIP39) qui n'érode pas la propriété E2E ;
- propose un bypass MFA email 7 jours pour récupérer un facteur
  perdu sans reset destructif ;
- expose une matrice de re-auth cohérente pour toutes les
  modifications sensibles ;
- mitige le threat model "serveur compromis qui sert du JS altéré"
  via SRI sur l'entry chunk + manifest INTEGRITY.txt à chaque
  release.

### 1.2 Invariants permanents

Quoi qu'il arrive, ces invariants tiennent :

1. **Main key client-only.** Aléatoire 32 bytes générés à
   l'inscription. Jamais transmise. Wrapée côté serveur sous une
   clé que le serveur n'a pas.
2. **HKDF domain separation** entre `aes` et `hmac` — labels
   `nodea:aes` et `nodea:hmac`, inchangés.
3. **Non-extractable `CryptoKey`** importé une fois, vit en mémoire
   jusqu'au logout.
4. **Branded types** TypeScript (`Base64`, `AesMainKey`,
   `HmacMainKey`, etc.) en `packages/shared/src/crypto-types.ts`.
5. **Guards HMAC** sur les mutations d'entrées, dérivés depuis la
   sub-key HMAC.
6. **Reset destructif** conservé en filet de dernier recours.
7. **Aucun "logged-in sans clé"** : status `crypto.missing` →
   `KeyMissingModal` bloquant.

---

## 2. Threat model

### 2.1 Ce qu'on défend (et comment)

| Adversaire | Moyens | Ce qu'on garantit | Mécanisme |
|---|---|---|---|
| **Opérateur serveur honest-but-curious** | Lecture complète DB + logs | **Aucune** plaintext lisible. KEK et main key restent inaccessibles. | OPAQUE (export_key client-only), PRF (prf_output client-only), AES-GCM auth-tag, AAD lié à `users.id` |
| **Attaquant réseau (TLS rompu localement)** | MitM | Aucune fuite si TLS OK ; OPAQUE résiste partiellement à un serveur menteur | OPAQUE binding au server static key, HSTS prod, `Secure` cookies |
| **Voleur de sessions** (cookie session volé) | Cookie en clair | Lifetime borné, revocation par DELETE FROM sessions, SameSite=Lax. Mode max impose passkey + TOTP au renouvellement. | §5 |
| **Voleur de device avec session active** | OS access | Limité à la durée de session ; cold reload purge la main key (status `missing`) ; mode max nécessite passkey/TOTP au renouvellement | §5 |
| **Voleur d'email (compte mail compromis)** | Reset destructif possible, bypass TOTP possible après 7 jours | **Perte de données potentielle** (reset destructif) ou **bypass TOTP** (avec 7 jours delay) ; pas de fuite de plaintext sans password OPAQUE ou recovery code | §7.8, §7.9 |
| **Phisher** | Faux site Nodea | Passkey FIDO résistante par origin-binding. OPAQUE n'est **pas** anti-phishing (un faux site peut faire register OPAQUE chez l'attaquant). | Documenté §2.3 |
| **Brute-forceur online** | Tentatives répétées | Rate-limit sur `/auth/login`, OPAQUE intègre Argon2id côté serveur | §13 |
| **Brute-forceur offline (DB exfiltrée)** | Cracking sur dump | OPAQUE = pas de hash de password offline-crackable ; Argon2id paramètres élevés en cas de fallback | §13 |
| **Cross-user attaque par swap de blob** | Bidouille DB | AAD `users.id` lie chaque blob à son propriétaire | §3.4 |

### 2.2 Ce qu'on ne défend pas

Énoncé explicitement pour qu'aucun PR ne prétende fixer ces angles
sans rouvrir la spec :

1. **Serveur compromis avec tampering du bundle JS livré** :
   - TOTP devient bypassable (le serveur contrôle la vérification).
   - Passkey signature peut être bypassée si le serveur accepte
     n'importe quelle réponse.
   - **Ce qui reste protégé** : la KEK derrière OPAQUE export_key et
     PRF prf_output (calculés dans le client). Tant que le navigateur
     exécute le bundle officiel et que la passkey est utilisée
     correctement, l'attaquant ne récupère pas la main key.
   - Le mode "Sécurité maximale" **n'augmente pas** la protection
     crypto contre cet adversaire — c'est un gate UX.
2. **Malware actif sur la machine de l'utilisateur·ice** : keylogger,
   extension malveillante avec accès au DOM, autofill compromis. On
   n'a aucun moyen de défendre cette surface depuis le serveur ou le
   bundle.
3. **Passkey sans gesture (UV manquant)** : refusée par construction
   à l'enrollment (UV `'required'`, cf. §9.3). Ce vecteur est
   éliminé en amont, pas dans la couche crypto.
4. **Coercition (rubber-hose)** : si l'utilisateur·ice est forcé·e
   de donner password + passkey + TOTP, on perd. C'est un problème
   physique, pas crypto.
5. **Side channels** : timing attacks fines sur OPAQUE, fuites par
   cache, microarchitecture. Hors scope.
6. **Perte simultanée** de password + tous les passkeys + recovery
   code + email : reset destructif uniquement. **Données perdues**.
   L'utilisateur·ice est prévenu·e à chaque étape.
7. **Cooldown change-email contournable via reset destructif**.
   Un attaquant qui prend l'email victime peut déclencher un reset
   destructif puis un change-email immédiat (le cooldown 7j n'est
   pas (re-)armé par le reset). **Risque résiduel accepté V1** : le
   reset destructif efface toutes les données, le compte récupéré
   est vide, donc l'incentive à rouvrir un compte volé sous une
   autre adresse est faible. Si on observe ce vecteur, mitiger en
   armant `email_changed_at = now()` à la fin du reset destructif.

### 2.3 Trade-offs documentés

- **TOTP est un gate de session, pas un gate cryptographique.** Le
  secret TOTP doit être stocké en clair côté serveur (exigence du
  protocole : le serveur doit pouvoir vérifier le code). Donc un
  opérateur serveur qui aurait obtenu le password OPAQUE peut
  techniquement bypass TOTP côté serveur et obtenir les
  `wrapped_kek_*`. La protection TOTP repose **entièrement** sur
  l'intégrité du serveur. OPAQUE et PRF restent E2E même serveur
  compromis.
- **Mode "Sécurité maximale" est un gate UX, pas un Shamir 2-of-2.**
  Refuser l'option Shamir évite l'explosion de complexité (changement
  de mode = re-split, perte d'une passkey en mode max = perte de
  données sauf via recovery code, etc.). Le mode max augmente la
  résistance au vol d'appareil ou à la session volée, pas la
  résistance au serveur compromis.
- **Passkeys avec UV `'required'`.** Toute passkey sans gesture de
  déverrouillage (PIN, biométrie, ou unlock du gestionnaire) est
  refusée à l'enrollment. Conséquences pratiques :
  - Yubikey sans PIN configuré → le navigateur déclenche le setup
    PIN, ou enrollment bloqué.
  - Passkeys logicielles (Bitwarden, iCloud Keychain, 1Password,
    Google PM) → OK, déverrouillage du gestionnaire = UV.
  - TouchID / FaceID / Windows Hello → OK.
  Le vol pur de matériel sans gesture ne suffit donc plus à
  unwrap la KEK.
- **Phishing.** OPAQUE n'est pas anti-phishing. Un faux site peut
  capturer le password en lançant un OPAQUE register sur son propre
  serveur. La passkey FIDO **est** anti-phishing (origin-bound). On
  encourage l'usage des passkeys mais on ne les rend pas obligatoires.
- **Identifiant OPAQUE = email.** Changer l'email implique un
  re-register OPAQUE complet (qui nécessite le password en clair côté
  client à ce moment-là, déjà disponible via re-auth fraîche). Lourd
  mais cohérent.
- **Recovery code KEK affiché une seule fois.** Si l'utilisateur·ice
  ne le note pas, le seul recours en cas de perte de password +
  passkey est le reset destructif. Documenté à l'inscription, écran
  bloquant avec checkbox.
- **Surface lisible minimum sur les entry tables.** Aucune ligne
  d'entrée ne porte de `user_id`, ni de timestamp colonne. Le
  serveur ne peut pas linker une entrée à un user en plain SQL
  ni dater les écritures par row. Self-delete est client-driven
  (énumération des sids depuis `modules_config` puis suppression
  par sid + guard). Détails et rationale dans
  [`Architecture.md §7`](Architecture.md#7-schéma-commun-des-modules).

---

## 3. Modèle cryptographique

Le détail des primitives, de la hiérarchie de clés (KEK / main key /
wraps), des labels HKDF figés (`nodea:wrap-kek`, `nodea:wrap-main`,
`nodea:aes`, `nodea:hmac`) et de la construction d'AAD via
`buildAAD()` vit dans la doc « Modèle cryptographique » de
[`tech.md`](../packages/web/src/app/pages/docs/content/tech.md)
(rendu sur [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)).
Cette doc-là est la source de vérité ; toute évolution se fait
dedans, pas ici.

**Conséquences directes** spécifiques à l'auth (pour mémoire) :

- Login = unwrap KEK via **un** facteur → unwrap main key → HKDF AES + HMAC.
- Add/remove passkey = ajouter/retirer un blob `wrapped_kek_passkey_*`. Aucun impact sur les autres facteurs ; la main key bytes ne changent jamais.
- Change password = re-wrap **uniquement** `wrapped_kek_password`. La KEK ne change pas, la main key ne change pas, **aucun ciphertext existant n'est touché**.
- Régénération recovery code = re-wrap **uniquement** `wrapped_kek_recovery`. Idem.
- Régénération KEK : hors scope V1 (équivalent à un re-onboarding crypto).

---

## 4. Schéma de base de données

> Les tables et colonnes décrites ici reflètent
> `packages/api/src/db/schema.ts`.

### 4.0 Tables existantes préservées (hors scope auth)

Tables qui existent indépendamment du chantier auth :

| Table | Usage | Touchée par destructive reset (§4.3) ? |
|---|---|---|
| `invites` | ✅ V1 — invitations email-bound (Bitwarden-style) ; `email + token_hash` ; cf. §7.1 | non (consommée à l'inscription) |
| `app_settings` | ✅ V1 — clé/valeur key-value pour la config d'app (V1 stocke `open_registration` ; futurs réglages mode TOTP, etc.) | non |
| `modules_config` | Config par module et par user, chiffrée | oui (DELETE WHERE user_id) |
| `user_preferences` | Préférences UI par user, chiffrées | oui |
| `mood_entries`, `goals_entries`, `passage_entries`, `habits_*_entries`, `library_*_entries`, `review_entries` | Données chiffrées par module | **non** (depuis migration 0012 — pas de `user_id` sur ces tables, le serveur ne peut pas identifier les entrées d'un user à purger ; rows orphelines acceptées) |

Toutes les autres tables (auth + MFA + sessions) sont définies
en §4.1.

### 4.1 Tables (Drizzle PostgreSQL)

```ts
// packages/api/src/db/schema/users.ts

export const securityMode = pgEnum('security_mode', [
  'password_or_passkey', // défaut : un facteur unlock
  'always_totp',         // TOTP requis après password OU passkey
  'maximum',             // password + passkey + TOTP, tous les trois
]);

export const registerState = pgEnum('register_state', [
  'pre_register',     // ligne créée, email pas encore vérifié
  'email_verified',   // code email validé, peut continuer
  'password_set',     // OPAQUE registration faite
  'recovery_set',     // recovery code KEK affiché et acknowledgé
  'complete',         // facultatifs (TOTP, passkey) traités, session full émise
]);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  isAdmin: boolean('is_admin').notNull().default(false),
  securityMode: securityMode('security_mode').notNull().default('password_or_passkey'),
  registerState: registerState('register_state').notNull().default('pre_register'),
  // Wrap principal : la main key sous la KEK. UNE FOIS, jamais re-wrappée.
  wrappedMainKey: text('wrapped_main_key'),  // base64(AES-GCM(...))
  wrappedMainKeyIv: text('wrapped_main_key_iv'),
  // Wrap KEK par password (OPAQUE) : 1:1 avec users.
  wrappedKekPassword: text('wrapped_kek_password'),
  wrappedKekPasswordIv: text('wrapped_kek_password_iv'),
  // Wrap KEK par recovery code : 1:1 avec users.
  wrappedKekRecovery: text('wrapped_kek_recovery'),
  wrappedKekRecoveryIv: text('wrapped_kek_recovery_iv'),
  // SHA-256 hex de l'entropie BIP39 (16 bytes pour 12 mots) du recovery code.
  // Permet au serveur d'autoriser le flow recover-kek sans connaître le code
  // (130 bits → uncrackable offline). Cf. §7.7.
  recoveryCodeHash: text('recovery_code_hash'),
  recoveryAcknowledgedAt: timestamp('recovery_acknowledged_at', { withTimezone: true }),
  // Cooldown change-email (cf. §7.6) : 7 jours entre deux changes
  emailChangedAt: timestamp('email_changed_at', { withTimezone: true }),
  onboardingStatus: text('onboarding_status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

```ts
// packages/api/src/db/schema/opaque.ts

// 1:1 avec users. Pas de PK séparée — clé sur user_id.
// La table existe pour découpler la rotation OPAQUE des autres champs.
export const opaqueRecords = pgTable('opaque_records', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  envelope: bytea('envelope').notNull(),       // OPAQUE registration record
  // Version de la clé statique serveur OPAQUE utilisée pour cet envelope.
  // Permet la rotation de la clé statique (issue #39) sans casser
  // les comptes existants. La clé courante vit dans `OPAQUE_SERVER_SETUP`
  // (env var) ; les anciennes versions seront stockées dans une table
  // `opaque_server_keys` quand on attaquera #39.
  serverKeyVersion: integer('server_key_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

```ts
// packages/api/src/db/schema/auth-factors.ts

export const authFactorKind = pgEnum('auth_factor_kind', ['passkey']);

export const authFactors = pgTable('auth_factors', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: authFactorKind('kind').notNull(),
  // WebAuthn fields
  credentialId: bytea('credential_id').notNull().unique(),
  publicKey: bytea('public_key').notNull(),    // COSE-encoded
  signCount: integer('sign_count').notNull().default(0),
  // Désactivé pour les authenticators qui ne maintiennent pas le compteur
  // (Apple notamment). Heuristique : signCount = 0 sur >=3 assertions
  // consécutives → flip à false. Cf. §9.6.
  signCountStrict: boolean('sign_count_strict').notNull().default(true),
  transports: text('transports'),              // CSV : "usb,nfc,internal"
  prfSupported: boolean('prf_supported').notNull().default(false),
  // Wrap KEK par PRF (NULL si non-PRF passkey)
  wrappedKek: text('wrapped_kek'),
  wrappedKekIv: text('wrapped_kek_iv'),
  // Métadonnées
  label: text('label'),                        // user-facing : "Yubikey perso", "iPhone"
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('auth_factors_user_idx').on(table.userId),
}));
```

```ts
// packages/api/src/db/schema/mfa.ts

export const mfaTotp = pgTable('mfa_totp', {
  userId: uuid('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  secret: bytea('secret').notNull(),           // 20 bytes random, EN CLAIR (cf. §2.3)
  algo: text('algo').notNull().default('SHA1'),
  digits: integer('digits').notNull().default(6),
  period: integer('period').notNull().default(30),
  lastWindow: bigint('last_window', { mode: 'number' }), // anti-replay
  enabledAt: timestamp('enabled_at', { withTimezone: true }), // null = pending
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const mfaTotpRecoveryCodes = pgTable('mfa_totp_recovery_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  codeHash: text('code_hash').notNull(),       // SHA-256 hex
  usedAt: timestamp('used_at', { withTimezone: true }),
}, (table) => ({
  userIdx: index('mfa_totp_recovery_user_idx').on(table.userId),
}));

export const mfaFactor = pgEnum('mfa_factor', ['totp', 'passkey']);

export const mfaBypassRequests = pgTable('mfa_bypass_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  factor: mfaFactor('factor').notNull(),       // 'totp' ou 'passkey'
  confirmTokenHash: text('confirm_token_hash').notNull(),
  cancelTokenHash: text('cancel_token_hash').notNull(),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  // Une seule request active à la fois par user, toutes factors confondues.
  // Empêche le chaînage instantané passkey-bypass + totp-bypass.
  uniqueActive: uniqueIndex('mfa_bypass_one_active')
    .on(table.userId)
    .where(sql`cancelled_at IS NULL AND consumed_at IS NULL`),
}));
```

```ts
// packages/api/src/db/schema/email-verifications.ts

export const emailVerificationKind = pgEnum('email_verification_kind', [
  'register',     // étape 2 du register multi-étapes
  'email_change', // changement d'email depuis Settings
]);

export const emailVerifications = pgTable('email_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),              // email cible (peut différer de users.email pendant un change)
  kind: emailVerificationKind('kind').notNull(),
  codeHash: text('code_hash').notNull(),       // SHA-256 du code 6 chiffres
  attempts: integer('attempts').notNull().default(0),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('email_verifications_email_idx').on(table.email),
}));
```

```ts
// packages/api/src/db/schema/sessions.ts

export const sessionKind = pgEnum('session_kind', [
  'full',         // session authentifiée complète
  'mfa_pending',  // OPAQUE/passkey OK, MFA requis avant promotion
  'register',    // inscription en cours, scope restreint à /auth/register/*
  'migrate',     // legacy user en cours de migration Argon2id → OPAQUE
                  // scope /auth/migrate/*, TTL 30 min
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  kind: sessionKind('kind').notNull(),
  // Marquage de fraîcheur des facteurs (matrice de re-auth)
  reauthPasswordAt: timestamp('reauth_password_at', { withTimezone: true }),
  reauthPasskeyAt: timestamp('reauth_passkey_at', { withTimezone: true }),
  // Pour mfa_pending : facteurs déjà vérifiés
  mfaPasswordVerified: boolean('mfa_password_verified').notNull().default(false),
  mfaPasskeyVerified: boolean('mfa_passkey_verified').notNull().default(false),
  mfaTotpVerified: boolean('mfa_totp_verified').notNull().default(false),
  // Challenge WebAuthn éphémère pour cette session (5 min TTL).
  // Permet enrollment + assertion sans dépendance Redis (cf. §9.2).
  pendingWebauthnChallenge: text('pending_webauthn_challenge'),
  pendingWebauthnChallengeAt: timestamp('pending_webauthn_challenge_at', { withTimezone: true }),
  // Métadonnées
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
}, (table) => ({
  userKindIdx: index('sessions_user_kind_idx').on(table.userId, table.kind),
}));
```

### 4.2 Contraintes & invariants DB

À enforcer via contraintes ou triggers, sinon vérifier dans le code
serveur :

1. `users.wrapped_main_key` est NOT NULL **après** transition vers
   `register_state >= 'password_set'`. NULL toléré seulement avant.
2. `users.wrapped_kek_password` NOT NULL après `password_set`.
3. `users.wrapped_kek_recovery` NOT NULL après `recovery_set`.
4. `users.recovery_code_hash` NOT NULL après `recovery_set`
   (parallèle à 3 — toujours stocké en même temps que le wrap blob).
5. **Mode `maximum`** : `users.security_mode = 'maximum'` implique
   `mfa_totp.enabled_at IS NOT NULL` **ET** au moins une ligne
   `auth_factors WHERE kind = 'passkey' AND prf_supported = true`.
   Enforcé côté serveur par §6.1 (activation + downgrade auto).
6. Une seule `mfa_bypass_requests` non-cancelled-non-consumed par
   user (unique index conditionnel ci-dessus).
7. `auth_factors.wrapped_kek IS NULL` ⟺ `prf_supported = false`.
8. `mfa_totp.enabled_at IS NULL` = enrollment en cours, pas encore
   utilisable au login.
9. `email_verifications.attempts <= 5`. Au-delà, la ligne est
   purgée par un job + nouvelle demande forcée.

### 4.3 Données purgées au reset destructif

(Cf. §7.9 — récap pour la migration Drizzle.)

**Note importante** : les tables d'entrées modules ne portent
pas de `user_id` — le serveur ne peut donc pas les identifier ni
les purger au reset. Les rows orphelines restent (clé maîtresse
perdue, illisibles). Le reset purge seulement les tables
1:1-FK-cascade-able sur l'user.

```sql
-- Tables modules : pas de purge possible (pas de user_id colonne).
-- Les rows survivent, illisibles, jusqu'à un éventuel cleanup
-- ops manuel.

DELETE FROM modules_config WHERE user_id = $1;
DELETE FROM user_preferences WHERE user_id = $1;
DELETE FROM auth_factors WHERE user_id = $1;
DELETE FROM mfa_totp WHERE user_id = $1;
DELETE FROM mfa_totp_recovery_codes WHERE user_id = $1;
DELETE FROM mfa_bypass_requests WHERE user_id = $1;
DELETE FROM email_verifications WHERE user_id = $1;
DELETE FROM sessions WHERE user_id = $1;
DELETE FROM opaque_records WHERE user_id = $1;
UPDATE users SET
  wrapped_main_key = NULL, wrapped_main_key_iv = NULL,
  wrapped_kek_password = NULL, wrapped_kek_password_iv = NULL,
  wrapped_kek_recovery = NULL, wrapped_kek_recovery_iv = NULL,
  recovery_code_hash = NULL,
  recovery_acknowledged_at = NULL,
  security_mode = 'password_or_passkey',
  register_state = 'email_verified',  -- on conserve email vérifié
  onboarding_status = 'pending'
WHERE id = $1;
```

Toute la séquence dans **une transaction**.

---

## 5. Cookies & sessions

### 5.1 Cookies

| Cookie | Durée | Routes acceptées (middleware) | Émis quand | Promu en quoi |
|---|---|---|---|---|
| `__Host-nodea_register` ✅ | 24h | `/auth/register/*` | Après vérif email réussie (étape 2 du wizard) | Effacé à la fin du register |
| `__Host-nodea_mfa` ✅ | 5 min | `/auth/mfa/*` | Après OPAQUE/passkey login finish | `__Host-nodea_session` quand MFA complète |
| `__Host-nodea_migrate` (vestigial) | 30 min | `/auth/migrate/*` | Plus émis — aucun code path n'en mint depuis l'élimination du modèle Argon2id | `__Host-nodea_session` après migration crypto |
| `nodea_session` ✅ | 7 jours (fixe, **pas** de slide) | tout le reste | Login complet | Re-login forcé après 7j ou révocation |

Tous les cookies :
- `HttpOnly`
- `Secure` en prod (et tous les environnements non-localhost)
- `SameSite=Lax`
- Signés (`COOKIE_SECRET`, min 32 chars)
- Préfixe `__Host-` (verrouille au domaine, **impose** `Path=/` côté
  navigateur, et requiert `Secure`).

**Note importante sur le scoping** : le préfixe `__Host-` impose
`Path=/`, donc tous les cookies voyagent avec **toutes** les
requêtes vers le domaine. La colonne "Routes acceptées" du tableau
ci-dessus n'est **pas** un attribut du cookie : c'est ce que le
middleware `loadSession` vérifie. Les middlewares `requireUser`,
`requireRegisterSession`, `requireMfaPending`, `requireMigrate` ne
lisent **que** leur cookie attendu et refusent les autres. Si
plusieurs cookies sont présents, chacun est valide uniquement sur
son set de routes.

Ce choix sacrifie un peu de "least-privilege" côté navigateur en
faveur de la propriété anti-subdomain de `__Host-` (pas de cookie
pollué par un sous-domaine compromis). Compromis assumé.

### 5.2 Modèle de session unifié

Les quatre types vivent dans `sessions` avec colonne `kind`. Le
middleware `loadSession` :

1. Lit le cookie correspondant à la route :
   - `/auth/register/*` → `__Host-nodea_register` → `kind = 'register'`
   - `/auth/mfa/*` → `__Host-nodea_mfa` → `kind = 'mfa_pending'`
   - `/auth/migrate/*` → `__Host-nodea_migrate` → `kind = 'migrate'`
   - sinon → `__Host-nodea_session` → `kind = 'full'`
2. Charge la ligne, vérifie `kind` correct + `expires_at > now()`.
3. Refuse silencieusement (cookie ignoré) si le `kind` ne matche pas
   la route.
4. Met à jour `last_seen_at` (atomique, debounced à 1 min pour ne
   pas spammer la DB).

### 5.3 Re-auth fresh

Middlewares + endpoints `/auth/reauth/*` ; timestamps stampés sur
tous les chemins d'auth ; matrice câblée sur toutes les routes
mutantes (security-mode, totp, passkey, recovery-code,
change-password, change-email, delete-self). Le front utilise
`freshenPasswordReauth` (pas de `proofLoginToken` embarqué dans
les bodies).

La matrice (§6) demande "re-auth fraîche < 5 min". Implémentation :

- `requireFreshPassword` middleware : checke
  `session.reauth_password_at >= now() - 5min`. Sinon 401 avec code
  `reauth_required: 'password'`.
- `requireFreshPasswordOrPasskey` : checke l'un OU l'autre.
- Routes de re-auth dédiées :
  - `POST /auth/reauth/password` → OPAQUE login lite, met à jour
    `reauth_password_at` sur la session courante.
  - `POST /auth/reauth/passkey` → WebAuthn assertion, met à jour
    `reauth_passkey_at`.
- Expiration `reauth_*_at` au logout, au change-password, au change
  de mode de sécurité.

### 5.4 Revocation

- **Logout** (`DELETE /auth/sessions/current`) : delete la ligne
  session.
- **Logout all** (`DELETE /auth/sessions/all`) : delete toutes les
  sessions de cet user, incluant la courante.
- **Change password** : *rotation complète d'ID* — delete toutes les
  sessions de cet user (y compris la courante), insert une fresh
  session, émet un nouveau cookie signé. Anti session-fixation.
- **Change mode security** (n'importe lequel) : même rotation que
  change-password (delete toutes, fresh session, nouveau cookie).
- **Bypass MFA appliqué** : delete toutes les sessions sauf la
  courante (qui vient d'être promue depuis mfa_pending). Force
  re-enrollment du facteur bypassé avant nouvelle session ailleurs.
- **Account deletion** : cascade DB (toutes les sessions partent
  avec).

---

## 6. Matrice de re-auth

| Opération | Re-auth fresh (< 5 min) | Notes |
|---|---|---|
| Changer `security_mode` | password | Les autres sessions sont revoked |
| Ajouter une passkey | password | |
| Retirer une passkey | password | |
| Activer TOTP | password | |
| Désactiver TOTP | password | Interdit depuis une session protégée *par* le mode lui-même sans re-auth |
| Régénérer backup codes TOTP | password | |
| Régénérer recovery code KEK | password | Invalide l'ancien `wrapped_kek_recovery` |
| Changer le password | password **OU** passkey | Le password est le seul facteur changeable via un facteur alternatif |
| Changer l'email | password | Déclenche re-register OPAQUE + re-vérification email |
| Supprimer un compte | password **ET** (passkey si activée) **ET** (TOTP si activé) | Confirmation par phrase tapée |
| Reveal recovery code | **N/A** : non-supporté en V1 | Code généré une seule fois à l'inscription, jamais re-affiché |
| Démarrer un bypass TOTP | password (pas frais — login OPAQUE direct) | C'est l'écran "j'ai perdu mon TOTP" sur le `mfa_pending` |
| Logout courant | aucun | |
| Logout all sessions | password | |
| Voir la liste des sessions | session full | Pas de re-auth |

**Logique sous-jacente** :

> *Toute modification de la policy de sécurité = password (le
> facteur le plus durable et celui que tu n'oublies pas même si tu
> l'utilises peu) ; le password lui-même est le seul truc qui peut
> être changé via un facteur alternatif (parce que c'est ce que tu
> fais quand tu l'as oublié).*

### 6.1 Règles d'activation et downgrade des modes

| Mode | Activation requise | Downgrade auto vers |
|---|---|---|
| `password_or_passkey` | Toujours disponible (défaut) | — |
| `always_totp` | TOTP enabled (`mfa_totp.enabled_at IS NOT NULL`) | `password_or_passkey` si TOTP désactivé ou bypassé |
| `maximum` | TOTP enabled **ET** au moins une passkey PRF-capable enrôlée | `password_or_passkey` si TOTP désactivé/bypassé OU dernière passkey retirée/bypassée |

**Côté serveur**, `POST /auth/security-mode/change` valide
l'éligibilité avant d'accepter le passage. Mode demandé sans les
facteurs requis → 400 avec message clair :
- `400 totp_required` : "Active TOTP avant de choisir mode max."
- `400 passkey_required` : "Enrôle au moins une passkey avant de
  choisir mode max."

**Le downgrade est appliqué dans la même transaction** que la
suppression du facteur (TOTP disable, last passkey removed/bypassed).
Email de notification systématique : "Ton mode de sécurité a été
abaissé à <mode> parce que <raison>."

### 6.2 Récupération en cas de perte d'un facteur

Politique : **un facteur perdu = récupérable, deux facteurs perdus
simultanément = reset destructif (perte de données)**.

| Facteur perdu | Chemin de récupération | Conditions |
|---|---|---|
| Password | Recovery code KEK (cf. §7.7) | Il faut connaître le recovery code |
| TOTP | Bypass email 7 jours (cf. §7.8) | Password OK + (passkey OK si mode max) |
| Passkey (la dernière) | Bypass email 7 jours (cf. §7.8) | Password OK + (TOTP OK si mode `always_totp`/`maximum`) |
| Recovery code | Régénérer depuis Settings (re-auth password) | Compte encore accessible |
| 2 facteurs simultanés (passkey + TOTP, password + passkey, etc.) | **Reset destructif uniquement** (cf. §7.9) | Données perdues, l'user est prévenu·e |

**Enforcement** : §7.8 refuse de démarrer un bypass si le facteur
**autre** requis par le mode courant n'est pas vérifiable. C'est ce
qui rend "perdu 2 = niqué" par construction.

---

## 7. Flows complets

Le détail de chaque flow vit dans son propre fichier sous
[`docs/auth/`](./auth/) — découpage par flow plutôt qu'un mur
monolithique de 880 lignes. Chaque fichier reprend les sub-flows
et leurs édges cases ; ce qui suit n'est qu'un index.

| Flow | Fichier |
|---|---|
| 7.1 Register — single-form + activation magic link | [`auth/Register.md`](./auth/Register.md) |
| 7.2 Login password-first | [`auth/Login.md`](./auth/Login.md) |
| 7.3 Login passkey-first | [`auth/Login.md`](./auth/Login.md) |
| 7.4 Stepped MFA — finalisation | [`auth/Login.md`](./auth/Login.md) |
| 7.5 Change password | [`auth/ChangePassword.md`](./auth/ChangePassword.md) |
| 7.6 Change email (design partiel) | [`auth/ChangeEmail.md`](./auth/ChangeEmail.md) |
| 7.7 Recovery via KEK code | [`auth/Recovery.md`](./auth/Recovery.md) |
| 7.8 Bypass d'un facteur MFA par email | [`auth/BypassMfa.md`](./auth/BypassMfa.md) |
| 7.9 Reset destructif | [`auth/Lifecycle.md`](./auth/Lifecycle.md) |
| 7.10 Logout | [`auth/Lifecycle.md`](./auth/Lifecycle.md) |
| 7.11 Suppression de compte | [`auth/Lifecycle.md`](./auth/Lifecycle.md) |

Les sections suivantes (§8 TOTP, §9 Passkey, §10 Service email,
etc.) couvrent les composants qui sont consommés par plusieurs
flows et restent dans ce fichier.

---

## 8. TOTP — détails

> Code : routes `packages/api/src/routes/auth-totp.ts` (enroll /
> disable / regenerate) + `packages/api/src/routes/auth-mfa.ts`
> (verify-step + passkey-as-second-factor) +
> `packages/api/src/routes/auth-security-mode.ts` (mode change).
> Page Settings dédiée `/totp` (QR + clé masquée + œil/copier +
> verify inline) et page `/login/mfa` (stepped MFA avec TOTP puis
> passkey). Le sidebar tip ambre dismissable invite à activer TOTP
> tant que `totpEnabled === false`. Backup codes : 10 × 120 bits /
> 24 base32 chars, single-use enforced par `UPDATE … WHERE used_at
> IS NULL`.

### 8.1 Paramètres figés

| Param | Valeur | Justification |
|---|---|---|
| Algo | SHA1 | RFC 6238, compat universelle (Authy, Google Auth, etc.) |
| Digits | 6 | Standard |
| Period | 30s | Standard |
| Secret | 20 bytes random | RFC recommande min 20 bytes |
| Skew accepté | ±1 fenêtre (30s avant/après) | Suffit pour les horloges typiques |
| Anti-replay | `last_window` | Refuse `window <= last_window` |
| Backup codes | 10, 130 bits, base32 (26 chars), SHA-256 hashés | Single-use |

### 8.2 Enrollment

`POST /auth/totp/enroll/start`

Préconditions : `requireFreshPassword` (depuis Settings) **OU**
session register avec `register_state = 'recovery_set'` (étape 5
du parcours d'inscription, cf. §7.1).

Server :
1. Génère secret 20 bytes random.
2. INSERT `mfa_totp { user_id, secret, enabled_at: NULL }` (ou
   UPDATE si existe en pending).
3. Génère 10 backup codes (130 bits chacun), hash SHA-256, INSERT
   `mfa_totp_recovery_codes`.
4. Réponse :
   ```json
   {
     "secret_base32": "JBSWY3DPEHPK3PXP",
     "otpauth_uri": "otpauth://totp/Nodea?secret=...&algorithm=SHA1&digits=6&period=30",
     "backup_codes": ["xxxx-xxxx-xx", ...]
   }
   ```

   `otpauth` label = `Nodea` (sans email ni user_id — minimaliste,
   évite toute fuite par screenshots des apps authenticator).
   Conséquence assumée : si l'user a plusieurs comptes Nodea dans
   le même authenticator, les entrées ne sont pas distinguées par
   le label.

`POST /auth/totp/enroll/verify`

Body : `{ code: "123456", backup_codes_acknowledged: true }`.

Server :
1. Vérifie le code TOTP avec le secret pending.
2. Refuse si `backup_codes_acknowledged !== true`.
3. UPDATE `mfa_totp.enabled_at = now()`,
   `mfa_totp.last_window = current_window`.
4. Réponse `200 { enabled_at }`.

### 8.3 Vérification

`POST /auth/mfa/totp/verify`

Body : `{ code: "123456" }`.

Server :
1. Charge `mfa_totp` (refuse si `enabled_at IS NULL`).
2. Calcule TOTP pour windows `[current-1, current, current+1]`.
3. Compare en temps constant.
4. Si match :
   - `last_window = matched_window` (anti-replay).
   - `mfaTotpVerified = true` sur la session pending.
5. Sinon : essaie les backup codes.

`POST /auth/mfa/totp/verify-backup`

Body : `{ code: "xxxx-xxxx-xx" }` (l'utilisateur·ice peut entrer un
backup code dans le même champ — UI distingue par format).

Server :
1. Hash SHA-256.
2. SELECT FROM `mfa_totp_recovery_codes WHERE user_id = $1 AND
   code_hash = $2 AND used_at IS NULL`.
3. Si trouvé : `used_at = now()` (single-use).
4. `mfaTotpVerified = true`.
5. Si tous les backup codes usés : email "Tu as utilisé ton dernier
   backup code. Régénère-en de nouveaux dans Settings."

### 8.4 Désactivation

`POST /auth/totp/disable` : `requireFreshPassword`.

Server : `enabled_at = NULL`, DELETE backup codes. Si
`security_mode in ('always_totp', 'maximum')` → bascule mode à
`password_or_passkey` automatiquement (et email de notification).

### 8.5 Régénération backup codes

`POST /auth/totp/backup-codes/regenerate` :
`requireFreshPassword`.

Server : DELETE anciens, INSERT 10 nouveaux. Réponse avec les codes
en clair (affichés une seule fois).

---

## 9. Passkey — détails

> Code : routes `packages/api/src/routes/auth-passkey.ts`,
> orchestrateur client `packages/web/src/core/auth/passkey-flow.ts`,
> page Settings dédiée `/passkeys` (et SecuritySection « Passkey »
> dans Account → Sécurité). Sidebar tip ambre dismissable invite à
> enroller quand `passkeysCount === 0` (cohérent avec la décision :
> pas de passkey au register, opt-in post-activation).
>
> **Limitation connue** : les authenticators qui ne surfacent pas
> `prf.results.first` au registration sont enrôlés en login-only ;
> le chemin "promote-to-PRF" via une assertion de calibration
> arrivera dans une itération ultérieure.

### 9.1 Choix structurels

- `userVerification: 'required'` (cf. §2.3). Toute tentative
  d'enrollment ou d'auth sans gesture est refusée par le navigateur
  ou par le serveur en validation finale.
- `attestation: 'none'` — on ne demande pas d'attestation
  matériel·le. Pas de tracking de vendeur.
- `authenticatorSelection.residentKey: 'preferred'` — autorise
  les discoverable credentials (login sans email).
- `pubKeyCredParams: [{type: 'public-key', alg: -7}, // ES256
  {type: 'public-key', alg: -257}]` // RS256.
- Extension PRF activée : `extensions: { prf: { eval: { first:
  PRF_INPUT_FIXED } } }`.

### 9.2 Enrollment

`POST /auth/passkeys/enroll/start`

Préconditions : `requireFreshPassword` (ou parcours register
étape 6).

Server :
1. Génère challenge 32 bytes random.
2. Stocke sur la session courante : `pending_webauthn_challenge` +
   `pending_webauthn_challenge_at = now()`. TTL 5 min validé au
   moment de `/finish` (refus si `now() - challenge_at > 5min`).
   Pas de Redis en V1.
3. Renvoie options WebAuthn `PublicKeyCredentialCreationOptions`.

Client :
1. `navigator.credentials.create(options)`.
2. Récupère `prf_output` si supporté
   (`getClientExtensionResults().prf.results.first`).
3. Si PRF supporté : dérive `wk_passkey = HKDF(prf_output,
   "nodea:wrap-kek")`, wrappe la KEK existante (que le client a en
   mémoire après login récent ou register en cours) :
   `wrapped_kek = AES-GCM(wk_passkey, kek,
   AAD=users.id||"passkey"||credential_id)`.
4. POST `/auth/passkeys/enroll/finish` avec :
   - WebAuthn attestation response
   - `prf_supported: bool`
   - `wrapped_kek` + IV (si PRF)
   - `label: string` (user-facing)

Server :
1. Vérifie l'attestation (challenge match, signature OK).
2. INSERT `auth_factors { kind: 'passkey', credential_id,
   public_key, sign_count, transports, prf_supported,
   wrapped_kek?, wrapped_kek_iv?, label }`.
3. Si `prf_supported = false` et c'est la **seule** passkey
   configurée → afficher un avertissement clair côté UI :
   "Cette passkey ne peut pas, seule, déchiffrer tes données. Tu
   auras toujours besoin de ton mot de passe ou d'une autre
   passkey PRF-capable. Continuer ?".

### 9.3 UV `'required'` — passkeys sans gesture refusées

Une passkey n'est utile que si un gesture (PIN, biométrie, unlock du
gestionnaire) prouve la présence de l'utilisateur·ice **en plus** de
la possession du device. Sans ça, le simple vol matériel suffit à
déverrouiller le compte et déchiffrer la KEK — angle qui invalide
tout le reste du modèle.

**Décision V1** : `userVerification: 'required'` pour
l'enrollment **et** pour l'authentication. Le serveur valide
`authData.flags.uv === true` à chaque assertion. Refus 400 sinon.

À l'enrollment, le navigateur lui-même refuse les authenticators qui
ne supportent pas UV (ou qui ne l'ont pas configuré — pour une
Yubikey, il propose le setup PIN). Côté UI, on affiche en clair :

> **Une passkey doit pouvoir te demander un PIN, une empreinte ou
> ton FaceID.** Si tu utilises une clé hardware (Yubikey, etc.)
> sans PIN configuré, configure le PIN avant de continuer.

Authenticators acceptés :
- Bitwarden, 1Password, iCloud Keychain, Google Password Manager
  (UV = unlock du gestionnaire) ;
- TouchID, FaceID, Windows Hello, Android biometric ;
- Yubikey / Solokey / Titan **avec PIN configuré**.

Authenticators refusés :
- Yubikey en mode tactile pur (sans PIN) ;
- Tout authenticator sans gesture.

### 9.4 Login & PRF

Cf. §7.3.

**Cas non-PRF** :
- L'authenticator ne supporte pas l'extension PRF.
- L'enrollment a stocké `prf_supported = false`, `wrapped_kek =
  NULL`.
- Au login, signature OK = `mfa_passkey_verified = true`. Mais le
  client ne peut pas dériver la KEK depuis cette passkey.
- Conséquence : il faut **soit** le password OPAQUE en plus
  (login enchaîné password après passkey), **soit** une autre
  passkey PRF.
- L'UI doit guider clairement : "Cette passkey valide ton identité
  mais ne peut pas seule déchiffrer tes données. Saisis ton mot de
  passe pour continuer."

### 9.5 PRF input fixe

```ts
const PRF_INPUT_V1 = new Uint8Array([
  0x6e, 0x6f, 0x64, 0x65, 0x61, 0x3a, 0x70, 0x72, 0x66, 0x2d, 0x76, 0x31,
  // padding zero jusqu'à 32 bytes
  ...new Uint8Array(20)
]);
// "nodea:prf-v1" + zero-padding
```

Versionné (`v1`) au cas où on veuille pivoter dans le futur. Toute
rotation = re-wrap des KEKs sous les nouvelles PRF outputs.

### 9.6 Signature counter

WebAuthn fournit un `signCount`. Si une assertion arrive avec
`signCount <= stored_signCount` **et** `auth_factors.sign_count_strict
= true`, c'est suspect (clone de credential). Action : refuser le
login + email d'alerte.

Exception : certains authenticators (notamment Apple) ne maintiennent
pas le compteur — `signCount` reste à 0. Heuristique : sur 3
assertions consécutives valides avec `signCount = 0`, le serveur
flip `auth_factors.sign_count_strict = false` pour cette credential
spécifique. À partir de ce moment, le check signCount est désactivé
**uniquement** pour ce credential.

La colonne `signCountStrict` (cf. §4.1) est `true` par défaut à
l'enrollment et ne se rallume jamais (un credential qui passe en
`false` y reste).

### 9.7 Add/remove

`GET /auth/passkeys/list` : liste des credentials avec `label`,
`created_at`, `last_used_at`, `prf_supported`, `transports`.

L'UI Settings doit **distinguer visuellement** les passkeys
PRF-capable (badge "déchiffre tes données") des login-only
(badge "connexion uniquement, ne déchiffre pas tes données"). Cette
distinction est cruciale pour que l'user comprenne pourquoi le mode
`maximum` peut être indisponible : il exige au moins une passkey
PRF-capable. La liste affiche aussi le compteur "X passkey(s)
PRF-capable enrôlée(s)" en en-tête.

`POST /auth/passkeys/:id/remove` : `requireFreshPassword`. DELETE
ligne dans une transaction qui inclut le downgrade auto :

- Si `count(auth_factors WHERE kind='passkey' AND prf_supported=true)
  == 1` (cette suppression retire la dernière passkey PRF-capable)
  **et** `users.security_mode = 'maximum'` → bascule
  `users.security_mode = 'password_or_passkey'` dans la même
  transaction.
- Email de notification : "Ton mode de sécurité est passé à
  `password_or_passkey` parce que tu as retiré ta dernière passkey
  PRF-capable."

V1 = downgrade auto, **jamais de refus 400**. L'utilisateur·ice
garde toujours la main sur la suppression de ses passkeys ; le mode
de sécurité s'adapte automatiquement.

---

## 10. Service email

### 10.1 Interface

```ts
// packages/api/src/services/email.ts

export interface EmailService {
  send(params: {
    to: string;
    subject: string;
    text: string;       // version texte obligatoire
    html?: string;      // version HTML facultative
    tag?: string;       // pour les logs : 'verify-register', 'totp-bypass-confirm', etc.
  }): Promise<void>;
}
```

### 10.2 Implémentations

| Env | Impl | Comportement |
|---|---|---|
| `dev` (recommandé) | `SmtpEmailService` pointant **Mailpit** | Vrai transport SMTP vers le conteneur `mailpit` du compose-profile `dev`. Les emails sont visibles dans l'UI web `http://localhost:8025`, rien ne quitte la machine. Permet de tester le **path SMTP réel** (templates rendus, encoding, multipart) plutôt qu'un log. |
| `dev` (fallback) | `ConsoleEmailService` | Log JSON sur stdout. Utile quand on lance `pnpm dev` en bare metal sans Docker (donc sans Mailpit). À éviter sinon. |
| `test` | `RecordingEmailService` | Stocke en mémoire, exposé via fixtures Vitest. |
| `prod` | `SmtpEmailService` | nodemailer + SMTP Infomaniak. Credentials via `SMTP_*` env vars (sourcées depuis Infisical au déploiement). Cf. §13.1. |

L'impl est sélectionnée par `EMAIL_SERVICE_IMPL` (`smtp` / `console` /
`recording`). Pour dev, le défaut est **`smtp`** combiné avec
`SMTP_HOST=mailpit` (dans Docker) ou `SMTP_HOST=127.0.0.1` +
`SMTP_PORT=1025` (depuis l'host).

### 10.3 Templates

Tous en français + UTF-8. Stockés dans
`packages/api/src/services/email/templates/`.

| Template | Usage |
|---|---|
| `verify-register.txt` | Code d'activation à l'inscription |
| `verify-email-change.txt` | Code de vérification au changement d'email |
| `totp-bypass-confirm.txt` | Liens confirm + cancel pour bypass TOTP |
| `totp-bypass-applied.txt` | Notification post-bypass |
| `password-reset.txt` | Token de reset destructif (existant) |
| `passkey-clone-detected.txt` | Alerte signCount |
| `last-backup-code-used.txt` | Notification backup codes |

### 10.4 Anti-spam / rate-limit

Per-email rate-limits (par défaut, ajustables via env) :
- `verify-register` : 3 / heure
- `verify-email-change` : 3 / heure
- `totp-bypass-confirm` : 1 / heure
- `password-reset` : 3 / heure

---

## 11. Middlewares serveur

### 11.1 Liste

| Nom | Vérifie | Sortie en cas d'échec |
|---|---|---|
| `loadSession` | Cookie + ligne sessions | 401 |
| `requireUser` | `loadSession` + `kind = 'full'` | 401 |
| `requireRegisterSession` | `kind = 'register'` | 401 |
| `requireMfaPending` | `kind = 'mfa_pending'` | 401 |
| `requireMigrate` | `kind = 'migrate'` | 401 |
| `requireFreshPassword` | `reauth_password_at > now-5min` | 401 `{ reauth_required: 'password' }` |
| `requireFreshPasswordOrPasskey` | l'un OU l'autre | 401 `{ reauth_required: 'password_or_passkey' }` |
| `requireAdmin` | `requireUser` + `users.is_admin` | 403 |
| `rateLimit(opts)` | Rate-limit par IP/email | 429 |

### 11.2 Composition

Chaque route déclare ses prérequis :

```ts
// packages/api/src/routes/auth.ts
const route = createRoute({
  method: 'post',
  path: '/auth/totp/enroll/start',
  middleware: [requireUser, requireFreshPassword],
  // ...
});
```

### 11.3 Reauth fresh — UX

Quand un middleware refuse pour cause de re-auth manquante, le
front intercepte le `reauth_required` et affiche un modal :
- `password` → champ password unique → POST `/auth/reauth/password`.
- `password_or_passkey` → boutons "Re-auth password" /
  "Re-auth passkey".

Après succès, retry automatique de la requête originale.

---

## 13. Algorithmes & paramètres figés

(Tableau récapitulatif. Tout changement d'un de ces paramètres
demande une PR dédiée + révision de cette section + plan de
rotation.)

| Domaine | Paramètre | Valeur |
|---|---|---|
| OPAQUE | librairie | `@serenity-kit/opaque` (Rust + WASM, audit Cure53) |
| OPAQUE | suite | OPAQUE-3DH-RISTRETTO255-SHA512-Argon2id (par défaut de la lib) |
| OPAQUE | Argon2 m | 64 MiB |
| OPAQUE | Argon2 t | 3 |
| OPAQUE | Argon2 p | 4 |
| HKDF | hash | SHA-256 |
| HKDF labels | `nodea:wrap-kek` | dériver wrapping key depuis facteur |
| HKDF labels | `nodea:wrap-main` | dériver wrapping key main key depuis KEK |
| HKDF labels | `nodea:aes` | sub-key AES module (existant) |
| HKDF labels | `nodea:hmac` | sub-key HMAC guards (existant) |
| AES-GCM | key size | 256 bits |
| AES-GCM | IV size | 96 bits, random/encryption |
| AES-GCM | tag size | 128 bits |
| HMAC | hash | SHA-256 |
| TOTP | algo | SHA1 |
| TOTP | digits | 6 |
| TOTP | period | 30 s |
| TOTP | secret size | 20 bytes |
| TOTP | skew | ±1 fenêtre |
| Recovery code KEK | entropie | 128 bits (12 mots BIP39 = 132 bits dont 4 de checksum) |
| Recovery code KEK | encoding | BIP39 12 mots (wordlist anglaise standard) |
| Backup codes TOTP | nombre | 10 |
| Backup codes TOTP | entropie | 130 bits chacun |
| Backup codes TOTP | hash storage | SHA-256 |
| WebAuthn | UV | `'required'` (enrollment + assertion) |
| WebAuthn | rpId | depuis env `WEBAUTHN_RP_ID`, défaut prod `nodea.app` |
| WebAuthn | attestation | `'none'` |
| WebAuthn | algos | ES256 (-7), RS256 (-257) |
| WebAuthn | PRF input v1 | `"nodea:prf-v1"` + zero-padding 32 bytes |
| Cookie | session full TTL | 7 jours fixe (pas de slide) |
| Cookie | rate-limit storage | in-process RAM (V1 single-instance) |
| Cookie | mfa_pending TTL | 5 min |
| Cookie | register TTL | 24 h |
| Cookie | reauth fresh window | 5 min |
| Email verification code | digits | 6 |
| Email verification code | TTL | 10 min |
| Email verification code | max attempts | 5 |
| Bypass TOTP | delay réel | 7 j après confirmation |
| Bypass TOTP | request TTL | 7j |
| Password policy | zxcvbn min score | 3 |
| Password policy | min length | 8 |
| Rate limits | `/auth/register/*` | 5/h IP, 3/h email |
| Rate limits | `/auth/login/*` | 10/min IP, 20/h email |
| Rate limits | `/auth/migrate/*` | 10/min IP, 20/h email (aligné login) |
| Rate limits | `/auth/recover-kek/*` | 5/h IP, 3/h email (130 bits BIP39 protège déjà du brute-force) |
| Rate limits | `/auth/mfa/*` | 5/min session |
| Cooldown | change-email (entre deux changes) | 7 jours |

### 13.1 Variables d'environnement

Tous les secrets et paramètres d'infra spécifiques au déploiement
passent par des variables d'environnement (ou Infisical). **Aucune**
de ces valeurs n'est hardcodée dans le code applicatif.

| Variable | Usage | Exemple / défaut |
|---|---|---|
| `WEBAUTHN_RP_ID` | rpId WebAuthn (origin lié aux passkeys) | `nodea.app` |
| `WEBAUTHN_RP_NAME` | Nom user-facing de la RP | `Nodea` |
| `WEBAUTHN_ORIGIN` | Origin attendue dans les assertions | `https://nodea.app` |
| `OPAQUE_SERVER_SETUP` | Server static setup (sortie de `server.setupServer()` de la lib) | base64 |
| `COOKIE_SECRET` | Signature des cookies, ≥ 32 chars | random base64 |
| `SMTP_HOST` | Serveur SMTP (Infomaniak) | `mail.infomaniak.com` |
| `SMTP_PORT` | Port SMTP | `587` |
| `SMTP_USER` | Identifiant SMTP | depuis Infisical |
| `SMTP_PASS` | Password SMTP | depuis Infisical |
| `SMTP_FROM` | Adresse expéditrice | `noreply@nodea.app` |
| `SMTP_FROM_NAME` | Nom expéditeur | `Nodea` |
| `EMAIL_SERVICE_IMPL` | Choix d'impl : `console` / `recording` / `smtp` | `console` en dev, `smtp` en prod |
| `DATABASE_URL` | Postgres | `postgres://...` |
| `RATE_LIMIT_DRIVER` | `memory` (V1) / `redis` (futur) | `memory` |
| `HSTS_ENABLED` | Active `Strict-Transport-Security` header | `true` en prod |
| `HSTS_MAX_AGE` | `max-age` du header HSTS, en secondes | `31536000` (1 an) |
| `HSTS_INCLUDE_SUBDOMAINS` | Inclut les sous-domaines | `true` |
| `HSTS_PRELOAD` | Eligible HSTS preload list | `false` (V1, à activer après stabilisation domaine) |

**Règle** : toute nouvelle config d'infra ajoute une ligne ici **et**
une entrée dans `.env.example` (sans valeur sensible).

**Source des secrets en prod** : Infisical → `.env` au déploiement.
Le repo ne contient jamais de credentials, ni de fichier `.env`
committé.

### 13.2 Tâches d'arrière-plan (cleanup)

#### ✅ V1 livré

Un seul job : `cleanup-unactivated-accounts`, schedulé via
`node-cron` à **03:00 chaque lundi (UTC, container TZ)**, en
process API. Cf. `packages/api/src/cron/index.ts` —
`startCronScheduler()` est appelé depuis `index.ts` au démarrage.

| Cible | Condition de purge | Pourquoi |
|---|---|---|
| `email_verifications` `kind='register'` | `expires_at < now()` | Tokens d'activation périmés, libère la table |
| `users` `email_verified_at IS NULL` | aucune `email_verifications` pending restante | Comptes inactifs dont la fenêtre de 7j s'est écoulée. CASCADE supprime sessions / email_verifications consommées au passage |
| `sessions` | `expires_at < now()` | Sessions expirées définitivement |

Le job logge un résumé sur stdout :
```
[cron] cleanup-unactivated done {"verifications":N,"users":N,"sessions":N}
```

En cas d'erreur, le job loggue et passe — la donnée orpheline
coûte moins qu'une suppression buggée. Pas d'endpoint admin de
trigger manuel en V1 (à ajouter quand le besoin se manifeste).

#### 🚧 Phase 2+

Quand TOTP / passkey / bypass MFA arrivent, ajouter dans le même
job :

| Cible | Condition de purge |
|---|---|
| `mfa_bypass_requests` | (`cancelled_at`, `consumed_at`, ou `expires_at`) `< now() - 30j` (audit window) |
| Email verifications avec `attempts >= 5` | tout de suite (force re-demande) |
| `email_verifications` `kind='email_change'` consommés ou expirés | `> 7j` |

---

## 14. Anti-patterns interdits

> Cette liste complète la « Checklist crypto pour les devs » de
> [`tech.md`](../packages/web/src/app/pages/docs/content/tech.md)
> avec les règles **auth-spécifiques** (sessions, MFA, backup codes,
> AAD, redaction des logs auth). Les règles génériques (HKDF, no-key-
> material-at-rest, no-leak-of-guard) vivent dans tech.md ; les
> deux listes ne se contredisent jamais.

À recopier dans les checks PR ou les linters custom :

1. **Ne JAMAIS** logger un `export_key`, `prf_output`, `recovery_code`,
   `kek`, `main_key`, `wrapped_*`, **secret TOTP**. Même en dev.
   Même en debug. Même au niveau `trace` du logger.
2. **Ne JAMAIS** stocker un facteur ou la KEK en localStorage,
   sessionStorage, IndexedDB, ou window.*.
3. **Ne JAMAIS** faire repasser la KEK ou la main key par le réseau
   (c'est le sens de l'E2E).
4. **Ne JAMAIS** importer le même raw byte sous deux primitives
   différentes (HKDF avant import obligatoire, labels distincts).
5. **Ne JAMAIS** oublier l'AAD dans un `AES-GCM(...)`. Vide ≠
   absence — le code doit refuser de chiffrer/déchiffrer sans AAD
   explicite (pas d'overload qui omette ce paramètre).
6. **Ne JAMAIS** wrapper le secret TOTP. Il doit être en clair côté
   serveur.
7. **Ne JAMAIS** exposer un endpoint qui révèle :
   - Le `recovery code` (jamais re-affichable).
   - Le secret TOTP (récupération = nouveau enrollment).
   - Les backup codes en clair (sauf à la régénération).
   - Le `wrapped_kek_*` ou `encrypted_key` d'un autre user.
8. **Ne JAMAIS** utiliser `users.email` comme PK. PK = `users.id`
   UUID, immuable.
9. **Ne JAMAIS** désactiver une 2FA depuis une session protégée par
   ce facteur sans re-auth password fresh. La matrice est
   inviolable.
10. **Ne JAMAIS** émettre une session full sans avoir fait passer
    par `mfa_pending` quand `security_mode != password_or_passkey`.
11. **Ne JAMAIS** valider un code TOTP sans bumper `last_window`.
12. **Ne JAMAIS** valider un backup code sans le marquer `used_at`.
13. **Ne JAMAIS** utiliser `==`/`!=` sur des hashes ou tokens.
    Toujours comparaison à temps constant
    (`crypto.timingSafeEqual`).
14. **Ne JAMAIS** construire une string SQL par concaténation. Toujours
    Drizzle `eq()` etc.
15. **Ne JAMAIS** retourner `guard`, `wrapped_*`, `secret` (TOTP),
    `code_hash` (backup) dans une réponse API.
16. **Ne JAMAIS** committer un `if (env.NODE_ENV === 'development')
    console.log(secret)` "temporaire". Aucun.
17. **Ne JAMAIS** ajouter un `catch (e) {}` muet dans une fonction
    crypto. Si l'échec est attendu, commenter la raison
    (ex : `// stale blob on logout`).
18. **Ne JAMAIS** logger le body **ou la réponse** d'une route
    `/auth/*` mutante. Le logger doit appliquer **deux** couches :

    **Couche A — blacklist par route (path patterns)** :
    `["/auth/register/*", "/auth/login/*", "/auth/passkeys/*",
      "/auth/totp/*", "/auth/mfa/*", "/auth/migrate/*",
      "/auth/recover-kek/*", "/auth/change-password",
      "/auth/change-email/*", "/auth/security/*",
      "/auth/me/crypto"]`.
    Seules les routes `/auth/sessions` (lecture liste) et
    `/auth/me` (profil sans crypto, API-14 split) peuvent
    logger leur body. `/auth/me/crypto` reste blacklisté —
    c'est la route qui transporte les wrap blobs.

    **Couche B — redaction field-level (defense-in-depth)** : sur
    **toute** la sortie du logger, redact les clés JSON suivantes :
    `["password", "current_password", "new_password",
      "code", "token", "secret", "envelope", "export_key",
      "prf_output", "wrapped_*", "recovery_*", "challenge",
      "signature", "credential_id", "code_hash", "*_hash"]`,
    avec un censeur du type `[REDACTED]`. Cette deuxième couche
    protège même si une route oublie sa blacklist Couche A, ou si
    du code applicatif logge des objets sensibles depuis ailleurs.
19. **Ne JAMAIS** construire une AAD AES-GCM autrement que via
    `buildAAD()` de `@nodea/shared/crypto-types`. Le linter / les
    tests doivent fail-loud sur tout autre usage.

---

## 15. Test matrix

Tests obligatoires **avant** le merge de chaque phase. Localisation :

- Vitest unit : `packages/api/test/auth/**` et
  `packages/web/test/auth/**`.
- Vitest integration : `packages/api/test/integration/auth.test.ts`
  (avec `testcontainers` PostgreSQL).
- Playwright : `packages/web/e2e/auth.spec.ts`.

### 15.1 Crypto unit tests

| Test | Scope |
|---|---|
| Round-trip AES-GCM avec AAD | unit |
| HKDF labels distincts produisent des clés différentes | unit |
| `buildAAD([users.id, "password"])` est déterministe | unit |
| `buildAAD([a, b])` ≠ `buildAAD([a+b])` (length-prefix prévient collisions) | unit |
| `buildAAD([])` retourne 0 byte (cas dégénéré) | unit |
| `buildAAD` refuse une part > 65535 bytes (limite u16) | unit |
| Wrap/unwrap KEK sous wk_password (export_key fixe) | unit |
| Wrap/unwrap KEK sous wk_passkey (prf_output fixe) | unit |
| Wrap/unwrap KEK sous wk_recovery (recovery_code fixe) | unit |
| Unwrap KEK avec mauvaise AAD échoue | unit |
| Unwrap KEK avec mauvais wrap blob échoue | unit |
| Recovery proof match attendu | unit |

### 15.2 OPAQUE integration

| Test | Scénario |
|---|---|
| Register OPAQUE → login → unwrap main key → ciphertext existant lisible | integration |
| Wrong password → login fail côté serveur (pas de leak) | integration |
| Stale session après change-password rejetée | integration |
| OPAQUE handles unknown identifier sans timing leak | integration |

### 15.3 Passkey integration

| Test | Scénario |
|---|---|
| Enroll PRF passkey → login passkey-first → unwrap KEK | integration |
| Enroll non-PRF passkey → login passkey-first → fallback password | integration |
| Multiples passkeys, retirer une seule préserve les autres | integration |
| signCount régression → login refusé + email envoyé | integration |
| signCount = 0 sur 3 assertions consécutives → `signCountStrict = false`, login OK | integration |
| Après `signCountStrict = false`, signCount régression accepté | integration |
| Enrollment avec `authData.flags.uv = false` → refus serveur 400 | integration |
| Assertion login avec `authData.flags.uv = false` → refus serveur 400 | integration |
| Activer mode `maximum` sans TOTP enrôlé → 400 `totp_required` | integration |
| Activer mode `maximum` sans passkey enrôlée → 400 `passkey_required` | integration |
| Retirer la dernière passkey en mode `maximum` → mode auto-downgrade vers `password_or_passkey` + email | integration |
| Désactiver TOTP en mode `maximum` → mode auto-downgrade + email | integration |

### 15.4 TOTP integration

| Test | Scénario |
|---|---|
| Enrollment + verify → enabled_at set | integration |
| Replay (même code, même window) rejeté | integration |
| Skew accepté à -30s, +30s ; rejeté à ±60s | integration |
| Backup code single-use | integration |
| Backup code après usage rejeté | integration |
| Last backup code → email envoyé | integration |
| Désactivation depuis session protégée par TOTP sans re-auth → 401 | integration |
| Désactivation après re-auth password OK | integration |

### 15.5 Bypass MFA factor (TOTP / passkey)

| Test | Scénario |
|---|---|
| Request TOTP → email envoyé avec confirm + cancel tokens | integration |
| Request passkey → email envoyé (template différent) | integration |
| Confirm sans 7 jours → bypass refusé | integration |
| Confirm + 7 jours TOTP → bypass appliqué, `mfa_totp.enabled_at = NULL`, backup codes purgés | integration |
| Confirm + 7 jours passkey → toutes les `auth_factors kind='passkey'` deleted | integration |
| Cancel pendant la fenêtre invalide la request | integration |
| Nouvelle request invalide la précédente (toutes factors confondues) | integration |
| Bypass TOTP en mode `maximum` → downgrade auto vers `password_or_passkey` | integration |
| Bypass passkey en mode `maximum` → downgrade auto vers `password_or_passkey` | integration |
| Bypass appliqué → notification email | integration |
| **Multi-factor loss** : mode max, passkey ET TOTP non vérifiés → request bypass `factor=totp` retournée 409 `multi_factor_loss` | integration |
| **Multi-factor loss** : mode max, passkey ET TOTP non vérifiés → request bypass `factor=passkey` retournée 409 | integration |
| Bypass passkey démarré pendant qu'un bypass TOTP est actif → 409 `bypass_already_active` | integration |

### 15.6 Multi-step register

| Test | Scénario |
|---|---|
| Step 1 → email envoyé en dev console | integration |
| Step 2 mauvais code → attempts++ ; 5 attempts → 410 | integration |
| Step 2 OK → cookie register émis | integration |
| Reprise après fermeture navigateur → bonne étape | integration |
| Cookie register expiré → forçage step 1 | integration |
| Step 7 finalize → cookie session full | integration |

### 15.7 Recovery KEK

| Test | Scénario |
|---|---|
| Recovery code valide → unwrap KEK + new password OK + recovery code régénéré | integration |
| Recovery code avec checksum BIP39 invalide → rejet client (pas de hit serveur) | integration |
| `recovery_code_hash` KO côté serveur → 401, **aucune** mutation appliquée | integration |
| `recovery_code_hash` KO loggué comme `auth.recover.hash_mismatch` | integration |
| Régénération en Settings → ancien `wrapped_kek_recovery` + ancien `recovery_code_hash` invalidés simultanément | integration |
| Reset destructif → `wrapped_kek_recovery` + `recovery_code_hash` NULL | integration |
| `recovery_session_id` consommé une seule fois | integration |
| `/start` sur email inconnu → réponse opaque indistinguable d'un email connu (timing) | integration |

### 15.8 Matrice de re-auth

| Test | Scénario |
|---|---|
| Change mode sans re-auth → 401 reauth_required | integration |
| Change mode avec re-auth password fresh → OK | integration |
| Change password avec re-auth passkey → OK | integration |
| Change password sans aucune re-auth → 401 | integration |
| Account deletion : password seul si aucun second facteur | integration |
| Account deletion : password + passkey + TOTP si tous configurés | integration |

### 15.9 End-to-end Playwright

| Scénario | Description |
|---|---|
| `register-happy-path` | Step 1 → ... → step 7 → onboarding |
| `register-resume` | Step 3 → ferme navigateur → revient → reprend step 4 |
| `login-password-first-mode-max` | password → passkey → TOTP → home |
| `login-passkey-first-mode-max` | passkey → password → TOTP → home |
| `bypass-totp-full-flow` | Lost TOTP → email confirm → 7 jours passe → login skip TOTP → re-enrollment |
| `change-password-via-passkey` | login → settings → re-auth passkey → change password OK |
| `migration-legacy-user` | login legacy → migration prompt → set recovery code → home |

### 15.10 Coverage cible

- `packages/api/src/auth/**` : ≥ 90 %
- `packages/web/src/core/crypto/**` : ≥ 95 %
- `packages/shared/src/crypto-types.ts` : ≥ 95 %

---

## 16. Pièges récapitulés

À garder visibles, en haut des PR de chaque phase :

1. **TOTP n'est pas un facteur crypto.** Il ne wrappe rien, il
   n'unlock rien. C'est un ralentisseur de session, pas un gardien
   de KEK. Un opérateur serveur malveillant peut le bypass.
2. **`export_key` est sensible.** Aussi sensible que la KEK
   elle-même. Zero les bytes après usage. Ne jamais persister.
3. **`prf_output` est sensible.** Idem.
4. **`recovery code` n'est jamais stocké en clair côté serveur.**
   Le serveur stocke `wrapped_kek_recovery` (blob non déchiffrable
   sans le code) et `recovery_code_hash = SHA-256(entropie)`
   (uncrackable offline avec 128 bits d'entropie BIP39). Le code lui-même
   n'est jamais persisté.
5. **Le main key bytes ne change pas après l'inscription.**
   Change-password = re-wrap KEK. Add-passkey = ajouter un wrap
   de KEK. Recovery = unwrap puis re-wrap (la main key reste la
   même). Tout ciphertext existant est protégé par cette
   immutabilité.
6. **AAD obligatoire à chaque wrap/unwrap.** Pas de défaut, pas de
   helper qui l'omet.
7. **Mode change requiert re-auth password fresh.** Pas de chemin
   contournant la matrice — même via API admin.
8. **OPAQUE id = email.** Changer l'email = re-register OPAQUE.
   Lourd mais cohérent. L'identifiant interne `users.id` reste
   immuable.
9. **Une seule mfa_bypass_request active à la fois.** Unique index
   conditionnel.
10. **Passkeys sans UV refusées.** UV `'required'` enforced à
    l'enrollment et à chaque assertion. Yubikey sans PIN configuré
    → enrollment refusé.

---

## Annexe A — Glossaire

| Terme | Définition |
|---|---|
| **OPAQUE** | aPAKE (asymmetric Password-Authenticated Key Exchange) qui permet à un client de prouver la connaissance d'un password au serveur sans révéler le password ni un hash crackable, et de dériver un `export_key` partagé. RFC 9497. |
| **export_key** | Clé symétrique 32 bytes dérivée par OPAQUE après authentification réussie. Connue uniquement du client. |
| **WebAuthn** | API web standardisée pour FIDO2. Permet l'auth via passkeys (clés cryptographiques liées à un origin). |
| **PRF** | Pseudo-Random Function. Extension WebAuthn qui permet à l'authenticator de produire une sortie déterministe à partir d'un input fourni par le client. Utilisé ici pour dériver une wrapping key sans envoyer de matériel sensible au serveur. |
| **prf_output** | Sortie de l'extension PRF. 32 bytes typiquement. Connue uniquement du client (jamais transmise au serveur). |
| **TOTP** | Time-based One-Time Password. RFC 6238. |
| **KEK** | Key Encryption Key. Ici, clé aléatoire 32 bytes qui wrappe la main key. Wrappée elle-même par chaque facteur. |
| **Main key** | Clé aléatoire 32 bytes générée à l'inscription. Source de vérité crypto pour les sub-keys AES et HMAC. Ne change jamais. |
| **Sub-keys (aes_main, hmac_main)** | Dérivées par HKDF depuis main_key, importées non-extractables dans WebCrypto. |
| **AAD** | Additional Authenticated Data. Données qui sont authentifiées par AES-GCM mais non chiffrées. Lient un blob à son contexte. |
| **HKDF** | HMAC-based Key Derivation Function. RFC 5869. |
| **Recovery code KEK** | Code haute entropie (~130 bits) généré au moment où l'user configure le code de récupération (étape post-inscription fortement recommandée), affiché une seule fois. Dérive une wrapping key qui wrappe la KEK. |
| **Backup codes TOTP** | 10 codes single-use générés à l'enrollment TOTP, hashés côté serveur, en cas de perte de l'authenticator. |
| **Bypass TOTP** | Mécanisme de récupération en cas de perte du TOTP + backup codes. Email + 7 jours delay. |
| **Stepped MFA** | Login en deux phases : facteur principal (password OPAQUE ou passkey) → cookie pending → facteurs additionnels → cookie full. |

