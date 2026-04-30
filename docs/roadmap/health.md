# Code health — clean, refacto, architecture

> **Statut** : audit posé après la clôture des chantiers
> `module-refacto` et `factoring-audit` (les deux roadmaps ont
> été retirées de `docs/roadmap/` une fois entièrement livrées).
> 10 chantiers identifiés à partir du terrain réel (legacy JSX
> persistant, lint absent, audits sécurité référencés mais
> manquants, couverture tests non mesurée). Aucune nouvelle
> fonctionnalité — uniquement nettoyage, santé du code,
> cohérence d'architecture.
>
> **Mise à jour** : à chaque PR qui livre une étape, cocher la
> case correspondante. Si une décision technique change la
> stratégie d'un chantier (ex : choix d'un linter, d'un schéma
> d'erreurs), mettre à jour le fichier `documentation/`
> concerné dans le **même commit**.

Constats bruts au moment où ce document est posé :

- **18 fichiers `.js`/`.jsx`** persistent dans
  `packages/web/src/` malgré la règle TS-strict de CLAUDE.md.
- **Aucun ESLint** configuré. Le `package.json` web indique
  `"lint": "echo 'lint: pending Phase 9' && exit 0"`.
- **49 fichiers de test** sur 335 fichiers source web — pas de
  carte de couverture, le ≥ 90 % crypto promis n'est ni mesuré
  ni vérifié.
- **`docs/security-audit.md` et `docs/global-audit.md`**
  référencés comme « obligatoires à consulter avant tout PR
  sécurité » dans CLAUDE.md, **ces fichiers n'existent pas**.
- Le bug du seed `onboarding_status` (corrigé dans le commit
  `5da5e22`) a montré qu'aucun test n'attrape la race entre
  [`useFirstRunSeed`](../../packages/web/src/core/modules/useFirstRunSeed.ts)
  et [`useModulesHydration`](../../packages/web/src/core/modules/useModulesHydration.ts).
- 25 routes API Hono, 21 fichiers dans
  [`packages/shared/`](../../packages/shared/) — la frontière
  shared vs local n'a pas été auditée depuis la migration de
  `splitThreads`.

---

## Tier A — santé du code

Quick wins à effet compounding. À traiter d'abord parce qu'ils
ferment la porte aux régressions futures.

### 1. ESLint + pre-commit (Phase 9)

**Pain** : aucun garde-fou automatique. Chaque règle de
CLAUDE.md (`no any`, `aria-*` partout, branded types crypto,
`no-restricted-imports` sur les helpers crypto sauvages, pas de
chaîne hardcodée hors whitelist) repose sur la vigilance
humaine en review. Un `git commit` avec `: any` ou un
`onClick` sur un `<div>` passe sans bruit.

**Coût** : 1–2 jours pour un setup propre.

- [ ] Choisir entre `eslint.config.ts` flat config (moderne, TS
      natif) vs legacy `.eslintrc.cjs`. Recommandation : flat
      config — c'est la voie supportée long-terme par
      `typescript-eslint`.
- [ ] Plugins de base : `@typescript-eslint`, `react`,
      `react-hooks`, `react-refresh`, `jsx-a11y`,
      `import` (ordering + no-cycle).
- [ ] Règles spécifiques projet :
  - `no-restricted-imports` : interdire l'import direct de
    primitives crypto (`crypto.subtle`) — forcer le passage
    par `core/crypto/*`.
  - `no-restricted-imports` : interdire `console.log` côté
    api (utiliser Pino).
  - `react/jsx-no-target-blank`, `jsx-a11y/click-events-have-key-events`.
  - Custom rule (ou `eslint-plugin-react-i18n`) qui interdit
    les chaînes littérales > 3 caractères dans le JSX (cf.
    [`docs/roadmap/i18n.md`](i18n.md) Tier 6).
- [ ] Pre-commit hook via [`husky`](https://github.com/typicode/husky)
      + [`lint-staged`](https://github.com/lint-staged/lint-staged)
      sur les fichiers modifiés uniquement (sinon trop lent).
      Exécute `eslint --fix` + `tsc --noEmit` sur le scope
      pertinent.
- [ ] Brancher dans CI (workflow GitHub Actions à créer si
      absent) : `pnpm lint` doit échouer le build.
- [ ] Mettre à jour `package.json` racine + per-workspace
      (`web` et `api`) pour que `pnpm lint` traverse tout.
- [ ] Documenter dans
      [`documentation/Architecture.md`](../Architecture.md)
      la convention finale (config, où elle vit, comment
      étendre).

### 2. Liquider la dette JSX/JS résiduelle

**Pain** : 18 fichiers en JSX/JS dans
[`packages/web/src/`](../../packages/web/src/) malgré la règle
TS-strict. Le code legacy n'a pas le même contrat de
type-safety que le reste — c'est un angle mort.

**Inventaire** (au moment où le document est posé) :

| Fichier | Surface | Effort estimé |
|---|---|---|
| [`app/App.jsx`](../../packages/web/src/app/App.jsx) | Routeur global | Moyen — touche tous les imports |
| [`app/pages/NotFound.jsx`](../../packages/web/src/app/pages/NotFound.jsx) | 1 page | Trivial |
| [`i18n/I18nProvider.jsx`](../../packages/web/src/i18n/I18nProvider.jsx) | Provider central | Coordonné avec roadmap i18n Tier 2 |
| [`core/utils/ImportExport/Goals.jsx`](../../packages/web/src/core/utils/ImportExport/Goals.jsx) + 6 autres | Export/import par module | Bloc cohérent à migrer ensemble |

**Coût** : 1 jour pour les triviaux + 2–3 jours pour
ImportExport (peu testé, à déchiffrer attentivement).

- [ ] Migrer
      [`NotFound.jsx`](../../packages/web/src/app/pages/NotFound.jsx)
      en TS strict (le plus simple, sert de smoke-test).
- [ ] Migrer
      [`App.jsx`](../../packages/web/src/app/App.jsx) — typer
      le routeur, les error boundaries, le `popstate`
      listener mentionné dans CLAUDE.md.
- [ ] Migrer le bloc
      [`core/utils/ImportExport/`](../../packages/web/src/core/utils/ImportExport/)
      en bundle cohérent (7 fichiers : `Goals`, `HabitsItems`,
      `HabitsLogs`, `LibraryItems`, `LibraryReviews`, `Mood`,
      `Review`). Vérifier en passant que le format d'export
      respecte les schémas Zod de `@nodea/shared` (sinon les
      sortir dans `shared/`).
- [ ] Migrer
      [`I18nProvider.jsx`](../../packages/web/src/i18n/I18nProvider.jsx)
      — coordonné avec
      [`docs/roadmap/i18n.md`](i18n.md) Tier 2 (où on touche
      au provider de toute façon pour ajouter `tn`).
- [ ] Recensement final :
      `find packages -name "*.js" -o -name "*.jsx" | grep -v
      node_modules | grep -v dist` → liste vide attendue.

### 3. Carte de couverture des tests

**Pain** : 49 fichiers de test, mais on ne sait pas où sont
les trous. CLAUDE.md vise ≥ 90 % sur
[`core/crypto/`](../../packages/web/src/core/crypto/) — non
mesuré. Le bug onboarding qu'on vient de chasser (race
`useFirstRunSeed`/`useModulesHydration`) montre qu'on a au
moins **un trou critique sur les flows post-login**.

**Coût** : 1 jour d'audit + suivi à la PR près.

- [ ] Activer `vitest run --coverage` côté `web` et `api`
      (provider `v8` natif, pas besoin d'install).
- [ ] Générer un rapport HTML, lire les zones à 0 %.
- [ ] Documenter le **baseline actuel** dans cette section —
      crypto X %, auth Y %, modules Z %, etc. Sert d'ancrage.
- [ ] Identifier les 3–5 fichiers où une régression silencieuse
      coûterait le plus (CLAUDE.md liste : crypto round-trips,
      auth flows, invite atomicity). Combler en priorité.
- [ ] Ajouter le test qui aurait attrapé le bug onboarding :
      simuler un user fraîchement créé avec
      `onboarding_status = pending`, vérifier que
      `useFirstRunSeed` ne se déclenche pas pendant que
      `useModulesHydration` n'a pas fini.
- [ ] Décider si on impose un seuil bloquant en CI (`vitest
      --coverage --reporter=...` qui échoue sous X %). Pour
      crypto ≥ 90 %, oui ; pour le reste, à débattre.

---

## Tier B — architecture & cohérence

Continuités à apporter au code existant. Pas urgent, mais
chaque jour de retard c'est de la dette qui s'accumule.

### 4. Pattern d'erreurs unifié (API ↔ store ↔ UI)

**Pain** : trois patterns d'erreurs coexistent sans
canonisation —
- `throw new Error('Erreur lors de…')` avec message FR
  hardcodé directement dans le `catch`,
- classe [`ApiError`](../../packages/web/src/core/api/internal.ts)
  côté client (mieux structurée, mais pas systématiquement
  utilisée),
- `catch {}` silencieux ici et là.

Chaque page a sa propre table de traduction code machine →
message FR ([`pages/Login.tsx:41-65`](../../packages/web/src/app/pages/Login.tsx#L41-L65)
en a 6).

**Coût** : 2–3 jours, mais cousin direct du Tier 4 i18n —
à coordonner.

- [ ] Recenser les codes machine renvoyés par les 25 routes
      [`api/src/routes/`](../../packages/api/src/routes/) et
      figer la liste canonique en
      [`packages/shared/src/error-codes.ts`](../../packages/shared/src/error-codes.ts)
      — type `ApiErrorCode = '…'`.
- [ ] Étendre [`ApiError`](../../packages/web/src/core/api/internal.ts)
      pour qu'il porte un `code: ApiErrorCode` typé.
- [ ] Helper `apiErrorMessage(code, t)` dans
      [`core/api/`](../../packages/web/src/core/api/) — toutes
      les pages remplacent leur switch local.
- [ ] Audit du repo pour `catch {}` non commenté (CLAUDE.md
      exige une justification one-liner). Compléter ou
      remplacer par `console.warn` (côté web) /
      `logger.warn` (côté api).
- [ ] Une fois la liste canonique en place, le Tier 4 i18n
      tombe naturellement.

### 5. Promotion `shared/` au statut de keystone

**Pain** : CLAUDE.md insiste « as soon as both sides touch
it, move it to shared ». 21 fichiers en place mais aucune
passe d'audit récente — combien de schémas / unions /
constantes vivent en double ? Spot check : codes machine
d'erreur, types de payload module, formats de date. Tous
candidats.

**Coût** : 1–2 jours pour l'audit + extraction.

- [ ] Diffuser depuis web vers shared : codes d'erreur (Tier
      4 ci-dessus), types `*Lite` qui ressemblent aux
      payloads canoniques, helpers de date FR (qui sont déjà
      dans `core/i18n/date-fr.ts` mais pourraient migrer si
      l'api en a besoin pour des emails par exemple — voir
      Tier 5 i18n).
- [ ] Diffuser depuis api vers shared : tout enum / status
      union qui sert au front via les Zod schemas. Vérifier
      qu'aucun `enum` Drizzle ne soit re-déclaré en TS côté
      web.
- [ ] Vérifier la **branded types** crypto : CLAUDE.md exige
      `Base64`, `AesMainKey`, etc. Audit que ces types vivent
      bien dans
      [`packages/shared/src/crypto-types.ts`](../../packages/shared/src/crypto-types.ts)
      (à créer si absent) et que les call-sites les utilisent.

### 6. Factory `createModuleContexts<>()`

**Pain** : 4 modules (Library / Goals / Journal / Mood)
partagent le même squelette `Data/Filters/Actions Provider`,
~80 LOC × 4 de boilerplate identique. Identifié pendant la
clôture de l'ancien `factoring-audit` ; la décision avait
été de **différer** avec un déclencheur explicite : « si
Habits ou Review s'y mettent ».

**Coût** : 1 jour pour la factory + migration des 4 modules,
ou 0 si on attend le 5ᵉ module.

- [ ] Décider : extraction préventive ou wait-for-trigger.
      Recommandation : attendre — l'abstraction sans 3ᵉ
      consommateur est typiquement prématurée, et la
      duplication actuelle est lisible. À reconsidérer si
      Habits ou Review repassent en chantier actif.
- [ ] Si on extrait : signature
      `createModuleContexts<Data, Filters, Actions>()`
      retourne `{ Provider, useData, useFilters, useActions }`.
      Test sur un seul module en isolation, ensuite
      propagation.

---

## Tier C — sécurité & crypto

Enjeux réels (l'app est e2e encrypted). À traiter sérieusement
dès que le terrain est clean (Tier A).

### 7. Audit sécurité — combler `security-audit.md`

**Pain** : CLAUDE.md référence
`documentation/security-audit.md` et
`documentation/global-audit.md` comme **références
obligatoires à cross-checker avant tout PR sécurité**. Ces
fichiers **n'existent pas dans le repo**. Le baseline qu'ils
sont censés porter n'a jamais été figé. Auth Phase 2/4 sont
landées, c'est le bon moment pour cristalliser.

**Coût** : 3–5 jours pour un audit honnête.

- [ ] Décider de l'emplacement : `docs/security-audit.md` ou
      `documentation/security-audit.md`. Voir Tier 10 sur
      `docs/` vs `documentation/`.
- [ ] Sweep crypto : HKDF labels, branded types,
      [`wipeMainKeyMaterial`](../../packages/web/src/core/crypto/),
      pas de `window.mainKey` survivant, base64 source
      unique.
- [ ] Sweep auth : guards sur toutes les mutations
      (CLAUDE.md exige le « factory of module routes driven
      by a single typed array »), invite atomicity test
      écrit, rate-limit sur tous les `/auth/*`, session
      cookies avec les flags `httpOnly; Secure; SameSite=Lax;
      Signed`.
- [ ] Sweep réponse serveur : intégration test qui vérifie
      qu'aucune réponse ne contient `guard` ou
      `encrypted_key` d'un autre user (CLAUDE.md exige ce
      test).
- [ ] Sweep deps : `pnpm audit`, `npm-check-updates`. Lister
      les deps non maintenues / non auditées.
- [ ] Sweep secrets : `git log -p | grep -i 'secret\|key\|
      token'` pour ne rien avoir laissé fuiter
      historiquement.
- [ ] Cross-check avec le `security-checklist` de CLAUDE.md
      (≈ 9 cases) : pour chaque case, prouver dans le doc
      qu'elle est respectée + cite un test.

### 8. Couverture crypto + intégration auth

**Pain** : CLAUDE.md cible ≥ 90 % sur
[`core/crypto/`](../../packages/web/src/core/crypto/) **non
vérifié**, et exige des tests d'intégration sur :
- register → login → change-password → logout → stale-cookie
  rejection,
- invite atomicity (le même code utilisé deux fois — la 2ᵉ
  doit échouer).

**Coût** : 2–3 jours.

- [ ] Mesurer la couverture crypto via Tier 3 ci-dessus.
      Cible : ≥ 90 % bloquant en CI.
- [ ] Écrire le test d'intégration register → … → stale-cookie
      (probablement déjà partiellement présent mais pas
      bout-en-bout).
- [ ] Écrire le test d'atomicité d'invite (transaction Drizzle
      `SELECT FOR UPDATE` → create user → delete invite). À
      placer dans
      [`packages/api/src/test/`](../../packages/api/src/test/).
- [ ] Vérifier que le pattern `wipeMainKeyMaterial` est
      respecté partout (les CryptoKey ne peuvent pas être
      effacées, mais les bytes sources doivent l'être).

---

## Tier D — performance

À traiter en dernier. Sans mesure, on optimise à l'aveugle.

### 9. Bundle + load profiling

**Pain** : pas de mesure récente. Suspects :
- Argon2 + WASM hash dans le main thread peut bloquer la
  frame ~1 s pendant le derive (UX login).
- Code splitting par module via `React.lazy` censé être en
  place — non vérifié.
- Dépendances lourdes potentielles (`puppeteer` côté api est
  ~200 MB, justifié ?).

**Coût** : 1–2 jours pour le profiling, l'optimisation
dépend des résultats.

- [ ] Ajouter
      [`rollup-plugin-visualizer`](https://github.com/btd/rollup-plugin-visualizer)
      en mode CI artifact (un build → un HTML qu'on archive).
      Documenter le poids total + top 10 chunks.
- [ ] Vérifier que chaque module flow est bien `lazy()` dans
      [`App.jsx`](../../packages/web/src/app/App.jsx) (à
      faire après sa migration TS, Tier 2 ci-dessus).
- [ ] Si Argon2 bloque visiblement le main thread, déplacer
      le derive dans un Web Worker. Ne **pas** faire avant
      d'avoir mesuré (UX peut être déjà OK).
- [ ] Côté api, vérifier que `puppeteer` est nécessaire (sert
      probablement à générer le PDF de récupération) et qu'il
      ne plombe pas l'image Docker. Si oui, voir s'il y a
      une alternative légère.
- [ ] Lancer `pnpm --filter @nodea/api db:studio` avec query
      logging activé, parcourir les pages qui chargent
      beaucoup de données (Library, Mood heatmap), repérer
      les N+1 — CLAUDE.md exige une mesure avant
      d'optimiser.

---

## Tier E — documentation & ops

Drift à corriger en continu, pas de chantier dédié sauf
clarification du `docs/` vs `documentation/`.

### 10. Doc-code reconciliation

**Pain** :
- CLAUDE.md référence à la fois `docs/` et `documentation/`
  comme s'il s'agissait d'un même dossier — alors qu'**un
  seul existe** (à confirmer).
- [`Modules.md`](../Modules.md) liste Habits + Library +
  Review comme « non implémentés », mais Library est
  largement développé maintenant.
- [`security-audit.md`](../security-audit.md) et
  [`global-audit.md`](../global-audit.md) référencés mais
  absents (cf. Tier 7).
- Les roadmaps cochées à 100 % doivent être archivées /
  supprimées plutôt que de traîner — la convention vient
  d'être appliquée sur `module-refacto.md` (commit `4e45616`)
  et `factoring-audit.md` (commit `6e86135`), à reproduire
  pour les suivantes.

**Coût** : 0,5 jour de sweep + discipline continue.

- [ ] Trancher : un seul dossier (recommandation : `docs/`
      conforme à la convention React/TS, supprimer
      `documentation/` si doublon vide). Mettre à jour
      CLAUDE.md.
- [ ] Mettre [`Modules.md`](../Modules.md) à jour : Library
      passe de « documenté, non implémenté » à « implémenté »
      avec la liste des features livrées.
- [ ] Vérifier que [`Architecture.md`](../Architecture.md),
      [`Database.md`](../Database.md),
      [`Security.md`](../Security.md) reflètent le code à
      jour (provider patterns, schema split, crypto
      branded types).
- [ ] Convention pour les roadmaps : quand 100 % cochée,
      `git rm` du fichier (cas
      [`module-refacto.md`](module-refacto.md)) plutôt que
      le laisser comme bruit.

---

## Sequencing recommandé

1. **Tier A.1 (ESLint)** d'abord — chaque autre Tier
   bénéficie du filet automatique.
2. **Tier A.3 (carte de couverture)** en parallèle — audit
   peu coûteux qui informe les Tiers suivants. Un `vitest
   --coverage` et 30 min de lecture du rapport.
3. **Tier C.7 (security-audit)** ensuite — l'app est e2e
   encrypted, on ne devrait pas pousser de Phase 5+ sans
   baseline figé.
4. **Tier A.2 (legacy JSX)** + **Tier B.4 (errors unifiés)**
   en cycle court — les deux se feront naturellement avec
   un linter qui hurle.
5. **Tier C.8 (crypto + auth integration tests)** — c'est le
   moment de rattraper la dette de tests une fois la carte
   de couverture lue.
6. **Tier B.5 (shared keystone)** + **Tier E.10 (docs)** —
   chantiers continus à tisser dans toutes les autres PRs.
7. **Tier B.6 (factory contextes)** — wait-for-trigger,
   recommandation : ne rien faire tant qu'un 5ᵉ module n'en
   a pas besoin.
8. **Tier D.9 (perf)** — en dernier. Mesurer avant
   d'optimiser.

## Décisions à figer

- [ ] **Linter flat config vs legacy** ? Recommandation :
      flat config (`eslint.config.ts`).
- [ ] **`docs/` vs `documentation/`** : on en garde un seul.
      Recommandation : `docs/`.
- [ ] **Seuil de couverture bloquant en CI** ? Recommandation
      : ≥ 90 % sur `core/crypto/` bloquant ; le reste en
      simple monitoring.
- [ ] **Factory `createModuleContexts<>()`** : préventive ou
      wait-for-trigger ? Recommandation : trigger.
- [ ] **Plafond LOC global** (héritage du chantier
      `factoring-audit` clôturé) : 300 LOC par feuille
      `.tsx`, 500 pour les providers, 700 pour schemas/
      configs. À codifier en lint custom (Tier A.1).

---

## Comment cocher

À chaque PR qui livre une étape, ouvre ce fichier, coche la
case, commit le changement de doc dans le même PR. Quand un
Tier est entièrement coché, replier sa section ou la déplacer
en bas dans une rubrique « livré ».

Quand le doc est entièrement coché, suivre la convention
Tier E.10 (héritée de la clôture de `module-refacto.md` et
`factoring-audit.md`) : `git rm docs/roadmap/health.md`.
