# 0012 — Tout-camelCase sur le wire (supersède 0003)

- **Status** : Accepted (supersède [ADR-0003](./0003-snake-case-camel-case-frontier.md))
- **Date** : 2026-05

## Context

[ADR-0003](./0003-snake-case-camel-case-frontier.md) actait une **frontière** : `snake_case` côté serveur (DB Postgres + payloads JSON sortis tels quels) et `camelCase` côté client TS, avec un mapper qui traduisait à la frontière. La motivation était que Drizzle exposait les colonnes en camelCase mais le `c.json(row)` ré-émettait en snake_case manuellement, et qu'un mapper côté web suffisait à isoler la convention JS du reste.

Trois choses ont changé depuis :

1. **Le projet est sur le point d'avoir un consommateur externe** : le chantier mobile démarre. Aujourd'hui le mapper côté web absorbe la frontière, mais demain le client mobile (Swift / Kotlin) devrait soit refaire le même mapping, soit consommer une API qui change de convention selon les endpoints (`/auth/me` est camelCase, `/<module>/records` est snake_case). Les deux options coûtent du temps de dev qui ne sert à rien.

2. **Un audit interne** classait la frontière comme « finding sévérité élevée — nulle part documentée comme contrat ». La réponse standard à un finding élevé non documenté est soit de figer la convention dans la doc, soit d'éliminer le besoin de doc. Avec un consommateur externe imminent, éliminer est moins cher long-terme que figer.

3. **Le générateur OpenAPI** (chantier voisin de cet ADR) absorbe les schémas Zod en types TS / Swift / Kotlin. Si les schémas Zod sortent du camelCase systématique, le code généré côté mobile sera idiomatique sans intervention manuelle. Avec deux conventions, le générateur produit des types mixtes que le client doit toujours re-mapper.

## Decision

**Tout-camelCase sur le wire**. Les schémas Zod publics, les payloads JSON émis par les routes, les schémas de payloads chiffrés (Mood, Goals, etc.) et les types TS dérivés via `z.infer` utilisent **uniquement camelCase**.

- **Côté DB** (`packages/api/src/db/schema/*`, fichiers `drizzle/*.sql`) : les colonnes Postgres restent en `snake_case`. C'est la convention SQL standard et changer les colonnes demanderait un script de migration. Drizzle continue d'exposer les colonnes en `camelCase` via la `name → mappedName` translation native — le code TS ne voit jamais le snake_case.
- **Côté wire** : les routes émettent `cipherIv`, `moduleUserId`, `updatedAt`, `buildDate` plutôt que `cipher_iv`, `module_user_id`, `updated_at`, `build_date`.
- **Côté payloads chiffrés** : les schémas dans `packages/shared/src/schemas/modules.ts` (Mood, Goals, Habits, Library, Review) utilisent `moodScore`, `completedAt`, `itemRid`, `coverRid`, `lastYear`, etc. plutôt que `mood_score`, `completed_at`, etc. Les anciennes entrées chiffrées avec les anciens noms ne sont **pas re-déchiffrables après cette migration** — le projet n'a pas d'utilisateurs en prod hors le compte dev qui peut être truncate-et-resseed.

Le mapper côté web (`Library/lib/mappers.ts`, etc.) **disparaît** : avec une convention unique, il n'a plus rien à traduire.

## Consequences

**Positives :**
- **Une seule convention, pas de mapper.** Le code TS qui lit un payload déchiffré accède directement à `entry.completedAt` — plus de double type `GoalsPayload` (snake) + `GoalEntry` (camel) à maintenir en parallèle.
- **Le client mobile est idiomatique tout seul.** Que le générateur OpenAPI produise du Swift ou du Kotlin, les types générés respectent la convention native du langage cible (Swift / Kotlin sont les deux camelCase).
- **L'audit API-01 est résolu sans création de `documentation/API.md`** — la convention « tout-camelCase » se documente toute seule à la lecture du code.

**Négatives :**
- **Migration breaking** sur les blobs chiffrés existants : un utilisateur qui aurait des entrées Goals avec `completed_at` snake_case ne peut plus les déchiffrer après la migration des schémas (le `passthrough()` Zod laisse passer les fields inconnus, mais le code consommateur lit `entry.completedAt`, pas `entry.completed_at`). Acceptable parce que le projet est encore au stade « solo dev avec son propre compte » — les entrées peuvent être supprimées et recréées.
- **La frontière DB ↔ TS reste implicite.** La convention Drizzle (`name: 'snake_case'` qui mappe sur `mappedName: camelCase`) tient ce contrat sans intervention humaine, mais un nouveau venu doit savoir que `users.cipherIv` côté code = `users.cipher_iv` côté SQL. Mitigé par le fait que les fichiers `db/schema/*.ts` exposent les deux noms côte-à-côte.

## Alternatives considered

- **Garder la frontière (ADR-0003 inchangé)** + créer `documentation/API.md` qui documente la dualité. Écarté : ajoute un fichier doc à maintenir, ne supprime pas la double convention que le client mobile devra consommer.
- **Migrer juste le wire wrapper (`cipher_iv` → `cipherIv`) sans toucher aux payloads chiffrés.** Écarté : laisse `completed_at`, `item_rid`, etc. en snake_case dans les payloads chiffrés que le client mobile devra consommer ; le mapper côté web reste nécessaire ; on n'a réglé qu'un demi-problème.
- **Versioning d'URL (`/v1/...` snake_case + `/v2/...` camelCase coexistent)**. Écarté plus tôt par décision utilisateur (cf. discussion Phase 2 du Tier 4) : solo-mainteneur incompatible avec la maintenance de deux versions parallèles.
