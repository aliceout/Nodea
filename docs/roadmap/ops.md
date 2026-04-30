# Infra, déploiement & observabilité — audit & roadmap

> **Statut** : audit posé après 5 roadmaps actives
> ([`refacto.md`](./refacto.md), [`security.md`](./security.md),
> [`api.md`](./api.md), [`frontend.md`](./frontend.md),
> [`architecture.md`](./architecture.md)) ; les roadmaps
> `health.md` et `i18n.md` qui ont précédé celle-ci ont déjà
> été livrées et retirées de `docs/roadmap/`. 15 findings —
> **0 critique, 3 élevés, 6 moyens, 4 faibles**, plus 2
> cross-références aux audits précédents. La maturité ops est
> **bonne sur la CI/CD, naïve sur le runtime** : le projet est
> outillé pour qu'un commit ne casse pas la prod, mais pas
> pour savoir que la prod est cassée.
>
> **Mise à jour** : à chaque PR qui livre un fix, cocher la
> case correspondante. Si un fix change le comportement
> opérationnel (healthcheck, alerting, backup), mettre à jour
> `docs/Operations.md` (à créer — cf. OPS-14) dans le **même
> commit**.

Audit mené sur le code au commit `ae12f2a`. **Périmètre limité
à l'infra, déploiement, observabilité, tests** — pas de
sécurité applicative ([`security.md`](./security.md)), pas de
bugs runtime, pas de qualité du code applicatif
([`architecture.md`](./architecture.md)).

---

## Diagnostic global

La maturité opérationnelle de Nodea est **bonne sur la CI/CD,
naïve sur le runtime**. Le pipeline GitHub Actions est sérieux :
lint + typecheck + build + tests sur Postgres réel,
INTEGRITY.txt uploadé en artifact, `docker-build.yml` qui ne
fire qu'après CI green via `workflow_run`, `permissions:
contents: read` explicite sur chaque job, `persist-credentials:
false` (defense-in-depth), concurrency `cancel-in-progress`.
C'est le profil d'une équipe qui a pensé la chaîne *« j'ai
poussé un commit → comment je sais qu'il est sain ? »*. Les
Dockerfiles sont propres (multi-stage côté web, single-stage
assumé côté api parce que `tsx` lance directement TS),
`.dockerignore` est correct, `docker-compose.yml` met une
healthcheck sur Postgres et fait dépendre l'api d'un
`condition: service_healthy`. **Pas de théâtre CI** — ça
teste vraiment.

Mais **dès qu'on quitte la CI, l'observabilité s'effondre**.
Si quelque chose casse à 3h du matin : (1) **personne ne le
saura**, parce qu'il n'y a aucun alerting (pas de Sentry, pas
de Datadog, pas de webhook Slack en cas de 5xx, rien) ;
(2) le `/healthz` répond `{ status: 'ok' }` **même si Postgres
est mort** — il ne vérifie que le process Node, pas la
chaîne ; (3) les logs sont du `hono/logger()` (texte non
structuré, pas de request_id, pas de Pino malgré CLAUDE.md),
donc impossible de corréler des requêtes liées ; (4) il n'y a
**aucune métrique applicative** (latence, throughput, taux
d'erreur), donc on ne peut pas dire *« est-ce que ça a
toujours été lent ou ça vient de se dégrader »*. Le projet va
découvrir ses incidents par les tickets utilisateur, pas par
sa télémétrie.

Le pipeline CD est minimaliste mais **honnête** : tag `:main`
poussé sur GHCR après CI green, le VPS écoute via webhook et
lance `infra/scripts/deploy.sh` qui pull + redémarre la stack
docker-compose. Pas de zero-downtime, pas de canary, pas de
rollback automatique. Pour un projet self-hosted en alpha,
c'est défendable. À noter : la migration DB tourne
automatiquement au boot (`pnpm db:migrate && pnpm start`),
donc une migration cassée bloque le déploiement entier et il
n'y a **pas de migration `down`** (cf. `architecture.md`
ARCH-17).

Sur les tests, la stratégie est **partielle mais pas dégueu**.
55 fichiers de test au total : 21 côté api, 33 côté web, 2
e2e Playwright. La pyramide est inversée : beaucoup d'unit /
integration côté serveur (tests qui hit un vrai Postgres avec
isolation propre via dbname-swap automatique vers `_test` +
refus du `setup.ts` si la DB ne finit pas par `_test`,
**défense en profondeur exemplaire**), beaucoup d'unit côté
front (helpers purs des modules, schemas Zod), **très peu
d'e2e** (2 specs : register/activate/login + totp/enroll/login).
Pour une app avec MFA, passkeys, recovery code, bypass MFA —
2 e2e sur 7+ flows critiques, c'est mince. Le seuil de
couverture **enforced** est précisément `core/crypto/**/*.ts:
90 %` (CLAUDE.md exige ≥ 90 % sur le crypto, c'est en place
et CI échoue si on tombe en-dessous).

Ce qui frappe en bien : le pattern de test DB. `vitest.config.ts`
côté api lit `.env`, identifie si `DATABASE_URL` pointe sur
la dev DB, et **swap le dbname en `_test` automatiquement** ;
et si jamais l'auto-swap rate, `src/test/setup.ts` refuse de
tourner. Deux niveaux de défense pour ne pas TRUNCATE la dev
DB par erreur. C'est rare et c'est exactement le pattern qu'on
espère trouver dans un projet qui a déjà été mordu (la trace
est dans le commentaire : *« cf. #41 »*). Ce qui frappe en
mal : **aucun des deux containers applicatifs (api, web) n'a
de `USER` non-root** dans son Dockerfile, donc en prod tout
tourne en root dans le container — ce n'est pas une faille
immédiate parce que les containers sont isolés, mais c'est la
première chose qu'on retire dans une review sécu standard.

**Phrase pour qualifier la capacité à opérer le système
sereinement** : *« L'équipe est outillée pour qu'un commit ne
casse pas la prod, mais pas pour savoir que la prod est
cassée — la chaîne de prévention est solide, la chaîne de
détection est inexistante. »*

---

## Reconnaissance

### Conteneurisation

- **Docker** + **docker-compose** (3 services prod : `postgres`, `api`, `web`, + `mailpit` profile dev).
- **Pas de Kubernetes** — déploiement single-host via compose.
- API : single-stage Node 22 Alpine, lance `tsx` directement.
- Web : multi-stage builder Node 22 Alpine + runtime nginx Alpine.
- `.dockerignore` propre (exclut `node_modules`, `dist`, `.git`, `.env`, tests, docs).
- Tags : `${NODEA_IMAGE_TAG:-main}` — défaut `main`, paramétrable.

### Plateforme de déploiement

- **VPS self-host** (déduit du commentaire dans `infra/scripts/deploy.sh`).
- Reverse proxy nginx **upstream** sur le VPS (cf. [`security.md`](./security.md) SEC-02 — pose HSTS, X-Frame-Options, etc.) + nginx **dans le container web**.
- **Infisical** comme secret manager.
- **GHCR** pour les images Docker.

### CI/CD

- **GitHub Actions**.
- 2 workflows :
  - [`ci.yml`](../../.github/workflows/ci.yml) — lint + typecheck + build + tests sur Postgres service. Trigger : push/PR sur main, refacto. Concurrency cancel-in-progress.
  - [`docker-build.yml`](../../.github/workflows/docker-build.yml) — build + push images sur GHCR. Trigger : `workflow_run` après CI green sur main.
- **Pas de workflow de déploiement direct** — c'est le VPS qui pull via webhook (mécanisme externe).

### Observabilité

| Catégorie | État |
|---|---|
| **Logs** | `hono/logger()` (texte console.log) côté api. `console.log/warn/error` ad hoc côté web. **Pas de Pino** malgré CLAUDE.md (cf. [`security.md`](./security.md) SEC-01). |
| **Métriques** | **Aucune**. Pas d'exporter Prometheus, pas de `/metrics`, pas de StatsD. |
| **Tracing** | **Aucun**. Pas d'OpenTelemetry. |
| **Sentry / Bugsnag / Rollbar** | **Non installé**. |
| **APM** (Datadog, New Relic) | **Non installé**. |
| **Healthcheck app** | `GET /healthz` → `{ status: 'ok' }` constant, ne vérifie pas la DB. **Healthcheck qui ment.** |
| **Healthcheck Postgres** | ✅ `pg_isready` toutes les 5s, dépendance `condition: service_healthy` dans api. |

### Frameworks de test

| Type | Volume | Outil |
|---|---|---|
| Unit / integration | **21 api + 33 web + tests dans shared** = 55 fichiers | Vitest |
| E2E | **2 specs** (register/activate/login + totp/enroll/login) | Playwright |
| Coverage | mesurée partout, **enforced à 90 % sur `core/crypto/`** seulement | `@vitest/coverage-v8` |
| Contract / property-based | **Aucun** | — |
| Perf / load | **Aucun** | — |

### Outils CI

- ✅ Lint (`pnpm lint` — ESLint flat config)
- ✅ Typecheck (`pnpm -r typecheck` — TS strict)
- ✅ Build (`pnpm -r build`)
- ✅ Tests (`pnpm -r test` avec Postgres service)
- ✅ INTEGRITY.txt uploaded as artifact (90 jours rétention)
- ❌ `pnpm audit` (CVE scan)
- ❌ Trivy / Snyk sur les images Docker
- ❌ CodeQL / GitHub Advanced Security
- ❌ Lighthouse CI (cf. [`frontend.md`](./frontend.md) FRONT-03)
- ❌ Dependabot / Renovate

### Environnements

- **Dev** : local + Postgres via compose dev profile.
- **Test** : isolé via dbname-swap auto vers `nodea_test`.
- **Prod** : VPS self-host via docker-compose + reverse proxy nginx upstream.
- **Pas de staging** identifiable.
- **Pas d'environnement de preview** par PR.

---

## Findings

### OPS-01 — `/healthz` retourne 200 même si Postgres est mort

- **Domaine** : alerting / supervision
- **Sévérité** : élevée
- **Effort** : S (~30 min)
- **Zone concernée** : [`packages/api/src/app.ts:46`](../../packages/api/src/app.ts#L46) — `app.get('/healthz', (c) => c.json({ status: 'ok' }))`
- **Description** : le healthcheck applicatif se contente de répondre 200 — il ne vérifie ni la connectivité Postgres, ni rien d'autre. Si la DB est down, l'api répond toujours `{ status: 'ok' }`. Pour un load balancer ou un système de monitoring qui sonde `/healthz`, c'est un **healthcheck qui ment** : le service n'est pas opérationnel.
- **Tâches**
  - [ ] Étendre `/healthz` pour exécuter `await db.execute(sql\`SELECT 1\`)` et renvoyer 503 si KO.
  - [ ] Optionnel : route `/readyz` (DB + dépendances critiques) distincte de `/livez` (process en vie). Standard k8s.
  - [ ] Documenter dans `documentation/Operations.md` (à créer — cf. OPS-14).
- **Risque** : faible
- **Dépendances** : aucune

### OPS-02 — Aucune intégration runtime de capture d'erreurs ni de webhook 5xx (côté app)

- **Domaine** : alerting
- **Sévérité** : élevée
- **Effort** : M (~2-3h pour le minimum côté app)
- **Statut** : **partagé** — la partie *« choix d'outil »* (UptimeRobot, Sentry cloud vs self-hosted, Discord vs Slack) est dans [`server-config.md` REC-S4-S6](../recommendations/server-config.md#section-2--alerting--monitoring-runtime). La partie code app (SDK Sentry init, middleware webhook 5xx) reste ici.
- **Zone concernée (app)** :
  - [`packages/api/src/app.ts`](../../packages/api/src/app.ts) — pas de Sentry init, pas de middleware 5xx-webhook
  - [`packages/web/src/main.tsx`](../../packages/web/src/main.tsx) — pas de Sentry init côté front
- **Description** : aucune capture d'exceptions runtime, aucun webhook sur 5xx, aucun ping externe sur `/healthz`. Si l'instance crashe ou que la DB tombe, **personne ne sera notifié**. La seule détection possible est *« un user m'a écrit pour dire que l'app marche pas »*.
- **⚠️ Caveat critique — Sentry dépend de SEC-01** :
  > **Ne PAS brancher Sentry avant que SEC-01 (Pino + scrubbing) soit livré.** Sentry capture par défaut les request bodies + cookies dans les events. Tant que `hono/logger()` log les guards HMAC en query string et que les bodies ne sont pas scrubbés, **Sentry exfiltrerait du matériel cryptographique** vers ses serveurs. SEC-01 doit livrer en amont, et l'init Sentry doit utiliser `beforeSend` pour filtrer agressivement les bodies / headers / query.
- **Tâches (app-side)**
  - [ ] **Étape 1 (sans Sentry)** : middleware Hono qui fire un POST sur webhook si `c.res.status >= 500`. URL du webhook via env var `ERROR_WEBHOOK_URL`. ~30 min. **Pas de dépendance à SEC-01** (le webhook envoie juste *« 5xx sur la route X »*, pas de body).
  - [ ] **Étape 2 (Sentry)** : ajouter `@sentry/node` côté API + `@sentry/react` côté web. **Après livraison de SEC-01.** Init avec `beforeSend` qui filtre les request bodies et les query strings sensibles. ~1h.
  - [ ] **Étape 3** : config UptimeRobot ou équivalent côté infra (hors-app — voir REC-S4).
- **Risque** : élevé si Sentry branché avant SEC-01 (fuite de crypto material vers Sentry servers).
- **Dépendances** : OPS-01 (healthcheck honnête), [`security.md`](./security.md) SEC-01 (Pino + scrubbing) **avant Sentry**.

### OPS-03 — Aucun container applicatif (api, web) ne tourne en `USER` non-root

- **Domaine** : build
- **Sévérité** : moyenne
- **Effort** : S (~30 min pour les 2)
- **Zone concernée** : [`packages/api/Dockerfile`](../../packages/api/Dockerfile), [`packages/web/Dockerfile`](../../packages/web/Dockerfile)
- **Description** : les deux Dockerfiles n'ont pas de directive `USER` — donc le process tourne en `root` dans le container. Pas une faille immédiate (le container est isolé du host), mais c'est la première chose qu'un audit sécu container retire. Une CVE Docker / runtime qui permet une évasion devient catastrophique si le process est root.
- **Tâches**
  - [ ] Ajouter dans `packages/api/Dockerfile` (après `WORKDIR /app/packages/api`) :
    ```dockerfile
    RUN addgroup -S nodea && adduser -S nodea -G nodea && chown -R nodea:nodea /app
    USER nodea
    ```
  - [ ] Pour `packages/web/Dockerfile` (stage runtime nginx) : migrer vers `nginxinc/nginx-unprivileged:alpine` qui tourne entièrement en non-root, OU passer `USER nginx` + adapter les chemins de pid/log.
  - [ ] Tester que les containers démarrent et que les volumes / ports fonctionnent toujours.
- **Risque** : moyen (toucher à un Dockerfile peut casser le boot — tester en CI d'abord)
- **Dépendances** : aucune

### OPS-04 — Pas de healthcheck sur les containers api / web

- **Domaine** : alerting
- **Sévérité** : moyenne
- **Effort** : S (~15 min)
- **Zone concernée** : [`docker-compose.yml`](../../docker-compose.yml) — services `api` et `web`
- **Description** : seul `postgres` a un `healthcheck:` block. Les containers `api` et `web` n'en ont pas, donc Docker Compose n'a aucune information sur leur état. Couplé à OPS-01, le diagnostic devient impossible.
- **Tâches**
  - [ ] Ajouter dans `docker-compose.yml` :
    ```yaml
    api:
      healthcheck:
        test: ['CMD-SHELL', 'wget -q -O - http://localhost:3000/healthz || exit 1']
        interval: 30s
        timeout: 5s
        retries: 3
        start_period: 30s

    web:
      healthcheck:
        test: ['CMD-SHELL', 'wget -q -O - http://localhost/ > /dev/null || exit 1']
        interval: 30s
        timeout: 5s
        retries: 3
    ```
  - [ ] Tester via `docker compose ps` que les états `(healthy)` apparaissent.
- **Risque** : faible
- **Dépendances** : à coupler avec OPS-01 (sinon le healthcheck reste bidon).

### OPS-05 — Pas de stratégie de backup Postgres documentée

- **Domaine** : backups / résilience
- **Sévérité** : élevée
- **Effort** : M (~2h pour la partie app — script + doc)
- **Statut** : **partagé** — la partie *« script `backup.sh` + doc procédure restore »* est app-side (vit dans le repo). La partie *« choix de provider off-site »* (Backblaze B2, S3, rsync) est dans [`server-config.md` REC-S7](../recommendations/server-config.md#rec-s7--storage-off-site-pour-les-backups-postgres).
- **Zone concernée (app)** : `scripts/` (où `deploy.sh` vit déjà), `docs/`
- **Description** : pas de script de backup automatique de Postgres dans le repo. Pas de procédure de restore documentée. Si le VPS plante / disque corrompu / `rm -rf` malheureux → **perte de toutes les données utilisateur**. Pour une app E2EE, l'impact est doublement grave : les blobs chiffrés sont perdus, et les utilisateur·ices ne peuvent pas les restaurer eux-mêmes.
- **Tâches (app-side)**
  - [ ] Créer `scripts/backup.sh` qui fait `docker compose exec -T postgres pg_dump ...` → fichier daté dans un dossier local (l'upload off-site est config VPS — voir REC-S7).
  - [ ] Créer `scripts/restore.sh` qui prend un dump en argument et le pousse dans Postgres.
  - [ ] Documenter dans `docs/Operations.md` (à créer — cf. OPS-14) : procédure de restore + rétention recommandée + lien vers REC-S7 pour le storage off-site.
  - [ ] Ajouter un test (manuel ou e2e) : restore d'un dump dans une instance temporaire + smoke test sur un user de test.
- **Risque** : faible (script en lecture seule sur la DB)
- **Dépendances** : REC-S7 (provider off-site) pour la chaîne complète backup → off-site → restore.

### OPS-06 — E2E coverage thin : 2 specs pour 7+ flows auth critiques

- **Domaine** : tests stratégie
- **Sévérité** : moyenne
- **Effort** : L (~1 jour pour 5 nouveaux specs)
- **Zone concernée** : [`packages/e2e/tests/`](../../packages/e2e/tests/) — 2 specs
- **Description** : 2 specs e2e pour une app avec MFA, passkeys, recovery code, bypass MFA, change password, change email, account deletion. Les flows critiques non couverts en e2e :
  - Recovery code generation + use (perte de mot de passe)
  - Passkey enrollment + login (PRF + non-PRF)
  - MFA bypass (clic-de-lien email + délai 7 jours)
  - Change password (re-encryption KEK)
  - Account deletion (cascade FK + clés détruites)
  - Module CRUD (création + lecture + update guard + delete)
- **Tâches**
  - [ ] Ajouter `03-recovery-code-generate-and-use.spec.ts`
  - [ ] Ajouter `04-passkey-enroll-and-login.spec.ts`
  - [ ] Ajouter `05-change-password-rotates-kek.spec.ts`
  - [ ] Ajouter `06-account-deletion-cascade.spec.ts`
  - [ ] Ajouter `07-module-crud-with-guard.spec.ts`
- **Risque** : faible (lecture-seule de la stack, tests Playwright isolés)
- **Dépendances** : aucune

### OPS-07 — Pas de Dependabot / Renovate

- **Domaine** : dépendances
- **Sévérité** : moyenne
- **Effort** : S (~30 min)
- **Zone concernée** : `.github/` — pas de `dependabot.yml` ni `renovate.json`
- **Description** : les versions sont strictement épinglées (CLAUDE.md *« Pin versions (no `^` / `~`) in the new stack »*) — bonne pratique. Mais sans automatisation, les bumps de version se font à la main. À 6 mois, le `pnpm audit` va révéler des CVE non patchées qui s'accumulent silencieusement.
- **Tâches**
  - [ ] Ajouter `.github/dependabot.yml` :
    ```yaml
    version: 2
    updates:
      - package-ecosystem: 'npm'
        directory: '/'
        schedule:
          interval: 'weekly'
        open-pull-requests-limit: 5
        groups:
          minor-and-patch:
            update-types: ['minor', 'patch']
      - package-ecosystem: 'github-actions'
        directory: '/'
        schedule:
          interval: 'monthly'
      - package-ecosystem: 'docker'
        directory: '/packages/api'
        schedule:
          interval: 'monthly'
      - package-ecosystem: 'docker'
        directory: '/packages/web'
        schedule:
          interval: 'monthly'
    ```
  - [ ] Documenter le rythme de review attendu (CLAUDE.md précise déjà *« Dependabot PRs stay open until the user decides »*).
- **Risque** : faible
- **Dépendances** : aucune

### OPS-08 — Pas de scan de sécurité CVE en CI

- **Domaine** : CI
- **Sévérité** : moyenne
- **Effort** : S (~30 min)
- **Zone concernée** : [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
- **Description** : aucun step ne fait `pnpm audit`, aucun scan d'image Docker (Trivy, Grype). Une CVE critique dans une dep peut passer le CI sans alerte. Couplé à OPS-07, la dette CVE peut s'accumuler.
- **Tâches**
  - [ ] Ajouter un step dans `ci.yml` :
    ```yaml
    - name: Audit dependencies
      run: pnpm audit --audit-level=high
      continue-on-error: false
    ```
  - [ ] Ajouter dans `docker-build.yml` un job qui fait `aquasecurity/trivy-action` après le push de l'image.
  - [ ] Décider du seuil bloquant (`high`, `critical`).
- **Risque** : moyen — peut casser des PRs si la baseline a déjà des CVE high. À auditer en pré-flight.
- **Dépendances** : aucune

### OPS-09 — Logs non structurés (`hono/logger()` au lieu de Pino)

- **Domaine** : logs
- **Sévérité** : moyenne (déjà tracké)
- **Effort** : voir [`security.md`](./security.md) SEC-01
- **Zone concernée** : voir [`security.md`](./security.md) SEC-01
- **Description** : déjà flaggé dans l'audit sécu. Impact ops complémentaire : pas de request_id pour corréler des logs liés à une requête, pas de log structuré JSON donc pas d'agrégation propre, pas de niveaux de log applicatifs.
- **Tâches** : voir [`security.md`](./security.md) SEC-01 (option B : Pino + serializer qui élide les query params sensibles).
- **Cross-référence** : à traiter en bloc avec OPS-02 — un Pino bien câblé permet d'envoyer les `error` à Sentry automatiquement.

### OPS-10 — Pas de migrations DB *« down »*

- **Domaine** : CD / résilience
- **Sévérité** : faible (déjà tracké)
- **Effort** : voir [`architecture.md`](./architecture.md) ARCH-17
- **Zone concernée** : voir [`architecture.md`](./architecture.md) ARCH-17
- **Description** : voir ARCH-17. Drizzle ne génère pas de down par défaut. Si une migration échoue à mi-parcours en prod, pas de rollback automatique → restauration depuis backup obligatoire (cf. OPS-05 qui n'existe pas non plus, donc impossible). **Lien direct** : OPS-05 + OPS-10 ensemble = vraie zone de risque.

### OPS-11 — Web Dockerfile build context : copie tout `packages/`

- **Domaine** : build
- **Sévérité** : faible
- **Effort** : S (~15 min)
- **Zone concernée** : [`packages/web/Dockerfile:24`](../../packages/web/Dockerfile#L24) — `COPY packages ./packages`
- **Description** : le builder web copie l'intégralité de `packages/` (donc api/, e2e/, shared/, web/), mais a seulement besoin de `web/` + `shared/`. Build context plus large = transfer plus long, layer cache moins précis.
- **Tâches**
  - [ ] Remplacer par :
    ```dockerfile
    COPY packages/web ./packages/web
    COPY packages/shared ./packages/shared
    ```
  - [ ] Optionnel : structure 2-stages d'install (copy package.json + lockfile d'abord, install, puis copy source) pour cache layer optimal.
- **Risque** : faible
- **Dépendances** : aucune

### OPS-12 — Pas de CHANGELOG.md

- **Domaine** : maintenance
- **Sévérité** : faible
- **Effort** : S (~30 min initial)
- **Zone concernée** : racine du repo
- **Description** : pas de `CHANGELOG.md`. Les changements sont tracés dans `git log` (commits conventionnels) mais pas de release notes lisibles. Pour un self-hoster qui veut savoir *« qu'est-ce qui a changé entre `:main` d'il y a 1 mois et `:main` d'aujourd'hui »* → il doit lire git log.
- **Tâches**
  - [ ] **Option manuelle** : créer `CHANGELOG.md` au format [Keep a Changelog](https://keepachangelog.com/) + maintenir manuellement.
  - [ ] **Option automatique** : `release-please` (Google) qui génère le CHANGELOG depuis les commits conventionnels — déjà en place côté convention.
- **Risque** : aucun
- **Dépendances** : aucune (mais utile à coupler avec un système de release tagué semver)

### OPS-13 — Pas d'environnement de staging (serveur-side)

- **Domaine** : CD
- **Sévérité** : faible
- **Statut** : **finding intégralement infra** — déplacé dans [`server-config.md` REC-S8](../recommendations/server-config.md#rec-s8--staging-environment-décision-business).
- **Description courte** : un seul environnement prod, pas de staging entre `main` CI vert et le VPS de prod. Décision business (selon user-base + appétit pour un VPS supplémentaire).
- **Tâches** : voir [`server-config.md` REC-S8](../recommendations/server-config.md#rec-s8--staging-environment-décision-business).

### OPS-14 — Pas de runbook côté app (engagements SLO en infra)

- **Domaine** : documentation ops
- **Sévérité** : faible
- **Effort** : M (~3h pour la première version du runbook)
- **Statut** : **partagé** — la partie *« doc runbook dans le repo »* est app-side. La partie *« engagements SLO »* (commitments à 99 % disponibilité, etc.) est dans [`server-config.md` REC-S12](../recommendations/server-config.md#rec-s12--slo--sli) parce que ça dépend du contexte d'opération.
- **Zone concernée (app)** : `docs/Operations.md` (à créer)
- **Description** : pas de runbook (*« si l'api est down, voici les 3 commandes à lancer »*), pas de doc d'incident. Pour une équipe à 1 personne, la connaissance vit dans la tête. Pour qu'un nouveau contributor ou un sysadmin de relève puisse intervenir, c'est un gap.
- **Tâches (app-side)**
  - [ ] Créer `docs/Operations.md` avec :
    - Runbook minimal : api down, postgres plein, certificate expiry, restoration backup (lien vers OPS-05)
    - Liens vers les commandes utiles (`docker compose`, `pg_dump`, `pnpm db:migrate`, etc.)
    - Procédure de premier diagnostic d'incident (logs, healthcheck, état des containers)
  - [ ] À enrichir au fil des incidents — chaque incident résolu génère 1 paragraphe de runbook.
- **Risque** : aucun
- **Dépendances** : OPS-05 (procédure restore à documenter), OPS-01 (comportement healthcheck), OPS-02 (config alerting) doivent être livrés pour que le runbook les référence correctement.

### OPS-15 — Postgres exposé via `ports:` dans compose (cross-réf SEC-05)

- **Domaine** : config (cross-réf sécu)
- **Sévérité** : déjà tracké en [`security.md`](./security.md) SEC-05
- **Description** : voir [`security.md`](./security.md) SEC-05.
- **Tâches** : voir [`security.md`](./security.md) SEC-05.

---

## Récap par domaine × sévérité

| Domaine | Critique | Élevée | Moyenne | Faible |
|---|---|---|---|---|
| Alerting / supervision | — | OPS-01, OPS-02 | OPS-04 | OPS-14 |
| Build / Dockerfile | — | — | OPS-03 | OPS-11 |
| Backups / résilience | — | OPS-05 | — | OPS-10 (cross-réf) |
| Tests stratégie | — | — | OPS-06 | — |
| Dépendances | — | — | OPS-07, OPS-08 | — |
| Logs (cross-réf) | — | — | OPS-09 (cross-réf) | — |
| CD | — | — | — | OPS-13 |
| Maintenance | — | — | — | OPS-12 |
| Config (cross-réf) | — | — | OPS-15 (cross-réf) | — |

**0 critique, 3 élevées, 6 moyennes, 4 faibles.** (3 cross-références non comptées en double.)

---

## Top 5 fondations à poser

1. **OPS-01 + OPS-02** combinés — `/healthz` qui interroge la DB + UptimeRobot ou Sentry sur `/healthz` ET sur les 5xx. **Tu détectes si ça casse.** ~1h cumulé. **Le finding le plus rentable du rapport.**
2. **OPS-05** — Backup Postgres + restoration testée. ~3h. **Tu peux récupérer les données après catastrophe.**
3. **OPS-04** — Healthcheck dans compose pour api / web. ~15 min. Précondition pour OPS-02 utilisable.
4. **OPS-03** — `USER` non-root dans les Dockerfiles. ~30 min. Hygiène container minimale.
5. **OPS-06** — 5 specs e2e supplémentaires sur les flows critiques (recovery, passkey, change-password, deletion, modules CRUD). ~1 jour. Le filet de sécurité avant tout prochain refacto auth.

---

## Top 5 améliorations pour une équipe déjà mature

1. **Pino structured logs + request_id** (cf. [`security.md`](./security.md) SEC-01 + OPS-09). Permet l'agrégation centralisée + corrélation traces.
2. **Métriques Prometheus** : `/metrics` endpoint via `prom-client` ou `@hono/prometheus`. Latence par endpoint, taux d'erreur, throughput. Précondition pour SLO.
3. **OpenTelemetry tracing** : traces distribuées api → DB. Inutile à la taille actuelle (single-instance), mais à monter quand la complexité augmente.
4. **Lighthouse CI** sur les PR `packages/web/` (cf. [`frontend.md`](./frontend.md) FRONT-03). Régressions perf détectées en PR.
5. **Tests de contrat** entre client et serveur via les Zod ResponseSchema (cf. [`api.md`](./api.md) API-11 + [`architecture.md`](./architecture.md) ARCH-12). Drift API ↔ client impossible.

---

## Bilan tests — verdict qualitatif

**Filet de sécurité réel sur la crypto, fragile sur le reste.** Le coverage est mesuré, **enforced à 90 %** sur `core/crypto/**/*.ts` (CLAUDE.md exigence respectée + CI échoue si on tombe en-dessous). Les tests unitaires + integration côté api sont nombreux (21 fichiers) et hit un vrai Postgres avec **isolation propre via dbname-swap automatique** vers `_test` + double défense via `setup.ts`. Le pattern de test DB est exemplaire — c'est un signal de maturité. Côté web, 33 tests unitaires sur les helpers purs.

Mais la pyramide est **inversée sur les e2e** : 2 specs Playwright pour ~7 flows critiques. C'est une illusion de couverture sur le bout de chaîne le plus important.

**Les 3 trous les plus graves** :

1. **Aucun e2e sur le flow recovery code** — un user qui perd son mot de passe, génère son code BIP39, et le réutilise pour récupérer ses données. C'est *la* fonction qui justifie l'existence du recovery code. Régression silencieuse possible.
2. **Aucun e2e sur le flow passkey enroll → login** (PRF + non-PRF). Ce flow est non-trivial (WebAuthn + PRF unwrap KEK + session pending → full).
3. **Aucun test d'intégration des handlers HTTP modules CRUD** end-to-end (création entry → guard promotion → update guard → delete).

---

## Bilan observabilité — qu'est-ce qu'on voit / ne voit pas en prod

**Ce qu'on voit aujourd'hui en prod** :
- Si Postgres est down → l'api log un trace dans stdout → Docker capture → `docker logs nodea-api` accessible via SSH.
- Si l'api crash-loop → `restart: unless-stopped` redémarre, et `docker ps` montre l'âge du container.
- Si quelqu'un brute-force le login → le rate-limiter renvoie 429 (la console log une ligne par requête, mais aucun signal agrégé).
- Si une migration échoue au boot → le container ne démarre pas, `docker logs nodea-api` montre le trace.

**Ce qu'on ne voit pas** :
- Latence p50/p99 par endpoint.
- Taux d'erreur 5xx vs 2xx vs 4xx.
- Nombre de logins par heure / par jour.
- Fuites mémoire ou CPU saturé (`docker stats` montre l'instant T, pas l'historique).
- Si le disque postgres se remplit (jusqu'à ce qu'il pète).
- Si une cron job échoue silencieusement.
- Latence DB (slow queries).
- État des sessions actives.
- Volume des emails envoyés / queue Mailpit / Infomaniak.

**Le diagnostic d'un incident à 3h du matin = SSH sur le VPS + `docker logs --tail 1000 nodea-api`.** Outillage de 2010, pas de 2026.

---

## Sequencing recommandé

```
Semaine 1 (fondations détection, ~3h cumulées)
  ├─ OPS-01    (/healthz interroge la DB)
  ├─ OPS-04    (healthcheck containers api/web dans compose)
  └─ OPS-02    (UptimeRobot OU Sentry + webhook 5xx)

Semaine 2 (résilience + hygiène container, ~4h cumulées)
  ├─ OPS-05    (backup Postgres + restoration testée)
  ├─ OPS-03    (USER non-root dans les 2 Dockerfiles)
  └─ OPS-11    (web Dockerfile build context restreint)

Semaine 3 (tests + deps, ~1.5 jour)
  ├─ OPS-06    (5 specs e2e)
  ├─ OPS-07    (Dependabot)
  └─ OPS-08    (pnpm audit + Trivy en CI)

Plus tard (à pondérer)
  ├─ OPS-09    (Pino — couplé avec security.md SEC-01)
  ├─ OPS-12    (CHANGELOG)
  ├─ OPS-13    (staging — décision business)
  └─ OPS-14    (Operations.md + runbook)
```

**Total effort cumulé** : ~2.5-3 jours dev pour Tier 1 + 2 + 3.

---

## Décisions à figer (avant de commencer)

| Décision | Options | Impact |
|---|---|---|
| Outil d'alerting | UptimeRobot (gratuit, basique) / Sentry (free tier 10k events) / Better Stack (free tier) / self-host (Sentry self-hosted) | OPS-02 — recommandé : UptimeRobot pour ping + Sentry free tier pour les exceptions |
| Stratégie de backup | Daily local + sync off-site / S3 versioning / Backblaze B2 | OPS-05 — recommandé : Backblaze B2 (10 GB gratuits) ou Wasabi |
| Seuil bloquant `pnpm audit` | high / critical / aucun (informatif) | OPS-08 — préfère `high` mais auditer la baseline avant |
| Pino vs hono/logger custom | Pino (lourd, structuré) / hono/logger wrapped + serializer custom | OPS-09 — voir security.md SEC-01 |
| Staging envt | Oui (1 VPS supplémentaire) / Non (rester direct main → prod) | OPS-13 — décision business, dépend du user-base |

---

## Angles morts

1. **Incidents passés** — sans connaissance des incidents qui ont vraiment frappé Nodea, impossible de prioriser correctement entre OPS-02 (alerting généraliste) et OPS-05 (backup). Si un user a déjà perdu des données, OPS-05 saute en priorité 1.
2. **Volume utilisateur réel** — combien d'instances, combien d'users par instance, quel rythme d'usage ? Change l'évaluation de OPS-13 (staging — utile au-delà de N users), OPS-14 (SLO — pertinent à partir d'un SLA implicite).
3. **Plan de bascule** — l'instance officielle `nodea.app` bouge-t-elle de VPS ? Si oui, OPS-05 (backup off-site) + OPS-10 (migrations down) + OPS-13 (staging) deviennent prioritaires.
4. **Heures d'activité de l'opérateur** — si tu es seul et tu n'es pas dispo 24/7, OPS-02 (alerting actif) est marginal — tu ne pourras rien faire à 3h du matin de toute façon. Si tu as plusieurs personnes : OPS-02 devient critique.
5. **Coût acceptable** — Sentry, Better Stack, log shipping : tous ont un coût (gratuit jusqu'à un seuil, payant ensuite). Sans budget connu, je propose les options gratuites mais le calcul peut basculer.
6. **Compatibilité de runtime** — si le VPS est sur un OS legacy (Debian 11), certaines images Docker récentes (USER non-root strictes, distroless) peuvent poser souci. Pas vérifiable à distance.
7. **Pratiques de l'équipe** — `pnpm audit` lancé manuellement parfois ? Backup pris à la main ? Sans connaître le rythme actuel, impossible de juger l'écart entre *« pas formalisé mais fait »* et *« pas formalisé donc pas fait »*.

---

## Comment cocher

- À chaque PR qui livre un fix, cocher les `[ ]` correspondants.
- Quand toutes les tâches d'un finding sont cochées, ajouter `— résolu (commit `xxxxxxx`)` à côté du titre.
- Quand un finding est résolu par une **décision documentée** (pas par un fix code — ex : « on garde main → prod direct, pas de staging »), pointer la décision dans le titre du finding.
- Quand toute la roadmap est livrée, retirer le fichier de `docs/roadmap/` (convention du repo : les roadmaps sont des artefacts temporaires qui disparaissent quand leur travail est fait — comme `i18n.md` et `health.md` retirés post-livraison).
