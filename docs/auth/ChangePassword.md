# Change password

> Flow extrait de `docs/Auth-Spec.md §7` lors du split. Voir
> [`Auth-Spec.md`](../Auth-Spec.md) pour le threat model, les
> primitives, les sessions, les middlewares, et les autres flows.

---

## 7.5 Change password

OPAQUE re-registration ne peut pas tenir dans un seul POST : le
client a besoin de la `registrationResponse` du serveur (calculée
à partir du `registrationRequest` du nouveau password) avant de
pouvoir produire le `registrationRecord` localement. D'où le
2-step pattern, calqué sur register / login.

### `POST /auth/change-password/start`

**Body** :
```json
{
  "proofLoginToken": "...",
  "proofFinishLoginRequest": "...",
  "registrationRequest": "..."
}
```

Le client a déjà tourné un round-trip `/auth/login/start` avec le
password courant pour produire le proof (cf. §13.X
`OpaquePasswordProofSchema`). `registrationRequest` est issu de
`client.startRegistration(newPassword)`.

**Serveur** :
1. Pré-condition `requireUser` (session valide).
2. `verifyPasswordProof(user, body)` : consume le `loginToken`,
   exige `userIdentifier === user.email`, run `server.finishLogin`.
   Échec → 401 `invalid_credentials`.
3. `server.createRegistrationResponse({ userIdentifier: user.email,
   registrationRequest })` → `registrationResponse`.
4. Stocke un single-use `changePasswordToken` (TTL 5 min, in-memory
   `auth/opaque-pending-state.ts`) lié à `users.id`.
5. Réponse `200 { registrationResponse, changePasswordToken }`.

### `POST /auth/change-password/finish`

**Body** :
```json
{
  "changePasswordToken": "...",
  "registrationRecord": "...",
  "wrappedKekPassword": "...",
  "wrappedKekPasswordIv": "..."
}
```

Le client a complété la registration localement
(`client.finishRegistration` avec le nouveau password) → nouvel
exportKey. Il a unwrappé l'ancienne KEK avec le proof, puis
re-wrappé la **même** KEK sous un sub-key HKDF du nouveau
exportKey. La main key n'est pas re-wrappée — c'est l'invariant
qui garantit que tous les ciphertexts pré-rotation restent
lisibles.

**Serveur** (transaction) :
1. `consumeChangePasswordPending(token)` ; doit binder `users.id`.
2. UPDATE `opaque_records.envelope` avec le nouveau record.
3. UPDATE `users.wrapped_kek_password{,_iv}` avec les nouveaux
   blobs.
4. **Rotation de l'ID de session** : DELETE toutes les sessions de
   cet user (incluant la courante). INSERT une nouvelle session
   `kind = 'full'` avec `reauth_password_at = now()`.
5. Émet un nouveau cookie `__Host-nodea_session` signé. L'ancien
   est explicitement effacé via `Set-Cookie` avec date passée.
6. Réponse `200`.

### UX côté frontend

- Form : password actuel + nouveau + **confirmation** (typé deux
  fois). Strength meter zxcvbn + tick list des règles
  `checkPasswordRules` (12 chars / min / maj / chiffre / spécial).
  Submit gaté sur règles passées + score zxcvbn ≥ 3.
- Sur succès : `useSession.logout()` côté client + redirect vers
  `/login?password-changed=1` (banner d'info). Le serveur ayant
  révoqué toutes les sessions dans la transaction, on aligne le
  client en virant le main-key material en mémoire et en
  forçant l'utilisateur·ice à retaper son nouveau password.
  Évite de continuer à opérer sur la KEK / main key dérivés du
  password ROUTÉ — c'est techniquement encore valide jusqu'à
  expiration locale, mais c'est bordélique d'avoir un état
  "session morte côté serveur, mais main key encore là côté
  client" — le force-logout coupe court.

La rotation de l'ID après un changement de privilège (changement
de password, change-mode, etc.) est un anti-pattern de session
fixation classique — on l'applique systématiquement.

