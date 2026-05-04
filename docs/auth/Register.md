# Register — single-form + activation magic link

> Flow extrait de `docs/Auth-Spec.md §7` lors du split. Voir
> [`Auth-Spec.md`](../Auth-Spec.md) pour le threat model, les
> primitives, les sessions, les middlewares, et les autres flows.

---

## 7.1 Register — single-form + activation magic link

### Vue d'ensemble

Un seul formulaire (email + password) côté UI, deux chemins serveur
selon le mode :

```
┌─ Invitation par e-mail (recommandé) ──────────────────────────────┐
│                                                                   │
│ Admin → /admin/invites { email }                                  │
│      → server email lien `/register?invite=<token>`               │
│ User clique le lien → form pré-rempli (email read-only) → submit  │
│      → server crée le compte + active immédiatement (1 mail total)│
│      → redirect /login?activated=1                                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─ Open registration (toggle admin ON) ─────────────────────────────┐
│                                                                   │
│ User → /register sans token → form ouvert → submit                │
│      → server crée compte inactif + envoie mail d'activation      │
│ User clique le lien → /activate?token=<...> → flip activated      │
│      → redirect /login?activated=1                                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

┌─ Closed (toggle admin OFF, pas de lien) ──────────────────────────┐
│                                                                   │
│ User → /register sans token → page "Sur invitation" + lien login. │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

Aucun cookie de "register session" en V1 — la state survit
uniquement via le token dans l'URL d'invitation ou via la
verification row côté serveur.

### `POST /auth/register/start` + `POST /auth/register/finish` (OPAQUE 2-step, V1 ✅)

**Body** `/start`
```json
{
  "email": "alice@example.com",
  "registrationRequest": "<opaque-blob>",
  "inviteToken": "<base64url, optional>"
}
```

**Réponse** `/start`
```json
{
  "registrationResponse": "<opaque-blob>",
  "userId": "<uuid v4>"
}
```

`/start` est **stateless** — pas d'écriture DB, pas de consommation
d'invite, pas de DB row créé. Il pré-valide la voie (invite présente
+ match email, ou `open_registration` ON) pour fail fast, puis appelle
`server.createRegistrationResponse()` de `@serenity-kit/opaque` avec
`userIdentifier = email.toLowerCase()`. Le `userId` retourné est utilisé
par le client pour calculer les AAD bindings (`buildKekAAD(userId,
'password')` et `buildMainKeyAAD(userId)`) AVANT de poster `/finish`.

**Body** `/finish`
```json
{
  "email": "alice@example.com",
  "username": "Alice",
  "userId": "<uuid retourné par /start>",
  "registrationRecord": "<opaque envelope>",
  "wrappedMainKey": "<base64 AES-GCM>",
  "wrappedMainKeyIv": "<base64 IV>",
  "wrappedKekPassword": "<base64 AES-GCM>",
  "wrappedKekPasswordIv": "<base64 IV>",
  "inviteToken": "<base64url, optional>"
}
```

`username` est **obligatoire** au register — règles `UsernameField`
(2-32 chars, lettres/chiffres/`_`/`-`/`.`, accents OK). Présenté à
l'utilisateur comme "un prénom ou un pseudo". **Pas d'unicité** :
deux comptes peuvent porter le même display name (l'identifiant
réel reste `users.id` + `users.email` pour le login).

`registrationRecord` est l'envelope OPAQUE produit côté client par
`client.finishRegistration()`. Le serveur le persiste dans
`opaque_records.envelope` — il ne peut **pas** être utilisé pour
retrouver le password (c'est le tout l'intérêt d'OPAQUE).

`wrappedMainKey` / `wrappedKekPassword` sont les deux couches de wrap
côté client (cf. §3.2) :
- **Main key** (32 bytes random) wrappée sous KEK via HKDF label
  `nodea:wrap-main`, AAD = `nodea:v1\x1f<userId>\x1fmain`.
- **KEK** (32 bytes random) wrappée sous une clé HKDF dérivée de
  l'OPAQUE `exportKey` via label `nodea:wrap-kek`, AAD =
  `nodea:v1\x1f<userId>\x1fpassword`.

**Branches serveur** sur `/finish` :

1. **Invité** (`inviteToken` présent) :
   - `consumeInviteAndCreateUser(token, email, …)` :
     - Lookup `invites` par `code_hash`, sous `SELECT … FOR UPDATE`.
     - Refus si used / expired / unknown → 401 `invalid_token`.
     - Refus si `invites.email !== body.email` (strict match) → 400
       `email_mismatch`.
     - INSERT `users { id: userId, username,
       wrappedMainKey, wrappedMainKeyIv,
       wrappedKekPassword, wrappedKekPasswordIv,
       emailVerifiedAt: now(), registerState: 'complete' }`.
     - INSERT `opaque_records { user_id: userId, envelope:
       registrationRecord }`.
     - UPDATE `invites { usedBy, usedAt }`.
   - Réponse `200 { ok: true, activated: true, email }`. Aucun
     cookie émis — l'user retape son password à `/login`.

2. **Open registration** (pas de token, toggle ON) :
   - Vérifier `app_settings.open_registration === true` (défense en
     profondeur — `/start` l'a déjà checké).
   - Si `users` (actif OU inactif) existe déjà avec cet email →
     silent 200 (anti-enum). Le retry sur ligne inactive **n'est
     plus** une réutilisation parce que les AAD du nouveau
     `/start` userId divergent du précédent — l'email d'activation
     d'origine reste valide, l'admin peut renvoyer hors-bande.
   - Sinon : INSERT `users { id: userId, …,
     emailVerifiedAt: NULL }` + INSERT `opaque_records`, dans
     une transaction.
   - INSERT `email_verifications { kind: 'register', codeHash:
     SHA-256(token), expiresAt: now+7d }`.
   - Email "Active ton compte Nodea" via `EmailService.send`.
   - Réponse `200 { ok: true, activated: false }`.

3. **Closed** (pas de token, toggle OFF) :
   - 403 `registration_closed`. Le frontend gate ce cas en amont
     via `GET /register/mode` (voir ci-dessous).

**Argon2id côté Nodea** : aucun chemin de code n'utilise Argon2id
pour l'auth ; le seul Argon2id restant est celui que
`@serenity-kit/opaque` fait tourner en interne dans la suite
OPAQUE-3DH-RISTRETTO255-SHA512-Argon2id.

### `POST /auth/register/activate`

Cible du lien magique de l'open path. **Pas appelé par le path
invité** — l'invité est déjà activé au submit.

**Body** : `{ token: "<base64url>" }`.

Server :
1. `consumeEmailVerification('register', token)` — lookup +
   timing-safe compare + single-use consume.
2. UPDATE `users { emailVerifiedAt: now() }` WHERE id = verification.userId
   AND emailVerifiedAt IS NULL. Si pas matched → 401 `already_consumed`.
3. Réponse `200 { ok: true, email }`.

Erreurs spécifiques : `invalid_token` (401), `already_consumed`
(401), `expired` (410).

### `GET /auth/register/mode`

Public, sans rate-limit côté V1. Renvoie `{ openRegistration:
boolean }` lu depuis `app_settings`. Le frontend l'appelle au mount
de `/register` pour décider entre form ouvert vs page "Sur
invitation".

### `GET /auth/register/invite-info?token=…`

Public, rate-limit 30/h/IP. Renvoie `{ email, expiresAt }` quand
le token est valide + non consommé + non expiré ; 404 sinon.
Permet au frontend de pré-remplir l'email quand l'user arrive via
`/register?invite=…`.

### Activation gate sur `POST /auth/login`

Une fois le compte créé, le login refuse si
`users.email_verified_at IS NULL` :

```ts
if (user.emailVerifiedAt === null) {
  return c.json({ error: 'account_not_activated' }, 403);
}
```

UI surface une bannière "Ton compte n'est pas encore activé. Clique
sur le lien envoyé par e-mail pour l'activer." Légalement les
admins seedés bypassent (on les insère avec `emailVerifiedAt =
now()` dans `seed.ts`).

### Cleanup des comptes non-activés

Cron Monday 03:00 (cf. §13.2) :
- DELETE `email_verifications` `kind = 'register'` `expires_at < now()`.
- DELETE `users` où `emailVerifiedAt IS NULL` ET aucune
  `email_verifications` pending → la fenêtre 7 jours s'est écoulée.

### Trade-offs assumés en V1

- **Invitations multi-usage** : aucun lien strict invite → user. Une
  invite n'est ni linkée à un user au submit ni consommée à
  l'activation — la même invite peut servir à plusieurs registers.
  Tightening à invite single-use = ajouter une FK
  `users.invite_id` ; reporté post-V1.
- **Cooldown change-email contournable via reset destructif** : le
  reset destructif ne (ré-)arme pas `email_changed_at`, donc
  enchaîner reset + change-email immédiat est possible. Risque
  résiduel accepté V1 (cf. §2.2 #7).

---

