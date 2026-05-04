# Operations runbook

Ce fichier documente **comment opérer** une instance Nodea : que faire quand quelque chose casse, où sont les logs, comment redémarrer, comment restaurer un backup. C'est le runbook que tu lis à 3 h du matin quand l'instance est down.

> **Audience** : opérateur·ice qui héberge sa propre instance Nodea (l'instance officielle est gérée par l'équipe Nodea). Les commandes Docker partent du principe que `docker-compose.yml` est à la racine du repo et que tu es loggé sur le VPS qui héberge l'instance.

---

## 1. Diagnostic en premier

Quand un problème est signalé, fais **toujours** ces 4 commandes avant de toucher à quoi que ce soit :

```bash
# 1. Quel container est dans quel état ?
docker compose ps

# 2. Le healthcheck api répond ?
curl -fsS http://localhost:3000/healthz | jq .

# 3. Tail des 50 dernières lignes côté api
docker compose logs --tail=50 api

# 4. Tail côté postgres
docker compose logs --tail=50 postgres
```

Le résultat de ces 4 commandes te donne 90 % du diagnostic. **Copie-les dans un fichier ou un canal d'incident** — si tu redémarres avant, tu perds le contexte qui te dirait pourquoi ça pétait.

---

## 2. L'API ne répond pas (502 / timeout)

### Symptômes
- Le navigateur affiche `502 Bad Gateway` ou un timeout sur `/api/*`.
- `curl /healthz` ne répond pas ou retourne 503.
- Les utilisateur·ices peuvent voir l'écran de login (statique) mais pas se logger.

### Causes les plus fréquentes

1. **Le container api a crashé** — `docker compose ps` montre `Exit 1` ou `Restarting`.
2. **Postgres est down** — l'api boot mais `/healthz` retourne `db_unreachable`.
3. **OOM kill** — l'api a été tuée par le kernel (vérifie `dmesg | tail`).
4. **Disk full sur le VPS** — Postgres refuse les writes ; les logs api sont pleins de `ENOSPC`.

### Procédure

```bash
# Si l'api est exited / restarting
docker compose logs api --tail=200          # lis le crash log
docker compose restart api                  # redémarre

# Si Postgres est down
docker compose logs postgres --tail=200
docker compose restart postgres
sleep 10
docker compose restart api                  # api refuse de redémarrer tant que postgres n'est pas ready

# Si le disque est plein
df -h                                        # confirme
# → libère de l'espace ou étend le volume avant de redémarrer
```

Si la cause n'est ni l'une ni l'autre : **ne pas redémarrer en boucle**. Lis les logs api au-delà des 200 dernières lignes, cherche un message qui ressemble à une stack trace TS, ouvre une issue GitHub avec le contexte avant de tenter quoi que ce soit.

---

## 3. Postgres saturé en disque

### Symptômes
- L'api log `disk full` ou `could not extend file`.
- `df -h` montre le volume `/var/lib/docker/volumes/...nodea_pg...` à 100 %.

### Procédure

```bash
# 1. Identifier la table qui pèse
docker compose exec postgres psql -U nodea -d nodea -c "
  SELECT relname AS table,
         pg_size_pretty(pg_total_relation_size(relid)) AS size
  FROM pg_catalog.pg_statio_user_tables
  ORDER BY pg_total_relation_size(relid) DESC LIMIT 10;
"

# 2. Lance le cron de cleanup à la main (purge sessions expirées + users non activés)
docker compose exec api node -e "
  import('./dist/cron/index.js').then(m => m.runCleanupUnactivatedAccounts());
"

# 3. Si encore plein : VACUUM FULL (downtime ~1 min sur grosse table)
docker compose exec postgres psql -U nodea -d nodea -c "VACUUM FULL;"
```

Si ces 3 étapes ne suffisent pas, le volume est à étendre côté VPS. Pas de raccourci magique côté app.

---

## 4. Certificats TLS expirés

### Symptômes
- Les utilisateur·ices voient un avertissement de certificat dans le navigateur.
- `curl https://nodea.example.org` répond `SSL certificate problem: certificate has expired`.

### Procédure

Dépend de ton setup TLS. Si tu utilises **Caddy** (recommandé pour les self-hosters) :

```bash
docker compose exec caddy caddy reload     # force un renouvellement Let's Encrypt
docker compose logs caddy --tail=50
```

Si tu utilises **certbot + nginx** :

```bash
sudo certbot renew --dry-run               # vérifie d'abord en dry-run
sudo certbot renew                          # renouvelle pour de vrai
sudo systemctl reload nginx
```

**Prévention** : configure un cron `0 3 * * 1 certbot renew` (chaque lundi à 3 h) pour ne jamais retomber dans cette situation.

---

## 5. Restoration d'un backup

> **Pré-requis** : un backup `.sql.gz` produit par `pg_dump` doit exister quelque part. Si tu n'en as pas, mets en place un job de backup automatique avant d'en avoir besoin.

### Procédure (perte de données complète, recovery from scratch)

```bash
# 1. Stoppe l'api pour éviter les writes pendant la restore
docker compose stop api

# 2. Drop la DB existante (DESTRUCTIF — assure-toi que tu as bien le bon backup)
docker compose exec postgres psql -U nodea -d postgres -c "DROP DATABASE nodea;"
docker compose exec postgres psql -U nodea -d postgres -c "CREATE DATABASE nodea;"

# 3. Restore depuis le dump
gunzip -c /path/to/backup-YYYY-MM-DD.sql.gz | \
  docker compose exec -T postgres psql -U nodea -d nodea

# 4. Redémarre l'api (les migrations Drizzle ne re-tournent pas — la DB restaurée a déjà le schéma)
docker compose start api

# 5. Vérifie
curl -fsS http://localhost:3000/healthz | jq .
```

**Critique** : en E2EE, restaurer la DB ne suffit **pas** à restaurer l'accès. Chaque utilisateur·ice doit toujours avoir son mot de passe + son code de récupération. Si la DB et les utilisateurs ont été perdus en même temps (par exemple un VPS rasé sans backup utilisateur), les blobs restaurés sont du bruit cryptographique.

---

## 6. Migration de schéma DB

Drizzle migre **au démarrage de l'api**, automatiquement. Une nouvelle migration arrive avec une nouvelle image Docker :

```bash
docker compose pull
docker compose up -d
docker compose logs api --tail=50         # vérifie que les migrations se sont appliquées
```

Si une migration échoue à mi-parcours (rare, mais possible) : Drizzle ne génère pas de `down` migrations, donc la seule remédiation est **restore depuis backup** (cf. §5).

---

## 7. Logs

### Où les trouver

- **api** : `docker compose logs api`. Format = `hono/logger()` une ligne par requête HTTP (méthode, path, status, durée). **Pas de cookies, pas de body, pas d'identifiants** — voir [`Security.md` §8.4](./Security.md#84-server-side-logs).
- **postgres** : `docker compose logs postgres`. Verbeux ; le cron de cleanup hebdo y log `[cron] cleanup-unactivated done {users: N, sessions: M}`.
- **web** (le container nginx qui sert les assets statiques) : généralement silencieux. Les access logs sont configurables.
- **Sentry** : si `SENTRY_DSN` est configuré, les erreurs api + web y atterrissent. Le `beforeSend` strippe cookies/query/body/headers — voir [`Security.md` §8.5](./Security.md#85-sentry-telemetry).

### Rotation

Configurer la rotation au runtime : `docker compose up -d` accepte `--log-opt max-size=50m --log-opt max-file=3` ou équivalent dans un `docker-compose.override.yml`. **Recommandé** : 7 jours de rétention max, pas d'archive offsite (cf. matrice rétention RGPD).

---

## 8. Premier secours — état des containers en une commande

```bash
# Snapshot complet pour un report d'incident
docker compose ps && \
echo "---" && \
curl -fsS http://localhost:3000/healthz && \
echo "---" && \
df -h | grep -E "^(/dev|Filesystem)" && \
echo "---" && \
docker compose logs --tail=20 api && \
echo "---" && \
docker compose logs --tail=20 postgres
```

Copie ce bloc dans `/usr/local/bin/nodea-snapshot.sh`, `chmod +x`, et tu as un one-shot pour produire le contexte d'un incident.

---

## 9. Engagements opérationnels

Les engagements de disponibilité (SLO / SLI), la procédure de notification utilisateur·ices en cas d'incident, et les pratiques de monitoring infrastructure (Grafana, Prometheus, alertes) vivent côté **infra** et non dans ce repo. Voir [`docs/recommendations/server-config.md`](./recommendations/server-config.md) pour les recommandations de l'opérateur de l'instance officielle.

Pour les self-hosters, la règle de pouce : **monitor activement** `/healthz` (uptime check externe genre UptimeRobot, gratuit) et **passivement** Sentry (si configuré) pour les erreurs runtime.

---

## 10. À enrichir au fil des incidents

Chaque incident résolu = un paragraphe dans ce fichier qui dit ce qui a marché. **Ne jamais documenter ce qu'on a essayé qui n'a pas marché** dans le runbook (ça a sa place dans une postmortem, pas ici). Le runbook est un guide d'action, pas une archive de fausses pistes.
