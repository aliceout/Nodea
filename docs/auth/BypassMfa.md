# Bypass d'un facteur MFA par email

> Flow extrait de `docs/Auth-Spec.md §7` lors du split. Voir
> [`Auth-Spec.md`](../Auth-Spec.md) pour le threat model, les
> primitives, les sessions, les middlewares, et les autres flows.

---

## 7.8 Bypass d'un facteur MFA par email

> Code : routes `packages/api/src/routes/auth-mfa-bypass.ts`,
> helpers `packages/api/src/auth/mfa-bypass.ts`, email templates
> `services/email/templates/mfa-bypass.ts`. UI sur `/login/mfa`
> (lost-factor links + inline confirm dialog) et Settings →
> Sécurité (active-bypass row + cancel button). Lazy application
> au login : `applyConsumableBypass` est appelé depuis
> `/auth/login/finish` ET `/auth/passkeys/login/finish` avant le
> calcul des facteurs requis. Pas de cron — la consommation est
> triggered par l'auth.

Mécanisme commun pour récupérer la perte d'un facteur MFA sans
casser l'E2E. Délai dur de 7 jours après confirmation par email, un
seul bypass actif à la fois (toutes factors confondues — un user en
cours de bypass passkey ne peut pas démarrer un bypass TOTP en
parallèle).

### Politique "perdu 2 trucs = niqué" (cf. §6.2)

Le bypass d'un facteur n'est offert que si **tous les autres
facteurs requis par le mode courant sont vérifiables**. Concrètement,
au moment du `POST /auth/mfa/bypass/request`, la session
`mfa_pending` doit déjà avoir :

| Mode | Bypass `totp` autorisé si | Bypass `passkey` autorisé si |
|---|---|---|
| `password_or_passkey` | N/A (TOTP non requis) | N/A (passkey alternative au password) |
| `always_totp` | `mfa_password_verified` OU `mfa_passkey_verified` | N/A (passkey non requise) |
| `maximum` | `mfa_password_verified` ET `mfa_passkey_verified` | `mfa_password_verified` ET `mfa_totp_verified` |

Si la condition n'est pas remplie → 409 `multi_factor_loss` →
l'UI redirige vers la page reset destructif.

### Démarrage

Sur l'écran `mfa_pending`, bouton conditionnel :
- "j'ai perdu mon TOTP" si TOTP requis ET non vérifié ET conditions OK ;
- "j'ai perdu ma passkey" si passkey requise ET non vérifiée ET conditions OK.

`POST /auth/mfa/bypass/request`

Body : `{ factor: 'totp' | 'passkey' }`.

Préconditions : session `mfa_pending` active. Conditions de §6.2
remplies.

Server :
1. Vérifie les éligibilités par mode (table ci-dessus).
2. Vérifie qu'aucune `mfa_bypass_requests` non-cancelled-non-consumed
   n'existe pour ce user (toutes factors confondues). Si oui → 409
   `bypass_already_active`.
3. Génère `confirm_token` (32 bytes random base64url). Hash SHA-256
   stocké. La colonne `cancel_token_hash` reste NOT NULL dans le
   schéma — on y écrit un hash placeholder (token jeté côté serveur)
   pour éviter une migration ; rien sur le réseau ne matchera jamais
   ce hash.
4. INSERT `mfa_bypass_requests { factor, expires_at: now+14j,
   confirm_token_hash, cancel_token_hash: <placeholder> }`. (TTL de
   la request = 14j pour laisser 7j de fenêtre de confirmation +
   7j de délai réel ; le délai "réel" de 7 jours commence à
   `confirmed_at`.)
5. Envoie email avec **un seul lien** (template diffère selon
   `factor`) :
   - `https://<rp_id>/auth/bypass/confirm?t=<confirm_token>` (SPA
     route, pas le `/api`).
6. Réponse `200 { earliestApplyAt: <ISO> }`.

### Confirmation par email

`GET /auth/mfa/bypass/confirm?t=<token>` retourne du JSON discriminé
par `status` ; le lien email pointe sur la SPA
(`/auth/bypass/confirm?t=…`) qui appelle l'API et rend la page.

Server :
1. Hash le token, charge la request.
2. Branche : `cancelled` / `consumed` / `expired` / `unknown` →
   status correspondant, HTTP 410 (ou 400/404 si token malformé /
   inconnu). Le SPA affiche le panneau d'erreur adéquat.
3. Si déjà confirmed → status `already_confirmed` + `factor` +
   `earliestApplyAt` (= `confirmed_at + 7 jours`).
4. Sinon : `confirmed_at = now()` puis status `ok` + `factor` +
   `earliestApplyAt` (= `now + 7 jours`). Le compteur 7 jours "réel"
   démarre ici (pas au request).

Le SPA rend une page au format `/totp` / `/passkeys` avec un
**countdown live `Jj HHh MMmin`** jusqu'à `earliestApplyAt` (tick
1 Hz, affichage à la minute pour éviter le bruit visuel ; les jours
disparaissent quand le reste passe sous 24h).

### Annulation

**Pas de lien email d'annulation**. Une demande pendante est
auto-annulée à la prochaine promotion en session `full`
(`cancelPendingBypassesForUser` câblé sur `/auth/login/finish`,
`/auth/passkeys/login/finish`, `/auth/mfa/{totp,passkey}/finish`,
et le reset recovery code). Un login complet réussi prouve que
l'user contrôle toujours le facteur prétendu perdu — la demande
est moot et annulée. Le legit owner d'un compte attaqué n'a donc
qu'à se reconnecter normalement pour défuser une demande forgée :
pas de clic sur un lien email à effectuer (et donc pas de surface
phishing « clique ici pour défuser » dans la boîte mail).

Conséquence : pas de surface "demande active" dans une session
full, le couple "user authentifié + bypass pendant" ne peut pas
coexister.

### Application du bypass au login

Au login suivant. Après `/auth/login/finish` (ou
`/auth/passkeys/login/finish`), si le facteur `<factor>` est requis
et non vérifié, le serveur checke :

```sql
SELECT id, factor FROM mfa_bypass_requests
WHERE user_id = $1
  AND factor = $2
  AND confirmed_at IS NOT NULL
  AND cancelled_at IS NULL
  AND consumed_at IS NULL
  AND confirmed_at + interval '7 days' <= now()
  AND expires_at > now()
LIMIT 1
```

Si trouvé : marquer `consumed_at = now()`, transaction selon le
factor.

**Si `factor = 'totp'`** :
1. `UPDATE mfa_totp SET enabled_at = NULL`.
2. `DELETE FROM mfa_totp_recovery_codes WHERE user_id = $1`.
3. Force l'écran "Ré-active ton TOTP" post-login (visible tant que
   `mfa_totp.enabled_at IS NULL`).
4. `mfaTotpVerified = true` sur la session pending.
5. Si `users.security_mode = 'maximum'` → downgrade auto vers
   `password_or_passkey` (cf. §6.1).
6. Si `users.security_mode = 'always_totp'` → downgrade auto vers
   `password_or_passkey`.
7. Email de notification "Ton TOTP a été désactivé."

**Si `factor = 'passkey'`** :
1. `DELETE FROM auth_factors WHERE user_id = $1 AND kind = 'passkey'`.
   On supprime **toutes** les passkeys (l'user en réenrôlera des
   nouvelles).
2. Force l'écran "Enrôle une nouvelle passkey" post-login si
   `security_mode = 'maximum'`.
3. `mfaPasskeyVerified = true` sur la session pending.
4. Si `users.security_mode = 'maximum'` → downgrade auto vers
   `password_or_passkey` (l'user remontera le mode après ré-enrollment).
5. Email de notification "Toutes tes passkeys ont été désactivées."

**Dans tous les cas** :
- Revoke toutes les **autres** sessions (DELETE WHERE user_id AND
  id <> current).
- L'email contient une instruction "Si ce n'est pas toi : utilise
  le reset destructif sur la page de connexion" — le destructif
  reste l'unique recours en cas de compromission.

