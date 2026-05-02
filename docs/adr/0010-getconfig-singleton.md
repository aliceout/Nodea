# 0010 — `getConfig()` en singleton global

- **Status** : Accepted
- **Date** : 2026-05 (cycle d'audit, Tier 4)

## Context

La configuration de l'API (URL Postgres, secret de signature de cookie, setup OPAQUE, paramètres SMTP, base URL du web, etc.) vit dans `packages/api/src/config.ts`. Elle est lue depuis les variables d'environnement, validée par un schéma Zod au boot, et exposée via une fonction `getConfig()` qui retourne le résultat memoïsé.

Cette fonction est appelée partout dans le code serveur — middlewares, handlers de route, services — chaque fois qu'un module a besoin d'un paramètre de config. C'est en pratique un singleton global : une seule instance, partagée par tout le code via `getConfig()`.

L'alternative serait l'**injection** : passer un objet config en argument à chaque fonction qui en a besoin (ou via un contexte React-style côté serveur). C'est le pattern "dependency injection" classique.

## Decision

**Garder le singleton `getConfig()`. Ne pas adopter l'injection.**

## Consequences

**Positives :**
- **Pas de plumbing à travers les couches.** Une fonction profondément imbriquée qui a besoin de `WEB_BASE_URL` appelle `getConfig().WEB_BASE_URL` directement. En injection, il faudrait que la config soit passée en argument depuis la racine, à travers chaque appel intermédiaire — beaucoup de signatures de fonctions à porter une dépendance qui ne les concerne pas.
- **Le boot fail-fast.** `getConfig()` parse les variables d'environnement avec un schéma Zod strict au premier appel. Si une variable est manquante ou mal formée, l'erreur explose au boot avec un message clair (genre `WEB_BASE_URL: Required, received undefined`). En injection, l'erreur serait poussée au moment où une fonction tente de lire la config — possiblement après un long boot apparemment réussi.
- **Tests faciles pour les overrides ponctuels.** Vitest expose `vi.stubEnv('VITE_API_URL', 'http://test.local')` qui modifie `process.env` au niveau de la machine virtuelle JS, et `getConfig()` re-lit l'env si appelé après le stub. C'est exactement le pattern qu'on utilise. L'injection n'apporterait pas de gain de testabilité ici — on stub déjà au bon niveau (env-var).

**Négatives :**
- **Tester un comportement avec une config spécifique demande de stub `process.env`.** Pas de stub propre du genre `service.lookup({ apiKey: 'fake' })`. Mitigé par `vi.stubEnv()` qui est l'API standard et fait le job.
- **Couplage implicite.** Toute fonction qui appelle `getConfig()` dépend de la présence des bonnes variables d'environnement. C'est invisible dans la signature de la fonction. Mitigé par le fait que `getConfig()` est typée — un appel à `getConfig().WEB_BASE_URL` pour une variable inexistante échoue à la compilation.

## Alternatives considered

- **Injection complète via une fonction `buildApp(config)` qui distribue la config aux modules.** C'est le pattern proper-DI. Écarté parce que le bénéfice de testabilité est absent (on stub déjà au niveau env-var) et le coût de plumbing est non-négligeable (chaque module exposerait une factory qui prend la config en argument). Pour un projet single-instance E2EE, c'est de la cérémonie pour rien.
- **Injection partielle via un objet `Container`** passé à travers `c.set('config', ...)` dans Hono. Écarté pour les mêmes raisons — la complexité ajoutée n'a pas de cas d'usage qui la justifie.
- **Cache TTL sur `getConfig()` pour gérer le hot-reload.** Écarté : le serveur ne hot-reload pas la config en prod (un changement d'env-var demande un redémarrage du container, ce qui est explicite). En dev, le hot-reload tsx redémarre tout de toute façon. Le cache à vie est OK.

## Quand reconsidérer

Si on commence à avoir des cas d'usage où la même fonction doit tourner avec deux configs différentes dans le même process (genre multi-tenant côté serveur, ou tests qui doivent simuler plusieurs instances en parallèle), le singleton ne suffit plus et l'injection devient nécessaire. Tant qu'on est mono-instance avec une seule config par boot, garder le singleton.
