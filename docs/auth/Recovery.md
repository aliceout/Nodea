# Recovery via KEK code

> Flow extrait de `docs/Auth-Spec.md §7` lors du split. Voir
> [`Auth-Spec.md`](../Auth-Spec.md) pour le threat model, les
> primitives, les sessions, les middlewares, et les autres flows.

---

## 7.7 Recovery via KEK code

> Setup opt-in depuis Settings → Security (l'utilisateur·ice ne
> voit pas le flow à l'inscription). Sidebar warning rouge
> non-dismissable tant que pas configuré. Recovery flow accessible
> via `/recover` ou via le lien "Tu as un code ?" sur
> `/request-reset`.
>
> Source de vérité : code dans
> `packages/api/src/routes/auth-recovery.ts`. Cette section décrit
> l'intention ; le wire format réel est légèrement plus serré (le
> OPAQUE register handshake est folded dans le `/start` plutôt que
> d'avoir une 3e route séparée).

### Modèle d'autorisation

Le serveur stocke `users.recovery_code_hash = SHA-256(recovery_bytes)`,
calculé et envoyé par le client à l'inscription (cf. §7.1 step 4).
Avec 128 bits d'entropie BIP39 (les 4 bits restants sont un
checksum, pas de l'entropie), ce hash est non-crackable offline
même en cas de compromission DB.

Au recovery, le client envoie son `recovery_code_hash` calculé
localement. Le serveur compare en temps constant avec celui stocké.
**Sans match → 401, aucune mutation appliquée**. C'est ce qui
empêche un attaquant externe de DoS le compte en soumettant un
nouvel envelope OPAQUE sans connaître le recovery code.

Propriété conservée : *le serveur ne connaît pas le recovery code
en clair*, il ne stocke qu'un hash uncrackable.

### `POST /auth/recover-kek/start`

Body : `{ email }`. Server :
1. Charge `users` par email. Si pas trouvé → réponse opaque
   `200 { ok: true, recovery_session_id: <random> }` (pas de leak
   d'existence ; on émet quand même un session_id pour rendre les
   timings indistinguables).
2. Stocke `recovery_session_id` (32 bytes random base64url) avec
   TTL 5 min, lié à l'`users.id` si trouvé, lié à `null` sinon.
3. Renvoie `{ recovery_session_id, wrapped_kek_recovery,
   wrapped_kek_recovery_iv }` si user trouvé, ou des blobs random
   indistinguables sinon (timing safety).

### Côté client (avant `/finish`)

1. User tape les 12 mots BIP39.
2. Client valide checksum BIP39, dérive `recovery_bytes` (16 bytes).
3. Calcule `recovery_code_hash = SHA-256(recovery_bytes)`.
4. Dérive `wk_recovery = HKDF(recovery_bytes, "nodea:wrap-kek")`.
5. Tente unwrap `wrapped_kek_recovery` côté client → si l'auth-tag
   AES-GCM échoue, le code est mauvais. Message d'erreur immédiat
   côté UI **sans hit serveur** : ça épargne le rate-limit et évite
   de polluer les logs serveur de mismatch. (Le serveur fait quand
   même son propre check de hash au `/finish`, en double-vérification.)
6. Si unwrap OK : main key dérivée par chemin standard (KEK →
   `wrapped_main_key` → main_key).
7. User tape un nouveau password.
8. Client lance OPAQUE registration (sur l'email courant), dérive
   nouveau `export_key`, re-wrappe KEK sous nouveau `wk_password`.
9. Client génère **nouveau recovery code** (l'ancien sera invalidé)
   → nouveau `wrapped_kek_recovery` + nouveau `recovery_code_hash`.
   Affiché à l'écran après succès, checkbox d'acknowledgement.

### `POST /auth/recover-kek/finish`

Body :
```json
{
  "recovery_session_id": "...",
  "recovery_code_hash": "...",
  "opaque_register_record_new": "...",
  "wrapped_kek_password_new": "...",
  "wrapped_kek_password_new_iv": "...",
  "wrapped_kek_recovery_new": "...",
  "wrapped_kek_recovery_new_iv": "...",
  "recovery_code_hash_new": "..."
}
```

Server :
1. Valide `recovery_session_id` (charge, vérifie TTL, consomme).
   Si lié à `null` → 401 (cas "user inexistant" depuis /start).
2. Charge `users.recovery_code_hash`. Comparaison **temps constant**
   avec `recovery_code_hash` fourni. Si KO → 401, **aucune
   mutation**, log un `auth.recover.hash_mismatch`.
3. Valide le nouvel envelope OPAQUE (cohérence cryptographique).
4. Transaction :
   - UPDATE `opaque_records.envelope` (par `user_id` PK).
   - UPDATE `users.wrapped_kek_password{,_iv}`.
   - UPDATE `users.wrapped_kek_recovery{,_iv}` ← nouveau code.
   - UPDATE `users.recovery_code_hash` ← nouveau hash.
   - DELETE toutes les sessions de cet user.
5. Émet une session full + cookie.
6. Email de notification "Ton mot de passe a été réinitialisé via
   recovery code. Si ce n'est pas toi : reset destructif via
   /password-reset."

### Anti-pattern obligatoire

Le body de `POST /auth/recover-kek/finish` contient un hash
sensible (et le password en clair n'y est pas, mais `recovery_code_hash`
permet une vérif offline si DB compromise — non-crackable mais
quand même à protéger). **Le logger doit black-lister le body de
cette route.** Cf. §14.

### Régénération depuis Settings

Cas distinct du recovery flow : l'utilisateur·ice est déjà
authentifié·e (session full, KEK déjà en mémoire) et veut
simplement rotater son recovery code (perte du papier, doute,
hygiène).

`POST /auth/security/recovery-code/regenerate`

Préconditions : `requireFreshPassword` (cf. matrice §6).

Côté client (avant POST) :
1. Génère un nouveau recovery code BIP39 12 mots.
2. Affiche immédiatement (modal avec checkbox "j'ai noté").
3. Dérive `recovery_bytes_new`, `wk_recovery_new = HKDF(...,
   "nodea:wrap-kek")`.
4. Wrap la KEK courante (en mémoire) :
   `wrapped_kek_recovery_new = AES-GCM(wk_recovery_new, kek,
   AAD=buildAAD([users.id, "recovery"]))`.
5. Calcule `recovery_code_hash_new = SHA-256(recovery_bytes_new)`.

Body :
```json
{
  "wrapped_kek_recovery_new": "...",
  "wrapped_kek_recovery_new_iv": "...",
  "recovery_code_hash_new": "..."
}
```

Server (transaction) :
1. UPDATE `users.wrapped_kek_recovery{,_iv}`,
   `users.recovery_code_hash`.
2. Bump `users.updated_at`.
3. Réponse `200 { regenerated_at }`.

L'ancien recovery code devient immédiatement invalide (le
`wrapped_kek_recovery` qu'il déchiffrait n'est plus stocké). Le
client zero `recovery_bytes_new` après la copie utilisateur·ice.

Pas d'email de notification (l'opération est explicite côté
utilisateur·ice + re-auth password fresh = pas de takeover
possible silencieusement).

