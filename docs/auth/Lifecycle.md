# Reset destructif, logout, suppression de compte

> Flow extrait de `docs/Auth-Spec.md §7` lors du split. Voir
> [`Auth-Spec.md`](../Auth-Spec.md) pour le threat model, les
> primitives, les sessions, les middlewares, et les autres flows.

---

## 7.9 Reset destructif (existant, conservé)

Inchangé fonctionnellement par rapport à l'existant, mais étendu
pour purger toutes les nouvelles tables :

`POST /auth/request-reset` → email avec token (si email vérifié).
`POST /auth/reset` → token + nouveau password. Server : voir
purge §4.3, puis création des nouveaux wraps comme en register
(mais on conserve `email_verified_at`).

L'écran de reset rappelle explicitement : "Toutes tes données
chiffrées seront supprimées. Cette action est irréversible." +
checkbox bloquante.

## 7.10 Logout

`POST /auth/logout` : DELETE session courante. Cookie expiré.

`POST /auth/logout-all` : `requireFreshPassword`. DELETE toutes les
sessions de l'user. Cookie expiré.

`GET /auth/sessions` : `requireUser`. Liste les sessions full
actives de l'user (`id`, `created_at`, `last_seen_at`, `ip_hash`
tronqué pour préview, `user_agent`, flag `is_current: true` sur la
session du cookie courant).

`DELETE /auth/sessions/:id` : `requireFreshPassword`. Révoque une
session spécifique par son ID. Refus 404 si l'ID n'appartient pas
à cet user (constant-time pour éviter l'enumération). Refus 400 si
`id == current` (utiliser `/auth/logout` pour ce cas).

Côté client : `resetAll()` du store Zustand → main key et sub-keys
deviennent garbage-collectables (on ne peut pas les wiper, cf.
CLAUDE.md règle 7).

## 7.11 Suppression de compte

`POST /auth/account/delete`

Préconditions : re-auth password fresh + (re-auth passkey si
`auth_factors.passkey` existe) + (TOTP code live si
`mfa_totp.enabled_at` non null).

Body : `{ confirmation_phrase: "supprimer mon compte" }` (en français,
exact match).

Server : transaction de purge §4.3 + `DELETE FROM users WHERE id`.
Cascade DELETE sur toutes les FKs.

Réponse `200`. Cookie effacé.

---

