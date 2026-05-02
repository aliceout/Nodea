# Sécurité applicative — audit & roadmap

> **Statut** : audit posé après les chantiers `module-refacto`,
> `factoring-audit`, la migration logo, et l'audit organisation
> (cf. [`refacto.md`](./refacto.md)). 11 findings identifiés —
> dont **0 critique**, 1 élevé, 3 moyens, 6 faibles, 1 informatif.
> La posture cryptographique du protocole (OPAQUE, KEK
> wrapping, AES-GCM avec AAD, guards HMAC, modèle « surface
> lisible minimum ») est solide ; les défauts se concentrent
> sur la **télémétrie applicative et les défenses de couche
> infrastructure**.
>
> **Mise à jour** : à chaque PR qui livre un fix, cocher la
> case correspondante. Si un fix change un invariant documenté
> (ex : déplacer `sid+d` du query vers les headers), mettre à
> jour `CLAUDE.md` ou `docs/Security.md` dans le **même
> commit**.

Audit mené sur le code au commit `b9b250c` + un `curl -I` sur
l'instance prod `nodea.app` pour confirmer les headers servis
par le reverse proxy upstream. **Périmètre limité à la sécurité
applicative et la protection des données** — pas de remarques
qualité de code / perf / archi (ces angles vivent dans
[`refacto.md`](./refacto.md) et [`architecture.md`](./architecture.md)
— l'ancienne roadmap `health.md` qui couvrait la dette
JSX/lint/couverture est livrée).

---

## Diagnostic global

La posture de sécurité de Nodea est **mature au cœur du
protocole et naïve à la périphérie**. Le design crypto est
rigoureux et coûteux à atteindre : OPAQUE pour ne jamais voir
le password en clair, KEK enveloppée par 3 facteurs avec HKDF
domain-separated, AES-GCM avec AAD construits, guard HMAC pour
les mutations, modèle « surface lisible minimum » qui supprime
même `user_id` des entrées. Drizzle est utilisé avec des `eq()`
partout (pas d'interpolation), Argon2id pour les hashes,
`timingSafeEqual` pour les comparaisons critiques, OPAQUE qui
rend l'énumération d'emails impossible par construction.

En revanche, dès qu'on quitte la couche crypto, on retombe sur
des défauts opérationnels habituels d'un projet jeune :
**`hono/logger()` qui écrit l'URL avec son query string sur
stdout** (ce qui inclut `sid` et **guard HMAC** sur chaque
PATCH/DELETE — directement contradictoire avec l'invariant
CLAUDE.md « jamais de matériel crypto dans les logs »), un
**rate-limiter qui fait confiance aveugle au premier hop de
`X-Forwarded-For`** et donc bypassable via spoofing trivial,
et **pas de Content-Security-Policy** alors que les autres
headers défensifs sont posés par le reverse proxy upstream.

Les autorisations elles-mêmes sont gérées par un middleware
factory (`createCollectionRoutes`) qui rend l'oubli
structurellement impossible — il n'y a pas de routes manuelles
pour les entrées chiffrées. Le seul point d'attention côté
autorisation est l'admin (`requireAdmin`) qui repose sur une
lecture du flag `user.role`, mais rien d'exploitable en l'état.

Ce qui frappe : la qualité du commentaire sur `requireGuard`
(39 lignes pour expliquer le modèle d'accès, justifier 404 vs
403 contre l'oracle d'existence, citer la régression du commit
29b6e25). Cette densité de prose défensive trahit une équipe
qui a sécurité-au-cœur **dans ses revues**, mais qui n'a pas
encore dépassé la phase « tout faire à la main » côté ops.

**Phrase au CTO** : *« Le chiffrement bout-en-bout fait ce
qu'il dit, mais on logue les guards HMAC en clair sur chaque
mutation et il manque la CSP qui mitigerait le scénario
serveur compromis ; un attaquant qui a accès aux logs API
peut modifier des entrées d'un user sans avoir sa clé en
rejouant un guard depuis un journal. À fixer cette semaine. »*

---

## Reconnaissance

### Stack auth

- Backend Hono + Drizzle + PostgreSQL 16, sessions cookie
  signées (`hono/cookie` `setSignedCookie`), pas de JWT.
- OPAQUE-3DH (`@serenity-kit/opaque` 1.1.0), WebAuthn + PRF
  (`@simplewebauthn/server` 13.3.0), TOTP RFC 6238 (`otplib`),
  BIP39 recovery code, MFA stepped (3 modes : `password_or_passkey`
  / `always_totp` / `maximum`).
- Argon2id intégré au protocole OPAQUE (m=64 MiB, t=3, p=4).

### Sessions

- Cookie : `nodea_session`, `httpOnly`, `sameSite='Lax'`,
  `secure=COOKIE_SECURE`, `path='/'`, signé HMAC avec
  `COOKIE_SECRET`.
- ID de session : 32 bytes random base64url (256 bits entropy).
- TTL `full` : 30 jours (Auth-Spec cible 7 jours), `register` :
  24h, `mfa_pending` : 5 min.
- Logout côté serveur : `revokeSession()` purge la row DB.

### Surface d'exposition

| Catégorie | Exemples | Auth |
|---|---|---|
| Public | `/healthz`, `/auth/login/start\|finish`, `/auth/register/*`, `/auth/recover-kek/*`, `/auth/passkey/login/*`, `/auth/reset/*`, `/auth/mfa/bypass/{confirm,cancel}` | rate-limited |
| Authentifié (`requireUser`) | `/<collection>/records/*` (×6), `/auth/me`, `/auth/logout`, `/modules-config`, `/user-preferences`, `/library/lookup`, `/auth/reauth/*`, `/auth/passkey/{enroll,manage}`, `/auth/totp/*`, `/auth/security-mode` | sessionId obligatoire |
| Admin (`requireAdmin`) | `/admin/*` (users, invites, settings, sources) | role=admin |
| Avec `requireGuard` | mutations `/<collection>/records/:id` | sid + guard HMAC |

### Headers servis en prod (vérifiés via `curl -I https://nodea.app/`)

| Header | Présent | Valeur |
|---|:-:|---|
| `Strict-Transport-Security` | ✅ | `max-age=63072000; includeSubDomains` (2 ans) |
| `X-Frame-Options` | ✅ | `SAMEORIGIN` |
| `X-Content-Type-Options` | ✅ | `nosniff` |
| `Referrer-Policy` | ✅ | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | ✅ | `geolocation=(), microphone=(), camera=()` |
| `Content-Security-Policy` | ❌ | **manquant** |

### Outils sécu présents / absents

- ✅ Drizzle ORM (queries parametrées par construction)
- ✅ `timingSafeEqual` sur le guard, `constantTimeEqualHex` sur le recovery hash
- ✅ Rate limiter custom in-process (`rateLimit()` middleware)
- ✅ Argon2id via OPAQUE
- ✅ Zod validation côté serveur sur tous les body POST/PATCH
- ✅ Anti-énumération sur `/login/start`, `/register`, `/recover-kek/start`
- ✅ HSTS / X-Frame-Options / X-Content-Type-Options / Referrer-Policy / Permissions-Policy posés par l'upstream
- ❌ Pas de Content-Security-Policy
- ❌ Pas de helmet ou équivalent côté Hono
- ❌ Pas de scanner CVE en CI (pas de `dependabot.yml`, pas de `pnpm audit` automatique)

---

## Findings

### SEC-01 — Guard HMAC + sid loggés en clair sur chaque mutation — livré

- **Sévérité** : élevée
- **Exploitabilité** : conditions particulières (accès lecture aux logs API)
- **Fichiers** :
  - [`packages/api/src/app.ts:44`](../../packages/api/src/app.ts#L44) (`app.use('*', logger())`)
  - [`packages/api/src/middleware/require-guard.ts:54-55`](../../packages/api/src/middleware/require-guard.ts#L54-L55) (lit `sid` et `d` depuis query string)
  - [`packages/api/src/routes/collection-factory.ts:64,99,134`](../../packages/api/src/routes/collection-factory.ts) (LIST/PATCH/DELETE)
- **Description** : `hono/logger()` écrit `<-- ${method} ${path}` puis `--> ${method} ${path} ${status} ${ms}` sur stdout. `path` inclut le query string. Le middleware `requireGuard` lit le guard via `c.req.query('d')`, ce qui veut dire que sur chaque PATCH/DELETE d'une entrée chiffrée, la ligne logguée ressemble à : `PATCH /mood/records/abc-12...?sid=<sid>&d=g_<hex_guard> 200 5ms`. Le guard est du **matériel cryptographique HMAC dérivé de la main key** ; CLAUDE.md interdit explicitement *« No secrets, tokens, session cookies, or raw crypto material in logs — not even at debug »*.
- **Scénario d'exploitation** : un sysadmin ou un service de log shipping (Loki, ELK, journalctl, docker logs aggregator) qui a accès aux logs API peut récupérer `sid + d` pour une entrée arbitraire. Avec ces deux valeurs il peut **modifier ou supprimer cette entrée** sans avoir la main key du user, puisque `requireGuard` valide uniquement `(id, sid, d)`. Un employé du fournisseur cloud ou un attaquant qui a compromis le pipeline de logs peut effacer ou écraser des entrées privées sans que la victime s'en rende compte avant qu'elle ouvre l'app.
- **Tâches**
  - [x] Décider entre Option A (déplacer `sid` + `d` en headers `X-Sid` / `X-Guard`) ou Option B (logger custom qui élide les query params sensibles avant émission).
  - [x] Migrer `requireGuard` à lire `c.req.header('x-sid')` / `c.req.header('x-guard')` (Option A).
  - [x] Migrer le client web (`packages/web/src/core/api/modules/collection-client.ts`).
  - [x] Documenter le contrat dans `docs/Security.md`.
  - [x] Ajouter un test qui vérifie qu'aucune route de mutation ne log le query string (snapshot test sur la sortie du logger).
- **Effort** : M (~2-3h pour Option A en migrant côté serveur + client + tests)
- **Risque** : faible (pas de breaking change visible côté user, juste une migration interne)
- **Dépendances** : aucune

### SEC-02 — Content-Security-Policy manquante (serveur-side)

- **Sévérité** : moyenne *(était élevée avant vérif `curl -I` — les autres headers sont posés par l'upstream)*
- **Exploitabilité** : conditions particulières (suppose une faille XSS, dépendance compromise, ou bundle JS modifié)
- **Statut** : **finding intégralement serveur-side** — déplacé dans [`docs/recommendations/server-config.md` REC-S1](../recommendations/server-config.md#rec-s1--content-security-policy).
- **Description courte** : tous les autres headers défensifs sont en place sur `https://nodea.app/` (HSTS 2 ans, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy), **sauf la CSP**. Le fix est sur le reverse proxy upstream (hors-repo).
- **Tâches** : voir [`server-config.md` REC-S1](../recommendations/server-config.md#rec-s1--content-security-policy).

### SEC-03 — Rate limiter bypassable via `X-Forwarded-For` spoofé — livré

- **Sévérité** : moyenne
- **Exploitabilité** : triviale si l'API est joignable directement, conditionnelle derrière le proxy
- **Statut** : **partagé** — la partie code app reste ici, la partie config upstream nginx est dans [`server-config.md` REC-S2](../recommendations/server-config.md#rec-s2--x-forwarded-for-strip-de-lentrant).
- **Fichiers (app)** :
  - [`packages/api/src/middleware/rate-limit.ts:34`](../../packages/api/src/middleware/rate-limit.ts#L34) (`getClientKey` lit `x-forwarded-for` premier hop sans validation)
- **Description** : la fonction extrait le **premier IP** de `X-Forwarded-For` comme clé de rate-limit. Sous l'hypothèse d'un reverse proxy upstream qui **n'a pas** strip l'entrant (cf. REC-S2), un client peut spoof `X-Forwarded-For: 1.2.3.4` et bypass le rate-limit. Le fix app-side est de lire le **dernier** hop (celui que l'upstream vient d'append) plutôt que le premier.
- **Scénario d'exploitation** : un attaquant envoie 1000 requêtes `POST /auth/login/start` avec `X-Forwarded-For: ${random_ip}` à chaque coup. Chaque requête hit un bucket différent → rate-limit jamais déclenché. Bypass valable sur tous les endpoints rate-limités.
- **Tâches (app-side)**
  - [x] Modifier `getClientKey` dans `rate-limit.ts` pour lire le **dernier** hop : `parts[parts.length - 1].trim()`.
  - [x] Documenter le contrat dans le commentaire du fichier : *« le rate limiter suppose un seul reverse proxy de confiance directement devant l'API, qui append son IP en dernier »*.
  - [x] Ajouter un test unit qui vérifie le comportement avec un `X-Forwarded-For` multi-hop.
- **Tâches (server-side)** : voir [`server-config.md` REC-S2](../recommendations/server-config.md#rec-s2--x-forwarded-for-strip-de-lentrant).
- **Effort (app)** : S (~30 min)
- **Risque** : faible
- **Dépendances** : REC-S2 (les deux fixes ensemble closent le finding)

### SEC-04 — `COOKIE_SECURE` défaut à `false` (foot-gun pour self-hosters) — livré

- **Sévérité** : faible *(était moyenne avant confirmation par l'opérateur que `COOKIE_SECURE=true` est bien set en prod sur l'instance officielle)*
- **Exploitabilité** : conditions particulières (oubli de configuration prod par un self-hoster tiers)
- **Fichiers** :
  - [`packages/api/src/config.ts:18-22`](../../packages/api/src/config.ts#L18-L22)
- **Description** : `COOKIE_SECURE` est défini avec `default('false')`. L'instance officielle force `true` via `.env` (Infisical), donc **pas de problème en prod actuelle**. Mais pour un·e self-hoster·euse qui clone et déploie sans setter explicitement la variable, les cookies ne portent pas le flag `Secure` et peuvent partir en clair. CLAUDE.md exige *« Session cookies ... Secure ; SameSite=Lax ; Signed »* — le défaut du code contredit cette exigence.
- **Scénario** : un nouvel·le opérateur·ice déploie Nodea derrière un reverse proxy TLS mais oublie `COOKIE_SECURE=true`. Un user visite `http://instance.tld` (avant redirect HTTPS), le cookie part en clair. MITM passif (Wi-Fi public, ISP malveillant) sniffe le cookie et hijacke la session.
- **Tâches**
  - [x] Inverser le défaut à `true` dans `config.ts` :
    ```ts
    COOKIE_SECURE: z.enum(['true', 'false']).default('true').transform(v => v === 'true'),
    ```
  - [x] Ajouter un override explicite pour le dev local dans `.env.example` : `COOKIE_SECURE=false  # Override pour dev HTTP local uniquement`.
  - [x] Mettre à jour `dev-setup.yaml` si la variable y est référencée.
- **Effort** : S (~15 min)
- **Risque** : faible
- **Dépendances** : aucune

### SEC-05 — Postgres exposé sur le host en prod (héritage docker-compose dev) — livré

- **Sévérité** : moyenne
- **Exploitabilité** : conditions particulières (mot de passe Postgres + accès réseau au host)
- **Fichiers** :
  - [`docker-compose.yml`](../../docker-compose.yml) — service `postgres` avec `ports: '${POSTGRES_PORT:-5433}:5432'`
- **Description** : le service Postgres bind son port 5432 sur l'host (5433 par défaut). Commode en dev (psql depuis l'IDE) mais en prod ça expose Postgres au réseau du host. Si le host n'a pas de pare-feu strict ou si le port est forwardé par mégarde, Postgres devient publiquement atteignable. Mitigation actuelle : `POSTGRES_PASSWORD` requis. Mais la pratique recommandée est de ne pas exposer du tout — l'API y accède via le réseau Docker interne (`postgres:5432`).
- **Scénario** : un sysadmin déploie sur un VPS, oublie iptables/ufw. Postgres devient atteignable sur `<vps_ip>:5433`. Brute-force du `POSTGRES_PASSWORD` ou exploit d'une CVE Postgres connue donne accès direct à toutes les rows (y compris emails, hashes, blobs chiffrés — qui restent illisibles sans la main key, mais qui sont déjà du dommage). À vérifier également côté firewall VPS.
- **Tâches**
  - [x] Retirer la section `ports` du service `postgres` dans `docker-compose.yml`.
  - [x] Créer un override `docker-compose.dev.yml` qui ré-expose le port pour le dev (avec `profiles: ['dev']` ou un fichier séparé).
  - [x] Documenter l'accès psql en prod : `docker compose exec postgres psql -U nodea`.
  - [x] Vérifier l'état du firewall sur le VPS de prod (cf. *Angles morts*).
- **Effort** : S (~30 min)
- **Risque** : moyen (à coordonner avec workflows dev qui dépendent du port exposé)
- **Dépendances** : aucune

### SEC-06 — User UUID logué sur recovery hash mismatch

- **Sévérité** : faible
- **Exploitabilité** : théorique
- **Fichiers** :
  - [`packages/api/src/routes/auth-recovery.ts:255`](../../packages/api/src/routes/auth-recovery.ts#L255)
- **Description** : sur tentative de recovery avec un hash incorrect, l'user UUID est logué : `console.warn(\`[auth/recover-kek] hash_mismatch user=${user.id}\`)`. Le commentaire explique que c'est volontaire pour le monitoring. L'UUID n'est pas directement PII, et un hash mismatch est un signal d'incident. **Mais** combiné avec SEC-01 (logs accessibles), c'est encore une donnée qui sort du périmètre application.
- **Scénario** : couplé à un autre log qui correspond user_id ↔ email (par exemple un futur log applicatif en debug), permet à un opérateur des logs de corréler activité ↔ email.
- **Tâches**
  - [ ] Remplacer par un compteur agrégé (Prometheus / dashboard métier) plutôt qu'un log par occurrence. OU
  - [ ] Loguer un hash tronqué du user_id si le besoin de tracer un user spécifique reste.
- **Effort** : S (~30 min)
- **Risque** : faible
- **Dépendances** : SEC-01 (le contexte de cet ajustement est lié à l'hygiène des logs en général)

### SEC-07 — Logo email chargé depuis `WEB_BASE_URL` — privacy reveal

- **Sévérité** : faible
- **Exploitabilité** : N/A (revelation, pas exploitation)
- **Fichiers** :
  - [`packages/api/src/services/email/templates/layout.ts:87-105`](../../packages/api/src/services/email/templates/layout.ts#L87-L105)
- **Description** : l'image du logo dans les emails est chargée depuis `${WEB_BASE_URL}/favicon-128.png`. Quand le destinataire ouvre l'email avec « charger les images » activé (défaut Gmail, Apple Mail desktop), son client fait une requête HTTP au serveur Nodea. Cette requête révèle : (a) que l'email a été ouvert, (b) l'IP du destinataire au moment de l'ouverture, (c) le user-agent de son client mail. C'est exactement le mécanisme des *tracking pixels*, sauf qu'ici il sert le logo. Pour un projet qui pose en bandeau « pas de tracking », c'est une contradiction si elle n'est pas documentée.
- **Tâches**
  - [ ] Embed l'image en base64 inline dans le HTML (`<img src="data:image/png;base64,...">`) — alourdit les emails de ~6 KB, mais zéro callback réseau.
  - [ ] OU utiliser une image attachée via `cid:` (multipart/related) — plus propre mais nécessite d'étendre `SendMailParams`.
  - [ ] OU documenter explicitement dans la FAQ que le logo se charge depuis l'instance.
- **Effort** : S (~30 min pour base64 inline)
- **Risque** : faible
- **Dépendances** : aucune

### SEC-08 — Pas de défense CSRF au-delà de `SameSite=Lax`

- **Sévérité** : faible
- **Exploitabilité** : théorique en prod (couplée à un XSS ou sub-domain takeover)
- **Fichiers** :
  - [`packages/api/src/auth/cookies.ts:13`](../../packages/api/src/auth/cookies.ts#L13) — `sameSite: 'Lax'`
  - [`packages/api/src/app.ts:33-39`](../../packages/api/src/app.ts#L33-L39) — CORS `allowHeaders: ['content-type']`
- **Description** : la défense CSRF repose sur (a) `SameSite=Lax`, (b) CORS qui n'accepte que `content-type`, (c) le fait que les routes acceptent du JSON. C'est solide en pratique : un POST cross-origin top-level ne portera pas le cookie en `Lax`. Mais `Lax` ne couvre pas tous les cas — un même-site sub-domain compromis peut envoyer des requêtes avec credentials. Et la CSP étant absente (cf. SEC-02), un XSS injecté ne rencontre aucune barrière CSRF.
- **Scénario** : couplage avec un XSS ou un sub-domain takeover. Un script injecté sur `nodea.app` peut faire `fetch('/auth/security/recovery-code', {method: 'POST', credentials: 'include'})` et regénérer le recovery code de l'user, invalidant l'ancien.
- **Tâches**
  - [ ] À court terme : passer `SameSite='Strict'` (l'app n'a pas de besoin de cross-site navigation, les liens d'email reviennent sur le même site).
  - [ ] À moyen terme (si justifié) : implémenter un double-submit token (`__Host-csrf` cookie + header) sur les routes mutantes sensibles (security mode change, password rotation, account deletion, recovery regenerate).
- **Effort** : S pour Strict (10 min), M pour double-submit (~3h)
- **Risque** : faible
- **Dépendances** : SEC-02 (la CSP couvre la majorité du scénario)

### SEC-09 — RGPD : matrice de rétention + brouillon CGU — livré (V1)

- **Sévérité** : faible
- **Statut** : livré pour la V1 doc — la version définitive des CGU passera par un·e juriste avant signature, et la matrice peut être resserrée si l'opérateur veut une rétention plus stricte.
- **Tâches**
  - [x] Audit cron : confirmé que les FK CASCADE sur `user_id` empêchent les blobs orphelins (un `DELETE FROM users WHERE id = X` cascade vers chaque table E2E + auth + modules). Aucun nettoyage code-side supplémentaire requis pour l'orphan-free invariant.
  - [x] Matrice complète table × rétention × erasure-on-demand documentée dans [`docs/Security.md` §9](../Security.md#9-data-retention--rgpd) (12 tables couvertes, dont les 3 gaps connus de purge automatique : `mfa_bypass_requests` / `password_reset_tokens` / `email_verifications` non-`register` — kept indefinitely for audit, à durcir par l'opérateur si besoin).
  - [x] Brouillon CGU créé : [`docs/Terms.md`](../Terms.md) — 8 sections (qui propose, ce que tu confies, engagements, ce que tu acceptes, logs/télémétrie, emails, modification, contact) + glossaire. Marqué explicitement « ébauche de travail, pas encore juridique ».
  - [x] Lien depuis `newbie.md` (FAQ « Mes données sont stockées où ? ») vers `Terms.md` ajouté.
  - [x] Route `DELETE /auth/me` déjà en place ([`auth-account.ts:208`](../../packages/api/src/routes/auth-account.ts#L208)) avec `requireUser` + `requireFreshPassword` ; les FK CASCADE assurent l'effacement complet en une transaction. Documenté dans la matrice.
- **Décisions explicites non prises ici** :
  - Pas de modification du cron : durcir la rétention au-delà de l'audit (90 j ?) est une décision opérateur, pas une obligation RGPD tant qu'on documente la rétention en cours.
  - Pas d'envoi d'email à la suppression compte : la documentation actuelle dit « le user disparaît complètement, by design » — voulu pour respecter le « droit à l'oubli ».
- **Effort** : M — réalisé en doc seulement (pas de code touché).
- **Risque** : faible
- **Dépendances** : aucune (mais à coordonner avec la review juridique des CGU avant publication)

### SEC-10 — `WEB_BASE_URL` rendu obligatoire — livré

- **Sévérité** : faible
- **Statut** : livré.
- **Tâches**
  - [x] `packages/api/src/config.ts` : `WEB_BASE_URL: z.string().url()` (plus d'`.optional()`). Commentaire enrichi pour expliquer pourquoi le fail-fast au boot est préférable à des liens email cassés silencieusement.
  - [x] `.env.example` : section dédiée renommée « Web base URL (REQUIRED) » avec une valeur par défaut `http://localhost:8089` (au lieu d'être commentée). Marqué clairement REQUIRED.
  - [x] `.github/workflows/ci.yml` : ajout de `WEB_BASE_URL=http://localhost:8089` dans le `.env` généré pour les tests CI (sinon le boot du test app échouerait).
  - [x] Les call sites (`admin.ts`, `auth-register-v2.ts`, `auth-reset.ts`, `auth-mfa-bypass.ts`, `email/templates/layout.ts`) gardent leurs `?? ''` ou `?? config.WEBAUTHN_ORIGIN` fallbacks — devenus dead code mais inoffensifs ; nettoyage en suivi optionnel.
- **Effort** : S — réalisé.
- **Risque** : faible (fail-fast au boot meilleur que silent-broken-emails)
- **Dépendances** : aucune

### SEC-11 — HSTS éligible au preload list (serveur-side)

- **Sévérité** : informatif
- **Exploitabilité** : N/A (renforcement, pas vulnérabilité)
- **Statut** : **finding intégralement serveur-side** — déplacé dans [`docs/recommendations/server-config.md` REC-S3](../recommendations/server-config.md#rec-s3--hsts-preload).
- **Description courte** : la prod sert `Strict-Transport-Security: max-age=63072000; includeSubDomains` — éligible au HSTS preload list. Ajouter la directive `preload` + soumettre à `hstspreload.org`. Choix infra (quasi-irréversible — retrait ~6 mois).
- **Tâches** : voir [`server-config.md` REC-S3](../recommendations/server-config.md#rec-s3--hsts-preload).

---

## Récap par catégorie × sévérité

| Catégorie | Critique | Élevée | Moyenne | Faible | Info |
|---|---|---|---|---|---|
| Injections | — | — | — | — | — |
| Auth/sessions | — | — | — | SEC-04, SEC-08 | — |
| Autorisations | — | — | — | — | — |
| Secrets | — | — | — | — | — |
| Validation entrées | — | — | — | — | — |
| Headers/config | — | — | SEC-02 (CSP) | — | SEC-11 (HSTS preload) |
| Dépendances | — | — | — | — | — |
| Rate limit / abus | — | — | SEC-03 (XFF) | — | — |
| Logs / fuites | — | SEC-01 (guard logué) | SEC-05 (PG exposé) | SEC-06, SEC-07 | — |
| Données personnelles | — | — | — | SEC-09, SEC-10 | — |

**0 critique, 1 élevé, 3 moyens, 6 faibles, 1 informatif.**

---

## Top à fixer cette semaine

1. **SEC-01** — Guards loggés. Solution rapide (Option A : déplacer en headers `X-Sid`/`X-Guard`) tient en 1 PR de 2-3h. **Hotfix prioritaire.**
2. **SEC-02** — CSP en `Report-Only` sur l'upstream. 1h de boulot + 1 semaine de soak avant enforce.
3. **SEC-03** — Rate limit X-Forwarded-For. Ajustement nginx upstream + lecture du dernier hop côté Hono. ~30 min.
4. **SEC-05** — Retirer `ports:` du service Postgres dans le compose prod. Trivial mais à coordonner.
5. **SEC-04** — `COOKIE_SECURE` défaut à `true`. Trivial (1 ligne de config). Pour les self-hosters tiers.

---

## Sequencing recommandé

```
Semaine 1 (hotfixes critiques)
  ├─ SEC-01    (guards en headers)              ← hotfix
  ├─ SEC-02    (CSP en Report-Only sur upstream)
  ├─ SEC-03    (XFF strip + last-hop)
  └─ SEC-04    (COOKIE_SECURE default true)

Semaine 2 (durcissement)
  ├─ SEC-05    (Postgres pas de ports prod)
  ├─ SEC-08    (SameSite=Strict)
  └─ SEC-10    (WEB_BASE_URL required)

Semaine 3+ (compliance + propreté)
  ├─ SEC-06    (compteurs au lieu de logs user_id)
  ├─ SEC-07    (logo email en base64)
  ├─ SEC-09    (matrice de rétention RGPD + CGU)
  ├─ SEC-02    (CSP enforce après soak)
  └─ SEC-11    (HSTS preload submit)
```

---

## Décisions à figer (avant de commencer)

| Décision | Options | Impact |
|---|---|---|
| `sid + d` en headers ou en body ? | Headers (rapide), body (plus REST) | SEC-01 — préfère headers pour limiter le diff |
| CSP `script-src` strict ou avec nonce ? | `'self'` strict / nonce per-request | SEC-02 — `'self'` strict suffit, l'app ne génère pas de scripts inline |
| Logger : `hono/logger` custom-wrapped suffit-il ? | hono/logger + serializer custom (élide les query params sensibles) / refonte complète | SEC-01 — préfère hono/logger wrapped : Nodea est single-instance, le besoin est le scrubbing pas la structure |
| `COOKIE_SECURE` default | `true` (fail-secure) / `false` (dev-friendly) | SEC-04 — préfère `true`, override explicite en dev |
| `SameSite='Strict'` ou rester `Lax` ? | Strict (plus sûr, casse les liens email vers app) / Lax (actuel) | SEC-08 — vérifier d'abord que les liens depuis email continuent à porter le cookie en Strict (sinon login forcé) |

---

## Angles morts

Ce que je n'ai **pas** pu vérifier depuis le code, et qui peut basculer la posture si mal exécuté :

1. **Configuration upstream nginx complète** — j'ai vérifié les headers via `curl -I` mais pas la conf nginx elle-même. La directive `proxy_set_header X-Forwarded-For` (cf. SEC-03) est sur l'upstream, pas dans le repo.
2. **CVE des dépendances** — `pnpm audit` n'est pas en CI. Pas de `.github/dependabot.yml`. À faire tourner manuellement et, à terme, automatiser.
3. **Secrets dans le bundle web final** — Vite expose `VITE_*` au bundle ; pas inspecté un build pour voir ce qui transpire. Tous les `VITE_API_URL` etc. sont OK (publics par nature) mais à scanner.
4. **Permissions Postgres** — l'utilisateur Postgres applicatif est-il `SUPERUSER` (mauvais) ou un user dédié avec privileges minimaux ? Pas vu de `GRANT` plumbing dans la migration init.
5. **Comportement sous charge** — le rate-limiter est en mémoire process-locale ; en multi-instance (scale-out), chaque réplique a son propre compteur, capacité totale = `max × n_replicas`. Pas critique tant que mono-réplique.
6. **Logs réels en prod** — `hono/logger()` écrit sur stdout (Docker capture). Où vont les logs après ? journald ? fluentd ? log shipping vers cloud externe ? L'impact de SEC-01 dépend du **qui les lit**.
7. **Backups Postgres** — pas vu de logique de backup. Une fuite de backup non chiffré = même surface qu'un dump SQL volé.
8. **WebAuthn rpId rotation** — si jamais le domaine change (`nodea.app` → `nodea.example.org`), toutes les passkeys deviennent inutilisables. Process documenté ?
9. **Firewall VPS** — l'host expose-t-il vraiment Postgres `5433` au monde ? Cf. SEC-05.
10. **TLS config upstream** — `curl -I` confirme HTTPS marche. Mais cipher suites, TLS 1.2 vs 1.3, OCSP stapling — pas vérifiés. À tester via [SSL Labs](https://www.ssllabs.com/ssltest/analyze.html?d=nodea.app).

---

## Comment cocher

- À chaque PR qui livre un fix, cocher les `[ ]` correspondants dans la liste de tâches du finding concerné.
- Quand toutes les tâches d'un finding sont cochées, ajouter `— résolu (commit `xxxxxxx`)` à côté du titre.
- Quand tout un Tier est résolu, déplacer la section en bas du document sous une rubrique « Résolu ».
- Quand toute la roadmap est livrée, retirer le fichier de `docs/roadmap/` (convention du repo : les roadmaps sont des artefacts temporaires qui disparaissent quand leur travail est fait — comme `i18n.md` et `health.md` retirés post-livraison).
