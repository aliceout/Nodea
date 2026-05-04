# Change password

> Flow extracted from `docs/Auth-Spec.md §7` during the split. See
> [`Auth-Spec.md`](../Auth-Spec.md) for the threat model, primitives,
> sessions, middlewares, and the other flows.

---

## 7.5 Change password

OPAQUE re-registration cannot fit in a single POST: the client needs
the server's `registrationResponse` (computed from the new password's
`registrationRequest`) before it can produce the `registrationRecord`
locally. Hence the 2-step pattern, mirrored from register / login.

### `POST /auth/change-password/start`

**Body**:
```json
{
  "proofLoginToken": "...",
  "proofFinishLoginRequest": "...",
  "registrationRequest": "..."
}
```

The client has already run a `/auth/login/start` round-trip with
the current password to produce the proof (cf. §13.X
`OpaquePasswordProofSchema`). `registrationRequest` comes from
`client.startRegistration(newPassword)`.

**Server**:
1. Precondition `requireUser` (valid session).
2. `verifyPasswordProof(user, body)`: consume the `loginToken`,
   require `userIdentifier === user.email`, run `server.finishLogin`.
   Failure → 401 `invalid_credentials`.
3. `server.createRegistrationResponse({ userIdentifier: user.email,
   registrationRequest })` → `registrationResponse`.
4. Stores a single-use `changePasswordToken` (TTL 5 min, in-memory
   `auth/opaque-pending-state.ts`) bound to `users.id`.
5. Response `200 { registrationResponse, changePasswordToken }`.

### `POST /auth/change-password/finish`

**Body**:
```json
{
  "changePasswordToken": "...",
  "registrationRecord": "...",
  "wrappedKekPassword": "...",
  "wrappedKekPasswordIv": "..."
}
```

The client has finished registration locally
(`client.finishRegistration` with the new password) → new exportKey.
It unwrapped the old KEK with the proof, then re-wrapped the **same**
KEK under an HKDF sub-key of the new exportKey. The main key is not
re-wrapped — that's the invariant that guarantees every
pre-rotation ciphertext stays readable.

**Server** (transaction):
1. `consumeChangePasswordPending(token)`; must bind `users.id`.
2. UPDATE `opaque_records.envelope` with the new record.
3. UPDATE `users.wrapped_kek_password{,_iv}` with the new blobs.
4. **Session ID rotation**: DELETE every session for this user
   (including the current one). INSERT a new
   `kind = 'full'` session with `reauth_password_at = now()`.
5. Issue a fresh signed `__Host-nodea_session` cookie. The old one
   is explicitly cleared via `Set-Cookie` with a past date.
6. Response `200`.

### Front-end UX

- Form: current password + new + **confirmation** (typed twice).
  zxcvbn strength meter + tick list of `checkPasswordRules`
  (12 chars / lowercase / uppercase / digit / symbol). Submit
  gated on passing rules + zxcvbn score ≥ 3.
- On success: `useSession.logout()` client-side + redirect to
  `/login?password-changed=1` (info banner). Since the server
  revoked every session in the transaction, we align the client by
  dropping the in-memory main-key material and forcing the user to
  re-type the new password. Avoids running with the KEK / main key
  derived from the rotated password still in memory — technically
  valid until local expiration, but messy to keep a "session dead
  on the server, main key still alive on the client" state — the
  force-logout cuts that short.

ID rotation after a privilege change (password change, mode change,
etc.) is a classic session fixation anti-pattern — we apply it
systematically.

