## Threat model

Cette section liste explicitement contre quoi Nodea protège — et contre quoi non. Tout ce qui suit est testable contre le code et la spec ; les compromis sont assumés en clair plutôt que cachés.

### Adversaires couverts

| Adversaire | Capacité | Garantie | Mécanisme |
|---|---|---|---|
| Opérateur serveur honest-but-curious | Lecture complète DB + logs | Aucun plaintext lisible. KEK et clé maîtresse inaccessibles. | OPAQUE (`export_key` client-only), PRF (`prf_output` client-only), AES-GCM auth-tag, AAD lié à `users.id`. |
| Voleur de DB (dump exfiltré) | Cracking offline sur dump | Pas de hash de password offline-crackable (OPAQUE). | Argon2id m=64 MiB / t=3 / p=4 enveloppé dans OPAQUE. |
| Voleur de session (cookie volé) | Cookie en clair | Lifetime borné, révocation immédiate par DELETE. SameSite=Lax. | Cookies HttpOnly + Signed + Secure prod, table `sessions` server-side. |
| Cross-user blob swap | Bidouille DB pour servir le wrap d'un autre utilisateur | AES-GCM auth-tag fail au déchiffrement. | AAD lie chaque blob à `users.id` + facteur (cf. §Hiérarchie des clés). |
| Brute-force online password | Tentatives répétées sur `/auth/login` | Borné par rate-limit IP + email. | 10/min IP + 20/h email sur les routes login (cf. §Hardening serveur). |
| Phishing passkey | Faux site Nodea avec WebAuthn | Refusé par origin-binding FIDO. | `WEBAUTHN_RP_ID` lié à l'origin déclaré, navigator.credentials refuse les origines tierces. |
| Énumération de comptes | Tester si une adresse existe | Réponses indistinguables sur `/register`, `/login`, `/recover-kek`, `/mfa-bypass`, `/reset`. | Anti-enum systématique : blobs aléatoires pour les emails inconnus, timing constant. |

### Adversaires non couverts

Énoncés en clair pour qu'aucune mise à jour ne prétende les couvrir sans rouvrir la spec.

1. **Serveur compromis avec tampering du bundle JS** — un opérateur malveillant peut servir du JavaScript modifié qui exfiltre le password ou la KEK au moment où le navigateur les manipule. Cette limite est **inhérente à toute application web E2EE** ; on la mitige (SRI, `INTEGRITY.txt`, recommandation auto-hébergement) sans prétendre la neutraliser. Cf. §Intégrité du bundle.
2. **Malware sur la machine de l'utilisateur·ice** — keylogger, extension malveillante avec accès au DOM, autofill compromis. Aucune défense possible depuis le serveur ou le bundle.
3. **Coercition (rubber-hose)** — si l'utilisateur·ice est forcé·e de donner password + passkey + TOTP, on perd. Problème physique, pas crypto.
4. **Side channels fins** — timing attacks sur OPAQUE, fuites par cache, microarchitecture. Hors scope V1.
5. **Perte simultanée** de password + tous les passkeys + recovery code + accès email — reset destructif uniquement, données perdues. L'utilisateur·ice est prévenu·e à chaque étape de l'inscription.
6. **Métadonnées résiduelles minimales** — taille des blobs chiffrés, fréquence de connexion, ordre d'insertion physique au niveau WAL Postgres. Le design « surface lisible minimum » a éliminé les liens directs serveur-side (pas de `user_id` ni de timestamps colonnes sur les entrées) ; ce qui reste tient au stockage relationnel lui-même. Cf. §Modèle de données.

### Compromis assumés

- **TOTP est un gate de session, pas un gate cryptographique.** Le secret TOTP est stocké en clair côté serveur (RFC 6238 le requiert). Un opérateur serveur qui aurait obtenu le password OPAQUE peut techniquement contourner TOTP. La protection TOTP repose sur l'intégrité du serveur ; OPAQUE et PRF restent E2E même serveur compromis.
- **Mode « Maximum » est un gate UX, pas un Shamir 2-of-2.** Refuser le partage de secret évite l'explosion de complexité. Le mode max augmente la résistance au vol d'appareil et à la session volée, pas au serveur compromis.
- **OPAQUE n'est pas anti-phishing.** Un faux site peut capturer le password en lançant un OPAQUE register sur son propre serveur. Les passkeys FIDO **sont** anti-phishing (origin-binding) ; on les encourage sans les rendre obligatoires.

## Primitives cryptographiques

| Usage | Algo | Paramètres exacts | Source |
|---|---|---|---|
| Password proof + key export | OPAQUE-3DH | suite OPAQUE-3DH-RISTRETTO255-SHA512-Argon2id ; Argon2 m=64 MiB, t=3, p=4 | RFC 9497, librairie `@serenity-kit/opaque` 1.1.0 (Rust + WASM, audit Cure53) |
| Passkey | WebAuthn level 2 | `userVerification: 'required'`, attestation `'none'`, extension PRF, algos ES256 (-7) + RS256 (-257) | WebAuthn L2, librairie `@simplewebauthn` 13.3.0 |
| Wrapping key derivation | HKDF-SHA-256 | labels figés ci-dessous | RFC 5869, WebCrypto |
| Symmetric encryption | AES-256-GCM | clé 256 bits, IV 96 bits aléatoire par chiffrement, tag 128 bits | NIST SP 800-38D, WebCrypto |
| Integrity (guards) | HMAC-SHA-256 | sub-key dérivée par HKDF label `nodea:hmac` | RFC 2104, WebCrypto |
| TOTP | HOTP-SHA1 / RFC 6238 | digits=6, period=30 s, secret 20 bytes random, ±1 fenêtre de skew | RFC 6238, librairie `otplib` 13.4.0 |
| Backup codes TOTP | random 130 bits | hash SHA-256 stocké, format `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (base32) | — |
| Recovery code KEK | BIP39 12 mots | 128 bits d'entropie + 4 bits checksum, wordlist anglaise | BIP-0039, librairie `@scure/bip39` 2.2.0 |
| Random | `crypto.getRandomValues` (browser) / `crypto.randomBytes` (node) | jamais `Math.random` | — |

### Pourquoi ces choix

- **OPAQUE plutôt qu'Argon2id direct** — OPAQUE empêche le serveur d'apprendre le password, même momentanément. Un Argon2id classique a le password en clair côté serveur pour la durée du hash. OPAQUE déplace ce risque.
- **PRF plutôt que credentialId-as-key** — PRF dérive un secret par credential, isolé par chaque assertion. Pas de fuite si l'attaquant a la liste des credentials sans avoir l'assertion.
- **BIP39 plutôt qu'un code court** — 12 mots = 128 bits d'entropie, mémorisable, résistant aux fautes de frappe (checksum + wordlist optimisée). Un code court à 6 chiffres nécessiterait un compteur anti-DoS serveur compliqué.
- **AES-GCM plutôt que AES-CBC + HMAC** — auth-tag intégré, AAD support natif, primitive moderne. CBC + HMAC requiert deux clés et un format custom.

## Hiérarchie des clés

Trois étages, deux blobs structurels par utilisateur·ice. Aucune clé n'apparaît jamais en clair côté serveur.

<aside class="docs-diagram-key-hierarchy"></aside>

### Ce qui rotate à quel moment

| Événement | wrap touchés | KEK | main_key |
|---|---|---|---|
| Register | tous (création) | générée | générée |
| Login | aucun | rechargée en mémoire | rechargée en mémoire |
| Change password | `wrapped_kek_password` uniquement | inchangée | inchangée — **aucun ciphertext existant n'est touché** |
| Add passkey PRF | `wrapped_kek_passkey_<credId>` ajouté | inchangée | inchangée |
| Remove passkey PRF | `wrapped_kek_passkey_<credId>` supprimé | inchangée | inchangée |
| Régénération recovery code | `wrapped_kek_recovery` uniquement | inchangée | inchangée |
| Recovery via mnemonic | `wrapped_kek_password` (nouveau pwd) + `wrapped_kek_recovery` (nouveau code) | inchangée | inchangée — **données préservées** |
| Reset destructif | tous (régénérés) + tous les blobs chiffrés purgés | nouvelle | nouvelle — **toutes les données effacées** |

### AAD (Additional Authenticated Data)

Chaque blob AES-GCM est lié à son contexte par une AAD. Un swap de blob entre utilisateurs ou entre facteurs fait échouer l'auth-tag au déchiffrement.

Construction canonique via `buildAAD(parts: Uint8Array[])` (dans `packages/shared/src/crypto-types.ts`) — chaque part préfixée par sa longueur en u16 big-endian, puis concaténation. Format non ambigu même avec parts de longueur variable (notamment `credential_id` WebAuthn, 16 à 1023 bytes).

| Blob | AAD = `buildAAD([...])` |
|---|---|
| `wrapped_main_key` | `[users.id]` (UUID, 16 bytes raw) |
| `wrapped_kek_password` | `[users.id, utf8("password")]` |
| `wrapped_kek_passkey_<credId>` | `[users.id, utf8("passkey"), credential_id]` |
| `wrapped_kek_recovery` | `[users.id, utf8("recovery")]` |

Aucune autre construction n'est autorisée dans le code applicatif — toute exception est un bug à fail-loud.

## Authentification

### OPAQUE en deux étapes

<aside class="docs-diagram-opaque-flow"></aside>

Ce qui transite : le `startLoginRequest` (un point sur la courbe Ristretto), la réponse OPAQUE, le `finishLoginRequest`. **Jamais le password en clair, jamais l'`exportKey`, jamais la KEK ou la main key.** Le serveur ne peut pas reconstruire le password à partir des messages capturés.

L'état serveur entre start et finish (`opaque_login_state`) vit en mémoire process, TTL 5 minutes, single-use. Pas d'opportunité de replay.

### Anti-énumération

Cinq routes peuvent être abusées pour énumérer les comptes ; toutes répondent de manière indistinguable :

- `/auth/register/finish` — sur invite-bound, l'invite est consommée ou refusée selon que l'email matche le token, jamais selon que le compte existe déjà ailleurs.
- `/auth/login/start` — un email inconnu reçoit une réponse OPAQUE syntaxiquement valide mais cryptographiquement morte (`finishLogin` côté client retourne `undefined`).
- `/auth/recover-kek/start` — emails inconnus (ou emails connus sans recovery code) reçoivent des `wrappedKekRecovery` aléatoires de la bonne taille (48 bytes ciphertext + 12 bytes IV) ; le client échoue silencieusement à les unwrap.
- `/auth/mfa-bypass/request` — pendant un `mfa_pending`, la requête de bypass renvoie toujours 200, qu'un `mfa_bypass_request` soit créé en DB ou non.
- `/auth/request-reset` — toujours 200, qu'un email matche ou non.

## Cycle de vie d'un compte

### Inscription

Deux variantes selon `app_settings.open_registration` :

**Invite-bound** (Bitwarden-style, par défaut) — admin émet `POST /admin/invites { email }` → email envoyé avec lien `/register?invite=<token>` → l'utilisateur·ice clique → form pré-remplit l'email (read-only) → submit consomme l'invite atomiquement (`SELECT … FOR UPDATE`, strict email match) → ligne `users` créée avec `email_verified_at = now()` (le clic sur le lien magique a prouvé le contrôle de l'email).

**Open** (`app_settings.open_registration = true`) — `/register` accepte un signup libre → ligne créée avec `email_verified_at = NULL` → email d'activation envoyé → `/auth/register/activate` flippe `email_verified_at`.

Dans les deux cas, le client génère localement la `main_key` (32 bytes random) et la KEK (32 bytes random), wrappe selon la hiérarchie ci-dessus, envoie les blobs au serveur dans la même transaction que l'OPAQUE registration. Le mot de passe et les clés ne quittent jamais le navigateur.

### Login

Cf. flux OPAQUE ci-dessus. Le serveur refuse `403 account_not_activated` si `email_verified_at IS NULL`.

Si `users.security_mode != 'password_or_passkey'`, le `/auth/login/finish` n'émet pas une session `'full'` mais une session `'mfa_pending'` (TTL 5 min) avec les wrap blobs en payload. Le client unwrap localement la KEK + main key pendant que la session est encore pending — `/auth/me` refuse les sessions pending donc aucune route data n'est accessible avant la finalisation MFA (cf. §MFA).

### Change password

OPAQUE 2-step via `/auth/change-password/start` + `/finish`. Le client re-derive la `exportKey` courante via un round-trip `/auth/login/start`, unwrap la KEK localement, finit l'OPAQUE registration avec le nouveau password, **re-wrap la même KEK** sous le nouveau `exportKey`, envoie au `/finish`. Le serveur consomme le token, remplace `opaque_records.envelope` et `users.wrapped_kek_password{,_iv}` en transaction, **révoque toutes les sessions** et émet une session fraîche.

La main key et la KEK ne bougent pas — tous les ciphertexts existants restent lisibles.

### Reset destructif

Email avec token magic-link (32 bytes random, hashé SHA-256 en DB, TTL 1h). Le client génère une nouvelle main key + nouvelle KEK (l'ancienne main key est irrécupérable puisque le password est oublié) → re-register OPAQUE → `/finish` purge **toutes** les lignes user-owned dans la même transaction que la rotation des credentials.

### Recovery via mnemonic

Non-destructif. L'utilisateur·ice tape ses 12 mots → le client dérive la wrap-key recovery → unwrap la KEK depuis `wrapped_kek_recovery` → choisit un nouveau password → re-register OPAQUE → re-wrap la KEK sous le nouveau `exportKey` → génère un nouveau recovery code → re-wrap la KEK sous le nouveau code. Le serveur valide en constant-time le hash du recovery code (anti-DoS) puis remplace tous les blobs en transaction. Sessions révoquées + nouvelle session fraîche émise. **La main key reste la même → toutes les données restent lisibles.**

## MFA

### Modes de sécurité

Trois niveaux par utilisateur·ice (`users.security_mode`) :

- `password_or_passkey` (défaut) — un facteur unique unlock la session.
- `always_2fa` — TOTP requis après password ou passkey. Activable seulement si TOTP enrôlé.
- `maximum` — password + passkey PRF + TOTP, les trois requis. Activable seulement si une passkey PRF est enrôlée.

Downgrade auto §6.1 : si l'utilisateur·ice désactive le facteur qui maintient le mode, le mode retombe à `password_or_passkey` dans la même transaction (avec email de notification).

### Stepped MFA

Quand `security_mode != 'password_or_passkey'`, le login finish émet une session `'mfa_pending'` au lieu de `'full'`. Les routes `/auth/mfa/totp/verify` et `/auth/mfa/passkey/{options,verify}` consomment des flags sur la pending row. Quand tous les flags requis pour le mode sont à `true`, la pending est promue en `'full'` atomiquement (DELETE + INSERT en transaction via `finalizeMfaSession`).

<aside class="docs-diagram-stepped-mfa"></aside>

### TOTP

RFC 6238, paramètres figés (SHA1 / 6 chiffres / 30 s, ±1 fenêtre de skew). Secret 20 bytes random, en clair en DB (le serveur doit pouvoir vérifier — c'est le compromis assumé du protocole).

Anti-replay : la dernière fenêtre matchée est stockée dans `mfa_totp.last_window`, refusant les codes du même créneau réutilisés.

10 backup codes générés à l'enrollment, 130 bits d'entropie chacun, format `XXXX-XXXX-XXXX-XXXX-XXXX-XXXX` (base32), hash SHA-256 stocké. Single-use via `UPDATE WHERE used_at IS NULL`.

### Passkey + PRF

WebAuthn level 2 avec `userVerification: 'required'` (gate côté serveur en plus de la lib). Toute passkey sans gesture (PIN, biométrie, déverrouillage gestionnaire) refusée à l'enrollment.

PRF input v1 : `"nodea:prf-v1"` zero-padding 32 bytes — figé pour ne pas casser les KEK déjà wrappées si on évolue.

La KEK est wrappée par credential PRF. L'ajout d'une passkey crée un nouveau `wrapped_kek_passkey_<credId>` ; la suppression supprime la ligne. La main key et la KEK ne sont jamais re-générées dans ces opérations.

Signature counter `signCount` vérifié strict côté serveur — un counter qui régresse signale un clone de la passkey (refus + log).

### Bypass MFA par email

Auth-Spec §7.8. Quand l'utilisateur·ice perd son TOTP (téléphone perdu, app effacée…) et n'a pas de backup code sous la main, il/elle peut demander un bypass via `/auth/mfa-bypass/request`. Le serveur envoie un email avec un lien `/auth/bypass/confirm?t=<token>` ; cliquer démarre un délai de **7 jours** pendant lesquels la requête peut être annulée par n'importe quelle connexion réussie. Après 7 jours, la prochaine connexion consomme le bypass : le facteur perdu est nettoyé (TOTP désactivé + backup codes purgés, ou toutes les passkeys supprimées) et le mode rétrogradé si nécessaire.

Eligibility gate §6.2 : en mode `maximum`, un bypass d'un facteur exige que l'autre facteur soit prouvé dans la session `mfa_pending` avant d'émettre la requête. Sans ça, on perdrait deux facteurs d'un coup → reset destructif.

<aside class="docs-diagram-mfa-bypass"></aside>

## Sessions

| Propriété | Valeur |
|---|---|
| Type | Cookie signé `nodea_session=<id>.<sig>` |
| Flags | `HttpOnly`, `Signed` (`COOKIE_SECRET` ≥ 32 chars), `SameSite=Lax`, `Secure` en prod |
| Stockage | Table `sessions` (Postgres) — la révocation par `DELETE` prend effet immédiatement, pas de JWT |
| TTL `full` | 7 jours fixe (pas de slide) |
| TTL `mfa_pending` | 5 minutes |
| TTL `register` | 24 heures |
| Freshness re-auth | 5 minutes |

### Rotation systématique sur changement de privilège

La table `sessions` est purgée (`revokeAllUserSessions`) à chaque événement qui change le profil de sécurité du compte :

- `change-password` finish
- `security-mode-change`
- `recover-kek/finish`
- `mfa-bypass/applied` (au login suivant)

Une session fraîche est émise dans la même requête. Toute session parallèle (autre tab, autre device) est invalidée immédiatement.

### Re-auth fresh

Les routes mutantes en Settings (`security-mode/change`, `totp/disable`, `passkey/:id/remove`, `recovery-code`, `change-password`, `change-email`, `delete-self`) requièrent une preuve fraîche de password datant de moins de 5 minutes, vérifiée par le middleware `requireFreshPassword`. L'horodatage est stamped sur `sessions.reauth_password_at` à chaque login finish, MFA finalize, change-password, recovery, et après un `/auth/reauth/password` explicite.

Variante `requireFreshPasswordOrPasskey` accepte aussi un re-prove passkey via `/auth/reauth/passkey`.

## Hardening serveur

### Requêtes paramétrées

Toutes les requêtes DB passent par Drizzle (`eq(users.email, value)`, etc.). **Aucune** interpolation de chaîne dans le SQL — le legacy `Register.jsx` qui interpolait `code="${inviteCode}"` dans un filtre PocketBase est éliminé. Règle dure du projet, vérifiée à chaque PR.

### Guards HMAC obligatoires sur les mutations

Toute table d'entrée chiffrée (`mood_entries`, `goals_entries`, etc.) requiert un guard HMAC pour UPDATE et DELETE. Le middleware `requireGuard(table)` valide le tuple `(user, sid, guard)` dans une seule passe centralisée. La liste des collections est dans `packages/api/src/collections/registry.ts` — le route factory itère cette liste pour monter les routes ; impossible d'enregistrer une collection sans validation.

**Formule du guard.** Déterministe, calculé côté client :

```text
guard = "g_" + hex( HMAC(hmacKey, `${module_user_id}:${record_id}`) )
```

**Création en deux temps.** À la création, le client n'a pas encore l'`id` de la ligne (généré côté serveur). Il envoie donc `guard: "init"` au `POST`, reçoit l'`id` retourné, recalcule le vrai `guard`, puis fait immédiatement un `PATCH` avec les en-têtes `X-Sid: <sid>`, `X-Guard: init` et le vrai guard dans le body. Le serveur promeut `"init"` → vrai guard atomiquement.

**Mutations ultérieures** (UPDATE, DELETE) requièrent les en-têtes `X-Sid: <module_user_id>` et `X-Guard: <guard>`. Le serveur compare en temps constant et refuse sur mismatch. **En-têtes, jamais query-params** — les query-strings seraient loguées par `hono/logger()` et les access logs Nginx, et le guard est du matériel crypto dérivé de la clé maîtresse.

Tables 1:1 (`modules_config`, `user_preferences`) — pas de guard : le user *est* la ligne, `requireUser` + scoping `user_id` suffit (pas d'`id` à authentifier indépendamment).

### Rate-limit catalog

22 limiters actifs au total. Format : `max / fenêtre`. Tous keyed-IP (premier hop `x-forwarded-for`, fallback `x-real-ip` puis `unknown`) et indépendants — un même IP peut consommer chaque bucket séparément. Implémenté en mémoire process (`packages/api/src/middleware/rate-limit.ts`). Single-instance ; scaling out = swap vers Redis.

#### Pré-auth (`/auth/*` accessibles sans cookie de session)

| Route | Limite | `keyPrefix` | Justification |
|---|---|---|---|
| `POST /auth/register/start` | 10 / 1h | `register-start` | OPAQUE start, accepte 10 essais/heure pour permettre la correction d'erreurs sans ouvrir un boulevard à l'enrôlement automatisé |
| `POST /auth/register/finish` | 5 / 1h | `register-finish` | Étape coûteuse (création user + opaque_record + invite consumption en transaction) |
| `POST /auth/register/activate` | 20 / 1h | `register-activate` | Click sur le magic-link — tolérant à un user qui clique plusieurs fois |
| `GET  /auth/register/invite-info` | 30 / 1h | `register-invite-info` | Pré-rendu de l'écran de register (peeks au token sans le consommer) |
| `POST /auth/login` (legacy hashed) | 10 / 1min | `login` | Court-fenêtré pour limiter le brute-force, tolérant à un user qui se trompe |
| `POST /auth/login/start` + `/finish` | — | — | Pas de limiter dédié : OPAQUE est déjà coûteux côté serveur et `client.finishLogin` retourne `undefined` avant tout aller-retour réseau pour un mot de passe faux |
| `POST /auth/request-reset` | 5 / 1h | `request-reset` | Anti-spam mailer, 5 demandes par IP par heure suffisent à un user honnête |
| `POST /auth/reset` | 10 / 1min | `reset` | Mild cap pour ralentir un brute-force sur un token volé |
| `POST /auth/recover-kek/start` | 5 / 1h | `recover-kek` | Anti-énumération : 5 emails testés par heure max |
| `POST /auth/recover-kek/finish` | 5 / 1h | `recover-kek` | Partage le bucket avec `/start` |
| `POST /auth/mfa-bypass/confirm` | 20 / 1h | `mfa-bypass-link` | Click sur le magic-link de confirmation |

#### Authentifié (cookie de session requis)

| Route | Limite | `keyPrefix` | Justification |
|---|---|---|---|
| `POST /auth/reauth/password/{start,finish}` | 10 / 15min | `reauth` | Re-prove password gate — assez large pour les ré-auths légitimes, assez serré pour ne pas devenir un canal de devinette du mot de passe |
| `POST /auth/security-mode/change` | 10 / 15min | `security-mode-change` | Mutation sensible mais déjà gardée par re-auth |
| `POST /auth/mfa/totp` | 10 / 5min | `mfa-totp-verify` | Stepped-MFA après login : 10 tentatives/5min coupent le brute-force d'un code à 6 chiffres |
| `POST /auth/mfa/passkey/{options,verify}` | 10 / 5min | `mfa-passkey` | Stepped-MFA passkey : challenge à usage unique côté serveur |
| `POST /auth/mfa-bypass/request` | 3 / 1h | `mfa-bypass-request` | Anti-spam : trois mails maximum par heure pour le bypass MFA |
| `POST /auth/totp/enroll/{start,verify}` | 10 / 15min | `totp-enroll` | Setup d'un nouveau secret — utilisé une fois en pratique |
| `POST /auth/totp/{disable,…}` | 30 / 15min | `totp-manage` | Lecture/écriture régulière depuis Settings, plafond confortable |
| `POST /auth/security/recovery-code` | 5 / 1h | `recovery-code-setup` | Setup ou regenerate du code de récupération — opération rare |
| `POST /auth/passkeys/enroll/{options,finish}` | 10 / 15min | `passkey-enroll` | Setup d'un nouveau passkey, idem TOTP |
| `POST /auth/passkeys/{login-options,login-finish}` | 20 / 15min | `passkey-login` | Login passkey-first : tolérant aux annulations utilisateur sur le prompt OS |
| `*    /auth/passkeys/:id/...` (rename, remove) | 30 / 15min | `passkey-manage` | Lecture/écriture Settings |

#### Non-auth (lookup externes)

| Route | Limite | `keyPrefix` | Justification |
|---|---|---|---|
| `GET /library/lookup/isbn/:isbn` | 30 / 1min | `library-lookup-isbn` | Proxy ISBN — protège l'API tierce |
| `GET /library/lookup/query` | 30 / 1min | `library-lookup-query` | Recherche fuzzy |
| `GET /library/lookup/cover/:hash` | 60 / 1min | `library-lookup-cover` | Couvertures d'images, ratio plus haut car appelé en batch sur une page de résultats |

**Politique implicite — trois familles de durée :**

- **5 minutes** pour les codes courts (TOTP, passkey en stepped-MFA) — borne le brute-force d'un secret 6 chiffres.
- **15 minutes** pour la gestion sensible (re-auth, security-mode, enroll d'un facteur).
- **1 heure** pour les actions à coût mailer ou serveur élevé (register, reset, recovery, bypass).

Si tu ajoutes une nouvelle route `/auth/*`, choisis la fenêtre selon ces familles plutôt que d'inventer une nouvelle valeur ; les exceptions doivent être justifiées en commentaire au-dessus du `rateLimit({…})`.

### Pas d'identifiants dans les logs

La politique de logs interdit toute métadonnée identifiante qui ne soit pas tied à la requête servie. Concrètement : pas d'emails, pas de session ids, pas de tokens, pas de matériel crypto — même au niveau `debug`. Les logs côté API portent la méthode + le path + le statut + la durée — le minimum nécessaire pour corréler une erreur à une requête.

### Checklist crypto pour les devs

Liste prescriptive utilisée à la revue de PR. La version exhaustive (avec rationale par règle) vit dans `Auth-Spec.md` §14.

**À faire :**

- Générer un IV frais par chiffrement AES-GCM (`crypto.getRandomValues`).
- Construire toute AAD via `buildAAD(parts: Uint8Array[])` (dans `packages/shared/src/crypto-types.ts`) — jamais à la main.
- Dériver les sous-clés AES et HMAC via HKDF avec labels distincts (`"nodea:aes"`, `"nodea:hmac"`).
- Utiliser les branded types (`AesMainKey`, `HmacMainKey`, `Base64`, `CipherIV`…) — mélanger les primitives doit échouer à la compilation.
- Pour un nouveau module : réutiliser `createCollectionClient`, ne pas réimplémenter le POST/PATCH dance.
- Quand le slice Zustand `crypto.status` flippe à `'missing'` : ne pas tenter de déchiffrer, surfacer le `KeyMissingModal` existant.

**Interdit :**

- `console.log(mainKey)` ou équivalent qui logue / persiste un `CryptoKey` ou du matériel clé brut.
- `window.mainKey` ou tout autre fallback global qui exposerait la clé.
- Stockage de `guard` ou de tokens sensibles dans `localStorage`.
- Réutiliser les mêmes 32 bytes comme clé AES ET HMAC sans HKDF.
- Ajouter un second encodeur base64 : passer par `core/crypto/base64.ts`.
- Renvoyer `guard` ou l'`encrypted_key` d'un autre user dans une réponse serveur (un test d'intégration le bloque).
- Commit qui dépend de hooks skippés (`--no-verify`).

## Intégrité du bundle

C'est la limite la plus honnête de Nodea : un serveur compromis peut servir du JavaScript modifié qui exfiltre password ou KEK avant qu'ils ne soient utilisés. Inhérent à toute application web E2EE — Bitwarden, Standard Notes, Cryptee partagent la même limite.

### Mitigations en place

- **Subresource Integrity** sur l'entry chunk — le HTML qui charge le bundle principal contient l'empreinte SHA-384 du fichier ; un navigateur conforme refuse d'exécuter un fichier altéré.
- **Manifest `INTEGRITY.txt`** publié à chaque release — empreintes SHA-384 de tous les fichiers du bundle. Un auditeur peut comparer ce que son instance sert avec ce qui est annoncé (commande `sha384sum` côté instance déployée, comparaison contre l'`INTEGRITY.txt` attaché à la release GitHub correspondante). La vérification est manuelle et out-of-band, c'est le point : le trust anchor est la release GitHub publiée, pas le serveur en marche.

### Recommandation

**Auto-héberge si tu manipules des données sensibles.** Tu réduis drastiquement la surface d'attaque (ton serveur, tes employé·es… toi-même). C'est explicitement la posture par défaut de Nodea — l'app est conçue pour tourner facilement sur un serveur personnel via docker-compose.

## Modèle de données

### Surface lisible côté serveur — minimum strict

Pour chaque ligne d'une table `*_entries` (Mood, Goals, Journal, Habits, Library, Review…), le serveur ne voit que le strict minimum nécessaire au routing et à la cryptographie :

| Champ | Visible serveur | Rôle |
|---|---|---|
| `id` | oui | UUID généré côté serveur, sert uniquement de handle pour les routes `/records/:id`. Aucun contenu utilisateur. |
| `module_user_id` | oui | Sid opaque dérivé client-side. **Seule clé d'accès** aux entrées. Le mapping `user → sids` vit chiffré dans `modules_config` ; le serveur ne sait jamais à qui un sid appartient. |
| `cipher_iv` | oui | IV 96 bits aléatoire — requis pour déchiffrer le payload (impossible de le cacher sans casser AES-GCM). |
| `payload` | oui (chiffré) | JSON chiffré AES-GCM. **Tout le contenu utilisateur**, **plus** les éventuels timestamps applicatifs (`updated_at` etc.) que le module veut conserver. **Jamais déchiffrable côté serveur.** |
| `guard` | oui (jamais renvoyé en lecture) | HMAC stocké, jeton secret pour les mutations. Calculer un guard valide nécessite la clé maîtresse. |

**Pas de `user_id`** : les entrées ne portent aucune référence directe à `users.id`. Le serveur ne peut donc pas faire `SELECT COUNT(*) FROM mood_entries WHERE user_id = X` — la corrélation user↔data n'existe pas en plain SQL.

**Pas de timestamps colonnes** (`created_at`, `updated_at`) : ils leakaient l'activité d'écriture par ligne. Si un module a besoin d'un timestamp (par ex. Goals pour le tri « Récent »), le client le met dans le `payload` chiffré — le serveur n'en voit jamais la valeur.

### Conséquences cascade

- **User self-delete** : flow client-driven. Le client décrypte `modules_config` pour récupérer ses sids, énumère ses entrées par sid, calcule les guards, supprime une par une via les routes guard-protected, puis appelle `DELETE /auth/me`.
- **Admin delete user** : la ligne `users` disparaît + cascade FK sur `modules_config`, `user_preferences`, `sessions`, `opaque_records`. Les entrées dans les tables modules **restent en DB orphelines** — illisibles puisque la clé maîtresse est partie avec le user. Bounded growth, accepté par design.
- **Reset destructif** : même comportement — les anciennes entrées deviennent orphelines, le user repart avec une nouvelle clé. Les rows existantes sont chiffrées avec une clé perdue, donc inaccessibles.

### Surface lisible côté serveur — toutes les autres tables

Pour chaque champ lisible avec un simple `SELECT` : sa nature et la raison pour laquelle il existe en clair plutôt qu'ailleurs. Les colonnes absentes sont chiffrées ou hashées — détails en bas de section.

#### Comptes et identité

| Table | Champ | Description | Pourquoi |
|---|---|---|---|
| `users` | `id` | UUID PK | Identifiant unique référencé en FK par toutes les autres tables (sessions, opaque_records, etc.) |
| `users` | `email` | Adresse email du compte | Identifiant OPAQUE pour le login + envoi des mails de service (reset, invitations, notifs) |
| `users` | `username` | Nom d'affichage public | UI uniquement, duplications autorisées (l'identité c'est l'`id`) |
| `users` | `role` | `'user'` / `'admin'` | Gate les routes admin (créer des invites, supprimer des comptes…) |
| `users` | `security_mode` | `password_or_passkey` / `always_2fa` / `maximum` | Détermine quels facteurs sont requis au login (Auth-Spec §6.1) |
| `users` | `register_state` | État dans la machine d'inscription multi-étapes | Permet de reprendre l'inscription si l'user ferme l'onglet (pre_register → email_verified → password_set → recovery_set → complete) |
| `users` | `email_verified_at` | Timestamp d'activation | Le login refuse `403 account_not_activated` si NULL |
| `users` | `email_changed_at` | Timestamp du dernier change-email | Anchor du cooldown 7 jours entre deux change-email |
| `users` | `recovery_acknowledged_at` | Timestamp de validation du code de récup | Set quand l'user a coché « j'ai noté mes 12 mots » ; gate la transition `recovery_set` |
| `users` | `onboarding_status`, `onboarding_version` | État de l'onboarding | Drive le modal de premier login + permet de re-trigger après update du flow |
| `users` | `created_at`, `updated_at` | Timestamps standard | Audit / debug |
| `opaque_records` | `user_id` | FK | Lie l'envelope OPAQUE au user |
| `opaque_records` | `envelope` | Registration record OPAQUE (opaque crypto blob) | Lu au login pour `server.startLogin` ; sans, pas de preuve OPAQUE possible |

#### Sessions et MFA

| Table | Champ | Description | Pourquoi |
|---|---|---|---|
| `sessions` | `id` | Token signé (HMAC `COOKIE_SECRET`) | Valeur du cookie `nodea_session` ; la signature empêche un attaquant de fabriquer un cookie valide |
| `sessions` | `user_id`, `kind` | FK + classification | `kind` gate quelles routes la session peut atteindre (`full`, `mfa_pending`, `register`, `migrate`) |
| `sessions` | `expires_at` | TTL | 7j pour `full`, 5min pour `mfa_pending`, 24h pour `register` |
| `sessions` | `reauth_password_at`, `reauth_passkey_at` | Timestamps de la dernière re-auth fraîche | Gate les actions sensibles via `requireFreshPassword` (5 min de fenêtre) |
| `sessions` | `mfa_*_verified` (3 flags) | Progression stepped MFA | Sur une session pending : track quels facteurs sont OK ; promotion en `full` quand tous les requis sont à `true` |
| `sessions` | `pending_webauthn_challenge` | Challenge WebAuthn en cours | Single-use TTL 5 min — anti-replay entre `passkey/options` et `passkey/verify` |
| `sessions` | `created_at`, `updated_at` | Timestamps standard | Audit, expiration |
| `auth_factors` | `id`, `user_id`, `kind` | Identité de la passkey | `kind = 'passkey'` (TOTP a sa table dédiée) |
| `auth_factors` | `credential_id` | ID renvoyé par WebAuthn à l'enrollment | Identifie la passkey lors d'une assertion ultérieure |
| `auth_factors` | `public_key` | Clé publique de la passkey | Vérifie les signatures WebAuthn |
| `auth_factors` | `sign_count` | Compteur de signatures | Anti-clone : un compteur qui régresse signale un duplicata de l'authenticator |
| `auth_factors` | `transports` | `'usb'`, `'nfc'`, `'internal'`… | Hints au navigateur pour les discoverable credentials |
| `auth_factors` | `prf_supported` | Bool | Détermine si la passkey peut déchiffrer la KEK seule (PRF) ou si l'user devra chaîner un mot de passe |
| `auth_factors` | `label` | Étiquette donnée par l'user | UI : « iPhone Touch ID », « Yubikey perso »… |
| `auth_factors` | `created_at` | Date d'enrôlement | Affichée dans la liste des passkeys de l'user |
| `mfa_totp` | `user_id` | FK | 1:1 par user |
| `mfa_totp` | **`secret`** | Secret TOTP RFC 6238 (⚠️ en clair) | RFC 6238 EXIGE le secret en clair côté serveur pour vérifier les codes à 6 chiffres ; trade-off assumé (cf. callout ci-dessous) |
| `mfa_totp` | `algo`, `digits`, `period` | SHA1 / 6 / 30s | Paramètres figés compatibles avec toutes les apps authenticator |
| `mfa_totp` | `enabled_at` | Timestamp d'activation | Distingue un enrollment en cours (NULL) d'une activation complète |
| `mfa_totp` | `last_window` | Dernière fenêtre TOTP matchée | Anti-replay : le même code dans la même fenêtre 30s n'est pas accepté deux fois |
| `mfa_totp_recovery_codes` | `id`, `user_id` | PK + FK | Identité du backup code |
| `mfa_totp_recovery_codes` | `used_at` | Timestamp ou NULL | Single-use : `UPDATE WHERE used_at IS NULL` lors de la consommation |
| `mfa_bypass_requests` | `id`, `user_id` | PK + FK | Identité de la requête de bypass |
| `mfa_bypass_requests` | `factor` | `'totp'` ou `'passkey'` | Quel facteur sera désactivé après le délai 7 jours |
| `mfa_bypass_requests` | timestamps (`confirmed_at`, `cancelled_at`, `consumed_at`, `expires_at`, `earliest_apply_at`) | Track le cycle de vie | Le bypass devient applicable après `earliest_apply_at` (= confirmation + 7j), est annulé à `cancelled_at` (un login normal défang la requête), consommé à `consumed_at` |

> ⚠️ **Le secret TOTP est en clair côté serveur.** RFC 6238 le requiert. Trade-off assumé : la protection TOTP repose sur l'intégrité du serveur, pas sur la cryptographie pure. OPAQUE et PRF restent E2E même serveur compromis.

#### Flux email transitoires

| Table | Champ | Description | Pourquoi |
|---|---|---|---|
| `email_verifications` | `id`, `user_id`, `kind` | Identité de la demande | `kind = 'register'` ou `'email_change'` — même mécanisme, deux contextes |
| `email_verifications` | `attempts` | Compteur | Cap à 5 avant invalidation forcée |
| `email_verifications` | `expires_at` | TTL 10 min | Empêche un token volé de servir indéfiniment |
| `password_reset_tokens` | `id`, `user_id` | Identité de la demande | PK + FK |
| `password_reset_tokens` | `expires_at` | TTL 1h | Anti-replay sur token volé |
| `password_reset_tokens` | `used_at` | Single-use marker | Une demande de reset = un token utilisable une fois |
| `invites` | `id` | UUID PK | — |
| `invites` | `email` | Adresse du destinataire (en clair) | Pour envoyer le magic-link **et** matcher strictement à l'inscription (l'invite ne peut être consommée que par cette adresse exacte) |
| `invites` | `created_by` | FK admin | Audit / révocation côté admin |
| `invites` | `expires_at`, `created_at` | TTL configurable | — |

#### Configuration utilisateur (1:1 par user)

| Table | Champ | Description | Pourquoi |
|---|---|---|---|
| `modules_config` | `user_id` | PK | 1:1 par user — `requireUser` suffit, pas de guard |
| `modules_config` | `cipher_iv` | IV AES-GCM | Requis pour déchiffrer le payload |
| `modules_config` | `updated_at` | Timestamp | Cache invalidation côté client |
| `user_preferences` | `user_id` | PK | 1:1 par user — `requireUser` suffit, pas de guard |
| `user_preferences` | `cipher_iv` | IV AES-GCM | Requis pour déchiffrer le payload |
| `user_preferences` | `updated_at` | Timestamp | Cache invalidation côté client |

Le `payload` de ces deux tables est chiffré (`modules_config` contient le mapping `user → sids` par module ; `user_preferences` contient les réglages UI du user).

#### Données globales d'app

| Table | Champ | Description | Pourquoi |
|---|---|---|---|
| `announcements` | tout (id, title, body, active, priority, timestamps, created_by) | Annonces publiques de l'admin | Affichées en tête de la home pour TOUS les users connectés — en clair par construction (pas du contenu user) |
| `app_settings` | `key`, `value`, `updated_at` | Config globale clé/valeur | Stocke les flags d'app comme `open_registration` (autoriser ou non l'inscription sans invite) |

#### Tables modules (rappel)

`mood_entries`, `goals_entries`, `journal_entries`, `habits_*_entries`, `library_*_entries`, `review_entries` — décrites dans le tableau « surface lisible côté serveur — minimum strict » plus haut. **Pas de `user_id`, pas de timestamps colonnes.**

#### Le reste (chiffré ou haché)

Pour la complétude — colonnes absentes des tableaux ci-dessus :

- **Blobs chiffrés AES-GCM** (illisibles sans la clé maîtresse) : `users.wrapped_main_key{,_iv}`, `users.wrapped_kek_password{,_iv}`, `users.wrapped_kek_recovery{,_iv}`, `auth_factors.wrapped_kek{,_iv}`, `modules_config.payload`, `user_preferences.payload`.
- **Hashes SHA-256** (irréversibles, le secret en clair n'est jamais stocké) : `users.recovery_code_hash`, `mfa_totp_recovery_codes.code_hash`, `mfa_bypass_requests.{confirm,cancel}_token_hash`, `email_verifications.code_hash`, `password_reset_tokens.token_hash`, `invites.token_hash`.

### Qui peut voir quoi

Trois acteurs possibles avec des privilèges différents. Liste honnête des capacités de chacun.

#### L'équipe Nodea (l'opérateur de l'instance hébergée par nous)

Avec accès SQL direct au serveur de prod, l'équipe peut lire toutes les colonnes en clair listées ci-dessus. Concrètement :

- **Voir** les emails, usernames, rôles admin/user, mode de sécurité de chaque compte.
- **Voir** les heures de connexion, la fréquence d'usage agrégée, l'IP des sessions courantes (à travers les logs proxy / API ; pas en DB).
- **Voir** quelles passkeys sont enrôlées (label, transport — pas le contenu crypto utile sans intervention de la passkey).
- **Voir** les annonces, les invitations envoyées, les paramètres globaux de l'app.
- **Compter** les entrées par module en agrégat (« il y a 1247 entrées Mood ») — **pas par user**, le serveur ne sait pas à qui chaque entrée appartient.
- **Désactiver / supprimer** des comptes, modifier les rôles, supprimer des invites.

L'équipe **ne peut pas** :
- Lire le mot de passe (OPAQUE — jamais transmis en clair).
- Lire les payloads chiffrés (modules_config, user_preferences, *_entries) — pas la clé.
- Lier une entrée module à un user (pas de `user_id` sur les entries — corrélation impossible en SQL direct).
- Forger un guard pour modifier une entrée (HMAC dépend de la clé maîtresse).
- Récupérer un compte perdu (pas le mot de passe, pas le code de récup, pas la clé).

#### L'hébergeur (cloud provider, sysadmin avec accès root au serveur)

Tout ce que voit l'équipe Nodea + accès au filesystem, à la mémoire RAM du process Node, aux logs Postgres / WAL, aux backups disque.

- **Voir** les `ctid` Postgres / le WAL → corrélation statistique d'écritures « proches en temps » sur plusieurs tables, pour reconstruire qui a écrit quoi sans avoir le `user_id` direct (forensic, pas plain SQL).
- **Snapshot mémoire** : la clé maîtresse vit dans le **navigateur du user**, jamais sur le serveur. Un snapshot RAM du serveur n'aide donc pas à lire les payloads chiffrés.
- **Tampering du bundle JS** : si l'hébergeur prend le contrôle de la chaîne de build / du serveur web, il peut servir un JS modifié qui exfiltre le mot de passe ou la KEK au moment où le user se connecte. **Limite fondamentale du modèle web E2EE** — mitigations : SRI sur l'entry chunk, manifest `INTEGRITY.txt`, recommandation d'auto-hébergement.

L'hébergeur **ne peut pas** non plus lire les payloads tant qu'il n'a pas tampered le bundle ET attendu une connexion user.

#### Une autorité judiciaire (police, justice — réquisition légale)

L'équipe Nodea, contrainte par une réquisition formelle, peut être obligée de remettre **tout ce qui est lisible côté serveur** :

- **Peut remettre** : les emails, usernames, heures de connexion, IP des sessions, blobs chiffrés (inutiles sans la clé), hashes anti-DoS, liste des passkeys enrôlées, mode de sécurité, dates d'inscription, dates d'annonces.
- **Ne peut pas remettre** : le contenu utilisateur en clair (techniquement impossible — l'équipe n'a aucune clé pour le déchiffrer). Le mot de passe (techniquement impossible — OPAQUE le rend non-récupérable côté serveur).
- **Pourrait être contrainte** d'installer un bundle JS modifié qui exfiltrerait les clés au prochain login (cf. limite supply-chain ci-dessus). Cette éventualité est documentée dans Auth-Spec §2.2 comme l'un des vecteurs qu'on **ne défend pas**.

Concrètement, en pratique : « voilà l'email du compte, voilà ses heures de connexion, voilà ses fichiers chiffrés sur la table X. Bon courage pour les ouvrir. »

#### Auto-héberge si ces vecteurs te préoccupent

L'équipe Nodea, l'hébergeur de l'instance, et l'interlocuteur d'une réquisition deviennent **toi**. Tu réduis drastiquement la surface de risque (à condition que ton serveur soit sécurisé). C'est explicitement la posture par défaut recommandée pour un usage sensible.

### Ce qui fuit comme métadonnée — récap

Pour les vecteurs qui restent même si l'équipe Nodea, l'hébergeur et l'autorité judiciaire ne sont pas tous corrompus :

- **Action × module × utilisateur·ice par croisement de logs.** Les endpoints API sont nommés par module (`/mood-entries/records`, `/library-items/records`, etc.) — une requête est tirée à chaque lecture, écriture, édition, suppression. En croisant les logs Nginx (path + IP + horodatage), les logs API (path + statut + durée + user_id quand présent) et la table `sessions` (user_id ↔ IP), un opérateur peut reconstruire « user U a fait une opération sur le module M à l'heure T ». Le contenu reste chiffré et les rows ne portent toujours pas de `user_id`, mais l'attribution user → module → action → timestamp est triviale par jointure des logs. **Mitigation prévue** : unifier les endpoints `*-entries/records` en un seul `/records` agnostique au module, pour que le path ne révèle plus rien — pas encore implémenté.
- **Taille des blobs chiffrés** (ordre de grandeur du contenu).
- **Ordre d'insertion physique** Postgres / WAL (corrélation statistique forensic).
- **Fréquence et timestamps de connexion** des sessions.
- **Adresse email** (clair, c'est l'identifiant OPAQUE).
- **Logs proxy / API** côté hébergeur (IP, user-agent, request ID).

Aucun de ces signaux ne donne accès au contenu en clair. L'auto-hébergement neutralise la quasi-totalité d'entre eux.

## Conservation des données et RGPD

Nodea traite des données personnelles sous **intérêt légitime** (faire tourner le service demandé par l'utilisateur·ice) pour tout ce qui est opérationnel, et sous **consentement explicite** pour le contenu chiffré (l'utilisateur·ice ouvre un compte en sachant qu'iel y stocke des notes E2EE).

### Matrice de rétention

Toutes les tables qui contiennent de la donnée personnelle ou dérivée, avec leur règle de rétention et la cascade FK à la suppression de compte. Les tables non listées (`app_settings`, `announcements`) ne contiennent pas de donnée personnelle.

| Table | Contient | Rétention | Effacé par `DELETE /auth/me` |
|---|---|---|---|
| `users` | id, email, username, rôle, blobs OPAQUE, mode de sécurité | Tant que le compte existe | Oui |
| `opaque_records` | Envelope OPAQUE (par user) | Durée de vie de la ligne user | Oui (cascade FK) |
| `auth_factors` | Credentials passkey (id, label, transports, wrap blobs, prfSupported) | Durée de vie user, ou jusqu'à retrait du credential | Oui (cascade FK) |
| `mfa_totp` | Secret TOTP (chiffré) + flag enabled | Durée de vie user, ou jusqu'au disable TOTP | Oui (cascade FK) |
| `mfa_totp_recovery_codes` | Backup codes hashés | Durée de vie user, single-use (lignes consommées gardées pour audit) | Oui (cascade FK) |
| `mfa_bypass_requests` | Tokens (hashés), timestamps confirm/cancel | Gardées indéfiniment pour audit ; lignes inertes après consume/cancel/expire | Oui (cascade FK) |
| `email_verifications` | Tokens one-time pour register/reset/change-email | `register` purgées par cron hebdo. Autres types gardées indéfiniment jusqu'à consume | Oui (cascade FK) |
| `password_reset_tokens` | Tokens one-time pour reset password | Gardés indéfiniment ; inertes après consume/expire | Oui (cascade FK) |
| `sessions` | Cookies de session + expiry | Purgées par cron hebdo quand `expires_at` est passé | Oui (cascade FK) |
| `modules_config` | Guard HMAC par module + mapping user-id chiffré | Durée de vie user | Oui (cascade FK) |
| `user_preferences` | Settings UI chiffrés | Durée de vie user | Oui (cascade FK) |
| `entries_*` (par module) | Contenu E2EE + AAD | Durée de vie user, ou jusqu'à suppression de l'entrée | Oui (cascade FK) |

### Droit à l'effacement (RGPD art. 17)

`DELETE /auth/me` (route dans `packages/api/src/routes/auth-account.ts`) supprime la ligne `users` avec `requireFreshPassword`. **Toutes les autres tables cascadent en FK sur `user_id`**, donc un seul DELETE wipe l'arbre complet atomiquement. La route n'émet pas d'email et ne pose pas de ligne d'audit côté user — l'utilisateur·ice disparaît complètement, par design.

Côté opérateur, la suppression apparaît dans les logs du prochain cron en delta `{ users: N, sessions: M }`. Pas de soft-delete, pas de récupération — une fois la ligne partie, les blobs chiffrés deviennent du bruit mathématique (la KEK et la clé maîtresse dérivées du password ne sont jamais persistées ailleurs que comme wraps gatés par le password proof).

### Droit à la portabilité (RGPD art. 20)

La vue `Account` expose un export par module qui télécharge le JSON déchiffré de toutes les entrées de l'utilisateur·ice. Le déchiffrement se fait côté client ; le serveur ne voit jamais le clair. Ça satisfait la portabilité sans affaiblir le modèle E2EE.

### Logs serveur

`hono/logger()` écrit une ligne par requête HTTP sur stdout — method, path, status, duration. **Pas de body, pas de headers, pas de cookies, pas de session id.** Les en-têtes `X-Sid` / `X-Guard` restent hors des access logs par construction (en-têtes, pas query-strings).

En production, stdout est capturé par le runtime container. Responsabilité opérateur : configurer la rétention des logs au niveau runtime (`docker logs --max-size`, journald, etc.). Recommandation : **rotation à 7 jours**, jamais d'archivage offsite des logs bruts.

### Télémétrie Sentry

Quand `VITE_SENTRY_DSN` / `SENTRY_DSN` sont définis, le SDK envoie les events d'erreur à Sentry. Le hook `beforeSend` (`packages/api/src/sentry.ts`, `packages/web/src/sentry.ts`) strip cookies, query-strings, request bodies, headers et `event.user` avant transmission. Ce qui atteint Sentry : la stack trace, la route, le code de statut. Aucune donnée personnelle, aucun contenu E2E.

### Ce qui n'est PAS purgé automatiquement (gaps connus)

Les lignes suivantes accumulent dans le temps et sont gardées pour audit :

- `mfa_bypass_requests` après `consumed_at` / `cancelled_at`
- `password_reset_tokens` après `consumed_at`
- `email_verifications` autres que `register`

Pour une rétention plus serrée, étendre `packages/api/src/cron/index.ts` avec des delete-where passé une fenêtre d'audit choisie (ex. 90 jours). Choix laissé à l'opérateur — la valeur d'audit de ces lignes n'est pas nulle, et les volumes restent minuscules en V1.

## Audit & divulgation

### Auditer

Le code est public et chaque commit est signé. La suite de tests est exécutable localement contre un Postgres réel :

```sh
git clone https://github.com/aliceout/Nodea
pnpm install
pnpm --filter @nodea/api test       # 222 tests d'intégration
pnpm --filter @nodea/web test       # 83 tests unitaires (crypto round-trips, HKDF, factor-wrap, guards, passkey-PRF unwrap, base64, store, HTTP client)
pnpm --filter @nodea/e2e test       # Playwright : register / activate / TOTP enroll + login
```

Les tests crypto vérifient les invariants (round-trip AES-GCM, déterminisme HKDF, séparation de domaine AES vs. HMAC, consistance d'AAD, anti-enum dans OPAQUE) en isolation des routes — auditables sans environnement complet.

### Documentation technique de référence

Tout le détail vit dans le repo, mis à jour avec le code — règle de projet : doc et code sont une seule source de vérité, dans le même PR.

- [Auth-Spec.md](https://github.com/aliceout/Nodea/blob/main/docs/Auth-Spec.md) — spécification auth complète, ~2700 lignes : threat model formel, schéma cryptographique détaillé, flows complets, matrice de re-auth, anti-patterns interdits, test matrix.
- [Architecture.md](https://github.com/aliceout/Nodea/blob/main/docs/Architecture.md) — vue d'ensemble du code (api / web / shared), routes, runtime, stack frontend.
- [Database.md](https://github.com/aliceout/Nodea/blob/main/docs/Database.md) — schéma Postgres complet, FK cascades, AAD pour chaque blob chiffré.

### Contribuer

Issues étiquetées dans [le tracker GitHub](https://github.com/aliceout/Nodea/issues). Les règles dures du projet (crypto, monorepo, conventions) vivent à la racine du repo.

### Signaler une vulnérabilité

Ouvre une issue **non publique** via [GitHub Security Advisories](https://github.com/aliceout/Nodea/security/advisories). La coordination de divulgation passe par là — pas par une issue normale. Pas de bug bounty formel à ce jour.
