# 0001 — Architecture en couches hybride (layered + feature-first)

- **Status** : Accepted
- **Date** : 2026-01 (cutover JSX → TS, Phase 1 du Auth-Roadmap)

## Context

Le projet historique vivait sous une organisation purement **par type technique** (`pages/`, `components/`, `hooks/`, `services/`) — convention React 16 standard. À mesure que les modules métier (Mood, Goals, Library, Journal, Habits, Review) ont grandi, deux problèmes ont émergé :

1. **Les modules sont devenus des « clients dispersés »** : pour comprendre comment Library marche, il fallait sauter entre `pages/Library.jsx`, `components/library/*`, `hooks/useLibrary.js`, `services/library-api.js`. Aucun dossier ne représentait l'ensemble.
2. **Les composants partagés étaient noyés** : `components/Button.jsx` (atom UI réutilisable) et `components/MoodScoreBar.jsx` (spécifique au module Mood) cohabitaient au même niveau, sans signal de réusabilité.

L'équipe a considéré trois alternatives :

- **Pure feature-first** (`features/library/*`, `features/goals/*` avec tout dedans) — mais cela duplique les primitives UI dans chaque feature ou crée un `shared/` fourre-tout.
- **Pure layered** (la situation existante) — déjà identifié comme problématique.
- **Hybride layered + feature-first** — couches techniques pour l'infra (`core/`, `ui/`) + un dossier par module pour la logique métier.

## Decision

**Adopter une organisation hybride** :

- `packages/web/src/core/` — couche infra transverse : crypto, store, API client, auth, modules registry, i18n. Aucune connaissance des modules métier.
- `packages/web/src/ui/` — primitives UI réutilisables, organisées en `atoms/` (Button, Input, Field…) et `dirk/` (composants composés Direction K spécifiques au design system Nodea). Aucune connaissance d'un module métier.
- `packages/web/src/app/flow/<Module>/` — un dossier par module métier authentifié. Contient le `context.tsx` (ou `state/` à partir de REFACTO-08), les `views/`, `components/` et `lib/` propres au module. Peut consommer `core/` et `ui/` mais jamais l'inverse.
- `packages/web/src/app/pages/` — pages publiques (auth, docs) hors du flux modulaire — leur cycle de vie est indépendant et leur URL est exposée.

La règle d'import est unidirectionnelle : `app/flow/<Module>` → `core/`, `ui/`, `app/pages/` → `core/`, `ui/`. Jamais l'inverse.

## Consequences

**Positives :**
- **Découverte** par module : ouvrir `app/flow/Library/` montre tout ce qui constitue Library.
- **Réusabilité** explicite : `ui/atoms/` ne peut pas dépendre d'un module — pas de couplage caché.
- **Nouvel arrivant** : la frontière `core` / `ui` / `module` est une bonne carte mentale en 5 minutes.

**Négatives :**
- **Frontière `lib/` (web racine) vs `core/utils/`** : créée par accident dans le cutover, jamais arbitrée. Suivi en [REFACTO-11](../roadmap/refacto.md) / [ARCH-11](../roadmap/architecture.md).
- **Tentation de mettre des « presque-atoms »** dans `app/flow/<Module>/components/` au lieu de promouvoir vers `ui/`. Mitigé par la règle CLAUDE.md *« reuse before creating »*.
- **Coût d'apprentissage** pour quelqu'un habitué au pure feature-first : il faut comprendre que `ui/atoms/` n'est pas du « shared fourre-tout ».

## Alternatives considered

- **Pure feature-first à la Next.js 14 `app/`** — écarté : duplique les primitives ou crée un `_shared/` fourre-tout. Bien pour une app à 1-2 features, lourd à 6 modules.
- **Domain-Driven Design strict (entities/aggregates/repositories)** — overkill pour une SPA E2EE. Le serveur fait juste du CRUD chiffré, pas de domain logic complexe.
