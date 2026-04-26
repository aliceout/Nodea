# Auth-Roadmap — OPAQUE + Passkey + TOTP + Email + Recovery

> **Contexte.** Ce document acte les décisions prises lors de la revue
> de sécurité (cf. discussion archivée). Il décrit le plan d'exécution
> pour passer de l'auth actuelle (Argon2id direct + KEK dérivée du mot
> de passe) à un modèle complet : OPAQUE pour le password, WebAuthn +
> PRF pour les passkeys, TOTP pour le gating de session, recovery code
> KEK, vérification email, parcours d'inscription multi-étapes.
>
> La spécification technique détaillée (threat model, schéma DB, AAD,
> labels HKDF, matrices…) vit dans `Auth-Spec.md` (à rédiger en
> Phase 0). Ce fichier-ci ne décrit **que** le plan d'exécution.

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
   mécanisme unifié) : 48h de délai après confirmation, un seul
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

### Phase 0 — Spec + dépendances (bloquant tout le reste)

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

### Phase 1 — Vérification email à l'inscription

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

**Livrables**
- Server : remplacer `password_hash` par `opaque_records.envelope`,
  clé sur `users.id` (UUID immuable, pas l'email).
- Étape 3 du register : OPAQUE registration côté client, dérivation
  KEK depuis `export_key` (HKDF label `nodea:kek`), main key aléatoire
  wrappée → `wrapped_kek`.
- Login : OPAQUE login → `export_key` → unwrap KEK → unwrap main key
  → chaîne `deriveMainKeys` existante inchangée.
- Change-password : re-registration OPAQUE, re-wrap KEK. La main key
  reste la même → tout le ciphertext existant reste lisible.
- Migration des comptes existants : lazy migration au prochain login
  avec password legacy. `password_hash` conservée le temps de la
  transition, droppée en Phase 8.
- Suppression du dummy-hash login timing trick (OPAQUE gère
  nativement les identifiants inconnus).

**Tests obligatoires (Vitest)**
- Round-trip register → login → unwrap main key → ciphertext existant
  lisible.
- Wrong password rejeté côté client via auth-tag AES-GCM.
- Stale session rejetée après change-password.
- Lazy migration : login legacy fonctionne pendant la transition.

**Critère de sortie** : 100% des nouveaux comptes en OPAQUE.
Anciens comptes migrés au fil des logins. La spec promet l'E2E même
serveur compromis.

---

### Phase 3 — Recovery code KEK

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

### Phase 4 — Passkey (WebAuthn + PRF)

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

### Phase 5 — TOTP + backup codes + security mode

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

### Phase 6 — Bypass d'un facteur MFA par email (TOTP **ou** passkey, 48h)

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
  4. User confirme par email → `confirmed_at` set, compteur 48h
     démarre.
  5. À T+48h, prochain login OPAQUE skip le factor :
     - `totp` → `mfa_totp.enabled_at = NULL`, backup codes purgés.
     - `passkey` → toutes les `auth_factors kind='passkey'` deleted.
     - Si `security_mode = 'maximum'` → downgrade auto vers
       `password_or_passkey` + email de notification.
- Cancel à tout moment : lien email **ou** bouton dans une session
  active si elle existe.
- Nouvelle request invalide la précédente.
- Email-only pour les autres sessions actives (pas de bannière in-app).

**Tests**
- Confirm TOTP → 48h skip OK + downgrade auto si mode max.
- Confirm passkey → 48h skip OK + DELETE de toutes les passkeys.
- Cancel pendant la fenêtre invalide.
- Nouvelle request invalide l'ancienne (toutes factors confondues).
- Bypass passkey démarré pendant qu'un bypass TOTP est actif → 409.
- Multi-factor loss (passkey ET TOTP non vérifiés en mode max) →
  request bypass refusée 409 `multi_factor_loss`.
- Bypass force l'écran de re-enrollment au login suivant.

**Critère de sortie** : un·e user·ice ayant perdu TOTP **ou**
passkey (un seul facteur, l'autre encore OK) récupère son compte
en 48h. La perte simultanée de plusieurs facteurs MFA force le
reset destructif.

---

### Phase 7 — Matrice de re-auth + Settings UI

**Livrables**
- Middlewares serveur :
  - `requireFreshPassword` (5 min)
  - `requireFreshPasswordOrPasskey` (5 min)
- Câblage de la matrice sur toutes les routes mutantes
  (mode, factors, codes, account deletion).
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
   - Email + 48h delay → bypass TOTP, force re-enrollment.
   - Email + 48h delay → bypass passkey, force re-enrollment.
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
