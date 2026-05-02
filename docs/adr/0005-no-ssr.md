# 0005 — Pas de SSR — CSR pur, single-page application

- **Status** : Accepted
- **Date** : 2026-02

## Context

Le rendu côté serveur (Server-Side Rendering, SSR) est un standard pour la plupart des apps React modernes — Next.js, Remix, SvelteKit. Les bénéfices habituels :

- **Premier render plus rapide** : l'utilisateur voit du contenu pendant que le JS télécharge.
- **SEO** : les crawlers indexent le HTML rendu, pas une coquille vide qui s'hydrate.
- **Partage** : un lien partagé sur les réseaux sociaux se preview proprement (les meta OG sont lues du HTML serveur).

Pour Nodea, le compteur du SSR est **l'invariant E2EE** :

> *Tout le contenu utilisateur est chiffré côté navigateur avec une clé dérivée du mot de passe. Le serveur ne voit que des blobs AES-GCM.*

Si un user logué demandait `/flow`, le serveur n'a **rien à pré-rendre** — il n'a pas la clé pour déchiffrer, donc il ne peut pas produire le HTML de la liste de Mood/Goals/Library/Journal. Le SSR ne marche que pour les surfaces où le serveur peut générer le contenu sans clé : pages publiques (login, register, docs).

L'équipe a considéré :

- **SSR full-app via Next.js / Remix** : forcerait un layer de fetch serveur-side pour les pages publiques tout en délégant `/flow` au CSR — donc deux modèles de rendu coexistant. Coûteux, pour un gain qui ne touche que les pages publiques (~10 % du trafic d'un user authentifié).
- **SSR partiel sur les pages publiques uniquement** : Next.js avec un `'use client'` agressif sur tout `/flow`. Marche mais demande une stack Next.js pour faire le travail d'une SPA Vite. Valeur faible.
- **CSR pur + meta OG statiques dans `index.html`** : le serveur sert la même `index.html` pour toutes les routes ; les meta OG sont figées à la home (les liens partagés vers `/docs` montrent la preview de Nodea, pas du tier exact, c'est acceptable).

## Decision

**CSR pur. Vite construit une SPA standalone. Tous les routes (publiques et authentifiées) sont rendues côté navigateur. Les meta OG dans `index.html` sont statiques et pointent sur la home.**

Le serveur Hono ne fait **que** :
- Servir l'API `/api/*` (JSON encrypted-blobs aller-retour).
- Servir les assets statiques (le bundle Vite + les fichiers publics).
- Rien de pré-render.

## Consequences

**Positives :**
- **Cohérence** : un seul modèle de rendu (CSR), pas de surface où le serveur a une logique de rendu spécifique.
- **Compatibilité E2EE** : aucune surface où le serveur pourrait *« voir »* du contenu déchiffré. Conforme à l'invariant.
- **Stack mince** : Vite + React + Hono + Drizzle. Pas de framework SSR hybride à apprendre.
- **Self-hosting trivial** : un nginx + un container api + un container web statique. Pas de couche de rendu serveur à scale.

**Négatives :**
- **Premier render plus lent** : un user qui charge `/login` voit du blanc pendant ~300-700 ms (téléchargement du JS, parse, mount). Mitigé par : skip-link a11y dès le HTML statique, manualChunks Vite (react-vendor + crypto + markdown + headlessui en chunks séparés et cacheables — cf. [FRONT-10](../roadmap/frontend.md)), preconnect aux Google Fonts.
- **SEO faible sur les pages publiques** : `/docs/<tier>` ne sert pas le contenu du tier en HTML. Mitigé en V1 par les meta OG statiques + le `<link rel="canonical">` dynamique côté Docs.tsx (cf. [FRONT-12](../roadmap/frontend.md)). Une vraie SEO demanderait un pre-render selectif sur `/docs/*`. À évaluer si la doc devient un canal d'acquisition.
- **Liens partagés OG génériques** : un lien partagé vers `/docs/tech` montre la preview de la home. Acceptable — l'audience cible (self-hosters tech-savvy) ne navigue pas via les previews sociales.

## Alternatives considered

- **Next.js ou Remix avec hybrid SSR** : techniquement faisable, supersédé par la simplicité du CSR pur sur une app E2EE. Si la SEO devient un enjeu critique sur `/docs`, on pourra ajouter un **pre-render statique** des pages publiques au build (via `vite-plugin-ssr` ou un build script qui mounte React dans JSDOM) sans casser le CSR du reste.
- **Server Components React 19** : prometteur, mais nécessite Next.js ou un framework custom. Mêmes contraintes que SSR full-app.
