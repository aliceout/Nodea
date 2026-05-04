# 0011 — Migrations Drizzle forward-only, sans rollback

- **Status** : Accepted
- **Date** : 2026-05 (cycle d'audit, Tier 4)

## Context

Drizzle est l'ORM utilisé pour parler à Postgres et pour gérer les migrations de schéma. Les migrations sont générées automatiquement depuis les fichiers de schéma TypeScript (`packages/api/src/db/schema/*.ts`) via `drizzle-kit generate`, qui produit des fichiers SQL dans `packages/api/drizzle/` (genre `0001_init.sql`, `0002_add_passkeys.sql`, etc.).

Ces migrations sont **forward-only** : Drizzle génère le SQL pour passer de la version N à la version N+1, mais ne génère pas le SQL inverse pour passer de N+1 à N. Si une migration plante à mi-parcours en production (genre une perte réseau au milieu d'un `ALTER TABLE` sur une grosse table), la base reste dans un état inconsistent et l'API refuse de booter.

Beaucoup d'autres outils de migration (Rails ActiveRecord, Django migrations, Flyway, Alembic) supportent les migrations inverses comme un mécanisme de rollback : si la migration N+1 plante, on rejoue le SQL inverse pour revenir à N et l'API peut booter en attendant qu'on diagnostique.

## Decision

**Accepter le mode forward-only de Drizzle. Ne pas écrire à la main de SQL inverse pour chaque migration.**

Le filet de sécurité en cas de migration cassée est le **backup Postgres** : restaurer un dump pris juste avant la migration ramène la base à l'état pré-migration, ce qui équivaut à un rollback. Cette dépendance au backup rend la procédure de backup **non-optionnelle** — sans backup à jour, une migration cassée = panne plus ou moins longue selon la complexité du désordre à réparer manuellement.

## Consequences

**Positives :**
- **Migrations triviales à écrire.** `drizzle-kit generate` après chaque modif de `schema/*.ts` produit le SQL automatiquement. Zéro travail manuel pour 95 % des cas.
- **Pas de risque d'inverse incorrect.** Quand un dev écrit à la main un SQL inverse, il a souvent des bugs (la donnée perdue par un `ALTER ... DROP COLUMN` ne peut pas vraiment être rollbackée — un faux inverse remet la colonne mais sans les données, ce qui donne une fausse sensation de sécurité). Le backup, lui, restaure les données.
- **Pas de tentation d'utiliser le rollback en routine.** Quand un mécanisme de rollback existe, il est utilisé pour annuler une migration "raté" en dev — mais en prod, le rollback est un événement d'urgence qui se prépare différemment. Avoir un seul chemin (backup-restore) force la discipline opérationnelle.

**Négatives :**
- **Forte dépendance au backup.** Si l'opérateur n'a pas configuré la procédure de backup (OPS-05), une migration cassée = panne potentiellement longue. Cette dépendance doit être visible dans le runbook (`docs/Operations.md` §5 le mentionne déjà).
- **Pas de "annulation rapide" en cas de migration controversée.** Si une migration est mergée puis qu'on se rend compte le lendemain qu'elle pose problème (genre elle change la sémantique d'un index de manière subtile), il n'y a pas de bouton "annuler" — il faut soit avancer (écrire la migration N+2 qui répare), soit restaurer un backup (perte de toutes les données saisies entre les deux). Mitigé par la review en PR avant merge.

## Alternatives considered

- **Écrire à la main une migration inverse pour chaque modif.** Écarté pour les raisons listées : l'inverse est error-prone, la sensation de sécurité est fausse (les données perdues par un DROP ne sont pas restaurées), et la discipline d'écriture systématique est rarement maintenue dans la durée (les premières migrations ont leur inverse, les dernières l'oublient).
- **Adopter un autre outil avec rollback natif** (Atlas, Bytebase, etc.). Écarté parce que Drizzle est déjà bien intégré au reste du code TypeScript (les schémas servent aussi de source pour les types) et que changer d'outil coûterait beaucoup pour résoudre un problème qui se gère bien avec des backups.
- **Snapshot de schéma avant chaque migration via `pg_dump --schema-only`.** Une variante du backup-mais-pas-tout. Écarté parce que le schéma sans les données ne sert à rien — le scénario "rollback rapide" demande de récupérer aussi les données dans leur ancien shape, ce que seul un dump complet fait.

## Quand reconsidérer

Si l'instance grossit au point que les backups deviennent trop volumineux pour être pris à chaque déploiement (genre plusieurs heures de dump), le coût d'un rollback-via-backup devient prohibitif et l'écriture manuelle d'inverses devient justifiée. Tant que les backups sont rapides à prendre (minutes) et l'instance assez petite pour qu'un restore reste viable, garder forward-only.
