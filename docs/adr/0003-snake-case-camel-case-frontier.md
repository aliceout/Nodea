# 0003 — Frontière snake_case ↔ camelCase entre serveur et client

- **Status** : Accepted
- **Date** : 2026-02

## Context

Le serveur (Hono + Drizzle + Postgres) parle en `snake_case` partout : noms de colonnes (`module_user_id`, `cipher_iv`, `created_at`), noms de champs JSON sortis tels quels (`item_rid`, `cover_rid`). Le client (TypeScript + React) suit la convention JS standard `camelCase` partout (`moduleUserId`, `cipherIv`, `itemRid`).

Trois conventions étaient envisageables au moment du cutover JSX → TS :

1. **Tout-snake-case** : le client garde `module_user_id` dans ses types et selectors. Cohérent avec ce que les fixtures de seed et les payloads de DB exposent ; mais frotte avec ESLint, les conventions React, et la norme TypeScript.
2. **Tout-camelCase** : le serveur transforme à l'émission JSON, le client reste idiomatique. Plus propre côté client, mais demande un layer de mapping serveur-side et casse la transparence du `c.json(row)` direct.
3. **Frontière explicite** : les deux conventions coexistent, frontière documentée et passée au compilateur.

## Decision

**Frontière explicite, documentée, et typée.**

- **Côté serveur** (`packages/api/`) : tout reste en `snake_case` — colonnes DB, payloads JSON sur le wire, schémas Zod publics. Drizzle expose les colonnes en `camelCase` dans le code TS (par convention de la lib) mais le `toView()` du `collection-factory.ts` re-projette explicitement en `snake_case` sur la réponse HTTP.
- **Côté client** (`packages/web/`) :
  - Les **payloads chiffrés** consommés par le client (encrypted JSON sorti d'AES-GCM côté navigateur) gardent le `snake_case` du serveur — les types `LibraryItemPayload`, `MoodPayload`, etc. dans `@nodea/shared` exposent les champs tels quels (`item_rid`, `cipher_iv`, `cover_rid`).
  - Les **mappers** dans chaque module (`Library/lib/mappers.ts`, `Goals/lib/mappers.ts`, etc.) traduisent `payload.cipher_iv` → `entry.cipherIv` quand le code consommateur attend la convention JS. Le mapper est le seul endroit où la frontière est franchie.
- **Le shared package** (`packages/shared/`) expose les schémas Zod en `snake_case` (côté DB / wire) **et** les types TypeScript dérivés via `z.infer` qui héritent de la même convention. Pas de champ `camelCase` côté shared — il appartient au mapper côté web de re-conventionner si l'UI le veut.

## Consequences

**Positives :**
- **Pas de mapping serveur-side** : `c.json(row)` direct, le serveur reste mince.
- **Le payload chiffré est testable** : un test peut comparer `payload.item_rid === 'rid_xxx'` sans se demander si le mapper a déjà tourné.
- **La frontière est passée au compilateur** : un développeur qui écrit `payload.itemRid` sur un type `LibraryItemPayload` reçoit une erreur tsc — il sait qu'il doit consommer `payload.item_rid` ou utiliser le mapper.

**Négatives :**
- **Inertie cognitive** : un nouveau contributeur côté web peut se demander pourquoi `entry.completedAt` (type `GoalEntry` post-mapper) côtoie `payload.completed_at` (type `GoalsPayload` pré-mapper). La règle *« les types qui finissent par `Payload` sont en snake_case »* est documentée mais demande une seconde pour s'imprégner.
- **Duplication des champs** côté client : pour Goals, le payload chiffré a `completed_at` et l'entry post-mapper a `completedAt`. C'est voulu mais c'est du code qui pourrait paraître redondant à un drive-by reviewer.
- **Le mapper devient un point de mutation centralisé** : si un nouveau champ est ajouté, le mapper doit être mis à jour. Mitigé par tsc qui hurlera à l'exhaustivité du destructure.

## Alternatives considered

- **Tout-camelCase avec un middleware Hono** qui transforme `snake_case` → `camelCase` à l'émission JSON. Écarté : casse la lisibilité des fixtures de tests, demande un layer global qui doit gérer les blobs encryptés différemment des champs métadonnées (les blobs ne doivent PAS être touchés).
- **`type Foo = SnakeCaseToCamel<…>` au niveau type** : transformation purement TS via les template literal types. Écarté : la transformation type-level n'aide pas le code runtime du mapper, et l'écriture initiale est lourde.
