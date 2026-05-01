# Frontend — audit & roadmap

> **Statut** : audit posé après les chantiers `module-refacto`,
> `factoring-audit`, la migration logo, et les audits
> [`refacto.md`](./refacto.md), [`security.md`](./security.md),
> [`api.md`](./api.md). 14 findings identifiés — dont **0
> critique**, 1 élevé, 2 moyens, 10 faibles, 1 informatif
> (positif). La posture frontend est **accessibilité d'abord +
> vélocité de dev**, avec un effort visible sur les atoms a11y
> mais sans monitoring runtime des Core Web Vitals.
>
> **Mise à jour** : à chaque PR qui livre un fix, cocher la
> case correspondante. Si un fix change un comportement UX
> visible (skip-link, document.title dynamique, scroll
> restoration), mettre à jour le `documentation/Architecture.md`
> dans le **même commit**.

Audit mené sur le code au commit `1c389ae`. **Périmètre limité
au navigateur** — perf perçue, accessibilité, gestion d'état,
formulaires, SEO. Pas d'API ([`api.md`](./api.md)), pas de
sécu serveur ([`security.md`](./security.md)), pas de refacto
([`refacto.md`](./refacto.md)).

---

## Diagnostic global

L'expérience utilisateur déductible du code est **fluide en
steady state, légèrement saccadée au premier load par module**
(chaque module est lazy-chargé sur le premier accès, donc un
flash de *« Chargement… »* sec en texte avant que le code
arrive). La posture dominante est claire : **accessibilité
d'abord, puis vélocité de dev**, avec un net effort sur l'a11y
qui transparaît dans des détails comme le composant `Field`
qui câble correctement `aria-invalid` + `aria-describedby` +
erreur en `role="alert"`, le `eslint-plugin-jsx-a11y` configuré
en mode `recommended`, l'absence stricte de `onClick` sur des
`<div>` (zéro hit dans le grep), le focus géré par Headless UI
sur toutes les modales, et la moitié des composants qui
portent un `role="alert"` ou `role="status"`.

La perf n'est pas négligée mais elle n'est pas le but :
**toutes les routes et tous les modules sont lazy-loaded**, le
code-splitting Vite par défaut tourne, mais aucune mesure (pas
de `web-vitals`, pas de Lighthouse en CI, pas de bundle
analyzer dans le workflow).

La gestion d'état est **distribuée mais lisible** : un seul
store Zustand global (`nodea-store`) pour la session + l'état
UI cross-module, et 4 contextes React page-locales pour les
modules complexes (Goals, Library, Journal, Mood) via une
factory réutilisable `createModuleContexts`. CLAUDE.md
mentionne TanStack Query comme cible mais **TanStack Query
n'est pas installé** ; le data-fetching se fait à la main dans
les contextes via le pattern `LoadState` (`idle | loading |
ready | error`). C'est cohérent et le projet sait où vit chaque
morceau d'état, mais ça veut dire que des fonctionnalités
gratuites de TanStack Query (cache invalidation, refetch on
focus, optimistic updates structuré, query dedup) sont
réimplémentées à la main dans chaque contexte.

Ce qui frappe en premier : **le composant `Field` atom**
([`packages/web/src/ui/atoms/dirk/Field.tsx`](../../packages/web/src/ui/atoms/dirk/Field.tsx))
est exactement ce qu'on espère trouver — label + input + erreur
câblés via `htmlFor` + `aria-describedby`, avec `role="alert"`
sur l'erreur et `id` auto-dérivé du `name`. Si tous les
composants étaient à ce niveau d'a11y, l'audit pourrait
s'arrêter là. Ce qui frappe en mal : **les images de
couvertures de livre dans Library** sont marquées `alt=""`
(décoratif) alors qu'elles **portent l'information principale**
dans la vue `BookWall` (sans titre adjacent visible). Détail
révélateur de la limite de l'effort a11y : il a été pensé sur
les composants atoms mais pas re-vérifié dans les vues qui les
composent.

L'accessibilité a été pensée — pas un angle mort. Les outils
sont là (jsx-a11y, Headless UI, atoms bien câblés), les
conventions visibles dans le code montrent une intention. Il y
a quelques accidents (les couvertures, la double-`<h1>`
possible sur les pages auth) mais pas de désastres style « tout
en `<div onClick>` » ou « modale custom sans focus trap ».

**Phrase pour qualifier le risque UX principal** : *« Le projet
est globalement fluide et accessible, mais la vue Library va
devenir lente et imprédictible quand un user dépassera ~1000
livres parce qu'il n'y a aucune virtualisation et que tout le
catalogue se rend en une passe. »*

---

## Reconnaissance

| Sujet | Constat |
|---|---|
| **Framework** | React **19.1** + Vite 6 + TypeScript strict. Mode de rendu : **CSR pure** (pas de SSR, pas de SSG, pas de RSC). |
| **State** | **Zustand 5** pour le store global. **4 modules** ont leur Provider local via `createModuleContexts<D, F, A>` factory (Goals, Library, Journal, Mood). Pas de TanStack Query / SWR malgré la mention CLAUDE.md. |
| **Routing** | **React Router v7** (`react-router-dom`). URL `/flow` invariante côté authentifié (privacy invariant — module visité ne fuit pas dans les access logs). 14 pages publiques + Layout gardé par `ProtectedRoute`. |
| **Data fetching** | Manuel via `core/api/*.ts` — thin wrappers `fetch()` avec credentials + Zod-validated bodies. Pattern `LoadState` redéfini dans 4 modules (cf. [`refacto.md`](./refacto.md) REFACTO-01). |
| **Design system** | **Maison** — `ui/atoms/dirk/*` (Direction K · Sauge), `ui/dirk/*` (composants composites). **Headless UI 2** pour les primitives complexes (Dialog, Listbox, Transition). |
| **Styling** | **Tailwind CSS 4** + tokens custom (`@theme` block dans `theme.css`). Pas de CSS-in-JS, pas de CSS modules. `cn()` helper de `clsx` + `tailwind-merge`. |
| **Outils qualité a11y** | ✅ `eslint-plugin-jsx-a11y` 6 (preset `recommended`), `eslint-plugin-react-hooks`, `eslint-plugin-react`. ❌ Pas de `web-vitals`, pas de Lighthouse en CI, pas de bundle analyzer. |
| **Bundle / chunks** | Vite default code-splitting, route-based via `lazy()`. Pas de `manualChunks` config. Tous les modules + toutes les pages auth sont lazy. |

---

## Findings

### FRONT-01 — Couvertures de livres : `alt=""` (décoratif) alors qu'elles sont informationnelles

- **Catégorie** : a11y
- **Sévérité** : élevée
- **Impact utilisateur** : un·e utilisateur·ice de lecteur d'écran qui parcourt la vue *« Book Wall »* (`/flow` → Library → mode mur) entend uniquement les titres adjacents quand ils existent. Sur les vues où la couverture est l'élément principal sans titre lisible visible (BookWall mosaic), les images sont annoncées comme silencieuses. Pas inexploitable, mais l'info de la couverture (le titre, l'auteur visible sur la couv) est inaccessible.
- **Fichiers** :
  - [`Library/views/BookGrid.tsx:55`](../../packages/web/src/app/flow/Library/views/BookGrid.tsx#L55) — `<img src={cover} alt="" />`
  - [`Library/views/BookWall.tsx:39`](../../packages/web/src/app/flow/Library/views/BookWall.tsx#L39)
  - [`Library/views/ItemRow.tsx:78`](../../packages/web/src/app/flow/Library/views/ItemRow.tsx#L78)
  - [`Library/components/BookPickerModal.tsx:107`](../../packages/web/src/app/flow/Library/components/BookPickerModal.tsx#L107)
  - [`ComposerModal/lookup/CoverGrid.tsx:45`](../../packages/web/src/ui/dirk/ComposerModal/lookup/CoverGrid.tsx#L45)
- **Description** : `alt=""` (décoratif) est correct **uniquement** quand l'image est purement décorative ET que l'info qu'elle porte est disponible ailleurs dans l'arbre. Pour BookGrid et ItemRow où le titre est rendu en texte adjacent, `alt=""` reste défendable. Pour **BookWall** (vue mosaic, juste les couvertures, pas de texte) et le picker / cover-grid (où l'utilisateur choisit une couverture, donc l'info visuelle EST le contenu), `alt=""` est faux.
- **Tâches**
  - [ ] Pour BookWall : `alt={item.title}` (la couverture *est* l'item).
  - [ ] Pour CoverGrid (composer lookup) : `alt={\`Couverture proposée par \${cover.source}\`}` ou similaire.
  - [ ] Pour BookGrid / ItemRow : garder `alt=""` puisque le titre est lu juste à côté, mais ajouter `aria-hidden="true"` pour cohérence sémantique.
  - [ ] Pour BookPickerModal : décider — si la modale liste des résultats avec titre adjacent, garder `alt=""` ; si pas de titre, mettre le titre en alt.
- **Effort** : S (~30 min)
- **Risque** : faible
- **Dépendances** : aucune

### FRONT-02 — Pas de virtualisation des listes longues (Library)

- **Catégorie** : perf runtime
- **Sévérité** : moyenne (deviendrait élevée à >1000 entries)
- **Impact utilisateur** : un·e utilisateur·ice avec ~500 livres voit le module Library prendre 200-500 ms à monter, et le scroll commence à saccader. À 2000 entries, l'app se fige ~1-2s sur le premier render et le scroll devient injouable sur appareil moyen-de-gamme. Conditionnel au volume.
- **Fichiers** :
  - [`Library/views/BookGrid.tsx`](../../packages/web/src/app/flow/Library/views/BookGrid.tsx)
  - [`Library/views/BookWall.tsx`](../../packages/web/src/app/flow/Library/views/BookWall.tsx)
  - [`Library/views/ItemRow.tsx`](../../packages/web/src/app/flow/Library/views/ItemRow.tsx)
  - Aussi : [`Journal/views/PrimaryColumn.tsx`](../../packages/web/src/app/flow/Journal/views/PrimaryColumn.tsx) (pour utilisateur·ice avec beaucoup d'entrées)
- **Description** : 87 occurrences de `.map()` dans `app/flow/`. Aucune des 4 vues catalogue Library + EntriesList Journal n'utilise de virtualisation. Pour Mood/Goals/Habits le volume reste borné par la nature du module. Pour Library et Journal, le volume peut exploser.
- **Tâches**
  - [ ] **Court terme** : ajouter une pagination cursor-based côté API (cf. [`api.md`](./api.md) API-08) et limiter le rendu côté client à N=200 par défaut avec scroll-pagination.
  - [ ] **Moyen terme** : intégrer `@tanstack/react-virtual` (~3 KB gzip) sur BookGrid et BookWall.
  - [ ] **Décisionnel** : ne pas faire ça avant qu'un user réel ait le problème — c'est conditionnel au volume.
- **Effort** : M (~3h pour Library + tests)
- **Risque** : faible (param optionnel + virtualisation coïncide avec rendu identique)
- **Dépendances** : API-08 (pagination cursor) côté API

### FRONT-03 — Aucun monitoring des Core Web Vitals ni Lighthouse en CI

- **Catégorie** : perf chargement / runtime
- **Sévérité** : moyenne
- **Impact utilisateur** : N/A directement, mais l'équipe ne **sait pas** si la prod régresse en LCP / CLS / INP. Une PR qui dégrade à -10 % du score passe sous le radar.
- **Fichiers** : aucun (l'absence est le finding)
- **Description** : pas de package `web-vitals` installé, pas de hook `onCLS`/`onLCP`/`onINP`. Pas de Lighthouse CI dans `.github/workflows/`. Pas de bundle analyzer au build.
- **Tâches**
  - [ ] **Étape 1** : ajouter [`web-vitals`](https://github.com/GoogleChrome/web-vitals) en dev dep, hook minimal dans `main.tsx` qui logue `console.info` en dev pour les Core Web Vitals.
  - [ ] **Étape 2** : ajouter [`rollup-plugin-visualizer`](https://www.npmjs.com/package/rollup-plugin-visualizer) en build prod pour voir la taille des chunks. Inspecter le rapport à chaque release.
  - [ ] **Étape 3** (optionnelle) : Lighthouse CI ([`@lhci/cli`](https://github.com/GoogleChrome/lighthouse-ci)) en GitHub Action sur les PRs touchant `packages/web/`.
- **Effort** : S pour étape 1 (~30 min), S pour étape 2 (~30 min), M pour étape 3 (~3h)
- **Risque** : faible
- **Dépendances** : aucune

### FRONT-04 — `document.title` jamais mis à jour selon la route

- **Catégorie** : SEO + DX (onglet du navigateur)
- **Sévérité** : faible
- **Impact utilisateur** : l'onglet du navigateur affiche toujours **« Nodea »** quel que soit le module ou la page consulté. Un·e utilisateur·ice qui a 2 onglets (un sur la doc, un sur l'app) ne peut pas les distinguer. Sur navigateur mobile, la navigation entre tabs devient confuse.
- **Fichiers** :
  - [`packages/web/index.html`](../../packages/web/index.html) — `<title>Nodea</title>` figé
  - Aucun `document.title = ...` ni `react-helmet` dans le code
- **Description** : pas de gestion dynamique du titre. CSR pure → pas de SSR pour pré-render le bon titre. Pour les pages publiques (`/docs`, `/login`, `/register`), un titre par page améliorerait le SEO + l'UX onglets. Pour les pages authentifiées, c'est moins urgent (privacy invariant — on **ne veut pas** que le titre révèle le module actif).
- **Tâches**
  - [ ] Pour `/docs` : ajouter dans `Docs.tsx` un `useEffect(() => { document.title = 'Documentation — Nodea'; }, [])`.
  - [ ] Pour `/login`, `/register`, `/recovery-code`, etc. : pareil, un titre par page.
  - [ ] Pour `/flow` (authentifié) : **garder « Nodea »** générique pour la privacy. Documenter dans `CLAUDE.md` (privacy invariant) que le titre du tab ne doit jamais refléter le module actif.
- **Effort** : S (~1h pour 8 pages publiques)
- **Risque** : faible
- **Dépendances** : aucune

### FRONT-05 — Plain text *« Chargement… »* en fallback Suspense (pas de skeleton)

- **Catégorie** : états de chargement
- **Sévérité** : faible
- **Impact utilisateur** : sur le premier chargement d'un module ou d'une page auth, le user voit *« Chargement… »* aligné centralement sur fond bg, environ 100-300 ms (selon vitesse réseau + taille du chunk). Pas dramatique mais ça donne un effet « pas très soigné » sur une app par ailleurs très soignée.
- **Fichiers** :
  - [`App.tsx:30`](../../packages/web/src/app/App.tsx#L30) (auth pages)
  - [`config/modules_list.tsx:38`](../../packages/web/src/app/config/modules_list.tsx#L38) (modules)
- **Description** : tous les Suspense fallback sont `<div className="p-6 text-center opacity-60">Chargement…</div>`. C'est explicite (cf. commentaire dans `Stages.tsx:9`) — *« fast enough that a fancy skeleton would feel like overkill »*. Décision design assumée. Mais sur connexion 3G ou première visite, 200ms de texte centré reste visible.
- **Tâches**
  - [ ] **Garder en l'état** si la philosophie design est « éviter les skeletons fancy » (point assumé).
  - [ ] **OU** remplacer par un skeleton minimal qui garde la structure de la page (sidebar + main column) pour éviter le flash de page vide.
- **Effort** : S (~30 min) si garder en l'état + doc, M (~2-3h) si skeleton partagé
- **Risque** : faible
- **Dépendances** : aucune

### FRONT-06 — Pas de scroll restoration sur la navigation back/forward intra-`/flow`

- **Catégorie** : routing
- **Sévérité** : faible
- **Impact utilisateur** : un·e user qui scrolle 50 % d'une longue liste Library, clique sur un livre pour ouvrir la modale, ferme la modale, puis utilise la flèche back du navigateur — le scroll revient en haut de Library, perte de la position. Frustrant sur mobile.
- **Fichiers** :
  - [`App.tsx:48-55`](../../packages/web/src/app/App.tsx#L48-L55) — `popstate` listener qui sync le module mais ne sauvegarde pas le scrollY
  - Pas de `<ScrollRestoration />` (composant React Router v7) nulle part
  - Le seul `scrollTo` explicite est [`Docs.tsx:60`](../../packages/web/src/app/pages/Docs.tsx#L60) sur changement d'onglet docs
- **Description** : React Router v7 propose `<ScrollRestoration />` qui sauvegarde scrollY par entrée d'historique et le restaure au back. Le projet n'utilise pas ce composant. Les modules changent via `setModule()` du store qui pushState avec `{ nodeaModule: id }` dans le state, mais sans le scrollY.
- **Tâches**
  - [ ] Étendre le pushState pour inclure `scrollY: window.scrollY`.
  - [ ] Au popstate dans `App.tsx`, restaurer `window.scrollTo({ top: e.state?.scrollY ?? 0, behavior: 'instant' })`.
  - [ ] Tester sur Library + Journal (les deux modules à listes longues).
- **Effort** : S (~1h)
- **Risque** : faible
- **Dépendances** : aucune

### FRONT-07 — Possible double `<h1>` sur les pages auth (à vérifier)

- **Catégorie** : a11y / sémantique
- **Sévérité** : faible
- **Impact utilisateur** : un lecteur d'écran qui navigue par titres entend **deux** « titre principal » consécutifs sur Login / Register / RequestReset etc. — celui du `AuthMarketingPanel` à gauche ET celui de la page form à droite. Les utilisateur·ices au clavier qui font H pour next-heading se prennent un h1 surnuméraire.
- **Fichiers** :
  - [`AuthMarketingPanel.tsx:49`](../../packages/web/src/ui/dirk/AuthMarketingPanel.tsx#L49) — `<h1 className="text-[56px]...">{headline}</h1>`
  - [`Login.tsx`](../../packages/web/src/app/pages/Login.tsx), [`Register/RegisterForm.tsx`](../../packages/web/src/app/pages/Register/RegisterForm.tsx), etc. — à vérifier au cas par cas
  - [`AuthPanelHeader.tsx`](../../packages/web/src/ui/dirk/AuthPanelHeader.tsx) — composant utilisé sur les forms, à inspecter
- **Description** : la marketing panel pose un grand `<h1>` (probablement bon UX visuellement). Si la page form contient un autre `<h1>` (par exemple « Créer mon compte ») on a 2 h1.
- **Tâches**
  - [ ] **Vérifier** chaque page auth pour confirmer le diagnostic (curl / inspect).
  - [ ] **Si 2 h1 confirmés** : démoter le headline du `AuthPanelHeader` à `<h2>` (le marketing panel garde son `<h1>` car il est l'élément dominant visuel de la page).
- **Effort** : S (~30 min vérif + fix)
- **Risque** : faible
- **Dépendances** : aucune

### FRONT-08 — `recharts` peut-être pas vraiment utilisé (audit + retrait potentiel)

> Consolide l'ancien FRONT-15. Un seul finding, un seul fix.

- **Catégorie** : perf chargement / dette
- **Sévérité** : faible
- **Impact utilisateur** : si recharts est dans le bundle Habits, il pèse ~95 KB gzip. Ouvrir Habits pour la première fois → fetch un chunk de cette taille. Sur connexion lente, ~500 ms ajoutés au premier accès Habits.
- **Fichiers** :
  - [`Habits/components/Heatmap.tsx`](../../packages/web/src/app/flow/Habits/components/Heatmap.tsx) — **seul site qui importe `recharts`** dans tout le repo
- **Description** : `recharts` est dans `package.json` mais ne semble être consommé qu'à un seul endroit (Heatmap.tsx). Le code visible de Heatmap.tsx suggère des **SVG hand-rolled** (`<title>` inline pour tooltips). Très probablement la lib est importée *« par habitude »* sans être réellement utilisée — à vérifier.
- **Tâches**
  - [ ] **Étape 1 — audit (~30 min)** : ouvrir `Heatmap.tsx`, identifier précisément quels symboles de `recharts` sont consommés.
  - [ ] **Étape 2 — décision** :
    - Si rien d'essentiel n'est utilisé → **retirer la dep** de `package.json` + retirer l'import.
    - Si quelque chose est utilisé → vérifier si `recharts/es6/<component>` (sub-imports) tree-shake mieux que l'import racine.
  - [ ] **Étape 3 — confirmation** : rebuild + bundle analyzer (cf. FRONT-03) pour confirmer le gain.
- **Effort** : S (~30 min audit) à M (~1h si migration sub-imports)
- **Risque** : faible (ou aucun si suppression pure)
- **Dépendances** : FRONT-03 (bundle analyzer pour valider le gain)

### FRONT-09 — `@zxcvbn-ts/language-common` importé en `import *` sur 4 pages auth

- **Catégorie** : perf chargement
- **Sévérité** : faible
- **Impact utilisateur** : chaque page auth qui doit calculer la force du password (`Register`, `Reset`, `Recover`, `ChangePassword`) charge ~50-80 KB gzip de dictionnaire commun zxcvbn. C'est dans des chunks lazy-loaded → impact uniquement quand la page est visitée.
- **Fichiers** :
  - [`ChangePassword.tsx:7`](../../packages/web/src/app/pages/ChangePassword.tsx#L7), [`Recover/index.tsx:4`](../../packages/web/src/app/pages/Recover/index.tsx#L4), [`Register/index.tsx:4`](../../packages/web/src/app/pages/Register/index.tsx#L4), [`Reset/index.tsx:4`](../../packages/web/src/app/pages/Reset/index.tsx#L4)
- **Description** : 4 imports star du dictionnaire commun. Vite va probablement créer **un chunk partagé** puisque les 4 pages le réfèrent — donc duplication évitée à la fin. À vérifier au build.
- **Tâches**
  - [ ] **Vérifier** au build (`pnpm --filter @nodea/web build` puis inspecter `packages/web/dist/assets/`) que zxcvbn-common est dans **un seul chunk** partagé.
  - [ ] Si oui : rien à faire.
  - [ ] Si non : factoriser dans un module `core/zxcvbn.ts` qui exporte un singleton `getZxcvbn()` async-init.
- **Effort** : S (vérif) à M (refonte si nécessaire)
- **Risque** : faible
- **Dépendances** : FRONT-03 (bundle analyzer pour vérifier)

### FRONT-10 — Pas de `manualChunks` Vite — risque de chunks gros sur libs partagées

- **Catégorie** : perf chargement
- **Sévérité** : faible
- **Impact utilisateur** : difficile à mesurer sans bundle analyzer. Vite par défaut split par dynamic import + un chunk vendor pour `node_modules`. Les libs lourdes finissent dans le bundle vendor unique → 1 chunk volumineux téléchargé au premier hit.
- **Fichiers** :
  - [`packages/web/vite.config.js`](../../packages/web/vite.config.js) — pas de `build.rollupOptions.output.manualChunks`
- **Description** : pas de finding bloquant — Vite est intelligent, et le route-based splitting via `lazy()` fait déjà le gros boulot. Mais explicit `manualChunks` permet de séparer (par exemple) `recharts` dans son propre chunk lazy.
- **Tâches**
  - [ ] **Avant tout** : faire FRONT-03 (bundle analyzer) pour voir où vivent les KB.
  - [ ] **Si nécessaire** : ajouter dans vite.config :
    ```js
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'headlessui': ['@headlessui/react'],
            'crypto': ['@serenity-kit/opaque', '@simplewebauthn/browser', '@scure/bip39'],
          }
        }
      }
    }
    ```
- **Effort** : S (~30 min)
- **Risque** : faible
- **Dépendances** : FRONT-03

### FRONT-11 — URLs par onglet sur la doc publique + anchors sur titres + OG meta

- **Catégorie** : SEO + UX partage
- **Sévérité** : faible
- **Impact utilisateur** : aujourd'hui la page `/docs` est une URL unique avec 3 onglets (`L'essentiel` / `La mécanique` / `Sous le capot`) gérés par état local. Un user ne peut pas (a) bookmarker un onglet précis, (b) partager un lien direct vers une section précise (« regarde la partie *Code de récupération* dans la mécanique »), (c) revenir à un onglet via l'historique navigateur. Et le partage du lien `https://nodea.app/docs` dans une messagerie reste un lien nu sans prévisualisation.
- **Fichiers** :
  - [`packages/web/src/app/pages/Docs.tsx`](../../packages/web/src/app/pages/Docs.tsx) — gestion d'onglet via `useState` au lieu de l'URL
  - [`packages/web/src/app/App.tsx`](../../packages/web/src/app/App.tsx) — route `/docs` actuelle
  - [`packages/web/index.html`](../../packages/web/index.html) — pas de `<meta property="og:*">`, pas de `<meta name="twitter:*">`, pas de `<meta name="description">`
  - [`packages/web/src/app/pages/docs/primitives.tsx`](../../packages/web/src/app/pages/docs/primitives.tsx) — rehype-slug ajoute déjà des `id` sur les h2/h3, mais pas de # cliquable visible
- **Note importante sur l'invariant `/flow`** : la règle *« une seule URL pour `/flow` »* vient du besoin de privacy (le module visité ne doit pas fuir dans les access logs serveur). Cette règle **ne s'applique pas à la doc publique** — `/docs` n'a pas de privacy à protéger, c'est du contenu public conçu pour être partagé. Découpler les URLs des onglets renforce l'UX sans toucher à l'invariant `/flow`.
- **Tâches**
  - [ ] **Routing par onglet** : passer la route `/docs` à `/docs/:tab` avec `tab` ∈ `{'newbie', 'advanced', 'tech'}`. `/docs` redirige vers `/docs/newbie` (l'onglet par défaut). Tab change → `navigate('/docs/<id>')` au lieu de `setState`.
  - [ ] **Anchor links sur les h2/h3** : ajouter dans `primitives.tsx` un sélecteur `# →` visible au survol sur chaque heading rendu, qui copie le lien `https://nodea.app/docs/<tab>#<slug>` dans le presse-papier ou navigue dessus directement.
  - [ ] **Scroll-to-anchor au load** : si l'URL contient `#section-id`, scroller à la bonne hauteur après le rendu markdown (effet utile pour les liens partagés).
  - [ ] **OG / Twitter meta dans `index.html`** :
    ```html
    <meta name="description" content="Nodea — journal et suivi personnel chiffré bout-en-bout. Tout est chiffré dans ton navigateur, avant le serveur.">
    <meta property="og:title" content="Nodea — journal et suivi personnel chiffré">
    <meta property="og:description" content="Tout est chiffré dans ton navigateur, avant le serveur.">
    <meta property="og:image" content="/nodea-lockup-horizontal.png">
    <meta property="og:url" content="https://nodea.app">
    <meta property="og:type" content="website">
    <meta name="twitter:card" content="summary_large_image">
    ```
- **Effort** : M (~2-3h pour le routing + anchors + meta)
- **Risque** : faible (les onglets continuent de fonctionner, l'URL devient juste plus précise)
- **Dépendances** : aucune (le système de slug heading via rehype-slug est déjà en place)

### FRONT-12 — Pas de `<link rel="canonical">` sur les pages publiques

- **Catégorie** : SEO + a11y
- **Sévérité** : faible
- **Impact utilisateur** : Google peut indexer plusieurs URL comme pages distinctes. Pas critique pour une SPA privée, plus important pour `/docs/`.
- **Fichiers** :
  - [`packages/web/index.html:2`](../../packages/web/index.html#L2)
- **Description** : pas de `<link rel="canonical">` du tout. Le `<html lang>` est mis à jour côté runtime depuis le commit `d87c821 fix(i18n): sync <html lang> with active language`.
- **Tâches**
  - [ ] Ajouter dans `index.html` un `<link rel="canonical" href="https://nodea.app">` sur la home.
  - [ ] Dans `Docs.tsx`, un effet qui met à jour le canonical en `https://nodea.app/docs` (couplé avec FRONT-04 sur `document.title`).
- **Effort** : S (~30 min)
- **Risque** : faible
- **Dépendances** : aucune

### FRONT-13 — Race conditions potentielles sur les mutations optimistes

- **Catégorie** : gestion d'état
- **Sévérité** : faible (à vérifier au cas par cas)
- **Impact utilisateur** : sur réseau lent + clic rapide sur 2 boutons d'action successifs, un user pourrait voir l'UI revenir à un état antérieur si le rollback de la 1ère mutation arrive après le succès de la 2nde.
- **Fichiers** :
  - [`Goals/context.tsx`](../../packages/web/src/app/flow/Goals/context.tsx) — handlers `handleToggleStatus`, `handleEdit`, `handleDelete`, `handleCarryOver` font tous un setLoad optimiste puis rollback en `catch`
  - [`Library/context.tsx`](../../packages/web/src/app/flow/Library/context.tsx)
  - [`Mood/context.tsx`](../../packages/web/src/app/flow/Mood/context.tsx), [`Journal/context.tsx`](../../packages/web/src/app/flow/Journal/context.tsx)
- **Description** : le pattern « optimistic update + rollback en `catch` » est utilisé partout. Sans cancel-token ni request id, deux mutations qui se chevauchent peuvent rollbacker la mauvaise version. Pas critique parce que le user voit le résultat final correct au prochain refetch, mais flicker visuel possible.
- **Tâches**
  - [ ] **Court terme** : disabler le bouton pendant la mutation in-flight (déjà fait sur certains, à vérifier exhaustif).
  - [ ] **Moyen terme** : ajouter un `requestId` par mutation et ignorer le rollback si un `requestId` plus récent existe.
  - [ ] **Long terme** : si TanStack Query est adopté, la dedup + cache invalidation est gratuite.
- **Effort** : M (~2-3h pour le requestId pattern × 4 modules)
- **Risque** : moyen (touche le data flow optimistic)
- **Dépendances** : aucune

### FRONT-14 — Pas de skip-link « passer au contenu principal »

- **Catégorie** : a11y
- **Sévérité** : faible
- **Impact utilisateur** : un·e utilisateur·ice clavier qui visite `/login` doit Tab à travers les liens du marketing panel + nav avant d'atteindre le formulaire. Pas dramatique sur 3-4 tabs, mais standard a11y.
- **Fichiers** : aucun (l'absence est le finding)
- **Description** : pas de `<a href="#main">Skip to content</a>` au début du body.
- **Tâches**
  - [ ] Ajouter dans `App.tsx` ou dans le `Layout` un skip-link visible-au-focus :
    ```tsx
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-bg focus:p-2">
      Passer au contenu principal
    </a>
    ```
  - [ ] Mettre `<main id="main">` sur le wrapper de la zone principale (Layout + AuthLayout).
- **Effort** : S (~10 min)
- **Risque** : aucun
- **Dépendances** : aucune

### FRONT-15 — *(retiré — fusionné dans FRONT-08)*

Le finding *« recharts en deps mais peut-être pas utilisé »* qui vivait
ici était un doublon partiel de FRONT-08. Les tâches sont consolidées
dans FRONT-08 ci-dessus.

---

## Récap par catégorie × sévérité

| Catégorie | Critique | Élevée | Moyenne | Faible | Info |
|---|---|---|---|---|---|
| Perf chargement | — | — | FRONT-03 | FRONT-08, FRONT-09, FRONT-10 | — |
| Perf runtime | — | — | FRONT-02 | — | — |
| Images / médias | — | FRONT-01 | — | — | — |
| Core Web Vitals | — | — | FRONT-03 | — | — |
| A11y | — | FRONT-01 | — | FRONT-07, FRONT-14 | — |
| Gestion d'état | — | — | — | FRONT-13 | — |
| Formulaires | — | — | — | — | (positif — `Field` atom est exemplaire) |
| Routing / nav | — | — | — | FRONT-06 | — |
| États chargement / erreur | — | — | — | FRONT-05 | — |
| SEO | — | — | — | FRONT-04, FRONT-11, FRONT-12 | — |

**0 critique, 1 élevée, 2 moyennes, 11 faibles, 1 info-positif (forms).**

---

## Top 5 quick wins

1. **FRONT-01** — Réécrire les `alt=""` des couvertures Library en `alt={item.title}` sur BookWall et CoverGrid. ~30 min.
2. **FRONT-04** — Ajouter `useEffect(() => { document.title = ... })` sur `Docs.tsx`, `Login.tsx`, `Register.tsx`, etc. ~1h pour 8 pages publiques.
3. **FRONT-14** — Skip-link sur `App.tsx`. 10 min, gain a11y immédiat.
4. **FRONT-11** — OG / Twitter meta dans `index.html`. 15 min, valeurs statiques.
5. **FRONT-08** — Audit recharts dans Heatmap (consolidé). 30 min, potentiel gain ~95 KB sur le chunk Habits.

## Top 5 chantiers structurants

1. **FRONT-03** — Setup `web-vitals` + bundle analyzer + Lighthouse CI. ~1 jour pour le tout. Pose les bases de toute future décision perf.
2. **FRONT-02** — Pagination cursor-based côté API ([`api.md`](./api.md) API-08) + virtualisation Library. ~2-3 jours combiné.
3. **FRONT-13** — Migrer le data-fetching vers TanStack Query (CLAUDE.md le promettait — pas livré). Résout les race conditions, simplifie les contextes par module, dedup automatique. **Très gros chantier** (~5 jours), à pondérer.
4. **FRONT-06** — `<ScrollRestoration />` ou équivalent pour le `popstate` listener custom. ~1h pour le code, mais affecte tous les modules.
5. **FRONT-04 + FRONT-11 + FRONT-12** combinés — refonte SEO + meta des pages publiques. ~3-4h.

---

## Audit accessibilité — score qualitatif

**Globalement OK, avec 3 trous spécifiques.** L'app est utilisable au clavier (`focus-visible` partout, pas de `outline: none` sans alternative, pas de `<div onClick>`, modales avec focus trap via Headless UI), les forms sont au-dessus de la moyenne (`aria-invalid` + `aria-describedby` + `role="alert"` câblés dans le `Field` atom), les feedbacks sont annoncés (`role="alert"` / `role="status"` partout), les autocompletes sont correctes.

**Les 3 trous les plus graves**, par ordre :

1. **Couvertures Library marquées décoratives** (FRONT-01) — perte d'info principale dans BookWall.
2. **Pas de skip-link** (FRONT-14) — Tab répétitif pour atteindre le contenu sur les pages auth.
3. **Possible double `<h1>` pages auth** (FRONT-07) — à confirmer, mais hiérarchie de titres potentiellement cassée.

Aucun bloqueur du genre « inutilisable au clavier » ou « modale sans aria-modal ». **Score qualitatif** : 7-8/10. Avec FRONT-01 + FRONT-14 corrigés, on est à 9/10.

---

## Sequencing recommandé

```
Semaine 1 (quick wins a11y + SEO, ~3h cumulées)
  ├─ FRONT-01    (alt sur les couvertures Library)
  ├─ FRONT-14    (skip-link)
  ├─ FRONT-11    (OG / Twitter meta)
  ├─ FRONT-04    (document.title par page publique)
  └─ FRONT-08    (audit recharts)

Semaine 2 (mesure + observabilité)
  ├─ FRONT-03    (web-vitals + bundle analyzer + LHCI)
  ├─ FRONT-09    (vérif chunk zxcvbn-common — dépend de bundle analyzer)
  └─ FRONT-10    (manualChunks selon analyzer)

Semaine 3+ (UX + état)
  ├─ FRONT-06    (scroll restoration)
  ├─ FRONT-07    (vérif double h1)
  ├─ FRONT-12    (canonical link)
  └─ FRONT-13    (request-id sur mutations optimistes)

Plus tard (à pondérer)
  └─ FRONT-02    (pagination + virtualisation Library — quand un user atteint ~500 livres)
```

**Total effort cumulé** : ~3-4 jours dev pour Tier 1 + 2 + 3 (hors FRONT-02 et FRONT-13 qui sont conditionnels).

---

## Décisions à figer (avant de commencer)

| Décision | Options | Impact |
|---|---|---|
| Adopter TanStack Query ou rester sur les contextes maison ? | Migration ~5 jours / Garder + corriger FRONT-13 ad-hoc | FRONT-13 — préfère garder pour l'instant, migrer si Habits/Mood s'enrichissent |
| Skeletons ou texte « Chargement… » ? | Skeletons / Texte (actuel) / Texte amélioré | FRONT-05 — préfère texte + doc explicite de la philosophie |
| Lighthouse CI sur quelles PRs ? | Toutes / Touchant `packages/web/` / Aucune (juste local) | FRONT-03 — préfère « touchant `packages/web/` » pour rester rapide |
| `<ScrollRestoration />` natif ou popstate custom étendu ? | RR v7 natif / popstate custom (cohérent avec privacy invariant `/flow`) | FRONT-06 — préfère custom pour rester en contrôle de l'URL |
| Virtualisation Library : seuil ? | À 500 livres / À 1000 / Jamais (pagination suffit) | FRONT-02 — préfère pagination + scroll-page d'abord, virtualiser si plaintes |

---

## Angles morts

Ce que je n'ai pas pu vérifier sans navigateur réel :

1. **Vrais Core Web Vitals en prod** — LCP / CLS / INP réels sur `https://nodea.app/`. Lighthouse runtime nécessaire.
2. **Tests lecteur d'écran** — VoiceOver / NVDA / JAWS sur les flows réels. La sémantique HTML peut être correcte et l'expérience écran toujours étrange (ex: ordre de lecture inattendu).
3. **Profiling React DevTools** — quels composants re-render trop, est-ce que les contextes sont bien splittés. Le code suggère que oui via `createModuleContexts`, mais à vérifier.
4. **Bundle réel servi** — taille des chunks initiale vs lazy, présence de duplications dans node_modules. À voir avec `rollup-plugin-visualizer` (cf. FRONT-03).
5. **Performance sur appareil low-end** — un Galaxy A12 ou un iPhone SE 1ère gen vs un MacBook Pro M3. Library avec 500 livres, scroll, animations Headless UI — à tester.
6. **Accessibilité couleur** — les tokens sage / sand / lavender / blush ont des contrastes à vérifier sur chaque combinaison fond/texte (WCAG AA = 4.5:1 pour body text). Quelques `text-muted` (slate-light `#7a7c7e` ou slate-lighter `#a2a5a8`) sur `bg` sand-light `#ffffff` sont à mesurer.
7. **Comportement du `popstate` listener** sous des cas tordus — back depuis une modale ouverte, history.go(-2), etc. Pas de tests visibles pour ça.
8. **Service Worker / offline** — pas de PWA active. Premier paint sur 3G ou perte connexion = écran blanc. Hors périmètre actuel mais à mentionner pour V2.

---

## Comment cocher

- À chaque PR qui livre un fix, cocher les `[ ]` correspondants dans la liste de tâches du finding concerné.
- Quand toutes les tâches d'un finding sont cochées, ajouter `— résolu (commit `xxxxxxx`)` à côté du titre.
- Quand tous les findings d'une catégorie sont résolus, déplacer la section en bas du document sous une rubrique « Résolu ».
- Quand toute la roadmap est livrée, retirer le fichier de `docs/roadmap/` (convention du repo : les roadmaps sont des artefacts temporaires qui disparaissent quand leur travail est fait — comme `i18n.md` et `health.md` retirés post-livraison).
