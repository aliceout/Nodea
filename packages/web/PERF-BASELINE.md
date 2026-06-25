# Performance baseline — `@nodea/web`

Numéros gelés à la date du dernier `pnpm bundle-size`. Le but
de ce fichier n'est PAS d'avoir des chiffres absolus parfaits,
c'est d'avoir un point de référence contre lequel tu mesures
la dérive après chaque modif lourde (refactor, ajout de
dépendance, nouvelle feature).

## Comment mesurer

```sh
pnpm --filter @nodea/web bundle-size
```

Lance `vite build` puis liste les `.js` / `.css` du `dist/` avec
leur taille brute et gzippée, regroupe par bucket, et compare au
budget figé dans `scripts/measure-bundle.mjs`. Sortie en non-zéro
si le budget est dépassé — utile en CI.

Variantes :
- `--skip-build` : mesure le `dist/` existant sans rebuilder.
- `--json` : sortie JSON pour scripts ou dashboards.

## Baseline 2026-05

Mesure faite après le cycle Tier 4 + 4 chantiers de découpage +
FRONT-13 + sweep i18n, branche `refacto-design-v2`.

| Bucket            | Gzip       | Raw         | Files | Notes |
|-------------------|-----------:|------------:|------:|-------|
| sentry            | 233.0 KB   | 479.1 KB    | 1     | `@sentry/browser` ESM build. Charge à l'import de `main.tsx` (fail-soft via `initSentryWeb` si DSN absent). |
| crypto            | 160.0 KB   | 431.4 KB    | 1     | OPAQUE WASM + argon2-wasm + hash-wasm + bip39 + simplewebauthn. Lourd mais incompressible — c'est le cœur sécu E2E. |
| docs page         | 144.6 KB   | 498.8 KB    | 2     | Lazy : `Docs-*.js` + `markdown-*.js`. Ne charge que sur `/docs`. |
| ui kit            | 38.5 KB    | 111.3 KB    | 1     | `@headlessui/react` — Modal, Disclosure, Dialog. |
| react             | 22.2 KB    | 65.9 KB     | 1     | `react-vendor` chunk. Minimal pour React 19. |
| app               | 343.5 KB   | 1336.6 KB   | 23    | Bundle principal + lazy chunks par page. Le plus gros single est `index-CCvSA10S.js` à 226 KB gzip — c'est le main app entry, probablement consolidable. |
| modules           | 5.2 KB     | 13.5 KB     | 9     | Lazy chunks par module (Mood, Goals, …). Très bien splitté. |
| other             | 25.1 KB    | 58.0 KB     | 28    | Petits chunks utilitaires. |
| **Total**         | **972.1 KB** | **2994.6 KB** | **66** | Budget actuel : 1500 KB gzip. **528 KB de marge**. |

## Budget

Figé en dur dans `scripts/measure-bundle.mjs` :

```js
const BUDGET_GZIP_TOTAL_KB = 1500;
```

Pourquoi cette valeur :
- Total actuel ~972 KB → marge ~528 KB pour absorber les ajouts
  raisonnables sans repasser par une revue de budget.
- Au-delà de 1500 KB, le coût first-paint commence à se sentir
  même sur réseau câblé (charger 1.5 MB gzip = ~500 ms de
  download sur 24 Mbps). Sur mobile 4G c'est 2-3 secondes.

Si tu dépasses le budget :
1. Le script sort en non-zéro, le commit/push échoue si tu lances
   `bundle-size` en pre-commit.
2. Investiguer pourquoi : nouveau lib, code-split raté, source
   maps qui passent en prod par erreur ?
3. Si l'ajout est légitime, augmenter le budget dans le script
   avec un commit dédié qui justifie la nouvelle valeur.

## Pistes d'optimisation actuelles

Pas urgentes mais notées pour le jour où on tape le plafond :

1. **Le main `index-*.js` à 226 KB gzip.** C'est le bundle de
   l'app authentifiée + le shell `App.tsx`. Vite log un warning
   ("chunks larger than 500 kB"). Les lazy `React.lazy()` par
   module aident, mais le shell lui-même reste massif. Piste :
   audit des imports dans `App.tsx` / `main.tsx` (peut-être
   qu'une lib tire toute une dep tree là où on en utilise un
   bout).

2. **Sentry à 233 KB gzip.** C'est `@sentry/browser` complet.
   Alternatives plus légères : `@sentry/browser` light variant,
   ou un SDK plus minimal genre Highlight. Pas urgent mais à
   surveiller — c'est 24 % du bundle pour une feature qui ne
   tourne que quand `VITE_SENTRY_DSN` est set.

3. **Docs lazy = 144 KB.** Ne charge que sur `/docs`. C'est OK
   parce qu'un user authentifié n'y va presque jamais. Mais si
   ça remonte en bucket « app » (i.e. importé non-lazy quelque
   part par accident), c'est un finding.

## Ce qu'on NE mesure PAS aujourd'hui

- **Web Vitals** (LCP, INP, CLS) — il y a un log dev dans
  `main.tsx` mais aucun assert / baseline. C'est mesuré par
  l'utilisateur dans son navigateur, pas par le script.
- **Time to Interactive** — même remarque, navigateur-side.
- **Hydration cost** — n/a (pas de SSR dans Nodea, ADR-0005).

Pour aller plus loin il faudrait :
- Lighthouse en CI sur une page authentifiée (avec un compte
  e2e seedé). Lourd à câbler.
- Un dashboard Web Vitals real-user (Vercel Analytics, Plausible
  RUM, etc.). Hors scope pre-prod.

La baseline actuelle se contente du bundle size — c'est le seul
indicateur que tu peux capturer en CI sans flakiness.
