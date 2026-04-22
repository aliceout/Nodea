# Roadmap de migration — Nodea

> **État — terminée.** Toutes les phases (0 → 10) ont été livrées sur
> la branche `refacto`. Le stack cible (Hono + Drizzle + PostgreSQL 16
> + TypeScript strict + pnpm workspaces + Docker) est en place. Le
> cycle de restauration post-migration (R1 → R15) est suivi dans
> [`Feature-Parity-Roadmap.md`](Feature-Parity-Roadmap.md) et dans le
> tracker GitHub sous le label `roadmap` ; il est clos au moment de
> la fermeture de #24.
>
> Le document ci-dessous est conservé comme référence historique —
> les fichiers qu'il cite (`frontend/src/…`, `crypto-js`, PocketBase)
> n'existent plus dans la branche courante.

## Principes directeurs

- **Parallèle, pas en place** : le nouveau back vit à côté de PocketBase jusqu'à la bascule. Pas de cohabitation au niveau données.
- **TS strict dès le début** sur tout nouveau code.
- **Pas de big-bang côté front** : migration module par module.
- **Chaque correctif tracé à un finding des audits** ; fin de phase = findings cochés.
- **Tests avant bascule** sur tout ce qui touche à la crypto.
- **Pas de données à préserver** (confirmé) → on ne prévoit aucun script de migration de contenu utilisateur.

## Stack cible

### Backend

```
Runtime    : Node 22 LTS
Framework  : Hono
ORM        : Drizzle
Validation : Zod
Auth       : sessions cookies httpOnly (pas JWT)
DB         : Postgres 16
Tests      : Vitest + (optionnel) testcontainers
Logs       : Pino
```

### Frontend (conservé, ajusté)

```
Existant  : React 19 + Vite + Tailwind + React Router v7
À ajouter : TanStack Query, Zustand, react-hook-form + Zod
À virer   : date-fns OU dayjs (garder un seul), chart.js OU recharts
```

### Monorepo & déploiement

```
pnpm workspaces (pas Turborepo)
packages/
  api/        → Hono
  web/        → ton front actuel
  shared/     → schémas Zod partagés front↔back
docker-compose : postgres + api + web (nginx)
```

### Justifications clés

- **Hono** plutôt que NestJS/Fastify/Express : typage end-to-end via `hono/client`, zéro magie, démarre en 200ms, parfait en Docker. Pour une app solo, le gain vs décorateurs/DI est net.
- **Drizzle** : typé depuis le schéma (pas de génération comme Prisma), SQL-like lisible, migrations versionnées simples.
- **Sessions cookies** (pas JWT) : logout immédiat, pas de refresh dance, cookie `httpOnly; Secure; SameSite=Lax` non volable en XSS. Résout mécaniquement le finding "guards en localStorage".
- **Pas de lib d'auth** (Lucia/Better Auth/Auth.js) : pour email + password + invite, auth custom ≈ 150 lignes. Argon2id déjà présent, réutilisable.
- **Zustand** : résout le finding "deux systèmes d'état parallèles". API simple, même modèle que `useSyncExternalStore` déjà utilisé.
- **TanStack Query** : cache/refetch/invalidation — encore plus pertinent pour des requêtes chiffrées (pas besoin de redéchiffrer à chaque nav).
- **pnpm workspaces, pas Turborepo** : 3 packages ne justifient pas d'orchestrateur de builds.
- **TypeScript strict** : branded types pour la crypto (`Base64`, `Base64Url`, `AesMainKey`, `HmacMainKey`), client Hono typé end-to-end, types Drizzle auto (`$inferSelect` / `$inferInsert`).

---

## Vue d'ensemble des phases

```
Phase 0  Préparation & gel de portée
Phase 1  Bootstrap monorepo TypeScript
Phase 2  Back : DB, auth, sessions, invitations
Phase 3  Back : modules CRUD + validation guards
Phase 4  Front : refonte du noyau crypto
Phase 5  Front : store unifié + flows auth
Phase 6  Front : câblage Mood, Goals, Passage
Phase 7  Modules manquants (Habits, Library, Review)
Phase 8  Routing, lazy, Error Boundaries, nettoyage libs
Phase 9  Tests & CI
Phase 10 Déploiement Docker + extinction PocketBase
```

**Dépendances** : 1→2→3 en séquentiel sur le back. 4 peut commencer en parallèle de 2. 5 dépend de 4. 6 dépend de 3+5. 7 peut se faire en parallèle ou après 6. 8 après 6. 9 démarre à 2 et s'enrichit partout. 10 est l'étape finale.

---

## Phase 0 — Préparation & gel de portée

**Objectif** : figer ce qui ne bougera plus côté PB et cadrer la migration.

**Livrables**

- Branche dédiée créée pour la migration (ex. `migration/self-hosted`)
- Fichier `MIGRATION.md` à la racine avec : principes, périmètre, checklist de findings
- Décision formelle : **aucune feature nouvelle** sur le code PocketBase existant pendant la migration

**Critère de sortie** : le `MIGRATION.md` est committé, la portée est claire.

---

## Phase 1 — Bootstrap monorepo TypeScript

**Objectif** : poser la structure qui accueillera tout le reste.

**Livrables**

```
/
├── package.json            (workspaces pnpm)
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .eslintrc / eslint.config.ts
├── docker-compose.yml      (postgres + api + web)
├── packages/
│   ├── shared/             (schémas Zod, types branded)
│   │   ├── src/crypto-types.ts
│   │   ├── src/schemas/
│   │   └── package.json
│   ├── api/                (Hono + Drizzle, skeleton vide)
│   └── web/                (front actuel déplacé ici)
```

**Actions spécifiques**

- Déplacer `frontend/` → `packages/web/` (conserve `.jsx` pour l'instant, `allowJs: true`)
- Installer `typescript`, `tsx`, `@tsconfig/strictest`, `@typescript-eslint/*`, `vite-tsconfig-paths`
- Rebrancher les alias `@/core`, `@/ui`, `@/app` via `tsconfig.base.json` paths
- **Nettoyage des dépendances zombies immédiatement** (vérifié : zéro usage dans `src/`) :
  - Supprimer `crypto-js` (jamais importé)
  - Supprimer `argon2-browser` (le code utilise `argon2-wasm` via [webcrypto.js:5](../frontend/src/core/crypto/webcrypto.js#L5))
  - `pnpm remove crypto-js argon2-browser` — risque nul, autant faire le ménage avant de déménager
- Poser le `shared/` avec les premiers branded types crypto :

```ts
export type Base64 = string & { readonly __b: 'Base64' };
export type Base64Url = string & { readonly __b: 'Base64Url' };
export type CipherIV = Base64;
export type EncryptedBlob = Base64;
```

**tsconfig.base.json recommandé**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  }
}
```

**Findings corrigés**

| Finding | Correctif |
|---|---|
| GLOBAL FAIBLE — Deps zombies (`crypto-js`, `argon2-browser`) | Retirées de `package.json`, vérifié zéro usage |

**Critère de sortie** : `pnpm -r build` vert, `pnpm --filter web dev` démarre l'app existante intacte.

---

## Phase 2 — Back : DB, auth, sessions, invitations

**Objectif** : un back minimal qui gère register, login, logout, sessions, invitations atomiques.

**Livrables**

Schéma Drizzle initial :

```
users (id, email UNIQUE, password_hash, encryption_salt,
       encrypted_key, role, onboarding_status, onboarding_version,
       created_at, updated_at)
sessions (id, user_id FK, expires_at, created_at)
invites (id, code_hash UNIQUE, created_by, used_by NULL,
         expires_at, created_at)
```

- Migrations Drizzle versionnées
- Argon2id (via `argon2` node native) pour le hash des mots de passe
- Cookie session : `httpOnly; Secure; SameSite=Lax; Signed`
- Routes :
  - `POST /auth/register` (invite code atomique)
  - `POST /auth/login`
  - `POST /auth/logout`
  - `POST /auth/change-password`
  - `GET /auth/me`
  - `POST /admin/invites` (auth admin requise)
- Politique mot de passe côté back : longueur min, score zxcvbn ≥ 3
- Rate limiting sur `/auth/*` (middleware Hono simple, table `auth_attempts` ou in-memory avec reset périodique)

**Findings corrigés**

| Finding | Correctif |
|---|---|
| SEC HAUTE — Injection filtre invite code | Requête paramétrée Drizzle (`eq(invites.codeHash, hash)`), le problème disparaît structurellement |
| SEC HAUTE — Réutilisation code invitation | Transaction SQL : `SELECT ... FOR UPDATE` → create user → delete invite, atomique. Rollback si n'importe quel step échoue |
| SEC HAUTE — Énumération codes invitation | La validation du code ne se fait que dans `/auth/register`. Jamais d'endpoint public qui "vérifie" un code. Codes stockés hashés (argon2 court), pas en clair. Rate limit sur `/auth/register` |
| SEC MOYENNE — Pas de politique mot de passe (back) | Validation Zod + zxcvbn côté serveur |

**Critère de sortie** : tests d'intégration verts pour les 6 routes auth + un admin seed initialisé.

---

## Phase 3 — Back : modules CRUD + validation guards

**Objectif** : toutes les routes de stockage chiffré, avec validation guard HMAC cohérente sur **toutes** les collections.

**Livrables**

Tables Drizzle pour les 6 modules + `modules_config` :

```
modules_config (user_id PK, cipher_iv, payload)
mood_entries / goals_entries / passage_entries
habits_items_entries / habits_logs_entries
library_items_entries / library_reviews_entries
review_entries
```

Toutes avec : `id, user_id FK, module_user_id, cipher_iv, payload, guard, created_at, updated_at`. Index `(user_id, module_user_id)`.

- Middleware `requireUser` (session → `c.set('user', ...)`)
- **`modules_config` n'a pas besoin de guard** : la table est keyée PK sur `user_id`, donc `requireUser` suffit (aucun `module_user_id` à valider). À documenter explicitement pour éviter la confusion.
- Middleware `requireGuard` générique paramétrable par collection :
  - Vérifie `sid` et `d` en query
  - Vérifie que `module_user_id` appartient bien à `user_id`
  - Vérifie guard en base (comparaison à temps constant) avec fallback `d=init` pour les enregistrements non promus
  - `c.set('entry', row)` pour les handlers
- Routes génériques (une factory par collection) :
  - `GET /:collection/records?sid=...`
  - `POST /:collection/records` (accepte seulement `guard: "init"`)
  - `PATCH /:collection/records/:id?sid=...&d=...`
  - `DELETE /:collection/records/:id?sid=...&d=...`
- **Sérialisation** : les champs `guard` et `encrypted_key` (autres users) ne sortent jamais des handlers. Écrire un test d'intégration qui le vérifie.

**Findings corrigés**

| Finding | Correctif |
|---|---|
| SEC HAUTE — `guard.pb.js` ne couvre pas toutes collections | La factory de routes applique `requireGuard` sur toutes les collections. Impossible d'oublier : ajouter une collection = ajouter une entrée dans un tableau typé qui couvre auto la validation |
| GLOBAL HAUTE — Modules Habits/Library/Review absents (côté schéma DB) | Tables créées dès maintenant, cohérentes avec le schéma documenté |

**Critère de sortie** : un test d'intégration par collection qui prouve le flux `POST init → PATCH promote → GET → PATCH update → DELETE`, et qu'une mutation sans guard retourne 403.

---

## Phase 4 — Front : refonte du noyau crypto

**Objectif** : réécrire `core/crypto/` en TS strict, branded types, corriger tous les findings crypto front. Cette phase ne touche pas encore à PocketBase, elle refait le noyau isolé.

**Ordre interne recommandé** (les deux premiers points sont bloquants car corrigent des risques crypto directs) :

1. **Séparation AES/HMAC via HKDF** (voir ci-dessous) — violation la plus directe de séparation de domaine
2. **Tests Vitest round-trip sur l'ancien code** avant toute suppression, pour pouvoir comparer
3. Puis le reste (base64, branded types, guards, nettoyage)

**Livrables (tous en TS)**

- `core/crypto/base64.ts` : une seule source pour `bytesToBase64`, `base64ToBytes`, `bytesToBase64Url`, `base64UrlToBytes`, `randomBytes`. Typage avec branded types.
  - **État actuel constaté** : 2 implémentations (pas 4) — `toBase64url`/`fromBase64url` dans [crypto-utils.js](../frontend/src/core/crypto/crypto-utils.js) et `bytesToBase64`/`base64ToBytes`/`arrayBufferToBase64`/`base64ToArrayBuffer` dans [webcrypto.js](../frontend/src/core/crypto/webcrypto.js). À unifier en une source.
- `core/crypto/argon2.ts` : wrapper typé sur `hash-wasm` (la lib `argon2-browser` est déjà zombie, nettoyée en Phase 1)
- `core/crypto/aes.ts` : `encryptAESGCM`, `decryptAESGCM`, `AesMainKey` branded
- `core/crypto/hmac.ts` : `HmacMainKey` branded, `sign`
- `core/crypto/hkdf.ts` : dérivation HKDF avec domain separation
- `core/crypto/main-key.ts` :
  - `createMainKeyMaterial(rawBytes: Uint8Array): Promise<MainKeyMaterial>`
  - **Violation actuelle** : [webcrypto.js:115](../frontend/src/core/crypto/webcrypto.js#L115) (`createMainKeyMaterialFromBase64`) importe les **mêmes 32 octets** en `CryptoKey` AES-GCM **et** HMAC-SHA-256. Aucune séparation de domaine.
  - Correctif : dérive via HKDF deux sous-clés distinctes, labels = `"nodea:aes"` et `"nodea:hmac"`, importées en `CryptoKey` non extractibles séparées.
  - `wipeMainKeyMaterial()` : **supprimé plutôt que maintenu en placebo**. Le code actuel teste des `digest()` vides et n'efface que des strings — c'est du théâtre sécuritaire. Remplacer par `bytes.fill(0)` sur les buffers sources uniquement, et documenter que les `CryptoKey` ne peuvent pas être effacées (seul un reload complet le ferait). Si un appelant veut vraiment purger, il appelle `location.reload()`.
- `core/crypto/guards.ts` :
  - Calcul à la volée, plus de cache localStorage (on supprime `nodea.guards.v1`)
  - Cache optionnel en mémoire (Map) seulement, purgé au logout
- `decryptWithRetry` : **existe et est utilisé dans 5+ fichiers** (Mood, Goals, Passage). **Ne pas supprimer aveuglément** — d'abord écrire les tests round-trip, puis tenter de retirer la retry pour voir si des tests échouent. Si la retry papier-masque une vraie race condition, il faut la diagnostiquer avant de l'enlever.
- Fallback double-base64 legacy : à supprimer (aucune donnée legacy à préserver, confirmé).

**Findings corrigés**

| Finding | Correctif |
|---|---|
| SEC HAUTE — Réutilisation clé AES/HMAC (upgradée de MOYENNE) | HKDF avec labels distincts — priorité 1 de la phase |
| GLOBAL HAUTE — Implémentations base64 dupliquées (2 sources, pas 4) | Une seule source, `base64.ts` |
| GLOBAL HAUTE — `randomBytes` en doublon | Une seule fonction exportée |
| SEC HAUTE — `wipeMainKeyMaterial` inefficace | Fonction supprimée, remplacée par `bytes.fill(0)` honnête + doc de limitation |
| SEC MOYENNE — Guards en localStorage | Cache mémoire uniquement, purge au logout |
| SEC FAIBLE — `decryptWithRetry` | Évalué via tests, retiré seulement si non nécessaire |
| SEC FAIBLE — Fallback double-base64 legacy | Supprimé (pas de data legacy à supporter) |

**Critère de sortie** : suite de tests Vitest couvrant :

- Round-trip AES-GCM
- `deriveGuard` déterministe
- HKDF : clés AES et HMAC différentes à partir de la même mainKey
- Round-trip base64 / base64url / bytes
- Test explicite : une sous-clé AES ne peut pas vérifier un HMAC produit avec la sous-clé HMAC (séparation de domaine vérifiée)

---

## Phase 5 — Front : store unifié + flows auth

**Objectif** : unifier l'état, câbler l'auth sur le nouveau back, nettoyer les flows Login/Register/ChangePassword.

**Livrables**

- `core/store/` réécrit avec Zustand (TS), un seul store
- `modulesRuntime.js` singleton → supprimé, sa responsabilité passe dans le store Zustand (`state.modulesRuntime`)
- `core/api/client.ts` : client Hono typé (`hc<ApiType>`)
- `core/auth/useAuth.ts` : s'appuie sur `/auth/me` du nouveau back, plus sur `pb.authStore`
- Pages réécrites en TSX :
  - `Login.tsx` : post sur `/auth/login`, plus de logs verbeux en prod, utilise Zod resolver
  - `Register.tsx` : policy UI (zxcvbn score + longueur), plus de lookup préalable du code
  - `ChangePassword.tsx` : plus de fallback double-base64
- `core/api/modules-config.ts` : utilise le nouveau back, rejette les configs plaintext avec un `console.warn` + tentative de migration immédiate vers format chiffré. Imports morts supprimés.
- Pages gardent PB accessible pour que le reste de l'app continue à marcher pendant que les modules sont portés (interrupteur `VITE_AUTH_BACKEND=new|pb`). On supprime PB en Phase 10.

**Attention** : `window.mainKey` — la correction se fait ici quand `DeleteAccount` est réécrit. Voir Phase 6.

**Findings corrigés**

| Finding | Correctif |
|---|---|
| GLOBAL HAUTE — Deux systèmes d'état parallèles | Zustand unique, singleton supprimé |
| GLOBAL MOYENNE — Imports morts `modules-config.js` | Supprimés |
| GLOBAL INFO — Config modules plaintext silencieuse | `console.warn` + migration automatique au prochain save |
| SEC MOYENNE — Pas de politique mot de passe (front) | Indicateur zxcvbn + longueur mini affichée |
| SEC INFO — Logs verbeux en prod | Conditionnés à `import.meta.env.DEV` |

**Critère de sortie** : register/login/logout/change-password fonctionnent sur le nouveau back, la Homepage (sans module) charge, les tests d'intégration Vitest passent.

---

## Phase 6 — Front : câblage Mood, Goals, Passage

**Objectif** : porter les 3 modules déjà implémentés sur le nouveau back, en TSX, avec les correctifs qualité.

**Pattern répété par module** :

1. Schémas Zod dans `shared/` : `<Module>PayloadSchema`
2. Service `core/api/modules/<Module>.ts` typé via client Hono
3. Port du `flow/<Module>/` JSX → TSX
4. Port de `core/utils/ImportExport/<Module>.tsx`
5. Test e2e : créer, lister, modifier, supprimer, exporter, réimporter

**Findings corrigés par cette phase**

| Finding | Correctif |
|---|---|
| SEC CRITIQUE — `window.mainKey` fallback | Réécriture de `DeleteAccount.tsx` : la clé vient uniquement du store. Si absente → redirect login. `declare global Window` n'expose plus `mainKey` |
| GLOBAL FAIBLE — `_prevEntry` inutilisé | Paramètre supprimé des signatures `updateGoal` / `deleteGoal` |
| GLOBAL FAIBLE — `listDistinctThreads` charge 200 entrées | Pagination complète + cache mémoire avec invalidation (TanStack Query) — le thread étant dans le payload chiffré, impossible d'agréger côté serveur. Compromis inévitable du E2E |
| GLOBAL FAIBLE — FR hardcodé Homepage | Passage par i18n, locale dynamique pour `Intl.DateTimeFormat` |
| GLOBAL FAIBLE — `getPreferredName` champs absents | Supprimé `firstname`/`lastname`/`name`, fallback `username` → `email` |

**Note sur `listDistinctThreads`** : le thread étant dans le payload chiffré, impossible d'agréger côté serveur. Solution : pagination complète + cache mémoire avec invalidation sur create/update/delete (TanStack Query s'en charge). C'est le compromis inévitable du E2E.

**Critère de sortie** : les 3 modules marchent de bout en bout sur le nouveau back, PocketBase n'est plus appelé pour eux.

---

## Phase 7 — Modules manquants (Habits, Library, Review)

**Objectif** : implémenter les 3 modules documentés mais absents.

**Livrables par module**

- Schéma Zod dans `shared/`
- Service `core/api/modules/<Module>.ts`
- `flow/<Module>/index.tsx` + vues + formulaires
- Entrée dans `modules_list.tsx` (avec lazy import — voir Phase 8)
- Fiche de test : création, listing, édition, suppression
- Plugin `ImportExport/<Module>.tsx`

**Findings corrigés**

| Finding | Correctif |
|---|---|
| GLOBAL HAUTE — Modules documentés absents | 3 modules implémentés |

**Critère de sortie** : les 6 modules sont tous activables et fonctionnels.

---

## Phase 8 — Routing, lazy, Error Boundaries, nettoyage libs

**Objectif** : finir le polissage architectural que la migration rend possible.

**Livrables**

- **Routage par URL** : `/flow/:module` remplace `currentTab` dans le store
  - `<Route path="/flow/:module" element={<ModuleResolver />} />`
  - `ModuleResolver` lit `useParams`, rend le composant du module correspondant
- **Lazy loading** :
  - `modules_list.tsx` → `component: React.lazy(() => import('../flow/Mood'))`
  - `<Suspense>` autour du `ModuleResolver`
- **ErrorBoundary** :
  - Un global dans `App.tsx`
  - Un par module dans `ModuleResolver` (isole les crashs)
  - UI de récupération : message + bouton "recharger"
- **Nettoyage dépendances** :
  - Garder `dayjs`, supprimer `date-fns`
  - Garder `recharts`, supprimer `chart.js` + `react-chartjs-2`
  - Supprimer `argon2-browser` (on utilise `hash-wasm`)
  - Supprimer `crypto-js` (tout WebCrypto natif)
- README mis à jour pour pointer sur `docker-compose up` comme méthode principale

**Findings corrigés**

| Finding | Correctif |
|---|---|
| GLOBAL MOYENNE — JSX instancié à l'import | `React.lazy` + composants-ref |
| GLOBAL MOYENNE — Pas de routing URL modules | Routes `/flow/:module` |
| GLOBAL MOYENNE — Pas d'Error Boundary | Boundary global + par module |
| GLOBAL MOYENNE — Installation incohérente README | Réécrit autour du docker-compose |
| GLOBAL FAIBLE — Deux libs dates + deux libs charts | Une seule de chaque |

**Critère de sortie** : bundle initial analysé avec `vite build --report`, chaque module non actif est bien en chunk séparé.

---

## Phase 9 — Tests & CI

**Objectif** : filet de sécurité durable.

**Livrables**

### Tests unitaires (Vitest)

- `shared/` : round-trip de chaque schéma Zod
- `core/crypto/*` : tout (mis en place en Phase 4, enrichi ici)
- `core/store/*` : actions Zustand

### Tests d'intégration back (Vitest + testcontainers Postgres)

- Flow auth complet (register → login → change-password → logout → refuse-stale-cookie)
- Invitations : code utilisé deux fois → second échoue (atomicité)
- Une collection module : CRUD complet + guard rejet
- Couverture minimale pour chaque collection : un test "le middleware guard rejette sans `d`"

### Tests e2e (Playwright, optionnel mais recommandé)

- Parcours register → login → créer entrée Mood → déconnexion → reconnexion → voir l'entrée déchiffrée

### CI (GitHub Actions ou autre)

- Lint + typecheck + tests sur chaque PR
- Job Docker build pour vérifier que l'image se construit

**Findings corrigés**

| Finding | Correctif |
|---|---|
| GLOBAL HAUTE — Aucun test dans le projet | Suite complète crypto + auth + collections |

**Critère de sortie** : CI verte, coverage crypto ≥ 90%.

---

## Phase 10 — Déploiement Docker + extinction PocketBase

**Objectif** : basculer définitivement, supprimer le code PB.

**Livrables**

- `docker-compose.yml` final :

```
postgres      (volume persistant, backup strategy documentée)
api           (build ./packages/api, env vars, healthcheck)
web           (multi-stage: vite build → nginx servant le static + proxy /api)
```

- `.env.example` à jour
- `install.sh` remplacé par un README docker-compose minimaliste
- **Suppression** :
  - `config/pocketbase/`
  - `config/script/install_pocketbase.sh`, `start_pocketbase.sh`, `stop_pocketbase.sh`, `check_superadmin.sh`, `create_admin.sh`, `apply_schema.mjs`, `repair_user_modules.mjs`
  - `pocketbase` dans `package.json`
  - Tout import de `pocketbase` ou `pb.send(...)` restant dans le front
  - `VITE_PB_URL` env var
- **Docs mises à jour** :
  - `README.md` (stack, installation)
  - `documentation/Architecture.md` (re-généré pour refléter le nouveau code)
  - `documentation/Database.md` (Postgres, pas PB)
  - `documentation/Security.md` (reflète HKDF, sessions cookies, pas de cache guard en localStorage)

**Critère de sortie** : `grep -r pocketbase packages/` ne renvoie rien. Un `docker compose up` frais sur une machine vierge donne une app fonctionnelle.

---

## Matrice de traçabilité des findings

### Audit sécurité

| Finding | Sévérité | Corrigé en phase |
|---|---|---|
| `window.mainKey` fallback | CRITIQUE | 6 |
| Injection filtre invite code | HAUTE | 2 |
| Réutilisation code invitation | HAUTE | 2 |
| `wipeMainKeyMaterial` inefficace | HAUTE | 4 |
| Énumération codes invitation | HAUTE | 2 |
| Réutilisation clé AES/HMAC (upgradée) | HAUTE | 4 |
| Guards en localStorage | MOYENNE | 4 |
| Pas de politique mot de passe | MOYENNE | 2 (back) + 5 (front) |
| `decryptWithRetry` (à évaluer) | FAIBLE | 4 |
| Fallback double-base64 legacy | FAIBLE | 4 |
| Logs verbeux en prod | INFO | 5 |

### Audit global

| Finding | Sévérité | Corrigé en phase |
|---|---|---|
| Aucun test | HAUTE | 9 (amorcé dès 4) |
| Implémentations base64 dupliquées (2 sources) + randomBytes doublon | HAUTE | 4 |
| Deps zombies dans `package.json` (`crypto-js`, `argon2-browser`) | FAIBLE | 1 |
| Deux systèmes d'état parallèles | HAUTE | 5 |
| Modules documentés absents du front | HAUTE | 7 |
| `guard.pb.js` ne couvre pas toutes collections | HAUTE | 3 |
| JSX instancié à l'import | MOYENNE | 8 |
| Pas de routing URL modules | MOYENNE | 8 |
| Pas de React Error Boundary | MOYENNE | 8 |
| Installation incohérente README | MOYENNE | 10 |
| Imports morts `modules-config.js` | MOYENNE | 5 |
| `_prevEntry` inutilisé | FAIBLE | 6 |
| Deux libs dates + deux libs charts | FAIBLE | 8 |
| FR hardcodé Homepage | FAIBLE | 6 |
| Code mort `getPreferredName` | FAIBLE | 6 |
| `listDistinctThreads` charge 200 entrées | FAIBLE | 6 |
| Config modules plaintext silencieuse | INFO | 5 |

**Total : 28 findings, 100% couverts** (27 initiaux + 1 ajouté lors de la relecture code : deps zombies).

---

## Ordre de priorité si compression nécessaire

Si à un moment il faut arrêter la migration à mi-parcours et figer, voici l'ordre de valeur décroissante :

1. **Phases 0 → 3** : non négociables. Sans le back, rien ne tient.
2. **Phase 4** : la refonte crypto seule corrige 7 findings d'un coup, dont le critique indirectement.
3. **Phase 5** : store unifié + auth, permet au front de vivre sans PB.
4. **Phase 6** : bascule les 3 modules existants.
5. **Phase 10** : extinction PB.
6. **Phase 7** (modules manquants) : peut attendre après la bascule.
7. **Phase 8** : polissage, peut attendre.
8. **Phase 9** : tests — à faire au moins pour la crypto avant la bascule (Phase 4 les pose), le reste peut attendre.

---

## Risques & mitigations

| Risque | Mitigation |
|---|---|
| Casser la crypto pendant la refonte TS (Phase 4) | Tests Vitest écrits avant de supprimer l'ancien code JS ; round-trip comparé |
| Divergence entre `shared/` et le code d'usage | `pnpm --filter ... ` en mode watch ; typecheck CI bloquant |
| Module mal câblé passe les tests back mais échoue en réel | Un test e2e Playwright par module avant Phase 10 |
| Confusion invite codes (hash vs clair) | Documenter dans `MIGRATION.md` dès Phase 2, jamais stocker en clair |
| Oubli d'une collection dans `requireGuard` | Factory de routes pilotée par un tableau typé unique (phase 3) |
| Release sans les fixes crypto | Phase 10 ne démarre que si la checklist de findings est 100% verte |

---

## Migration TypeScript : stratégie front

Pour éviter le big-bang sur les ~90 fichiers JSX existants, migration ciblée dans l'ordre du risque :

**Phase 1 — Nouveau code en TS strict**
- Le nouveau back : 100% TS dès le départ
- Le package `shared/` : 100% TS
- Active `allowJs: true` + `checkJs: false` côté front pour cohabiter

**Phase 2 — Migration ciblée dans l'ordre du risque**
1. `core/crypto/*` (le plus critique, et celui où TS aide le plus avec des branded types)
2. `core/api/*` (surface qui va changer vers le nouveau back de toute façon)
3. `core/store/*` (le refactor Zustand se fait en TS direct)
4. `core/auth/*`
5. `app/pages/*` (Login, Register, ChangePassword)
6. `app/flow/<module>/*` au fur et à mesure que tu les réécris pour taper la nouvelle API

**Phase 3 — Bascule de `ui/` et `i18n/`**
Mécanique, peu de types complexes, tu renommes `.jsx` → `.tsx` et tu ajoutes des props typées.

**Phase 4 — `strict: true` partout + `allowJs: false`**
Verrouillage de la porte.

### Pièges spécifiques au code Nodea

1. **`argon2-browser` et `hash-wasm`** : vérifier les typings — certaines libs crypto WASM ont des `.d.ts` incomplets. Prévoir des `declare module` de secours ou des wrappers typés.

2. **`CryptoKey` n'a pas de "forme"** : deux `CryptoKey` sont indistinguables pour TS (même si une est AES et l'autre HMAC). Solution : wrapper avec branded types :

```ts
type AesMainKey = CryptoKey & { __brand: 'AesMainKey' };
type HmacMainKey = CryptoKey & { __brand: 'HmacMainKey' };
```

3. **Le `window.mainKey` disparaîtra naturellement** parce que `declare global { interface Window { ... } }` rendra l'ajout explicite et le finding critique sera en face.

4. **PocketBase SDK typings** : plus besoin, on le vire — mais note que si on gardait PB en parallèle pendant la migration, le SDK est typé mais `authStore.model` a un type `Record | null` très faible. C'est un argument de plus pour ne pas garder PB en transition.

---

## Prochaine action concrète

Si cette roadmap est validée, la prochaine action c'est **Phase 1 : bootstrap du monorepo** : poser le squelette complet (pnpm workspaces, `tsconfig.base`, `docker-compose` Postgres + skeleton `api` + `web` déplacé, `shared/` avec les premiers branded types) et commit sur une branche dédiée.
