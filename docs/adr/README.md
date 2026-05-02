# Architecture Decision Records

Ce dossier contient les **ADR** (Architecture Decision Records) du projet Nodea. Un ADR est une note courte qui documente **une décision technique** prise à un moment donné, **le contexte** qui l'a motivée, **les alternatives considérées** et **les conséquences** assumées.

## Pourquoi ?

Sans ADR, les décisions architecturales vivent dans des commentaires éparpillés dans le code, des discussions de PR, ou la mémoire de la personne qui les a prises. Quand quelqu'un (toi dans 6 mois, un mainteneur futur, un contributeur de passage) se demande *« pourquoi ne pas avoir utilisé X ici, ça aurait été plus simple ? »*, la réponse doit être **trouvable en moins de 30 secondes**, sans avoir à grep le code ou demander.

Les ADR vivent à côté du code (`docs/adr/`) plutôt que sur un wiki externe pour deux raisons :
1. **Ils sont versionnés avec le code.** Le contexte historique reste cohérent avec l'état du repo au moment de la décision.
2. **Une PR qui change la décision change l'ADR dans le même commit.** L'ADR ne devient jamais silencieusement faux.

## Format

On suit le format [MADR](https://adr.github.io/madr/) (Markdown ADR), version simplifiée. Chaque ADR contient :

- **Status** : `Accepted`, `Superseded by ADR-XXXX`, ou `Deprecated`. Une fois `Accepted`, on ne réécrit pas l'ADR : on en crée un nouveau qui supersède.
- **Context** : ce qu'on essayait de résoudre, les contraintes en jeu.
- **Decision** : la décision prise, formulée en une ou deux phrases.
- **Consequences** : ce qu'on accepte comme tradeoffs (positifs et négatifs).
- **Alternatives considered** *(optionnel)* : les options écartées, avec une ligne disant pourquoi.

## Convention de nommage

`NNNN-short-kebab-case-title.md` où `NNNN` est un numéro à 4 chiffres incrémenté monotonement. Pas de réutilisation après `Deprecated` — un numéro = une décision dans le temps.

## Index

| # | Titre | Statut |
|---|---|---|
| [0001](./0001-layered-hybrid-architecture.md) | Architecture en couches hybride (layered + feature-first) | Accepted |
| [0002](./0002-zustand-single-store.md) | Zustand single store + per-module React contexts | Accepted |
| [0003](./0003-snake-case-camel-case-frontier.md) | Frontière snake_case ↔ camelCase entre serveur et client | Superseded by [0012](./0012-camel-case-only-on-the-wire.md) |
| [0004](./0004-no-request-cache.md) | Pas de cache de requêtes (TanStack Query, SWR, etc.) | Accepted |
| [0005](./0005-no-ssr.md) | Pas de SSR — CSR pur, single-page application | Accepted |
| [0006](./0006-zustand-mono-store-rationale.md) | `nodea-store` en un seul fichier vs splitté en plusieurs slices | Accepted |
| [0007](./0007-hand-rolled-api-client.md) | Client API web : 14 fonctions dédiées vs `hc<AppType>` de Hono | Accepted |
| [0008](./0008-auth-routes-flat.md) | Dossier `auth/` plat plutôt que séparé en couches | Accepted |
| [0009](./0009-library-lookup-as-service.md) | `library-lookup` déménagé en `services/library-lookup/` | Accepted |
| [0010](./0010-getconfig-singleton.md) | `getConfig()` en singleton global | Accepted |
| [0011](./0011-drizzle-forward-only-migrations.md) | Migrations Drizzle forward-only, sans rollback | Accepted |
| [0012](./0012-camel-case-only-on-the-wire.md) | Tout-camelCase sur le wire (supersède 0003) | Accepted |

## Quand écrire un nouvel ADR

Un changement vaut un ADR si **l'une** des conditions suivantes tient :

- La décision affecte **plus d'un fichier** ou **plus d'une couche** du projet.
- Une alternative raisonnable existe et a été écartée pour une raison non triviale.
- Quelqu'un, dans 6 mois, sera tenté de remettre la décision en question sans le contexte.

Pas besoin d'ADR pour : choix d'une lib utilitaire isolée, renaming, refactoring local, fix de bug.
