# 0009 — `library-lookup` déménagé en `services/library-lookup/`

- **Status** : Accepted
- **Date** : 2026-05 (cycle d'audit, Tier 4)

## Context

Le code de recherche de métadonnées de livres (Library module) vit aujourd'hui dans `packages/api/src/routes/library-lookup.ts`. Il cohabite à la racine de `routes/` avec les handlers HTTP fins comme `auth-login.ts`, `admin.ts`, `modules-config.ts`, etc.

Mais `library-lookup` n'est pas une route comme les autres :

- Les routes voisines sont des **handlers fins** : valider l'input avec Zod, appeler la base, retourner le résultat. Quelques dizaines de lignes par route.
- `library-lookup` est un **service à part entière** : il appelle 4-5 fournisseurs externes en parallèle (Google Books, Open Library, BNF, Wikidata, BNE), gère un dispatcher avec ranking par langue, fait du streaming NDJSON pour envoyer les résultats au fil de l'eau. Plusieurs centaines de lignes.

Le laisser à la racine de `routes/` envoie un signal trompeur — un nouveau dev qui ouvre le fichier s'attend à 50 LOC de handler HTTP fin et tombe sur un service de 500+ LOC. La friction n'est pas sur la qualité du code (qui est bonne), elle est sur l'**ambiguïté de la convention** : la racine de `routes/` est-elle pour les handlers HTTP fins seulement, ou pour tout ce qui répond à une URL ?

## Decision

**Déménager `library-lookup` dans un sous-dossier `packages/api/src/services/library-lookup/`** qui contient :

- Le ou les fichiers de logique métier (dispatcher, fournisseurs, ranking, streaming).
- Les types et schémas internes au service.

**Garder un fichier mince `packages/api/src/routes/library-lookup.ts`** qui ne fait que :

- Définir les routes HTTP (`GET /library/lookup/by-isbn`, `POST /library/lookup/by-query/stream`, `GET /library/lookup/cover-fetch`).
- Valider les inputs Zod.
- Appeler le service interne.
- Retourner / streamer la réponse.

Le résultat : la racine de `routes/` ne contient plus que des handlers HTTP fins, et la complexité de `library-lookup` est marquée architecturalement comme un service.

## Consequences

**Positives :**
- **La convention de la racine `routes/` redevient claire.** Tout fichier dans `routes/` est un handler fin (validation + appel + retour). Tout ce qui est plus gros migre dans `services/`.
- **Le service est testable indépendamment du HTTP.** On peut écrire un test du dispatcher de fournisseurs sans monter une `app` Hono — instancier le service, appeler `lookupByQuery({ q, lang })`, vérifier le résultat.
- **Un nouveau dev qui cherche "où est la logique de recherche de livres ?" trouve `services/library-lookup/`** par le nom du dossier au lieu de tomber dessus en explorant `routes/`.

**Négatives :**
- **Coût de la migration.** Un `git mv` pour préserver la blame, des imports à mettre à jour, des tests à re-router. Estimé une demi-heure.
- **Précédent à appliquer cohéremment.** Si `library-lookup` mérite `services/`, est-ce que d'autres routes le mériteraient aussi (genre `auth-mfa-bypass.ts` qui est aussi gros et complexe) ? La règle proposée : `services/` quand le code dépasse ~200 LOC ET fait plus que la chaîne valider→DB→retourner. Pour les autres `auth-*.ts`, la complexité reste dans le handler parce qu'elle est fondamentalement HTTP-bound (la dérivation OPAQUE produit la session cookie qui rentre directement dans la réponse, pas besoin de la sortir en service).

## Alternatives considered

- **Garder à la racine de `routes/`.** Le code marche, et déménager est du rangement pur. Écarté parce que l'ambiguïté de convention coûte une re-démonstration à chaque nouveau dev qui ouvre le fichier.
- **Déménager TOUTES les grosses routes en `services/`** (auth-login, auth-recovery, auth-mfa-bypass, etc.). Écarté : leur complexité est intrinsèquement HTTP-bound (cookies, sessions, redirections), pas une logique métier qu'on isolerait utilement. La séparation handler/service ne donnerait rien sur ces fichiers.

## Quand reconsidérer

Si une autre route serveur dépasse les ~200 LOC et fait du fan-out vers des services externes (genre une intégration à un fournisseur de paiement, un connecteur OAuth tiers), elle mérite probablement le même traitement. Le pattern à appliquer reste le même : handler mince dans `routes/`, logique dans `services/<feature>/`.
