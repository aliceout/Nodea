# Change email (design partiel — full flow non livré)

> Flow extrait de `docs/Auth-Spec.md §7` lors du split. Voir
> [`Auth-Spec.md`](../Auth-Spec.md) pour le threat model, les
> primitives, les sessions, les middlewares, et les autres flows.

---

## 7.6 Change email (design partiel — full flow non livré)

> **Statut.** La route `PATCH /auth/email` fait juste l'`UPDATE
> users.email` après un re-auth password fresh. Le flow ci-dessous
> décrit la version complète envisagée avec re-vérification email +
> cooldown 7 jours + re-register OPAQUE (parce que le
> `userIdentifier` baked dans l'envelope IS l'email). À implémenter
> dans une issue dédiée si on veut le verrou complet ; pour
> l'instant la simple route fait le boulot minimal.

Plus lourd qu'on aimerait. Trois étapes.

### Étape A — `POST /auth/change-email/start`

Re-auth password fresh. Body : `{ new_email }`. Server :
1. **Cooldown** : si `users.email_changed_at` n'est pas NULL et que
   `email_changed_at + 7 jours > now()` → 429 `email_change_cooldown`
   avec date de fin du cooldown. (Anti-takeover : si un attaquant
   prend l'email, on lui interdit de le tourner immédiatement.)
2. Vérifie qu'aucun `users` actif n'a `new_email`.
3. Génère code 6 chiffres, insère
   `email_verifications { kind: 'email_change', email: new_email, user_id }`.
4. Envoie email à `new_email`.

### Étape B — `POST /auth/change-email/verify`

Body : `{ code }`. Server : marque verification consumed. Pas de
mutation sur `users.email` encore.

### Étape C — `POST /auth/change-email/finalize`

Le client doit fournir un nouvel envelope OPAQUE keyed sur
`new_email`. Pour ça, le client doit re-faire OPAQUE registration
avec le password (qu'il a déjà via la re-auth récente — mais le
password OPAQUE plain est nécessaire ici, pas l'export_key).

**Note d'implémentation** : OPAQUE registration nécessite le
password en plain. La re-auth fresh ne le garde pas. On a deux
options :

1. **Garder le password en RAM client** entre la re-auth (étape A)
   et la finalize (étape C). Risqué (XSS).
2. **Demander à nouveau le password** à l'étape C. Plus propre
   UX-wise et sécurité.

→ **Choix : option 2.** À l'étape C, l'écran demande de retaper le
password, le client lance OPAQUE register sur `new_email`, dérive
nouveau `export_key`, re-wrappe la KEK, et envoie au serveur :

```json
{
  "opaque_register_record_new": "...",
  "wrapped_kek_password_new": "...",
  "wrapped_kek_password_new_iv": "..."
}
```

Server (transaction) :
1. UPDATE `users.email = new_email`, `users.email_changed_at = now()`
   (déclenche le cooldown 7j pour le prochain change).
2. UPDATE `opaque_records.envelope` (la PK étant user_id, on remplace
   le blob — aucun changement de PK).
3. UPDATE `users.wrapped_kek_password{,_iv}`.
4. Revoke toutes les autres sessions.
5. Réponse `200`.

