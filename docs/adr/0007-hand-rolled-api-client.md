# 0007 — Client API web : 14 fonctions dédiées vs `hc<AppType>` de Hono

- **Status** : Accepted
- **Date** : 2026-05 (cycle d'audit, Tier 4)

## Context

Le client web parle au serveur Hono via une dizaine de fichiers dans `packages/web/src/core/api/` (`auth.ts`, `passkeys.ts`, `mfa.ts`, `totp.ts`, `library.ts`, `admin.ts`, etc.). Chaque fichier expose une dizaine de fonctions dédiées du genre `apiLoginStart`, `apiPasskeyEnrollFinish`, `apiAdminListAnnouncements` qui appellent un wrapper `request<T>()` interne (cf. ADR-12 sur la validation runtime). Les types des bodies et responses sont importés depuis `@nodea/shared` (les schémas Zod publiés dans le package partagé).

Hono ships une alternative : `hc<AppType>(baseUrl)`. C'est un client HTTP typé qui infère automatiquement le shape de chaque endpoint à partir de la définition serveur (le type `AppType` exporté par le `buildApp()`). Le client devient utilisable sans aucune écriture manuelle par endpoint — `client.auth.login.start.$post({ json: { email, ... } })` est typé bout en bout, du body au response.

L'ergonomie de `hc<AppType>` est meilleure que les fonctions dédiées (zero boilerplate, zero risque de drift entre serveur et client). La question est : pourquoi on l'a pas adopté ?

## Decision

**Garder les fonctions dédiées hand-rolled, ne pas adopter `hc<AppType>`.**

## Consequences

**Positives :**
- **Pas de dépendance forte au shape interne du serveur Hono.** Si on refactore le routing serveur (genre on déplace `library-lookup` de routes/ vers services/, ou on change les noms de fichiers), le client n'est pas affecté — il dépend des schémas Zod publiés dans `@nodea/shared`, pas de la structure des fichiers serveur.
- **Le client est utilisable depuis n'importe quel autre consommateur** (script de seed, tests d'intégration, futur SDK mobile généré depuis OpenAPI) parce que les schémas Zod sont la source de vérité, pas le typage Hono.
- **L'erreur de routage est explicite côté client.** Si le serveur change le path d'un endpoint, le client échoue avec un 404 visible — facile à débugger. Avec `hc<AppType>`, un mismatch de path se traduit par une erreur de typage TypeScript opaque qui pointe vers une définition générique au lieu de l'endpoint concerné.

**Négatives :**
- **14 fichiers à maintenir à la main.** Chaque nouvel endpoint demande ~10 lignes de code wrapper. C'est répétitif et le risque de drift entre signature serveur et signature client existe (atténué par les types `*Body` / `*Response` partagés via `@nodea/shared`, donc le drift est attrapé par tsc).
- **Pas d'autocomplete des paths côté client.** L'autocomplete sur `client.auth.login.start.$post(...)` aurait été agréable. À la place, le dev tape `apiLoginStart(...)` qui demande de connaître le nom de la fonction.

## Alternatives considered

- **`hc<AppType>` avec refactor du routing serveur.** Le pattern actuel `app.route('/auth', authRoutes)` casse l'inférence de Hono : `hc<AppType>` ne voit pas les routes mountées via `route()`, seulement les routes définies inline sur le `app` racine. Pour faire marcher `hc<AppType>`, il faudrait refondre l'organisation des routes — pas un coût négligeable, et les tradeoffs deviendraient discutables (un fichier `app.ts` géant ou des centralisations forcées). Le bénéfice de `hc<AppType>` ne justifie pas cette refonte.
- **Un client centralisé custom**, du genre `apiClient.send('auth.login.start', body)` avec un dispatch interne. Écarté : ça reproduit `hc<AppType>` sans le typage automatique, donc le pire des deux mondes.
- **`@hono/zod-openapi` + génération automatique du client à partir de la définition OpenAPI.** Pertinent à terme pour générer un client mobile (cf. roadmap Tier 4 — chantier OpenAPI generator). Pour le client web on peut continuer avec les fonctions dédiées : ça marche, c'est lisible, c'est testable.

## Quand reconsidérer

Si le coût de maintenance des 14 fichiers wrapper devient visible (typiquement : régressions répétées dues à des oublis de mise à jour côté client après changement serveur), ou si on génère de toute façon un client mobile via OpenAPI et qu'on veut unifier les deux clients sur la même approche. Tant que le drift est attrapé par tsc et que les wrappers ne demandent pas plus de quelques minutes par nouvel endpoint, garder.
