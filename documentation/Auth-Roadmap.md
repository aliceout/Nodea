# Auth-Roadmap — OPAQUE + Passkey + TOTP + Email + Recovery

> **Contexte.** Ce document acte les décisions prises lors de la revue
> de sécurité (cf. discussion archivée). Il décrit le plan d'exécution
> pour passer de l'auth actuelle (Argon2id direct + KEK dérivée du mot
> de passe) à un modèle complet : OPAQUE pour le password, WebAuthn +
> PRF pour les passkeys, TOTP pour le gating de session, recovery code
> KEK, vérification email, parcours d'inscription.
>
> La spécification technique détaillée (threat model, schéma DB, AAD,
> labels HKDF, matrices…) vit dans `Auth-Spec.md`.
>
> ## État au {{2026-04-27}}
>
> **Phases livrées** : 0 (spec), 1 (register simplifié), 2A-2D
> (OPAQUE migration), 3 (recovery code BIP39), 4 (passkey WebAuthn
> + PRF), 5A-5D (TOTP + stepped MFA + security mode UI),
> 6 (bypass MFA email 7 jours), **7A (foundation re-auth :
> middlewares + endpoints + timestamps)**. En cours : 7B (câblage
> de la matrice sur les routes mutantes) puis 7C-D.
>
> **Phase 1 — ✅ livrée**, mais **simplifiée par rapport au design
> initial** :
> - Inscription en un seul formulaire (email + password) au lieu du
>   wizard 7-étapes (TOTP / passkey / recovery code retirés du flow
>   d'inscription, à proposer post-activation — issue
>   [#42](https://github.com/aliceout/Nodea/issues/42)).
> - Invitations basculées sur du email-bound (admin → e-mail → lien
>   `/register?invite=<token>`, Bitwarden-style) plutôt que des codes
>   à copier-coller.
> - Toggle admin `open_registration` ajouté pour basculer entre
>   invitation-only et signup libre.
> - Crypto reste sur le modèle legacy (Argon2id direct + KEK
>   dérivée du password) ; OPAQUE arrive en Phase 2.
>
> **Phase 2 (OPAQUE) et au-delà — pas démarré**. Les sections
> ci-dessous décrivent toujours le plan original ; il sera adapté
> phase par phase pour s'inscrire dans le register simplifié plutôt
> que de réintroduire le wizard.

---

## Décisions structurantes (rappel)

Tranchées dans la discussion, à figer dans `Auth-Spec.md` :

1. **TOTP = gate de session, pas crypto.** Le secret TOTP est en clair
   serveur (sinon vérification impossible). TOTP n'apparaît jamais
   dans la dérivation de la KEK. Conséquence honnête à documenter :
   un opérateur serveur qui aurait le password OPAQUE peut bypass le
   TOTP côté serveur. Mode "Sécurité maximale" = gate UX, pas Shamir
   split (option a).
2. **OPAQUE identifiant = email.** Changer l'email → re-register
   OPAQUE complet + re-vérification email. Documenté.
3. **Passkey UV `'required'`.** Toute passkey sans gesture
   (PIN, biométrie, unlock du gestionnaire) est refusée à
   l'enrollment. Yubikey sans PIN configuré → le navigateur
   propose le setup PIN, sinon enrollment bloqué. Authenticators
   logiciels (Bitwarden / iCloud / 1Password / Google PM) →
   acceptés (UV automatique). TouchID / FaceID / Windows Hello → OK.
4. **Recovery code KEK** : généré à l'inscription, affiché une seule
   fois, perpétuel jusqu'à régénération. Pas d'endpoint serveur de
   reveal.
5. **Backup codes TOTP** : systématiques à l'enrollment (10 codes,
   ~130 bits, SHA-256, single-use). Acknowledgement obligatoire.
6. **Bypass d'un facteur MFA par email** (TOTP **ou** passkey,
   mécanisme unifié) : 7 jours de délai après confirmation, un seul
   actif à la fois (toutes factors confondues). Force
   re-enrollment du facteur perdu au login suivant. **Dépend** de
   la vérification email à l'inscription. **Refusé si plusieurs
   facteurs MFA sont simultanément non-vérifiables** (politique
   "perdu 2 trucs = niqué" → reset destructif uniquement).
7. **Multi-session** : email seul (pas de bannière in-app pour V1).
8. **Reset destructif** existant conservé en filet de dernier recours
   (perte de password ET passkey ET recovery code = perte de données,
   l'utilisateur·ice est prévenu·e).
9. **Matrice de re-auth** :

| Opération                                | Re-auth fraîche (< 5 min)                         |
| ---------------------------------------- | ------------------------------------------------- |
| Changer mode de sécurité                 | password                                          |
| Ajouter / retirer une passkey            | password                                          |
| Activer / désactiver TOTP                | password                                          |
| Régénérer backup codes TOTP              | password                                          |
| Régénérer recovery code KEK              | password                                          |
| Changer le password                      | password **OU** passkey                           |
| Supprimer un compte                      | password **ET** (passkey ou TOTP si activés)      |
| Reveal recovery code (si applicable)     | password                                          |

10. **Ordre des facteurs** = ordre du bouton de connexion cliqué
    (entrée passkey-first ou password-first). Enforced server-side
    selon `security_mode` + chemin d'entrée.

---

## Hors scope (décisions négatives)

- **Shamir 2-of-2 OPAQUE/PRF.** Trop complexe, casse la récupération.
- **TOTP-protected KEK.** Inversion logique, impossible.
- **Reset par email.** Le destructif existant suffit.
- **Push notifications multi-session.** Email-only en V1.
- **In-app banner pour bypass TOTP en cours.** Reporté.

---

## Phases

### Phase 0 — Spec + dépendances (✅ livrée)

**Livrables**
- `documentation/Auth-Spec.md` (un seul gros fichier) :
  threat model, flows complets, schéma DB, AAD/HKDF/algos, matrice de
  re-auth, pièges TOTP/passkey, ordre des facteurs. ✅ **Rédigée**.
- Mise à jour `Security.md` §2 : marquer le flow Argon2id direct
  comme legacy, pointer vers Auth-Spec.md.
- **Libs choisies** (versions pinnées, audit/justification dans la PR) :
  - OPAQUE : **`@serenity-kit/opaque`** (Rust + WASM, audit Cure53,
    suite Ristretto255-SHA512-Argon2id).
  - WebAuthn : API native navigateur + helper serveur minimal
    (typiquement `@simplewebauthn/server` à valider en PR).
  - TOTP : lib RFC 6238 légère (`otplib` ou équivalent à valider).
  - BIP39 : pour le recovery code KEK (12 mots, 128 bits d'entropie + 4 bits de checksum, wordlist anglaise standard).
- **Variables d'env** documentées (cf. Auth-Spec §13.1) :
  `WEBAUTHN_RP_ID` (défaut `nodea.app`), `WEBAUTHN_RP_NAME`,
  `WEBAUTHN_ORIGIN`, `OPAQUE_SERVER_SETUP`, `COOKIE_SECRET`,
  `SMTP_*` (Infomaniak via Infisical), `EMAIL_SERVICE_IMPL`,
  `RATE_LIMIT_DRIVER` (V1 = `memory`).
- **Aucune URL/domaine hardcodé** dans le code. Tout configurable
  via env vars sourcées d'Infisical au déploiement.
- Migration Drizzle draft : `users` (extended), `opaque_records`,
  `auth_factors`, `mfa_totp`, `mfa_totp_recovery_codes`,
  `mfa_bypass_requests` (avec `factor` enum), `email_verifications`,
  `sessions` (kind + reauth tracking). Pas de code applicatif.

**Critère de sortie** : la spec est mergée et la migration draft
review-able. Aucun code d'auth modifié.

---

### Phase 1 — Inscription + activation (✅ livrée, simplifiée)

> **Divergence assumée vs design initial.** Phase 1 a été livrée
> en 5 commits successifs (cf. `git log --grep="feat(auth):"`).
> Le wizard 7-étapes du plan original a été remplacé par un
> single-form + magic-link activation après une revue UX qui a
> jugé l'expérience initiale trop lourde pour des non-tech.
> Détails dans `Auth-Spec.md` §7.1. Les facteurs additionnels
> (TOTP, passkey, recovery code BIP39) ne sont **pas** dans le
> register V1 — ils arrivent en Phase 2+ via des écrans Settings
> dédiés.
>
> Changements significatifs vs ce qui suit :
> - Pas de cookie `__Host-nodea_register` (single-form, pas de
>   wizard).
> - Pas de wizard cookie 24h, pas de `register_state` multi-valeur.
> - Invitations basculées sur du email-bound (table `invites` a
>   gagné une colonne `email`, pas de codes en clair).
> - Toggle `open_registration` ajouté (table `app_settings`).
> - Username obligatoire au register (`UsernameField`, présenté
>   comme "prénom ou pseudo"). **Pas d'unicité** — display name
>   pur, doublons autorisés (cf. migration `0010`).
>
> Le détail du flow livré est dans `Auth-Spec.md` §7.1. Les
> sections suivantes (Phase 2+) restent en l'état comme cible.

### Phase 1 (design initial — non livré tel quel)

**Pourquoi maintenant** : dépendance dure pour la Phase 6 (bypass
TOTP par email) et pour le parcours multi-étapes (cookie de reprise).

**Livrables**
- Étape 1 du register : email + invite code → `users` en
  `pre_register`, code 6 chiffres (TTL 10 min), stocké hashé.
- Service `EmailService` pluggable. Trois impls (cf. Auth-Spec §10) :
  - `smtp` : **défaut dev** pointant **Mailpit** (déjà câblé dans
    `docker-compose.yml` profile `dev`, UI web sur
    http://localhost:8025) **et** prod (nodemailer + SMTP Infomaniak,
    credentials via `SMTP_*` env vars sourcées d'Infisical).
  - `recording` : tests Vitest (en mémoire, no I/O).
  - `console` : fallback dev quand on lance `pnpm dev` sans Docker
    (donc sans Mailpit). Pas le défaut.
- Sélection d'impl via `EMAIL_SERVICE_IMPL`.
- Étape 2 : code saisi → `email_verified`, émission d'un cookie
  court `registration_incomplete` (24h, scope `/auth/register/*`).
- Reprise transparente : cookie survit à la fermeture du navigateur,
  l'utilisateur·ice retombe sur la bonne étape.
- Rate-limit sur la demande de code (par email + par IP, in-process
  RAM en V1).
- Parcours UX pédagogique : écran "Continue ton inscription" si on
  revient sur le site avec le cookie actif.

**Critère de sortie** : créer un compte jusqu'à `email_verified`
fonctionne en dev (code en console). Câblage SMTP Infomaniak vérifié
en staging avant Phase 6 (qui en dépend).

---

### Phase 2 — OPAQUE migration

**Pourquoi maintenant** : OPAQUE change le verbe `password` partout.
À faire avant passkey/TOTP pour éviter de refaire la danse.

**Statut** : 2A ✅ livrée (scaffolding lib + wrappers + helpers
HKDF + tests in-memory). 2B ✅ livrée (register OPAQUE 2-step
remplace l'Argon2id ; legacy columns rendues nullable). 2C ✅
livrée (login OPAQUE 2-step, dummy-hash dégagé, /me expose les
blobs OPAQUE, helper de test `loginAs` factorisé). 2D ✅ livrée
(change-password / reset-password en 2-step OPAQUE,
change-email / delete-self utilisent un proof OPAQUE, colonnes
legacy droppées, seed admin + seed-mood portés sur OPAQUE,
fichiers legacy `password.ts` / `password-policy.ts` /
`envelope.ts` / `argon2.ts` supprimés, deps `@node-rs/argon2`
+ `@zxcvbn-ts/*` retirées de l'api).

**Sous-découpage exécuté**

- **2A** — `@serenity-kit/opaque@1.1.0` installé, env var
  `OPAQUE_SERVER_SETUP`, wrappers serveur + client, helpers HKDF
  `nodea:wrap-kek` / `nodea:wrap-main`, schémas Zod pour les 4
  endpoints, tests round-trip in-memory.
- **2B** — `POST /auth/register/start` + `POST /auth/register/finish`
  remplacent le single-step Argon2id. Migration `0009_milky_brother_voodoo`
  rend `password_hash` / `encryption_salt` / `encrypted_key` nullables.
  Côté client : `submitRegistration` génère KEK + main key,
  fait l'OPAQUE handshake, wrappe les deux couches sous l'AAD
  `nodea:v1\x1f<userId>\x1f<tag>`, poste `/finish`. Login,
  change-password et delete-self refusent les comptes OPAQUE-
  registered avec un message clair (cf. 2C / 2D pour le rewire).

**Phase 2C livrée**
- `POST /auth/login/start` + `/finish` (OPAQUE KE1/KE2/KE3) avec
  un store in-memory pour le `serverLoginState` (token base64url
  256 bits, single-use, 5 min TTL — `auth/opaque-login-state.ts`).
- Anti-enum natif via `server.startLogin(registrationRecord: null)`
  pour les emails inconnus → réponse syntactiquement valide mais
  cryptographiquement morte que `client.finishLogin` rejette.
- Suppression du dummy-hash + de toute la route legacy
  `POST /auth/login` ; `LoginBodySchema` reste dans shared comme
  type pour le client mais n'est plus consommé par aucune route.
- `/auth/me` expose `wrappedMainKey{,Iv}` + `wrappedKekPassword{,Iv}`
  côté client. Le frontend pickle l'un ou l'autre chemin de unwrap
  selon ce qui est non-NULL (legacy Argon2id encore là pour les
  comptes seedés pré-2B, OPAQUE pour les nouveaux).
- Test infra : helper `loginAs(app, email, password)` partagé qui
  drive l'OPAQUE 2-step ; `seedAdmin` / `seedUser` populent
  désormais les deux jeux de blobs (legacy + OPAQUE) pour que les
  tests change-password / change-email / delete-self qui passent
  par `verifyPassword` continuent de tourner jusqu'à 2D.
- Nouveau fichier de tests `auth-login-v2.test.ts` (6 cas) couvrant
  /start, /finish, anti-enum, replay du token, gate d'activation.

**Phase 2D livrée**
- `POST /auth/change-password/start` + `/finish` (Auth-Spec §7.5
  réécrit, store in-memory `auth/opaque-pending-state.ts`). Le
  client prouve le password courant via `/auth/login/start` (proof
  body shared `OpaquePasswordProofSchema`), unwrappe la KEK,
  fait une OPAQUE registration avec le nouveau password, re-wrappe
  la même KEK sous le nouveau exportKey, puis poste à /finish.
  La main key reste inchangée → tout le ciphertext existant
  reste lisible.
- `POST /auth/reset/start` + `/finish` même pattern, avec
  destruction des données utilisateur dans la même transaction
  (puisque la main key est perdue avec le password oublié).
- `change-email` + `delete-self` passent au proof OPAQUE.
- Migration `0011_little_morg` drop `users.{password_hash,
  encryption_salt, encrypted_key}`.
- Helper partagé `auth/seed-crypto.ts` factorise les blobs
  OPAQUE pour `seed.ts` (admin), `seed-mood.ts` (data fixtures),
  `test/helpers.ts` (`seedAdmin` / `seedUser`).
- Fichiers legacy supprimés : `auth/password.ts`,
  `auth/password-policy.ts`, `web/core/crypto/envelope.ts`,
  `web/core/crypto/argon2.ts`. Deps Argon2id et zxcvbn retirées
  côté api (zxcvbn reste côté web pour le strength meter).
- Tests : 114 api / 62 web verts. Le reset rotation assert
  réintroduit (login OLD password rejeté, login NEW password
  accepté). delete-self / change-email / change-password
  exercent le proof body. Helper `passwordProofFor(app, email,
  password)` ajouté à `test/helpers.ts`.

**Pas de lazy migration** — décision dev (zéro user prod). Au
moment où 2C/2D drop le legacy, le seul user impacté est l'admin
seedé, qui se ré-enrôle via le seed OPAQUE.

**Tests obligatoires (Vitest)**
- Round-trip register → login → unwrap main key → ciphertext existant
  lisible (✅ Phase 2A pour le protocole nu, à compléter en 2C une
  fois le wire OPAQUE-login posé).
- Wrong password rejeté côté client via auth-tag AES-GCM (✅ 2A).
- Anti-enum sur identifiant inconnu (✅ 2A).
- Stale session rejetée après change-password (Phase 2D).

**Critère de sortie** : 100 % des nouveaux comptes en OPAQUE.
Pas de migration lazy : le legacy admin est ré-enrôlé via le seed
au passage 2D. La spec promet l'E2E même serveur compromis.

---

### Phase 3 — Recovery code KEK ✅ livrée

**Statut** : livrée. La saisie a lieu dans Settings (pas à l'inscription
— UX choice : l'utilisateur·ice opt-in une fois familier de l'app, on
n'overload pas le register flow). La sidebar warning rouge non-
dismissable apparaît tant que `recovery_code_hash IS NULL` côté `/me`.

**Routes livrées**
- `POST /auth/security/recovery-code` (auth) — setup + regenerate, body
  partagé `RecoveryCodeUpsertBodySchema`. Proof OPAQUE password
  toujours requis (le client en a déjà un sous la main pour
  re-dériver la KEK).
- `POST /auth/recover-kek/start` (anonyme) — anti-enum natif via
  blobs aléatoires + `userId` UUIDv4 frais pour les emails inconnus
  ou les comptes sans recovery code. Fold le OPAQUE register
  handshake : retourne `registrationResponse` aussi pour économiser
  un round-trip.
- `POST /auth/recover-kek/finish` (anonyme) — consomme la session,
  compare le hash en temps constant (`timingSafeEqual`), purge
  rien (la main key reste — c'est tout l'intérêt vs reset
  destructif), rotate `opaque_records.envelope` +
  `wrapped_kek_password{,_iv}` + `wrapped_kek_recovery{,_iv}` +
  `recovery_code_hash`, mint une session full.

**Frontend livré**
- `pages/RecoveryCode.tsx` (auth) — page dédiée pour setup +
  regenerate. Form → display 4×3 grid + Copier/Télécharger +
  acknowledgement requis avant "Terminé". Marketing panel
  cohérent avec le reste de la surface auth.
- `pages/Recover.tsx` (anonyme, route `/recover`) — flow complet :
  email + 12 mots + nouveau password (avec rules + zxcvbn +
  confirm). Sur succès, affichage du **nouveau** code BIP39 (le
  flow rotate aussi le recovery code) avec ack + redirect home.
- Settings → Security tab : SecuritySection "Code de récupération"
  positionnée après TOTP, avec `Configurer` (PrimaryButton, état
  initial) ou `Régénérer` (SecondaryButton) selon
  `user.recoveryCodeSet`.
- `RequestReset.tsx` : lien "Tu as un code de récupération ?
  Récupérer sans perdre tes données →" pointant vers `/recover`.
- `SidebarTipRecoveryCode` (kind=danger, non-dismissable) — affiché
  tant que `user.recoveryCodeSet === false`.

**Crypto livrée**
- Helper `web/core/crypto/bip39.ts` autour de `@scure/bip39@2.2.0`
  (audited, zero-dep). Wordlist anglaise canonique. Génération
  128 bits d'entropie + 4 bits checksum BIP39 = 12 mots.
- `factor-wrap.ts` réutilisé tel quel ; AAD =
  `nodea:v1\x1f<userId>\x1frecovery`. La KEK est wrappée sous
  `HKDF(entropy, "nodea:wrap-kek")` — même primitive que pour le
  password wrap, juste un IKM différent.
- `sha256Hex(entropy)` → `users.recovery_code_hash` (64 hex chars).

**Tests livrés**
- API : 12 nouveaux tests (`auth-recovery.test.ts`) — first-time
  setup, regenerate, bogus proof, unknown email anti-enum, hash
  mismatch, replayed `recoverSessionId`, happy path complet
  (login OLD password rejected → login NEW password accepted).
- Web : 12 nouveaux tests (`bip39.test.ts`) — round-trip,
  validation (mauvais nombre / mot inconnu / checksum),
  normalisation, splitMnemonicForDisplay, sha256Hex référence
  NIST.
- Total : 126 api (+12) / 74 web (+12).

---

### Phase 3 — Recovery code KEK (design original)

**Livrables**
- Étape 4 du register (post-OPAQUE) : recovery code au format
  **BIP39 12 mots** (128 bits d'entropie + 4 bits de checksum,
  wordlist anglaise standard). Le client calcule
  `recovery_code_hash = SHA-256(recovery_bytes)` et l'envoie au
  serveur en plus de `wrapped_kek_recovery` (anti-DoS du flow
  recover, cf. Auth-Spec §7.7).
- Affichage **une seule fois** (4×3 mots, lisible). Boutons
  "Copier" et "Télécharger en .txt". Checkbox "j'ai noté ce code"
  requise avant de continuer.
- Endpoint `/auth/recover-kek/start` + `/finish` : code saisi →
  validation BIP39 (wordlist + checksum) → unwrap KEK côté client
  → re-wrap sous nouveau password (force le change-password).
  Server valide `recovery_code_hash` (compare temps constant avec
  le hash stocké) avant d'accepter le nouveau envelope OPAQUE.
- Settings : régénérer le recovery code (re-auth password) →
  invalide l'ancien `wrapped_kek_recovery` + `recovery_code_hash`.
  Affiche la date de génération mais **jamais** le code.
- Pas de reveal serveur. Code perdu = pas de récupération via cette
  voie. L'utilisateur·ice est prévenu·e.

**Tests**
- Round-trip recovery code unwrap KEK + génération nouveau code.
- Recovery code avec checksum BIP39 invalide → rejet client (pas
  de hit serveur).
- `recovery_code_hash` KO côté serveur → 401, aucune mutation.
- Régénération invalide l'ancien blob et l'ancien hash.
- Reset destructif wipe `wrapped_kek_recovery` + `recovery_code_hash`.

**Critère de sortie** : un compte créé en Phase 1+2+3 a un chemin de
récupération viable hors password.

---

### Phase 4 — Passkey (WebAuthn + PRF) ✅ livrée

**Statut** : livrée. Enrollment uniquement depuis Settings (pas au
register — UX choice cohérent avec Phase 3 : on n'overload pas le
register flow). Sidebar tip ambre dismissable (`SidebarTipPasskey`,
kind=warning) tant que `passkeysCount === 0`.

**Routes livrées** (`packages/api/src/routes/auth-passkey.ts`)
- `POST /auth/passkey/enroll/start` (auth, password proof requis) —
  retourne `creationOptions` WebAuthn (UV `'required'`, attestation
  `'none'`, `excludeCredentials` peuplé pour anti-double-enrollment).
  Persiste le challenge sur `sessions.pending_webauthn_challenge`,
  TTL 5 min.
- `POST /auth/passkey/enroll/finish` (auth) — vérifie l'attestation
  via `@simplewebauthn/server`, exige `userVerified === true`, INSERT
  dans `auth_factors` avec `prf_supported` + `wrapped_kek{,_iv}`.
- `GET /auth/passkey/list` (auth) — liste les passkeys de l'user
  appelant uniquement, avec `prfCount` global.
- `PATCH /auth/passkey/:id/label` (auth, password proof) — renommer.
- `POST /auth/passkey/:id/remove` (auth, password proof) — supprimer
  + appliquer le downgrade auto §6.1 quand on retire la dernière
  passkey PRF-capable d'un user en mode `maximum`.
- `POST /auth/passkey/login/start` (anonyme) — anti-enum natif :
  email inconnu → options génériques sans `allowCredentials` (le
  browser tombe sur la sélection discoverable). Email connu →
  `allowCredentials` scopé aux credentials de l'user.
- `POST /auth/passkey/login/finish` (anonyme) — vérifie l'assertion,
  enforce UV server-side (Auth-Spec §9.3), bump `signCount` +
  `lastUsedAt`, mint une session full, retourne les blobs `wrappedKek`
  / `wrappedMainKey` pour que le client finisse l'unwrap localement.

**Frontend livré**
- `pages/Passkeys.tsx` (auth, route `/passkeys`) — list + add +
  rename + remove. Trois sub-stages dans un seul fichier (`list` /
  `add` / `remove` / `rename`). Marketing panel cohérent.
- `core/auth/passkey-flow.ts` — orchestrateur WebAuthn isolé du hook
  `useSession`. Drive `startRegistration` / `startAuthentication`,
  injecte le PRF eval input fixe (`PRF_INPUT_V1`), extrait
  `clientExtensionResults.prf.results.first` quand l'authenticator
  le surface, wrap KEK sous PRF output via `wrapKekUnderPrf`.
- `core/auth/use-session.ts` — gagne `enrollPasskey`,
  `loginWithPasskey`, `renamePasskey`, `removePasskey`. Le helper
  `issuePasswordProof` est mutualisé (rename / remove / enroll
  partagent le même round-trip OPAQUE).
- Login page : bouton « Se connecter avec une passkey » (visible
  seulement si le browser supporte `PublicKeyCredential`). Le bouton
  drive le flow passkey-first. Sur PRF complet → `/flow/home`. Sur
  non-PRF / PRF deferred → message clair invitant à compléter avec
  le mot de passe.
- Account → Sécurité tab : SecuritySection « Passkey » entre Mot de
  passe et 2FA. Affiche `Ajouter une passkey` (zéro enrôlée) ou
  `Gérer` (au moins une enrôlée).
- `SidebarTipPasskey` (kind=warning, ambre, dismissable via
  `localStorage["nodea:home:tip-passkey"]`) — affichée tant que
  `user.passkeysCount === 0`.

**Crypto livrée**
- `core/crypto/passkey-prf.ts` — `PRF_INPUT_V1` (32 bytes : ASCII
  `"nodea:prf-v1"` + 20 zero bytes), `wrapKekUnderPrf` /
  `unwrapKekUnderPrf` autour de `factor-wrap.ts` avec AAD =
  `nodea:v1\x1f<userId>\x1fpasskey\x1f<credentialIdB64Url>`.
- `factor-wrap.ts` gagne `buildPasskeyAAD(userId, credentialId)` —
  4-tuple format pour binder le wrap à la credential id (un swap
  serveur entre deux passkeys du même user fait échouer l'auth-tag).

**Variables d'env livrées**
- `WEBAUTHN_RP_ID` (défaut `localhost`).
- `WEBAUTHN_RP_NAME` (défaut `Nodea`).
- `WEBAUTHN_ORIGIN` (défaut `http://localhost:5173`).

**Tests livrés**
- API : 17 tests d'intégration (`auth-passkey.test.ts`) — passkey
  counts dans `/me`, gating de proof OPAQUE sur enroll-start,
  enroll-start retourne creationOptions avec UV required, list
  isole les credentials par user, rename / remove gating, downgrade
  auto §6.1 (PRF) + non-déclenchement (non-PRF), login-start
  anti-enum + scoped allowCredentials.
- Web : 9 tests crypto (`passkey-prf.test.ts`) — round-trip wrap,
  AAD format, binding cross-user / cross-credential, fresh IV,
  PRF input constant byte-by-byte.
- Total : 143 api (+17) / 92 web (+9). Le full WebAuthn-ceremony
  test (enroll/finish + login/finish avec virtual authenticator)
  est différé — il demande un fixture `@simplewebauthn/server`-
  compatible non encore en place.

**Calibration immédiate (post-enrollment)**

Beaucoup d'authenticators (Bitwarden / 1Password browser extension,
Chrome platform passkeys ≥ v123) signalent `prf.enabled: true` au
registration mais défèrent `prf.results.first` à la première
assertion. Pour qu'une passkey enrôlée à 100 % en PRF dès la
première seconde, l'orchestrateur déclenche une **assertion de
calibration locale** juste après `startRegistration` quand cette
condition se présente :

- Challenge généré client-side (32 bytes random).
- `allowCredentials` scopé à la credential qu'on vient de créer.
- L'assertion **n'est jamais soumise au serveur** — on consomme
  uniquement `clientExtensionResults.prf.results.first` pour wrapper
  la KEK, le reste est jeté.
- Si la calibration échoue (user cancel, NotAllowedError) → fallback
  login-only sans casser l'enrollment de la credential.

UX : un second prompt biométrique apparaît immédiatement après le
premier. Bitwarden / 1Password chaînent ça en <1 s sans demander à
l'user de confirmer deux fois (ils réutilisent le state d'unlock).
Pour les hardware keys (Yubikey), le second tap est explicite.

**Limitations connues**
- Le bouton "changer mon password via passkey" (matrice §6, row
  change-password) est conceptuellement supporté par le backend
  (la passkey unwrappe la KEK, qui suffit pour le change-password)
  mais le wire UI dédié atterrit en Phase 7 avec le reste de la
  matrice de re-auth.
- Le full WebAuthn-ceremony test (signature verifiée par
  `@simplewebauthn/server` avec un virtual authenticator) reste
  différé — les 17 tests d'intégration actuels couvrent le gating
  + downgrade auto + anti-enum sans exercer le path crypto signature.

---

### Phase 4 — Passkey (WebAuthn + PRF) — design original

**Livrables**
- Table `auth_factors` : credential id, public key, signature counter,
  transports, `prf_supported` boolean, `wrapped_kek` (NULL si non-PRF).
- Enrollment (Settings ou étape 5/6 d'onboarding, optionnel) :
  `userVerification: 'required'` à l'enrollment **et** à l'assertion.
  Yubikey sans PIN refusée par le navigateur ; Bitwarden / iCloud /
  1Password / Google PM / TouchID / FaceID / Windows Hello acceptés.
  rpId configurable via `WEBAUTHN_RP_ID` (défaut prod `nodea.app`).
- PRF-capable : `prf_output` → HKDF → `wrapped_kek_passkey` (un blob
  par credential). Plusieurs passkeys = plusieurs wraps indépendants.
- PRF input fixe versionné : `"nodea:prf-v1"` + zero-padding 32 bytes.
- Login passkey-first : unwrap KEK via PRF.
  Login password-first : unwrap KEK via OPAQUE.
  Les deux chemins atteignent la même KEK.
- Authenticators non-PRF : enregistrés comme login-only. Avertissement
  explicite à l'enrollment ("ce facteur ne peut pas, seul, déchiffrer
  tes données").
- Server enforce `authData.flags.uv === true` à chaque assertion.
- Add / remove passkey : re-auth password (matrice). Retrait de la
  dernière passkey en mode `maximum` → downgrade auto vers
  `password_or_passkey` + email (cf. Auth-Spec §6.1).
- Perte d'une passkey + password OK : aucun impact (les autres wraps
  restent valides).
- Bouton "changer mon password via passkey" disponible (matrice : le
  password est le seul facteur changeable via un facteur alternatif).

**Tests**
- Round-trip avec authenticator PRF-capable.
- Enrollment avec `authData.flags.uv = false` → refus serveur 400.
- Assertion login avec `authData.flags.uv = false` → refus 400.
- Plusieurs passkeys, retirer une seule préserve les autres.
- Non-PRF passkey ne bypasse pas l'unwrap password.
- Retirer la dernière passkey en mode max → downgrade auto + email.

**Critère de sortie** : un·e utilisateur·ice peut s'inscrire et se
connecter sans jamais retaper son password (passkey-first).

---

### Phase 5 — TOTP + backup codes + security mode ✅ livrée

**Statut** : livrée en quatre sous-phases (5A primitives, 5B
enrollment, 5C stepped MFA login, 5D security mode UI + passkey-as-
second-factor). 36 nouveaux tests (22 unit + 14 integration TOTP +
9 stepped + 9 security-mode + passkey 2nd factor à venir si on en
ajoute), couvrant gating de proof, anti-replay, single-use des
backup codes, downgrade auto, mfa_pending row state, finalize.

**Livrables**
- `otplib@13.4.0` + `qrcode@1.5.4` pinnés. Pas de hand-roll RFC 6238.
- Helpers crypto `auth/totp.ts` (TOTP_ALGO=sha1 / 6 / 30s, secret
  20 bytes, skew ±1 window) + `auth/totp-backup-codes.ts` (10 codes
  120 bits / 24 base32 chars, format 4-4-4-4-4-4 hyphenated,
  `normaliseBackupCode` + `hashBackupCode` + `constantTimeEqualHex`
  avec validation hex stricte).
- Routes (`packages/api/src/routes/auth-totp.ts`) :
  - `POST /auth/totp/enroll/start` (auth, password proof) — UPSERT
    `mfa_totp` avec `enabled_at: NULL`, génère 10 backup codes,
    retourne secret_base32 + otpauth_uri + backupCodes (one-shot).
  - `POST /auth/totp/enroll/verify` (auth) — vérifie le code TOTP,
    exige `backup_codes_acknowledged: true`, flippe `enabled_at`.
  - `POST /auth/totp/disable` (auth, password proof) — DELETE row
    + DELETE backup codes + §6.1 downgrade auto si mode
    `always_totp` / `maximum`.
  - `POST /auth/totp/backup-codes/regenerate` (auth, password proof)
    — refuse si TOTP pas activé, replace les 10 codes en transaction.
- Routes stepped MFA (`packages/api/src/routes/auth-mfa.ts`) :
  - `POST /auth/mfa/totp/verify` (mfa_pending) — accepte TOTP
    OU backup code dans `code`, anti-replay `lastWindow`, single-
    use sur les backup codes (`UPDATE … WHERE used_at IS NULL`),
    finalize automatique si tous les facteurs §6.1 sont satisfaits.
  - `POST /auth/mfa/passkey/start` + `/finish` (mfa_pending,
    Phase 5D) — passkey-as-second-factor pour mode `maximum`.
    Allow-credentials scopé à l'user (pas anti-enum, on est déjà
    authentifié), challenge persisté sur la pending session row,
    UV `'required'` enforcé. Finalize automatique aussi.
- Route `POST /auth/security-mode/change` (auth, password proof,
  Phase 5D) — valide les §6.1 prerequisites avant accept ; `400
  totp_required` / `400 passkey_required` quand manquant. Downgrade
  toujours OK (`password_or_passkey` n'a pas de prereq).
- Login routes étendus (`/auth/login/finish` + `/auth/passkey/login/
  finish`) : émettent `mfa_pending` au lieu de `full` selon le
  mode + le chemin d'entrée. Les blobs wrap sont inlinés dans la
  réponse (puisque `/auth/me` refuse les pending sessions).
- `OpaqueLoginFinishResponse` + `PasskeyLoginFinishResponse`
  étendus avec discriminator `needsMfa` + `factorsNeeded`.
- `requireMfaPending` middleware + `mfa-policy.ts` helper
  (matrice §7.4 entry × mode → required factors).
- `createSession` accepte `mfaFlags` + TTL `mfa_pending = 5 min`.
  `finalizeMfaSession` (DELETE pending + INSERT full atomiquement).
- Frontend :
  - Page `/totp` (TOTP setup avec QR + clé masquée + œil/copier +
    écran 2/2 backup codes + acknowledge + verify code 6 chiffres
    inline avec activation).
  - Page `/login/mfa` (TOTP/backup code form, passe à l'écran
    passkey si `factorsNeeded` contient `passkey`, fallback "session
    expirée → /login").
  - Settings → Sécurité tab : section "Mode de sécurité" en haut
    avec 3 cards (Standard / TOTP requis / Maximum), gates UI
    (cards greyed-out + helper line si prereqs manquants), inline
    password confirm form.
  - `useSession` gagne `startTotpEnrollment`, `verifyTotpEnrollment`,
    `disableTotp`, `regenerateTotpBackupCodes`, `verifyMfaTotp`,
    `verifyMfaPasskey`, `changeSecurityMode`.
  - SidebarTipTotp (warning amber, dismissable) tant que
    `totpEnabled === false`.
- `auth_factors` schema déjà en place depuis Phase 0 ; mfa_totp +
  mfa_totp_recovery_codes idem. Pas de nouvelle migration.

**Limitations connues**
- Mode `maximum` passkey-first → `factorsNeeded: ['password', 'totp']`.
  `password` comme 2e facteur n'est pas implémenté côté UI (route
  serveur non câblée non plus) — un user maximum qui se connecte
  via passkey-first reste bloqué sur l'écran MFA. Le cas réaliste
  est password-first → `['passkey', 'totp']` (passkey-first
  surtout pertinent quand mode = `password_or_passkey`).
- Bypass MFA par email (Phase 6) absent ; perte du téléphone en
  mode max = recovery destructif (Auth-Spec §7.9).

### Phase 5 — design original (archive)

**Livrables**
- Tables `mfa_totp` (secret 20 bytes, algo SHA1, digits 6, period 30,
  `last_window` anti-replay) et `mfa_totp_recovery_codes`.
- `users.security_mode` enum : `password_or_passkey` (défaut),
  `always_totp`, `maximum`.
- Enrollment : QR + base32 fallback. `otpauth://` label =
  `Nodea` seul (sans email ni user_id, anti-fuite via screenshots
  d'authenticator).
- 10 backup codes générés en même temps, ~130 bits chacun, SHA-256
  hashés, single-use. Affichés une seule fois. Acknowledgement
  obligatoire avant que le TOTP soit activé.
- **Règles d'activation des modes** (cf. Auth-Spec §6.1) :
  - `always_totp` : exige TOTP enabled.
  - `maximum` : exige TOTP enabled **ET** au moins une passkey
    PRF-capable enrôlée. UI bloque la sélection sinon.
- **Downgrade auto** vers `password_or_passkey` :
  - quand TOTP désactivé (depuis Settings ou via bypass) ;
  - quand la dernière passkey est retirée (en mode `maximum`).
  Email de notification systématique.
- Vérification : fenêtre ±1 (30s avant/après). `last_window` refuse
  toute window ≤ stockée.
- Cookie stepped MFA : `/auth/login/finish` ou
  `/auth/passkey/login/finish` émet `mfa_pending` (5 min, scope
  `/auth/mfa/*`). Promu en session **après** vérification de tous
  les facteurs requis selon `security_mode` + chemin d'entrée.
- Désactivation TOTP : re-auth password fraîche obligatoire (matrice).
  Interdit depuis une session protégée par le mode lui-même sans
  cette re-auth.

**Tests**
- Replay (même window) rejeté.
- Skew accepté à ±30s, rejeté à ±60s.
- Backup code usé une fois rejeté à la seconde.
- Mode `maximum` : facteur manquant → pas de session.
- Activer mode `maximum` sans TOTP enrôlé → 400 `totp_required`.
- Activer mode `maximum` sans passkey enrôlée → 400 `passkey_required`.
- Retirer la dernière passkey en mode `maximum` → downgrade auto +
  email.
- Désactiver TOTP en mode `always_totp` ou `maximum` → downgrade
  auto + email.
- Changement de mode requiert re-auth password (TOTP-only insuffisant).

**Critère de sortie** : trois modes choisissables, MFA réellement
appliquée selon le chemin d'entrée (passkey-first ou password-first).

---

### Phase 6 — Bypass d'un facteur MFA par email (TOTP **ou** passkey, 7 jours) ✅ livrée

**Statut** : livrée. Recovery path single-factor sans reset
destructif, sécurisé par 7 jours délai après confirmation email.

**Routes livrées** (`packages/api/src/routes/auth-mfa-bypass.ts`)
- `POST /auth/mfa/bypass/request` (mfa_pending) — éligibilité §6.2
  via `bypassEligibility`, génère token confirm + cancel (32 bytes
  base64url, hash SHA-256), INSERT request avec TTL 7j, envoie
  email. Response : `{ earliestApplyAt }`.
- `GET /auth/mfa/bypass/confirm?t=<token>` (anonyme) — flippe
  `confirmed_at`, démarre le délai 7 jours "réel". Retourne JSON
  discriminé par `status` (`ok` / `already_confirmed` /
  `cancelled` / `consumed` / `expired` / `unknown`). Le lien
  email pointe sur la SPA `${WEB_BASE_URL}/auth/bypass/confirm?t=…`,
  qui appelle l'API et rend une page stylée (même format que
  `/totp` / `/passkeys`) avec un compteur live `Jj HHh MMmin`
  jusqu'à `earliestApplyAt`.
- **Pas de lien email d'annulation** : l'auto-cancel-on-login fait
  qu'une simple reconnexion suffit à invalider une demande forgée
  par un attaquant. On évite ainsi de placer un lien « clique ici
  pour défuser » dans la boîte mail (surface phishing classique).

**Lazy application au login** (`auth/mfa-bypass.ts:applyConsumableBypass`)
- Appelée depuis `/auth/login/finish` ET `/auth/passkey/login/finish`
  AVANT le calcul des facteurs requis. Si une bypass confirmée
  passe son délai 7 jours : DELETE backup codes + reset
  `mfa_totp.enabled_at = NULL` (pour totp) OU DELETE toutes les
  passkeys (pour passkey). Downgrade auto `security_mode` →
  `password_or_passkey` selon §6.1. Marquer `consumed_at`. Revoke
  toutes les autres sessions de l'user. Email "récupération
  appliquée" (best-effort).
- Pas de cron — la consommation est triggered par l'auth, donc
  zéro infra background.

**Auto-cancel sur promotion en session full**
(`auth/mfa-bypass.ts:cancelPendingBypassesForUser`)
- Toute promotion en session `full` flippe `cancelled_at` sur
  chaque request pendante de l'user. Câblé sur les 5 chemins :
  `/auth/login/finish` (direct), `/auth/passkey/login/finish`
  (direct), `/auth/mfa/totp/verify` + `/auth/mfa/passkey/finish`
  (stepped finalize), et après le reset recovery code.
- Justification : un login complet réussi prouve que l'user
  contrôle toujours le facteur qu'il prétendait avoir perdu — la
  demande devient caduque. Bonus sécurité : un attaquant qui
  déclenche un bypass est défang dès que le user légitime se
  reconnecte.
- Conséquence UX : pas de surface "demande active" dans Settings
  — si l'user a une session full, c'est que la demande a déjà
  été annulée (ou consommée si 7 jours écoulées).

**§6.2 "perdu 2 trucs = niqué"** enforced par `bypassEligibility` :

| Mode | bypass `totp` autorisé si | bypass `passkey` autorisé si |
|---|---|---|
| `password_or_passkey` | N/A — 400 `factor_not_required` | idem |
| `always_totp` | password OR passkey verified | N/A |
| `maximum` | password ET passkey verified | password ET totp verified |

Échec → 409 `multi_factor_loss`. UI route vers `/request-reset`
(reset destructif).

**Frontend livré**
- `/login/mfa` — step TOTP avec deux sous-modes :
  - **Code TOTP** (default, input 6 chiffres uniquement) — le
    lien "j'ai perdu mon TOTP" switch vers le sous-mode backup.
  - **Code de secours** (input 24 chars hyphenated) — le lien
    "j'ai aussi perdu mes codes de secours" déclenche le flow
    bypass email. Lien retour "← Revenir au code TOTP".
  - Step passkey : bouton + lien "j'ai perdu ma passkey" qui
    déclenche directement le flow bypass.
  - Sur 409 multi_factor_loss → redirect auto vers `/request-reset`.
- `/auth/bypass/confirm?t=<token>` (`pages/BypassConfirm.tsx`) —
  page SPA stylée avec `AuthMarketingPanel` + countdown live
  `Jj HHh MMmin` (tick 1Hz, affichage à la minute). Branche par
  status JSON renvoyé par l'API. Pas de page bypass/cancel — le
  lien email correspondant n'existe pas.
- Pas de surface dans Settings : l'auto-cancel-on-login fait
  qu'une demande pendante ne peut pas coexister avec une session
  full, donc rien à afficher.
- `useSession.requestMfaBypass(factor)`.
- Email templates : `mfa-bypass.ts` (request avec **lien confirm
  uniquement** pointant sur la SPA) + `mfaBypassAppliedEmail`
  (notification post-consume).

**Limitations connues**
- Lien email confirm est en GET (state-changing) — convention
  email-link. Le token est le secret ; bot scanners (link
  preview) qui suivent le confirm flippent l'état. C'est un
  trade-off documenté ; le délai 7 jours donne au user le temps de
  cancel si nécessaire.
- Pas de bannière in-app pour les autres sessions actives —
  email-only par décision §7 (pas de push notification multi-
  session en V1).

**Tests** : 16 integration tests (`auth-mfa-bypass.test.ts`).
Couvre : request happy path + multi_factor_loss + bypass_already_active
+ factor_not_required + confirm/cancel via tokens + idempotent
re-confirm + cancel-then-confirm 410 + lazy application past 7 jours
+ pending/too-recent NOT consumed + GET active null/cancel 404.

**Total après Phase 6** : 213 api tests (+16), 83 web tests.

### Phase 6 — design original (archive)

**Dépend** de la Phase 1 (email vérifié), Phase 4 (passkey en place)
et Phase 5 (TOTP en place).

**Livrables**
- Table `mfa_bypass_requests` avec colonne `factor enum('totp','passkey')`
  + contrainte UNIQUE conditionnelle (un seul actif par user, toutes
  factors confondues).
- Flow unifié :
  1. Écran MFA bloqué → bouton "j'ai perdu mon TOTP" **ou**
     "j'ai perdu ma passkey" selon le facteur manquant.
  2. Server vérifie l'éligibilité (cf. Auth-Spec §6.2 / §7.8) :
     refuse si plusieurs facteurs MFA simultanément non-vérifiables
     → 409 `multi_factor_loss` → l'UI redirige vers reset destructif.
  3. Server crée la request, envoie email (template diffère selon
     factor) avec lien confirm + lien cancel.
  4. User confirme par email → `confirmed_at` set, compteur 7 jours
     démarre.
  5. À T+7 jours, prochain login OPAQUE skip le factor :
     - `totp` → `mfa_totp.enabled_at = NULL`, backup codes purgés.
     - `passkey` → toutes les `auth_factors kind='passkey'` deleted.
     - Si `security_mode = 'maximum'` → downgrade auto vers
       `password_or_passkey` + email de notification.
- Cancel à tout moment : lien email **ou** bouton dans une session
  active si elle existe.
- Nouvelle request invalide la précédente.
- Email-only pour les autres sessions actives (pas de bannière in-app).

**Tests**
- Confirm TOTP → 7 jours skip OK + downgrade auto si mode max.
- Confirm passkey → 7 jours skip OK + DELETE de toutes les passkeys.
- Cancel pendant la fenêtre invalide.
- Nouvelle request invalide l'ancienne (toutes factors confondues).
- Bypass passkey démarré pendant qu'un bypass TOTP est actif → 409.
- Multi-factor loss (passkey ET TOTP non vérifiés en mode max) →
  request bypass refusée 409 `multi_factor_loss`.
- Bypass force l'écran de re-enrollment au login suivant.

**Critère de sortie** : un·e user·ice ayant perdu TOTP **ou**
passkey (un seul facteur, l'autre encore OK) récupère son compte
en 7 jours. La perte simultanée de plusieurs facteurs MFA force le
reset destructif.

---

### Phase 7 — Matrice de re-auth + Settings UI

**Sous-phase 7A — Foundation re-auth (✅ livrée)**
- Wiring des timestamps `sessions.{reauth_password_at,
  reauth_passkey_at}` sur tous les chemins d'auth qui promeuvent
  vers `full` :
  - `/auth/login/finish` (direct full) → password
  - `/auth/passkey/login/finish` (direct full) → passkey
  - `/auth/mfa/totp/verify` finalize → propagation depuis
    `mfa_password_verified` du pending
  - `/auth/mfa/passkey/finish` finalize → propagation des deux
    flags du pending
  - `/auth/change-password/finish` (rotation full) → password
  - `/auth/recover-kek/finish` (reset destructif) → password
- Helpers `auth/session.ts` :
  - `createSession(opts.reauthFresh)` pose les timestamps à
    l'INSERT
  - `finalizeMfaSession()` lit les `mfa_*_verified` du pending et
    les propage en `reauth_*_at` sur la nouvelle full
  - `bumpSessionReauth(sessionId, factor)` met à jour un seul
    facteur à `now()`
  - `getSessionReauth(sessionId)` lit les deux timestamps
- Middlewares `middleware/require-fresh-reauth.ts` :
  - `requireFreshPassword` — 401 `{error:'reauth_required',
    reauth_required:'password'}` si timestamp > 5 min
  - `requireFreshPasswordOrPasskey` — accepte l'un OU l'autre,
    401 `reauth_required:'password_or_passkey'` sinon
- Routes dédiées `routes/auth-reauth.ts` :
  - `POST /auth/reauth/password/start` (OPAQUE) +
    `/finish` → bump password
  - `POST /auth/reauth/passkey/start` (WebAuthn) +
    `/finish` → bump passkey
  - Les deux requièrent `requireUser`. L'identifier OPAQUE est
    pris depuis la session, jamais depuis le body
    (anti-confused-deputy).
- 9 tests d'intégration (timestamps + middleware + endpoint
  password OPAQUE round-trip).

**Sous-phases 7B-D restantes (non livrées)**
- 7B — câblage de la matrice sur toutes les routes mutantes
  (mode, factors, codes, account deletion). Aujourd'hui plusieurs
  routes embarquent un `proofLoginToken` dans le body (Phase 5D
  MVP) ; 7B les migre vers le middleware + drop du helper
  `verifyPasswordProof` dupliqué dans chaque fichier.
- Settings UI :
  - Mode de sécurité (avec explication des trade-offs en clair).
    Sélection bloquée si les facteurs requis ne sont pas enrôlés
    (cf. Auth-Spec §6.1).
  - Liste des passkeys (add / remove). Avertissement si retrait de
    la dernière passkey en mode `maximum` (downgrade auto).
  - TOTP enroll / disable + régénérer backup codes.
  - Régénérer recovery code KEK (date de génération affichée,
    code jamais re-révélé).
  - Changement d'email (déclenche re-register OPAQUE complet +
    re-vérification email + cooldown 7 jours entre deux changes).
  - Sessions actives + révocation (logout other / logout all).
  - **Toggle inscription par invitation** (UI uniquement V1) :
    bascule visible mais inactive côté backend (l'invite reste
    requise). Le backend "ouvert sans invitation" sera implémenté
    plus tard dans une issue dédiée.
- Onboarding intégré : étape 5 (TOTP) et étape 6 (Passkey)
  proposées à l'étape 4. Si les deux sont skippées, on saute
  directement au modal d'onboarding existant.

**Tests**
- Scénario Playwright end-to-end : register → activate email →
  set password → save recovery code → enroll TOTP → enroll passkey
  → login → change mode → use bypass → re-enrollment TOTP.

**Critère de sortie** : Settings expose toutes les opérations
sensibles avec re-auth correcte. Pas de chemin caché qui
contourne la matrice.

---

### Phase 8 — Cleanup + audit final

**Livrables**
- Drop `users.password_hash` (legacy) une fois la migration à 100%.
- Drop dummy-hash login timing.
- Mettre à jour `Security.md`, `Database.md`, `Architecture.md` :
  le nouveau flow est le **seul** flow.
- Re-cross-check `documentation/security-audit.md` : fermer les
  findings résolus, ouvrir ceux découverts en chemin.
- Audit deps OPAQUE / WebAuthn / TOTP : vendoring des références
  d'audit dans la PR finale.
- Page publique "Comment Nodea protège tes données" basée sur le
  threat model d'Auth-Spec.md (différer si pas le temps).

**Critère de sortie** : aucune référence à l'ancien flow Argon2id
direct dans la doc ou le code. Audit interne OK.

---

## Dépendances entre phases

```
Phase 0  ──► toutes les autres
Phase 1  ──► Phase 6
Phase 2  ──► Phase 3, Phase 4, Phase 5
Phase 3  ──► Phase 7 (Settings recovery)
Phase 4  ──► Phase 5 (mode max), Phase 6 (bypass passkey), Phase 7
Phase 5  ──► Phase 6 (bypass TOTP), Phase 7
Phase 6  ──► Phase 7 (Settings affiche les requests actives)
Phase 7  ──► Phase 8
```

Phases parallélisables une fois 0+1+2 livrées :
- 3 et 4 indépendantes l'une de l'autre.
- 5 nécessite 4 (pour le mode max strictement, mais le squelette
  TOTP peut commencer sans).

---

## Exit criteria global

Quand toutes les phases sont livrées, l'app garantit :

1. **E2E préservé** : main key jamais côté serveur, OPAQUE +
   PRF protègent la KEK même serveur compromis.
2. **Trois facteurs disponibles** : password (OPAQUE), passkey
   (WebAuthn + PRF si capable, UV `'required'`), TOTP (gate de session).
3. **Trois modes** : `password_or_passkey`, `always_totp`, `maximum`.
   Activation du mode max bloquée tant que TOTP + passkey ne sont
   pas tous deux enrôlés ; downgrade auto si un facteur est retiré.
4. **Quatre chemins de récupération** :
   - Recovery code KEK (BIP39) → unwrap + change-password forcé.
   - Email + 7 jours delay → bypass TOTP, force re-enrollment.
   - Email + 7 jours delay → bypass passkey, force re-enrollment.
   - Reset destructif → filet de dernier recours (perte de données).
   **Politique "perdu 2 trucs = niqué"** : aucun bypass MFA n'est
   offert si plusieurs facteurs sont simultanément non-vérifiables.
5. **Email vérifié** à l'inscription, identifiant OPAQUE = email
   (re-register OPAQUE sur changement d'email).
6. **Matrice de re-auth** appliquée partout, pas de chemin caché.
7. **Aucun secret hardcodé** : domaines, rpId, SMTP, tout via env
   vars sourcées d'Infisical (cf. Auth-Spec §13.1).
8. **Tests Vitest** sur tous les round-trips crypto, Playwright
   sur le scénario end-to-end.
9. **Documentation** alignée sur le code (règle fondamentale CLAUDE.md).
