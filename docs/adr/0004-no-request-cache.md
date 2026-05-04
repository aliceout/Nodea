# 0004 — Pas de cache de requêtes (TanStack Query, SWR, etc.)

- **Status** : Accepted
- **Date** : 2026-02

## Context

La quasi-totalité des SPA React modernes adopte une lib de **request-caching** : TanStack Query (ex react-query), SWR, RTK Query, Apollo. Ces libs résolvent quatre problèmes communs :

1. **Déduplication** : deux composants qui demandent les mêmes données ne déclenchent qu'un seul fetch.
2. **Cache cross-mount** : naviguer hors d'une page puis revenir affiche les données précédentes pendant que le refetch tourne en arrière-plan.
3. **Synchro multi-onglets** : un focus d'onglet déclenche un refetch ; deux onglets restent à peu près cohérents.
4. **Invalidation par tag** : `mutation.invalidate('mood-entries')` purge le cache des reads concernés.

Pour Nodea, plusieurs facteurs changent l'équation :

- **Architecture E2EE** : chaque fetch passe par une couche de chiffrement / déchiffrement client. Le résultat « brut » qu'un cache stockerait est déjà du `LibraryItem[]` post-AES-GCM — pas le payload réseau. Les libs de cache cherchent à éviter le coût réseau ; ici le coût dominant est le **dérivement crypto**, pas la latence HTTP.
- **Single-instance, mono-utilisateur par session** : une instance Nodea sert un user à la fois (même si le serveur en héberge N). Pas de scénario *« deux onglets se disputent l'invalidation »* à l'échelle où les libs de cache excellent.
- **Volume de données modeste** : le journal d'un utilisateur tient en quelques centaines d'entries, pas en gigaoctets. Le coût d'un refetch full-list reste sous la seconde.
- **Mutations optimistes maison** : chaque module gère son rollback via `setItems(previous)` dans un `catch`. Le pattern marche, est testable, et n'a pas besoin du moteur d'invalidation d'une lib.

## Decision

**Ne pas adopter de lib de request-caching. Garder le pattern manuel : `useEffect(() => fetch())` + `setState`, optimistic update + rollback en `catch`, version-bump (`bumpItemsVersion`) pour forcer un refetch après mutation.**

## Consequences

**Positives :**
- **Le code reste lisible** : un `useEffect` qui appelle `clientX.list()` et fait `setItems(...)` est compréhensible sans connaître une lib externe. Un nouveau contributeur n'a pas à apprendre l'API d'une nouvelle abstraction.
- **Bundle plus mince** : ~30 KB gzip économisés (TanStack Query v5 minifié) qu'on ne paie pas.
- **Pas de cache à invalider sur logout** : le `mainKey` purgé au logout rend les blobs chiffrés inexploitables ; pas de risque qu'un cache survivant expose du contenu déchiffré au prochain utilisateur.
- **Pas de surprise de re-fetch en background** : le pattern explicite *« je fetch quand je monte, je refetch quand je bump la version »* est prévisible et débuggable.

**Négatives :**
- **Pas de dedup native** : si deux pages qui montent en parallèle demandent les mêmes data, on double-fetch. En pratique, les modules sont lazy-chargés un à la fois, et la situation n'arrive pas.
- **Pas de cache cross-mount** : naviguer hors d'un module puis revenir relance le fetch. Sur les volumes Nodea (~secondes max), c'est acceptable. Si un module devient lourd à hydrater, on revisitera.
- **Race conditions sur mutations rapides** : pas de `requestId` pour annuler un rollback obsolète. Acceptable sur l'app actuelle (les libs auraient le même problème sans config explicite des `mutationKey`).

## Alternatives considered

- **TanStack Query** — la lib de référence. Excellente pour une app SaaS multi-onglets. Sur Nodea : sur-équipe sans gain mesurable. **Décision réversible** si un module type *« live collab »* arrive un jour (peu probable vu l'invariant E2EE).
- **SWR** — plus léger que TanStack Query mais même problème de surcharge cognitive pour un gain marginal.
- **Apollo Client** — irrelevant : pas de GraphQL.

Si la situation change (réseau bcp plus lent, multi-utilisateur sur la même machine, requêtes coûteuses serveur-side), **superséder cet ADR** plutôt que de l'amender.
