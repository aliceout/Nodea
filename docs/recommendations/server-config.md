# Recommandations serveur (hors-repo)

> **Statut** : ce document collecte les recommandations qui
> portent sur la **configuration du serveur d'hébergement**
> — reverse proxy nginx upstream, choix d'outils de
> monitoring, stratégies de backup off-site, environnements
> d'infra. **Rien ici n'est dans le repo Nodea** ; c'est une
> liste d'actions à mener sur l'instance qui héberge Nodea.
>
> Les findings « partiellement serveur-side » (ex : strip de
> `X-Forwarded-For` côté nginx + lecture du dernier hop côté
> app) ont leur partie **app** trackée dans la roadmap
> correspondante (`docs/roadmap/security.md` SEC-03), et leur
> partie **serveur** ici.
>
> **Public visé** : opérateur·ice de l'instance officielle
> `nodea.app` ET self-hosters tiers qui mettent en place leur
> propre instance.

Source : extrait des audits posés en avril 2026
(commit `a4aa1ea`). Les références *« cf. SEC-XX »* /
*« cf. OPS-XX »* pointent vers les roadmaps app
correspondantes pour le contexte complet du finding.

---

## Section 1 — Reverse proxy nginx upstream

Toutes les recommandations ci-dessous s'appliquent au **reverse
proxy nginx qui tourne sur le VPS de l'instance**, en avant du
container `web` (qui contient son propre nginx pour servir la
SPA).

### REC-S1 — Content-Security-Policy

- **Source** : `docs/roadmap/security.md` SEC-02
- **Sévérité** (sécu) : moyenne
- **Vérification au commit `1c389ae`** : `curl -I https://nodea.app/` confirme que **HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy sont posés** par l'upstream. **Seule la CSP manque.**

**À ajouter** sur le `location /` (qui sert le HTML, pas sur les `/assets/`) :

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; form-action 'self'; base-uri 'self'; object-src 'none'" always;
```

**Notes** :
- `style-src 'unsafe-inline'` est nécessaire pour Tailwind v4 qui inline ses utility classes — pas idéal mais inévitable sans une refonte côté Vite (un nonce sur le HTML servi).
- `https://fonts.googleapis.com` + `https://fonts.gstatic.com` parce que `index.html` charge Instrument Sans/Serif via Google Fonts. Si self-host des fonts un jour, retirer ces sources.
- `frame-ancestors 'self'` redondant avec X-Frame-Options mais c'est l'équivalent moderne.

**Procédure** :
1. Déployer en `Content-Security-Policy-Report-Only` d'abord, ~1 semaine.
2. Surveiller les violations (logs nginx ou endpoint custom `/csp-report`).
3. Switcher en `Content-Security-Policy` (mode enforce).

### REC-S2 — `X-Forwarded-For` strip de l'entrant

- **Source** : `docs/roadmap/security.md` SEC-03 (partie serveur)
- **Sévérité** (sécu) : moyenne

**Problème** : la conf nginx upstream actuelle utilise
`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for`
(append). Si un attaquant envoie `X-Forwarded-For: 1.2.3.4`,
nginx forwarde `1.2.3.4, <real_ip>` à l'api, et le rate
limiter prend le **premier** hop = 1.2.3.4 spoofé.

**À changer** sur l'upstream :

```nginx
# Strip incoming X-Forwarded-For. The real client IP is appended fresh.
proxy_set_header X-Forwarded-For $remote_addr;
```

**Note** : la partie code app (lire le **dernier** hop dans
`packages/api/src/middleware/rate-limit.ts`) est trackée
côté `security.md` SEC-03 — les deux fixes ensemble closent le
finding.

### REC-S3 — HSTS preload

- **Source** : `docs/roadmap/security.md` SEC-11
- **Sévérité** : informatif (renforcement, pas vulnérabilité)

L'instance prod sert déjà
`Strict-Transport-Security: max-age=63072000; includeSubDomains`
— éligible au [HSTS preload list](https://hstspreload.org/).

**Avant de submit** :
- Vérifier que **tous les sous-domaines** de `nodea.app` servent en HTTPS (parce que `includeSubDomains` s'applique).
- Le retrait de la liste prend ~6 mois — quasi-irréversible. À faire seulement quand la config DNS / TLS est stable.

**Action** :
1. Audit des sous-domaines de `nodea.app` : tous en HTTPS ?
2. Ajouter `preload` à la directive HSTS sur l'upstream :
   ```nginx
   add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
   ```
3. Soumettre sur https://hstspreload.org/.
4. Vérifier `https://hstspreload.org/?domain=nodea.app` quelques semaines après.

---

## Section 2 — Alerting & monitoring runtime

### REC-S4 — Choix d'un outil de healthcheck externe

- **Source** : `docs/roadmap/ops.md` OPS-02 (partie choix d'outil)
- **Sévérité** (ops) : élevée

**Pré-requis applicatif** : `docs/roadmap/ops.md` OPS-01
(le `/healthz` doit interroger la DB) — sinon l'outil
externe sondera un endpoint qui ment.

**Options** (par ordre de simplicité) :

| Outil | Coût | Setup |
|---|---|---|
| **UptimeRobot** | Gratuit (50 monitors, ping toutes les 5 min) | ~10 min : créer compte, ajouter monitor sur `https://nodea.app/healthz`, configurer email/SMS d'alerte |
| **Better Stack Heartbeats** | Gratuit (10 monitors) | ~10 min, plus moderne UX, bon pour Slack/Discord webhooks |
| **Healthchecks.io** | Gratuit (20 checks), self-hostable | ~15 min, conçu pour cron jobs + heartbeats |

**Recommandation** : **UptimeRobot** pour démarrer (zéro coût, suffit pour 1 instance).

### REC-S5 — Choix d'un outil de capture d'erreurs

- **Source** : `docs/roadmap/ops.md` OPS-02 (partie capture exceptions)
- **Sévérité** (ops) : élevée

**Pré-requis applicatif** : `docs/roadmap/security.md` SEC-01
(scrubbing des query strings sensibles côté logger) **doit être
livré avant**. Sinon Sentry capturera potentiellement les
guards HMAC, sids opaques, ou d'autres données sensibles dans
les events. **Ne pas brancher Sentry avant SEC-01.**

**Options** :

| Outil | Coût | Notes |
|---|---|---|
| **Sentry cloud** | Free tier 10k events / mois | Le plus complet, intégration `@sentry/node` + `@sentry/react` |
| **Sentry self-hosted** | VPS supplémentaire requis | Plus de contrôle privacy, mais ops overhead |
| **Glitchtip** | Self-hostable, API-compatible Sentry | Plus léger que Sentry self-hosted |

**Recommandation** : **Sentry cloud free tier** pour démarrer
(quitte à migrer vers self-hosted si le volume explose).

**Côté code app** (à faire dans la roadmap `ops.md` OPS-02) :
- Ajouter `@sentry/node` côté API (init dans `app.ts` avec
  `beforeSend` qui filtre les request bodies).
- Ajouter `@sentry/react` côté web (init dans `main.tsx`).
- Configurer le DSN via env vars (`SENTRY_DSN_API`, `VITE_SENTRY_DSN_WEB`).

### REC-S6 — Webhook Slack / Discord sur 5xx

- **Source** : `docs/roadmap/ops.md` OPS-02 (option 3)
- **Sévérité** (ops) : élevée

Plus léger que Sentry si tu veux juste *« être notifié quand
ça pète »*. Webhook entrant Slack ou Discord, déclenché par un
middleware Hono qui poste en POST si `c.res.status >= 500`.

**Choix** :
- Slack — workspace gratuit, webhook entrant gratuit.
- Discord — serveur gratuit, webhook gratuit.
- Telegram — bot gratuit, webhook gratuit.

**Recommandation** : **Discord** si tu n'as pas déjà Slack
(plus rapide à setup pour un projet solo).

---

## Section 3 — Backups & résilience

### REC-S7 — Storage off-site pour les backups Postgres

- **Source** : `docs/roadmap/ops.md` OPS-05 (partie storage off-site)
- **Sévérité** (ops) : élevée

**Pré-requis applicatif** : le script `infra/scripts/backup.sh`
(à créer côté roadmap `ops.md` OPS-05) génère les dumps. Il
faut un endroit **off-site** où les uploader.

**Options** :

| Provider | Coût | Notes |
|---|---|---|
| **Backblaze B2** | 10 GB gratuits, puis $6/TB/mois | API S3-compatible, simple |
| **Wasabi** | $7/TB/mois minimum | S3-compatible, pas de frais egress |
| **AWS S3** | $0.023/GB/mois + egress | Standard mais cher pour faible volume |
| **rsync vers second VPS** | Coût VPS | Si tu as déjà un autre VPS, simple et gratuit |

**Recommandation** : **Backblaze B2** pour démarrer (10 GB
gratuits couvre largement un Postgres Nodea early-stage).

**Procédure de setup** (~30 min) :
1. Créer compte B2 + bucket `nodea-backups`.
2. Créer une App Key avec accès `nodea-backups` seulement.
3. Stocker les credentials sur le VPS (`/etc/nodea/b2-credentials` chmod 600).
4. Le script `backup.sh` upload via `rclone` ou `b2 cli`.
5. Cron quotidien à 4h du matin.

**Rétention recommandée** :
- 7 jours quotidiens
- 4 backups hebdomadaires (mardi par ex.)
- 6 backups mensuels (1er du mois)
- Total ~1.5 mois de profondeur, gérable en quelques GB.

**Test de restauration** : à faire 1 fois par trimestre
minimum. Restaurer dans une instance Postgres temporaire +
vérifier que `pnpm db:migrate` est idempotent + smoke test
sur un user de test. **Un backup non-restauré n'est pas un
backup.**

---

## Section 4 — Environnements

### REC-S8 — Staging environment (décision business)

- **Source** : `docs/roadmap/ops.md` OPS-13
- **Sévérité** (ops) : faible

**Décision à prendre selon l'usage** :

| Cas | Recommandation |
|---|---|
| Self-host pour quelques amis (≤ 10 users) | **Pas de staging.** Direct main → prod. |
| Instance officielle qui ouvre à un user-base inconnu | **Monter staging.** Cf. ci-dessous. |

**Si on monte staging** :
- VPS supplémentaire (peut être plus petit que prod).
- Secrets séparés via Infisical (env `staging`).
- DB séparée (idéalement Postgres dans le même VPS staging).
- Auto-deploy de `main` vers staging via webhook GHCR.
- Prod déployée uniquement sur tag git (cf. REC-S10 — versioning).

**Coût indicatif** : ~5-10 €/mois pour un VPS staging type
Hetzner CX11 ou OVH VPS Comfort.

### REC-S9 — Firewall VPS

- **Source** : `docs/roadmap/security.md` SEC-05 (angle mort)
- **Sévérité** : à vérifier

Le `docker-compose.yml` du repo expose Postgres sur le port
host `5433`. Si le firewall du VPS n'est pas strict, Postgres
devient publiquement atteignable.

**À vérifier** sur le VPS :
```bash
ufw status verbose
# OU
iptables -L -n
```

**Règles recommandées** (ufw) :
```bash
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP (redirect to HTTPS)
ufw allow 443/tcp  # HTTPS
ufw enable
```

Postgres `5433` n'est jamais ouvert au monde. L'accès psql
depuis le host se fait via `docker compose exec postgres psql`
ou ssh-tunneling.

**Note app-side** : le `docker-compose.yml` peut aussi être
modifié pour retirer le port 5433 de l'exposition host — voir
roadmap `security.md` SEC-05.

---

## Section 5 — Observabilité (mature, à long terme)

### REC-S10 — Aggregation des logs

- **Source** : `docs/roadmap/ops.md` (top améliorations équipe mature)
- **Sévérité** (ops) : faible — à long terme

**Pré-requis applicatif** : logs structurés côté api
(`security.md` SEC-01 — scrubbing + format JSON).

**Options** :

| Outil | Coût | Notes |
|---|---|---|
| **Loki + Grafana** (self-hosted) | VPS ressources | Stack standard observabilité |
| **Better Stack Logs** | Free tier 1 GB/mois | Simple, pas d'infra à maintenir |
| **Papertrail** | Free tier 50 MB/jour | Simple, search basique |
| **journald** (déjà sur le VPS) | Gratuit | Logs locaux uniquement, pas d'agg cross-instance |

**Recommandation** : commencer par **journald** (configurer
docker pour logger dedans via `--log-driver=journald`), sufit
pour 1 instance + investigation manuelle par SSH. Pivoter
vers Loki ou Better Stack quand le volume dépasse ce que
`journalctl` lit confortablement.

### REC-S11 — Métriques Prometheus

- **Source** : `docs/roadmap/ops.md` (top améliorations)
- **Sévérité** : long terme

**Pré-requis applicatif** : endpoint `/metrics` côté API via
`prom-client` ou `@hono/prometheus` (à faire dans roadmap
`ops.md` à long terme).

**Stack** :
- Prometheus (self-hosted dans un container)
- Grafana (self-hosted dans un container)

À monter quand le besoin de dashboards latence / throughput
émerge — pas nécessaire pour 1 instance early-stage.

### REC-S12 — SLO / SLI

- **Source** : `docs/roadmap/ops.md` OPS-14
- **Sévérité** (ops) : faible

**Niveau d'engagement** dépend du contexte :

| Contexte | Suggestion |
|---|---|
| Instance officielle alpha | Pas de SLO formel. Best effort. |
| Instance officielle ouverte au public | SLO indicatif : 99 % disponibilité mensuelle, P99 latence < 500 ms |
| Self-hosters tiers | Pas concerné — chacun son SLO |

**Note** : la partie *« runbook »* d'OPS-14 (procédures
d'incident) reste dans le repo (`docs/Operations.md` à
créer). C'est uniquement les **engagements de niveau** qui
sont infra (ce document).

---

## Comment utiliser ce document

- À chaque modif sur le VPS qui livre une recommandation, cocher l'entrée correspondante (à ajouter en `[ ]` quand on s'y met).
- Si une recommandation est livrée définitivement et stable, déplacer en bas du document sous *« Livré »*.
- Si une recommandation est rejetée par décision business (ex : *« on ne fera jamais de staging »*), la déplacer dans *« Décisions arrêtées »* avec la raison.
- Ce document évolue au gré des audits — nouvelles entrées arrivent quand de nouveaux findings serveur-side sont identifiés.

## Index des findings sources

| Recommandation | Source | Statut côté app |
|---|---|---|
| REC-S1 (CSP) | security.md SEC-02 | N/A (intégralement serveur) |
| REC-S2 (XFF strip) | security.md SEC-03 | partie app trackée |
| REC-S3 (HSTS preload) | security.md SEC-11 | N/A (intégralement serveur) |
| REC-S4 (healthcheck externe) | ops.md OPS-02 | dépend de OPS-01 (app) |
| REC-S5 (Sentry) | ops.md OPS-02 | dépend de SEC-01 (app) |
| REC-S6 (Webhook 5xx) | ops.md OPS-02 | partie app trackée |
| REC-S7 (Backup off-site) | ops.md OPS-05 | partie app (script) trackée |
| REC-S8 (Staging) | ops.md OPS-13 | N/A (intégralement infra) |
| REC-S9 (Firewall) | security.md SEC-05 (angle mort) | partie app (compose) trackée |
| REC-S10 (Log aggregation) | ops.md (top équipe mature) | dépend de SEC-01 |
| REC-S11 (Métriques Prometheus) | ops.md (top équipe mature) | partie app trackée |
| REC-S12 (SLO / SLI) | ops.md OPS-14 (partie engagements) | runbook reste app |
