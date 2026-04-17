# 🍃 Nodea — Suivi personnel chiffré

**Nodea** est une application web auto-hébergée pour suivre sa vie, ses envies,
ses objectifs, son humeur, ses habitudes, ses lectures.

Toutes les données sont **chiffrées dans le navigateur** avant d'arriver au
serveur. Personne d'autre que toi — pas même l'admin qui héberge
l'instance — ne peut les lire.

---

## Principes

- **Chiffrement de bout en bout** — AES-GCM + HMAC, clés dérivées via
  Argon2id côté client. Le serveur ne voit que du ciphertext opaque.
- **Séparation cryptographique stricte** — HKDF avec labels distincts
  (`nodea:aes`, `nodea:hmac`) pour que la clé AES et la clé HMAC ne partagent
  aucun secret.
- **Modules activables** — Mood / Goals / Passage / Habits / Library / Review
  s'allument à la demande. Chaque entrée est référencée par un
  `module_user_id` opaque, sans lien direct avec ton compte.
- **Zéro tracking, zéro analytics, zéro partage.**
- **Auto-hébergeable en une commande** — `docker compose up -d --build`.

---

## Stack

- **Backend** : Node 22, [Hono](https://hono.dev), Drizzle ORM, PostgreSQL 16,
  argon2id, Zod. Sessions cookies signées (pas de JWT).
- **Frontend** : React 19, Vite, TypeScript strict, Tailwind, React Router v7,
  Zustand, React Hook Form + Zod, WebCrypto + `hash-wasm`.
- **Monorepo** : pnpm workspaces (`packages/api`, `packages/web`,
  `packages/shared`).
- **Tests** : Vitest (90+ tests, dont intégration sur vraie Postgres).
- **CI** : GitHub Actions (typecheck + build + tests à chaque push).

---

## Modules

| Module  | Description                                                          |
| ------- | -------------------------------------------------------------------- |
| Mood    | Humeur quotidienne (score, emoji, commentaire, positives)             |
| Goals   | Objectifs (titre, statut, thread, note)                               |
| Passage | Journal libre — entrées datées avec thread optionnel                  |
| Habits  | Habitudes (items + logs datés, base d'une heatmap locale)             |
| Library | Livres / films / docs + fiches de lecture                             |
| Review  | Bilan annuel inspiré de YearCompass (parcours guidé)                  |

Spécifications détaillées dans [`documentation/Modules/`](documentation/Modules/).

---

## Installation — auto-hébergement via Docker

### Prérequis

- Docker + Docker Compose v2

### Démarrage

1. **Cloner le repo**

   ```bash
   git clone https://github.com/aliceout/Nodea.git
   cd Nodea
   ```

2. **Configurer l'environnement**

   ```bash
   cp .env.example .env
   # Édite .env :
   #  - COOKIE_SECRET : 32+ caractères aléatoires (obligatoire)
   #  - COOKIE_SECURE : true derrière TLS, false en dev local
   ```

   Pour générer un `COOKIE_SECRET` fort :

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. **Lancer la stack**

   ```bash
   docker compose up -d --build
   ```

   La base Postgres se provisionne au premier démarrage, l'API applique ses
   migrations automatiquement, le front sert sur `http://localhost:8080`
   (modifiable via `WEB_PORT` dans `.env`).

4. **Créer le premier admin**

   ```bash
   docker compose exec api sh -c 'ADMIN_EMAIL=toi@exemple.com ADMIN_PASSWORD=change-moi pnpm seed:admin'
   ```

5. **Se connecter**

   Ouvre `http://localhost:8080`. Le premier compte peut générer des codes
   d'invitation via `Paramètres → Admin` — les utilisateur·ice·s suivant·e·s
   s'inscrivent avec ce code.

### Mise à jour

```bash
git pull
docker compose up -d --build
```

Les nouvelles migrations sont appliquées automatiquement au démarrage.

---

## Développement local (sans Docker pour le front)

Si tu veux hacker sur le code :

```bash
# 1. Postgres en Docker, le reste via pnpm
docker compose up -d postgres

# 2. Install + env API
pnpm install
cp packages/api/.env.example packages/api/.env   # ajuste COOKIE_SECRET

# 3. Migrations + API + Web en watch
pnpm --filter @nodea/api db:migrate
pnpm dev:api   # port 3000
pnpm dev:web   # port 5173
```

Le client web en dev tape directement l'API sur `http://127.0.0.1:3000`
(voir `VITE_API_URL`).

---

## Tests

```bash
# API (intégration + Postgres service container)
pnpm --filter @nodea/api test

# Web (unitaires : crypto, store, client)
pnpm --filter @nodea/web test

# Ou tout d'un coup
pnpm -r test
```

La CI GitHub Actions fait la même chose à chaque push/PR.

---

## Sécurité

- **La sécurité dépend de la force du mot de passe.**
- **Perte du mot de passe = perte irréversible des données.** Pas de
  récupération possible — c'est la conséquence directe de l'E2E.
- **Pas de sauvegarde serveur automatisée.** Pense à backup le volume
  `pgdata` régulièrement (via `docker compose exec postgres pg_dump`), ou
  utilise l'export chiffré par utilisateur·ice.
- **Le serveur ne stocke que du ciphertext** : un dump complet de la DB
  ne révèle aucune donnée utilisateur·ice en clair. L'email et le sel
  d'enveloppe sont les seules métadonnées identifiantes.

Plus de détails dans [`documentation/Security.md`](documentation/Security.md).

---

## Documentation

- [`documentation/Architecture.md`](documentation/Architecture.md) — structure
- [`documentation/Database.md`](documentation/Database.md) — schéma
- [`documentation/Security.md`](documentation/Security.md) — chiffrement,
  guards HMAC, flux d'enregistrement, export
- [`documentation/Modules.md`](documentation/Modules.md) + fiches par module
- [`documentation/Migration-Roadmap.md`](documentation/Migration-Roadmap.md)
  et [`MIGRATION.md`](MIGRATION.md) — historique de la migration PB → Hono

---

## Crédits

Projet open source par [@aliceout](https://github.com/aliceout), sous licence
Mozilla Public License 2.0.
