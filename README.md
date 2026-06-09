# 🍃 Nodea

**Suivi personnel chiffré de bout en bout, auto-hébergeable.**

Une app web pour tenir un journal, suivre ses humeurs, ses objectifs,
ses habitudes, ses lectures, faire son bilan annuel. Tout ce que tu
écris est chiffré dans ton navigateur **avant** d'arriver au serveur —
personne d'autre que toi, pas même l'admin de l'instance, ne peut le
lire.

> **Stack** — Node 22 · Hono · Drizzle ORM · PostgreSQL 16 · React 19 ·
> TypeScript strict · OPAQUE (login sans password en clair) · WebAuthn
> + PRF (passkeys) · TOTP RFC 6238 · BIP39 (code de récupération).

---

## Modules

| Module | À quoi ça sert |
|---|---|
| **Mood** | Humeur quotidienne (score, emoji, 3 positives, commentaire) |
| **Journal** | Entrées libres datées, threads, attachments inline |
| **Goals** | Objectifs (open / wip / done, threads, date de complétion) |
| **Habits** | Habitudes + logs datés (heatmap, taux de régularité) |
| **Library** | Bibliothèque (livres, fiches de lecture, vignettes chiffrées) |
| **Review** | Bilan annuel guidé (parcours YearCompass, 15 sections) |
| **HRT** | Traitement hormonal — doses, biomarqueurs labo, fournisseurs, schémas récurrents |

Chaque module est activable indépendamment depuis **Paramètres**.

---

## Installer (Docker)

Prérequis : Docker + Docker Compose v2.

```sh
git clone https://github.com/aliceout/Nodea.git
cd Nodea
cp .env.example .env
# Édite .env — au minimum COOKIE_SECRET (32 chars random)

docker compose up -d --build
docker compose exec api sh -c \
  'ADMIN_EMAIL=toi@example.com ADMIN_PASSWORD=change-moi pnpm seed:admin'
```

Pour générer un `COOKIE_SECRET` fort :

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Le front répond sur `http://localhost:8080` (port modifiable via
`WEB_PORT`). L'admin invite ensuite d'autres utilisateur·ice·s depuis
**Paramètres → Admin** — Nodea envoie un magic-link par email.

**Mise à jour** :

```sh
git pull
docker compose up -d --build
```

Les migrations sont auto-appliquées au démarrage de l'API.

---

## Développer localement

```sh
docker compose up -d postgres   # Postgres en container, le reste via pnpm
pnpm install
pnpm --filter @nodea/api db:migrate
pnpm dev:api    # port 3000
pnpm dev:web    # port 5173
```

Tests :

```sh
pnpm -r test    # 222 tests d'intégration api + 83 tests unitaires web
```

Trois bases Postgres coexistent sur la même instance, jamais
mélangées : `nodea` (dev / `pnpm dev:api`), `nodea_test` (vitest
api), `nodea_e2e` (Playwright). Le `DATABASE_URL` du `.env` pointe
sur `nodea` ; vitest et Playwright dérivent automatiquement le bon
nom à partir de cette URL — pas de `.env.test` à éditer. Première
fois ? Crée et migre la base de test :

```sh
docker exec nodea-postgres psql -U nodea -d postgres -c "CREATE DATABASE nodea_test;"
pnpm --filter @nodea/api db:migrate:test
```

Garde-fou — `setup.ts` refuse de tourner si `DATABASE_URL` ne se
termine pas par `_test`, pour éviter la régression de #41 (suite
qui truncate la base dev).

La CI GitHub Actions exécute la même suite à chaque push.

Pour comprendre l'architecture avant de toucher le code :
[`docs/Architecture.md`](./docs/Architecture.md),
[`docs/Database.md`](./docs/Database.md), et le
[`CLAUDE.md`](./CLAUDE.md) à la racine (règles dures pour les
contributions humaines comme IA-assistées).

---

## Sécurité — l'essentiel

- **Chiffrement bout-en-bout.** Le contenu utilisateur est chiffré
  (AES-256-GCM) dans le navigateur avant d'atteindre le serveur. La
  clé maîtresse n'existe que côté client.
- **Login sans password en clair.** OPAQUE : ton mot de passe ne quitte
  jamais ton navigateur. Le serveur prouve que c'est bien toi sans
  voir ton secret, même chiffré, même momentanément.
- **Surface minimum côté DB.** Les tables modules (`mood_entries`,
  `goals_entries`…) ne portent ni `user_id` ni timestamps colonnes —
  un opérateur avec accès SQL ne peut pas linker une entrée à un user
  ni dater une écriture.
- **Récupération sans backdoor.** Un code BIP39 de 12 mots, généré au
  premier login, déchiffre une copie de ta clé en cas d'oubli du mot
  de passe. **Si tu perds les deux, les données sont perdues** — c'est
  la contrepartie directe du « personne d'autre ne peut les lire ».
- **Limite supply-chain web honnête.** Un serveur compromis pourrait
  servir du JS modifié qui exfiltre la clé au moment du login.
  Inhérent à toute webapp E2EE — Bitwarden, Standard Notes, Cryptee
  partagent la même limite. Mitigations : Subresource Integrity sur
  l'entry chunk + manifest `INTEGRITY.txt` (SHA-384) publié à chaque
  release. **Pour des usages très sensibles, auto-héberge.**

Threat model complet, matrice d'accès (équipe Nodea / hébergeur /
réquisition judiciaire), et inventaire des champs en clair dans la
page **`/docs`** de l'app déployée — 3 niveaux de lecture (les bases /
la mécanique / sous le capot).

Sources techniques : [`nodea.app/docs/security/tech`](https://nodea.app/docs/security/tech)
(source : [`packages/web/src/app/pages/docs/content/tech.md`](./packages/web/src/app/pages/docs/content/tech.md)),
[`docs/Auth-Spec.md`](./docs/Auth-Spec.md).

---

## Documentation

Index organisé par audience : [`docs/README.md`](./docs/README.md).

- **Curieux** → modules, sécurité concept-level
- **Hébergeur** → docker-compose, supply-chain, release checklist
- **Contributeur** → architecture, schéma DB, spec auth exhaustive

---

## Licence

Open source — [AGPL-3.0-or-later](./LICENSE).
Projet par [@aliceout](https://github.com/aliceout).
