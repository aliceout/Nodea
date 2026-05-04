# Login (password-first, passkey-first) + finalisation stepped MFA

> Flow extrait de `docs/Auth-Spec.md §7` lors du split. Voir
> [`Auth-Spec.md`](../Auth-Spec.md) pour le threat model, les
> primitives, les sessions, les middlewares, et les autres flows.

---

## 7.2 Login password-first

```
Client                                Server
   │                                     │
   │  client.startLogin(password)        │
   │   → { clientLoginState, KE1 }       │
   │                                     │
   │  POST /auth/login/start             │
   │  { email, startLoginRequest: KE1 }  │
   │────────────────────────────────────▶│
   │                                     │  load opaque_records by email
   │                                     │  (null when unknown — anti-enum)
   │                                     │  server.startLogin → KE2 + state
   │                                     │  storeLoginState(state) → token
   │  { loginResponse: KE2, loginToken } │
   │◀────────────────────────────────────│
   │                                     │
   │  client.finishLogin(password,       │
   │    clientLoginState, KE2)           │
   │   → { finishLoginRequest: KE3,      │
   │       sessionKey, exportKey }       │
   │  (undefined on wrong password / fake KE2 — anti-enum)
   │                                     │
   │  POST /auth/login/finish            │
   │  { loginToken, finishLoginRequest } │
   │────────────────────────────────────▶│
   │                                     │  consumeLoginState(token) → state
   │                                     │  server.finishLogin verifies KE3
   │                                     │  load user by userIdentifier
   │                                     │  (refuses 403 if not activated)
   │                                     │  createSession + setSessionCookie
   │  { id }   + Set-Cookie: nodea_session
   │◀────────────────────────────────────│
   │                                     │
   │  GET /auth/me/crypto                │
   │       → wrappedKekPassword,         │
   │         wrappedMainKey, …           │
   │  (lean GET /auth/me hit pour le     │
   │   reste du profil, API-14 split)    │
   │                                     │
   │  unwrapKekUnderFactor(exportKey)    │
   │   → KEK                             │
   │  unwrapMainKeyUnderKek(KEK)         │
   │   → mainKey                         │
   │  deriveMainKeys(mainKey)            │
   │   → aesKey + hmacKey                │
```

## 7.3 Login passkey-first

```
Client                                Server
   │                                     │
   │  POST /auth/passkeys/login/start     │
   │  { email? }   (email optionnel —    │
   │               WebAuthn supporte le  │
   │               flow "discoverable")  │
   │────────────────────────────────────▶│
   │                                     │  charge auth_factors
   │                                     │  génère challenge
   │  { challenge, allowCredentials }    │
   │◀────────────────────────────────────│
   │                                     │
   │  navigator.credentials.get(...)     │
   │  avec PRF eval input fixe           │
   │  → assertion + prf_output           │
   │                                     │
   │  POST /auth/passkeys/login/finish    │
   │  { credential_id, signature, ... }  │
   │────────────────────────────────────▶│
   │                                     │  vérifie signature
   │                                     │  bump sign_count
   │                                     │  émet mfa_pending
   │                                     │   - mfa_passkey_verified=true
   │  { needs_mfa, user_id }             │
   │◀────────────────────────────────────│
   │                                     │
   │  client : si prf_supported          │
   │     dérive wk_passkey               │
   │     unwrap wrapped_kek de la cred   │
   │     unwrap main_key                 │
   │                                     │
   │  client : si non-PRF                │
   │     ÉCHEC unwrap KEK                │
   │     ─▶ écran "Cette passkey ne     │
   │         peut pas déchiffrer tes    │
   │         données. Saisis ton mot de │
   │         passe pour finaliser."     │
   │     ─▶ fallback /auth/login/start  │
   │         (la session reste          │
   │          mfa_pending, le password  │
   │          re-auth ajoute            │
   │          mfa_password_verified)    │
   │                                     │
   │  Si mode = password_or_passkey :    │
   │     POST /auth/mfa/finalize         │
   │  Si mode = always_totp/maximum :    │
   │     ... TOTP, et password si max ...│
```

**PRF input** : on utilise un input fixe `"nodea:prf-v1"` (32 bytes,
zero-padded) côté client pour que le `prf_output` soit déterministe
pour une credential donnée, indépendamment du challenge WebAuthn
(qui change à chaque login).

## 7.4 Stepped MFA — finalisation

### Réutilisation des endpoints de login pour ajouter un facteur

Quand le mode courant requiert plusieurs facteurs et que l'entrée
s'est faite par un seul (par exemple : passkey-first en mode
`maximum` → la session pending a `mfa_passkey_verified=true` mais
manque `mfa_password_verified`), le client appelle à nouveau
**les mêmes endpoints de login** pour compléter :

- Pour ajouter une vérif password : `POST /auth/login/start` puis
  `/auth/login/finish` avec le cookie `__Host-nodea_mfa` actif. Le
  serveur détecte la session pending (au lieu d'en créer une
  nouvelle) et bump `mfa_password_verified=true`.
- Pour ajouter une vérif passkey : `POST /auth/passkeys/login/start`
  puis `/finish`. Bump `mfa_passkey_verified=true`.
- Pour ajouter une vérif TOTP : `POST /auth/mfa/totp/verify`. Bump
  `mfa_totp_verified=true`.

Aucun nouveau cookie n'est émis pendant ces étapes ; on travaille
sur la même `mfa_pending` jusqu'au `/auth/mfa/finalize`.

### Finalisation

`POST /auth/mfa/finalize`

**Serveur** :
1. Charge la session `mfa_pending` du cookie.
2. Calcule les facteurs requis depuis `users.security_mode` + chemin
   d'entrée :

   | mode | password-first | passkey-first |
   |---|---|---|
   | `password_or_passkey` | password | passkey |
   | `always_totp` | password + totp | passkey + totp |
   | `maximum` | password + passkey + totp | passkey + password + totp |

3. Vérifie tous requis dans la colonne `mfa_*_verified`. Si un
   manque → 400 `{ missing: [...] }`.
4. Transaction :
   - DELETE la session mfa_pending.
   - INSERT session full, populate `reauth_password_at` /
     `reauth_passkey_at` selon ce qui a été fait dans le pending.
   - Émet `__Host-nodea_session`.
5. Réponse `200 { user, ...some pubic info }`.

