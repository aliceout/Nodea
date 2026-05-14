<!-- markdownlint-disable -->

> Cette page est en cours d'écriture. Les détails opérationnels (backups, monitoring, restauration) seront transférés ici depuis le repo GitHub dans les jours qui viennent.

## À qui s'adresse cette page

Tu veux installer Nodea sur ton serveur ou ton NAS, pour toi seul·e ou pour un cercle restreint, sans dépendre de l'instance officielle.

Si tu cherches plutôt à **comprendre comment Nodea protège tes données**, va sur la section [Sécurité](/docs/security/newbie). Si tu veux **modifier le code pour ta propre version**, va sur [Reprendre le projet](/docs/fork).

## Pourquoi auto-héberger ?

Nodea est **chiffré de bout en bout** : ni l'admin de l'instance officielle, ni le développeur, ne peuvent lire tes données. Mais le modèle web a une limite irréductible — celui qui sert le JS contrôle ce qui s'exécute dans ton navigateur. Dans l'instance officielle, c'est l'équipe Nodea. Sur ton instance, c'est toi.

Pour un usage personnel sensible (journal intime, suivi médical, données familiales), **auto-héberger est recommandé**. Pour un usage professionnel ou collectif, c'est obligatoire.

## Pré-requis serveur

- **Linux** (Debian / Ubuntu / Alpine) — testé en production.
- **Docker** + Docker Compose v2.
- **2 GB RAM minimum** (1 GB pour l'API, 1 GB pour Postgres + cache).
- **5 GB disque** pour le système, plus l'espace pour ta DB chiffrée (compte 100 KB par entrée Mood / Goal, jusqu'à 1 MB par entrée Library avec couverture).
- **HTTPS obligatoire** — Nodea refuse de tourner en HTTP en production (les passkeys WebAuthn et la cookie `Secure` l'exigent).
- **Un nom de domaine** (`nodea.exemple.fr`) avec un certificat TLS valide (Let's Encrypt via Caddy / nginx / Traefik).

## Installation rapide

```bash
git clone https://github.com/aliceout/Nodea.git
cd Nodea
cp .env.example .env
```

Édite `.env` — au minimum :

```sh
COOKIE_SECRET=<32 chars random>
OPAQUE_SERVER_SETUP=<base64url, voir ci-dessous>
WEBAUTHN_RP_ID=nodea.exemple.fr
WEBAUTHN_RP_NAME=Nodea
WEBAUTHN_ORIGIN=https://nodea.exemple.fr
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASSWORD=...
```

Génère un `COOKIE_SECRET` fort :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Génère un `OPAQUE_SERVER_SETUP` (une seule fois — le perdre après inscription des premiers comptes invalide tous les mots de passe stockés) :

```bash
docker compose run --rm api node --input-type=module \
  -e "import { ready, server } from '@serenity-kit/opaque'; await ready; console.log(server.createSetup())"
```

Lance le tout :

```bash
docker compose up -d --build
```

Crée ton compte admin :

```bash
docker compose exec api sh -c \
  'ADMIN_EMAIL=toi@example.com ADMIN_PASSWORD=change-moi pnpm seed:admin'
```

## Variables d'environnement importantes

| Variable | Valeur | Critique ? |
|---|---|---|
| `COOKIE_SECRET` | 32 chars random | Oui — change-le et toutes les sessions actives sont invalidées |
| `OPAQUE_SERVER_SETUP` | Généré une fois, à conserver | Oui — le perdre = comptes existants inutilisables |
| `WEBAUTHN_RP_ID` | Ton domaine sans `https://` ni port | Oui — change-le et toutes les passkeys enrôlées sont perdues |
| `WEBAUTHN_ORIGIN` | URL complète avec `https://` | Oui — doit matcher exactement |
| `SMTP_*` | Provider SMTP | Oui — sans ça pas d'activation, pas de récupération |
| `OPEN_REGISTRATION` | `true` ou `false` | Optionnel — défaut `false` (admin doit envoyer une invitation) |

La liste exhaustive avec types Zod et valeurs par défaut est dans `packages/api/src/config.ts`.

## Reverse proxy (HTTPS)

Nodea écoute sur :3000 (API) et :8089 (web statique) à l'intérieur de Docker. Tu mets un reverse proxy devant qui :

1. Termine TLS (Let's Encrypt via Caddy ou Traefik).
2. Sert le web statique sur `/`.
3. Proxifie `/api/*` vers l'API.

Un exemple `Caddyfile` complet sera publié ici prochainement.

## Mise à jour

```bash
git pull
docker compose pull
docker compose up -d --build
```

Les migrations DB s'appliquent automatiquement au démarrage de l'API. **Forward-only** — pas de rollback possible (cf. ADR-0011 sur le repo GitHub).

## Backup et restauration

Le sujet mérite sa propre section, à venir. La règle de base : **dump quotidien `pg_dump` chiffré** (la DB contient déjà du chiffré E2E mais le dump expose les schémas + métadonnées non-encrypted comme les emails). Restauration testée régulièrement, sinon ce n'est pas un backup.

## Diagnostic en panne

Quand l'instance ne répond plus, fais TOUJOURS ces 4 commandes avant de toucher à quoi que ce soit :

```bash
docker compose ps                  # Quel container est dans quel état ?
curl -fsS http://localhost:3000/healthz | jq .   # API up ?
docker compose logs --tail=50 api
docker compose logs --tail=50 postgres
```

Un runbook ops complet (que faire quand X panne) sera transféré ici depuis `docs/Operations.md` du repo prochainement.
