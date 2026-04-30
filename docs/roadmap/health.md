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

### 1. ESLint + pre-commit (Phase 9) — livré

**Statut** : commits `e36b561` (config + cleanup + CI gate) +
`935e55d` (husky + lint-staged). Lint passe en CI sur tous
les workspaces, 0 erreurs / 68 warnings aspirationnels
(`react-refresh/only-export-components` + `no-console` côté
api seed).

- [x] Flat config livrée :
      [`eslint.config.mjs`](../../eslint.config.mjs) — eslint
      9.39.4, typescript-eslint 8.59.1, react / react-hooks /
      react-refresh / jsx-a11y / import-x.
- [x] Règles spécifiques CLAUDE.md :
  - `@typescript-eslint/no-explicit-any` en error.
  - `no-restricted-syntax` bloque `crypto.subtle.*` hors
    `core/crypto/` (`crypto.randomUUID` et
    `crypto.getRandomValues` restent libres).
  - `no-console` warn côté api (Pino préféré).
  - `no-unescaped-entities` ne forbid plus que `<>}`
    (apostrophes FR n'étaient que du bruit).
  - `jsx-a11y/label-has-associated-control` configuré pour
    reconnaître les `Input` / `Textarea` / `Select` du projet.
- [x] Pre-commit via husky 9.1.7 + lint-staged 16.4.0 — exécute
      `eslint --fix --max-warnings=0` sur les fichiers staged
      uniquement. Hook installé automatiquement à
      `pnpm install` via le script `prepare`.
- [x] Step `Lint` ajouté dans
      [`.github/workflows/ci.yml`](../../.github/workflows/ci.yml)
      entre Install et Typecheck — `pnpm lint` doit passer
      pour merger.
- [x] `lint` script remplacé dans `packages/api` (était
      `echo 'pending Phase 9'`). Web l'avait déjà.
- [ ] Documenter dans
      [`documentation/Architecture.md`](../Architecture.md)
      la convention finale (config, où elle vit, comment
      étendre). À faire dans le Tier E.10.

### 2. Liquider la dette JSX/JS résiduelle — quasi livré

**Statut** : 16 fichiers sur 17 traités. Restant : un seul,
[`i18n/I18nProvider.jsx`](../../packages/web/src/i18n/I18nProvider.jsx)
(225 LOC), volontairement laissé pour le Tier 2 de
[`i18n.md`](i18n.md) où on touche au provider de toute
façon (ajout du helper `tn`, migration EN parallèle).

Bilan concret :
  - **4 fichiers morts** supprimés (`SubNavDesktop.jsx`,
    `SubNavMobile.jsx`, `UserAvatar.jsx`,
    `headers/Subheader.jsx`) — aucun consommateur réel après
    le passage à K · Sauge. Le shim `Subheader` dans
    [`types/legacy-modules.d.ts`](../../packages/web/src/types/legacy-modules.d.ts)
    a été retiré dans la foulée.
  - **`core/api/modules/passage-legacy.js`** également
    supprimé — vues legacy remplacées, plus aucun appel.
  - **`NotFound.jsx`** + **`App.jsx`** migrés en TS strict
    (popstate handler typé, lazyPage typé `ReactElement`).
  - **Bloc ImportExport (8 fichiers)** migré : nouveau
    [`types.ts`](../../packages/web/src/core/utils/ImportExport/types.ts)
    qui pose le contrat `ImportExportPlugin`, registry typé,
    7 plugins (Mood, Goals, HabitsItems, HabitsLogs,
    LibraryItems, LibraryReviews, Review) en TS strict.
  - **Découverte au passage** : les plugins ImportExport
    produisent des payloads qui ne matchent plus les schémas
    Zod actuels — ce qui était silencieux en JS lève
    désormais TS2345/TS2352. Cast au boundary
    `client.create()` avec TODO référençant le **Tier B.7
    ci-dessous**.

- [x] Tous les fichiers `.jsx`/`.js` morts supprimés.
- [x] `NotFound.tsx`, `App.tsx`, `utils.ts`,
       `registry.data.ts` et les 7 plugins ImportExport
       livrés en TS strict.
- [x] `types.ts` pose le contrat plugin pour la suite.
- [x] Shim `Subheader` retiré de `legacy-modules.d.ts`.
- [ ] **`I18nProvider.jsx`** — migré dans
       [`i18n.md`](i18n.md) Tier 2 (pas ici, où on touche au
       provider de toute façon pour ajouter `tn`).
- [ ] Recensement final attendu après le Tier 2 i18n :
      `find packages -name "*.js" -o -name "*.jsx" | grep -v
      node_modules | grep -v dist` → liste vide.

### 3. Carte de couverture des tests — baseline posé

**Statut** : `@vitest/coverage-v8@3.2.4` installé,
`vitest.config.ts` configuré côté web + api avec
`reportsDirectory: 'coverage'` et un set d'`exclude`
pertinent (tests, fixtures, config, ambient `.d.ts`,
seed, scripts de migration). `pnpm test:coverage` à la
racine lance tout en parallèle.

**Baseline (commit `<this commit>`)** :

| Zone web | Stmts | Verdict |
|---|---|---|
| `core/crypto` | **93.54 %** | ✅ Cible CLAUDE.md ≥ 90 % atteinte |
| `core/i18n` | 100 % | ✅ |
| `core/store` | 78.76 % | OK (funcs à 30 %) |
| `core/api` | 12.6 % | ⚠️ Sous-couvert |
| `core/auth` | **0 %** | ❌ Trou — sessions, ProtectedRoute, login flows |
| `core/modules` | **0 %** | ❌ Bug onboarding y vit |
| `app/flow/Mood/lib` | 83.57 % | ✅ |
| `app/flow/Library/lib` | 69.36 % | OK |
| `app/flow/Goals/lib` | 52.63 % | Moyen |
| `app/flow/Journal/lib` | 38.13 % | Faible |
| `app/flow/Account/lib` | 10.63 % | ⚠️ |
| **Total web** | **4.77 %** | (UI components à 0 %, attendu sans jsdom + RTL) |

| Zone api | Stmts | Verdict |
|---|---|---|
| `routes/` | 73.43 % | ✅ Bien |
| `middleware/` | 93.37 % | ✅ |
| `auth/` | 90 %+ sur la majorité | ✅ |
| `lookup/` | **9.74 %** | ❌ BNF/Wikidata/Google/OL non testés en unitaire |
| `cron/` | **0 %** | ❌ 134 LOC non testées |
| `services/email` (hors templates) | 34.43 % | Moyen |
| **Total api** | **63.36 %** | (avec `seed/` exclu) |

**Trous prioritaires** :
1. `core/auth/` — 0 %, gros risque (use-session est central).
   Tester demande `@testing-library/react` + jsdom (non
   installés), donc pré-requis : poser l'infra de tests
   React.
2. `core/modules/` — 0 %, c'est là que vit le bug onboarding
   qu'on a chassé. Même pré-requis (RTL).
3. `api/src/lookup/*` — 9.74 %, les adapters ISBN ne sont
   testés que via le dispatcher dans `merge.ts`. Risque
   moyen (les providers évoluent côté serveur, on n'attrape
   pas leurs régressions silencieusement).
4. `api/src/cron/` — 0 %, 134 LOC. À vérifier d'abord si le
   cron est encore consommé ou si c'est mort.

- [x] `vitest run --coverage` opérationnel côté web + api +
       script `pnpm test:coverage` à la racine.
- [x] `coverage/` ajouté à `.gitignore` (artefacts par
       package).
- [x] Baseline ci-dessus documenté.
- [ ] **Pré-requis bloquant pour combler les 0 %** :
       installer `@testing-library/react` + un env DOM
       (recommandation : `happy-dom` plutôt que `jsdom`,
       plus rapide). Un seul setup partagé par
       `vitest.config.ts`.
- [ ] Une fois RTL en place, écrire le test de la race
       `useFirstRunSeed` / `useModulesHydration` — celui qui
       aurait attrapé le bug `onboarding_status` du commit
       `5da5e22`.
- [ ] Combler `core/auth/` à au moins 60 % (use-session a
       9 sous-modules, prioriser `login.ts` et
       `register.ts`).
- [ ] Couvrir au moins un round-trip par adapter
       `api/src/lookup/*` (mock du fetch ; l'objectif n'est
       pas de hit les vrais providers en CI).
- [ ] Auditer `api/src/cron/` — si vivant, écrire un test
       par job ; si mort, supprimer.
- [ ] Décider d'un seuil bloquant CI sur `core/crypto/`
       (recommandation : ≥ 90 %, on est à 93.54 % donc on
       peut figer). Le reste reste en monitoring (observable
       via le job CI mais non bloquant).

---

## Tier B — architecture & cohérence

Continuités à apporter au code existant. Pas urgent, mais
chaque jour de retard c'est de la dette qui s'accumule.

### 4. Pattern d'erreurs unifié (API ↔ store ↔ UI) — fondations livrées

**Statut** : la liste canonique est posée, le helper de
traduction marche, **Login.tsx** a été migré comme preuve
de concept (les 6 strings hardcodées du `catch` sont
remplacées par un `apiErrorMessage(err, t)` unique). Reste à
diffuser sur les autres pages (Register, Recover,
ChangePassword, RecoveryCode, Account/*) et auditer les
`catch {}` silencieux du repo.

Bilan concret :
  - 46 codes machine recensés à partir d'un grep
    `{ error: 'xxx' }` sur
    [`packages/api/src/routes/`](../../packages/api/src/routes/).
  - [`packages/shared/src/error-codes.ts`](../../packages/shared/src/error-codes.ts)
    expose `KNOWN_API_ERROR_CODES` (array `as const`) +
    type `KnownApiErrorCode` + alias permissif
    `ApiErrorCode = KnownApiErrorCode | (string & {})`.
    L'union reste **non-exhaustive** : un code fraîchement
    ajouté côté api ne casse pas le compile front, juste
    bascule sur le fallback générique le temps que i18n
    rattrape.
  - [`ApiError.error`](../../packages/web/src/core/api/internal.ts)
    désormais typé `ApiErrorCode` (était `string`).
  - [`apiErrorMessage(err, t)`](../../packages/web/src/core/api/error-message.ts)
    re-exporté depuis `core/api/client.ts`. Pattern :
    code connu → `errors.api.<code>` → fallback
    `errors.api.unknown` → `errors.api.network` quand le
    catch a fait feu sur autre chose qu'un `ApiError`.
  - [`packages/web/src/i18n/locales/{fr,en}/errors.json`](../../packages/web/src/i18n/locales/fr/errors.json)
    rempli avec une entrée par code (46) + `unknown` + `network`.
  - [`error-message.test.ts`](../../packages/web/src/core/api/error-message.test.ts)
    pose 5 tests qui verrouillent : code connu, code typé
    mais sans entrée JSON, code totalement inconnu, exception
    non-`ApiError`, JSON vide.

- [x] Liste canonique
       [`error-codes.ts`](../../packages/shared/src/error-codes.ts)
       + barrel `@nodea/shared`.
- [x] Type `ApiErrorCode` permissif (`Known | (string & {})`).
- [x] [`apiErrorMessage(value, t)`](../../packages/web/src/core/api/error-message.ts)
       + 5 tests Vitest.
- [x] `errors.api.*` rempli côté FR + EN (46 codes + 2
       fallbacks).
- [x] [`Login.tsx`](../../packages/web/src/app/pages/Login.tsx)
       migré (les 2 `catch` du formulaire + de la passkey).
- [x] Pages auth migrées : ChangePassword, Recover,
       RecoveryCode, Register/RegisterForm, RequestReset,
       Reset, SecurityMode (+ Login déjà fait dans le commit
       de fondation). 4 nouvelles clés page-spécifiques
       ajoutées dans `errors.recovery.*`, `errors.register.*`,
       `errors.securityMode.*` (FR + EN) pour les overrides
       sémantiques (code recovery vs password, email
       mismatch, totp/passkey required actionable).
- [ ] Activate.tsx — pattern incompatible (catch construit
       un enum `reason` qui pilote des panels différents,
       pas un setError). À traiter séparément si on uniformise
       les Activate panels.
- [ ] LoginMfa, Passkeys, Totp pages — patterns spéciaux
       (WebAuthn cancel, panels de stage). Migration à
       prévoir mais demande analyse au cas par cas.
- [ ] Migrer les pages module (Account/views/IdentityTab,
       Library composer, Goals carry-over, etc.). Cousin
       direct du Tier 4 de [`i18n.md`](i18n.md).
- [x] Audit `catch {}` non commenté — 46 catches recensés
       côté web + api. **Aucun n'est vraiment silent** (chacun
       fait quelque chose d'actionnable : return default, set
       state, throw typed error, return error response). 7
       d'entre eux manquaient juste du commentaire CLAUDE.md
       — comblés (Goals/Journal/Review draft hooks,
       passkey-flow, bip39, main.tsx theme bootstrap,
       email-verifications constant-time hex). `safeJson` et
       `loadDecryptedPreferences` ont déjà leur rationale dans
       le doc-bloc du module, OK comme ça.

### 5. Promotion `shared/` au statut de keystone — audit posé

**Statut** : audit fait. Sortie : moins de duplication
que l'audit d'origine craignait, mais un manque de typage
sur les module ids côté api. Action concrète prise dans le
même commit : promotion de `MODULE_IDS` /
`DATA_MODULE_IDS` / `ModuleId` / `DataModuleId` vers
[`packages/shared/src/module-ids.ts`](../../packages/shared/src/module-ids.ts),
re-export depuis `core/store/nodea-store.ts` (zéro changement
pour les 6+ consommateurs web), et **typage strict** de
`ensureModuleUserId` côté api seed.

Bilan détaillé :

| Candidat | Verdict |
|---|---|
| **Module ids** (`mood`, `goals`, …) | ✅ Promu — `ModuleId` (routing, 9 entrées) + `DataModuleId` (modules_config keys, 6 entrées). Api `ensureModuleUserId` typé `DataModuleId`. |
| **Codes d'erreur API** | ✅ Déjà fait (Tier B.4 → `error-codes.ts`). |
| **Module enums** (`MOOD_SCORE_VALUES`, `GOAL_STATUS_VALUES`, `LIBRARY_STATUS_VALUES`, `LIBRARY_FORMAT_VALUES`) | ✅ Déjà dans `@nodea/shared/schemas/entries.ts`. Importés cleanly côté web. |
| **Branded crypto types** (`Base64`, `AesMainKey`, etc.) | ✅ Déjà dans [`packages/shared/src/crypto-types.ts`](../../packages/shared/src/crypto-types.ts), utilisés correctement. |
| **Helpers de date FR** ([`core/i18n/date-fr.ts`](../../packages/web/src/core/i18n/date-fr.ts)) | ⏳ FR-only avec `'fr-FR'` hardcodé. Migration vers shared bloquée par i18n Tier 3 (généralisation EN). |
| **Types `*Lite`** (Homepage `MoodEntryLite` etc.) | ⏸ Décision déjà prise pendant `factoring-audit` Tier 3 : restent locaux, raison documentée (Goal status plus étroit, Library author dérivé). |

- [x] Audit : pas de duplication structurelle massive ; le
       projet était déjà discipliné sur les schémas Zod.
- [x] Promotion `MODULE_IDS` / `DATA_MODULE_IDS` (+ guards) à
       shared.
- [x] Api `ensureModuleUserId(moduleId: DataModuleId, …)` —
       typo-bug surface fermée. `purgeModuleKeys` reste typé
       `string` pour permettre la purge de clés legacy.
- [ ] **Follow-up** : quand i18n Tier 3 sera prêt (date
       formatting généralisé EN), promouvoir `core/i18n/
       date-fr.ts` (devenu `date-format.ts`) dans shared si
       l'api en a besoin pour les emails.

### 6. Factory `createModuleContexts<>()` — livré

**Statut** : la décision initiale « wait-for-trigger » a été
renversée — la factory a été extraite et déployée sur les 4
modules existants pour préparer Habits + Review.

Implémentation :
[`packages/web/src/core/react/module-contexts.tsx`](../../packages/web/src/core/react/module-contexts.tsx)
expose `createModuleContexts<D, F, A>(moduleName)` qui retourne
`{ Provider, useData, useFilters, useActions }`. Chaque hook
porte le nom du module dans son message d'erreur (« must be
used inside `<MoodProvider>` »), et la triple-nested JSX vit
dans la factory au lieu d'être copiée dans chaque module.

Migration appliquée :
  - [`flow/Goals/context.tsx`](../../packages/web/src/app/flow/Goals/context.tsx)
  - [`flow/Journal/context.tsx`](../../packages/web/src/app/flow/Journal/context.tsx)
  - [`flow/Library/context.tsx`](../../packages/web/src/app/flow/Library/context.tsx)
  - [`flow/Mood/context.tsx`](../../packages/web/src/app/flow/Mood/context.tsx)

Chaque module est passé de ~35 LOC de boilerplate (3 ×
`createContext` + `useRequiredContext` + 3 hooks + JSX triple-
nested) à ~5 lignes de déclaration via la factory.

- [x] Factory `createModuleContexts<D, F, A>(moduleName)` posée.
- [x] 4 modules migrés : Goals, Journal, Library, Mood.
- [ ] **Follow-up** : Habits + Review (quand ils repassent en
       chantier actif) suivront automatiquement le même contrat
       — la factory est prête.

### 7. Rewire ImportExport plugins → schémas Zod actuels — livré

**Statut** : commit `55157ac`. Les 7 plugins passent désormais
leur payload à travers `Schema.parse()` et retournent le type
inféré canonique. Les casts au boundary sont supprimés ; le
runtime n'est plus en décalage avec les schémas.

Bilan par plugin :
  - **Mood** : `mood_score` coercé en `string` (était parfois
    un nombre dans les vieux exports).
  - **Goals** : minimal — le schéma a un `.default(…)` sur
    presque tout, donc les anciens exports passent direct.
  - **HabitsItems** : `category` / `frequency` clamp aux
    enum, fall back à `autre` / `weekly` pour les valeurs
    free-form.
  - **HabitsLogs** : trivial.
  - **LibraryItems** : **migration legacy on the fly** —
    l'ancien `provider` + `external_id` plat est groupé en
    `providers` canonique. `status` / `format` clamp aux
    enums. Natural key reconstruite.
  - **LibraryReviews** : **vrai bug fix** — `note` legacy →
    `content` canonique, `kind: 'note'` par défaut. Les
    exports anciens importent sans retouche manuelle.
  - **Review** : `year` coercé en number, `updated_at` rempli
    par défaut Zod.

Bonus : `normalizePayload` est passé de 25-40 LOC à ~10 LOC
par plugin (Zod fait la coercion). Les interfaces internes
`RawXxxPayload` / `NormalisedXxxPayload` sont retirées.

- [x] Réaligner chaque `normalizePayload` sur le schéma Zod
       canonique de son module (7 plugins migrés).
- [x] Retirer les casts `as Parameters<…>[2]` au boundary
       `client.create()` (tous supprimés).
- [x] Migration legacy in-flight pour les exports anciens :
       LibraryItems (provider plat → providers groupé),
       LibraryReviews (note → content), Review
       (string year → number).
- [ ] **Follow-up** : test round-trip par module (export N
       records → re-importer → vérifier que les natural keys
       matchent). À écrire quand l'infra de tests web aura
       gagné jsdom + RTL (pré-requis Tier A.3).
- [ ] **Follow-up** : `meta.version` reste à `1` pour tous
       les plugins. Si on bump une shape de schéma à l'avenir,
       il faudra incrémenter la version + ajouter un chemin
       de migration depuis les exports v1.

---

## Tier C — sécurité & crypto

Enjeux réels (l'app est e2e encrypted). À traiter sérieusement
dès que le terrain est clean (Tier A).

### 8. Audit sécurité — combler `security-audit.md` — livré

**Statut** : baseline posée dans
[`docs/security-audit.md`](../security-audit.md). Audit
exhaustif des 6 zones (crypto / auth / response leakage /
git history / deps / CLAUDE.md security-checklist) ; les
**2 findings critiques** trouvés ont été fixés dans le même
cycle.

Findings traités :
  - 🚨 **Finding 1** (Critique) — Guards HMAC loggés via le
    query string `?d=<guard>` par Hono `logger()`. Fix :
    custom printer
    [`sanitize-log-url.ts`](../../packages/api/src/middleware/sanitize-log-url.ts)
    qui redacte `d=` et `token=` avant d'atteindre stdout +
    10 tests Vitest qui figent le contrat.
  - 🚨 **Finding 2** (Haute) — Atomicité d'invite non testée
    en concurrent. Fix : test
    [« rejects a second concurrent invite consumption »](../../packages/api/src/test/auth-register-v2.test.ts)
    qui drive deux `/finish` en `Promise.all` et vérifie qu'un
    seul user est créé.

Le doc s'archive aussi le ⚠️ design-choice (`modules_config`
exempté de guard, intentionnel et documenté dans CLAUDE.md).

- [x] Doc posé en `docs/security-audit.md` (la confusion
       `docs/` vs `documentation/` se résoudra dans le Tier
       11).
- [x] Sweep crypto : HKDF labels, branded types,
       wipeRawBytes, pas de leak global. ✅
- [x] Sweep auth : guards via `collections/registry.ts`,
       atomicité d'invite testée, rate-limit sur tous les
       `/auth/*`, session cookies signés httpOnly. ✅
- [x] Sweep réponse serveur : `toView()` strip `guard`,
       admin route sélective, `/me` ne renvoie que les wrap
       blobs du user authentifié. ✅
- [x] Sweep deps : `pnpm audit --prod` clean (1 vuln
       Playwright dev-only), crypto-deps toutes pinned. ✅
- [x] Sweep secrets : `.env.example` propre, git log clean. ✅
- [x] Cross-check security-checklist CLAUDE.md : 9/9 cases
       respectées avec évidence. ✅
- [ ] **Follow-up** : `documentation/global-audit.md`
       reste référencé dans CLAUDE.md mais inexistant. À
       traiter au Tier 11 (doc reconciliation) — soit on
       l'écrit, soit on retire la référence.

### 9. Couverture crypto + intégration auth — livré

**Statut** : seuil ≥ 90 % bloquant CI figé sur
[`core/crypto/`](../../packages/web/src/core/crypto/) (mesuré
93.54 % au baseline, on a de la marge). Les deux tests
d'intégration mandatés par CLAUDE.md sont en place.

Bilan :
  - **Seuil bloquant CI** : `vitest.config.ts` web déclare
    `thresholds: { 'src/core/crypto/**/*.ts': { lines: 90,
    functions: 90, branches: 90, statements: 90 } }`. La CI
    échoue si une régression fait tomber crypto sous 90 % ;
    le reste reste en monitoring sans seuil dur.
  - **Test register → login → change-password → logout →
    stale-cookie** : nouveau bloc « end-to-end auth lifecycle »
    dans [`auth.test.ts`](../../packages/api/src/test/auth.test.ts)
    qui chaîne tout. Vérifie à chaque étape que l'ancien
    cookie est bien rejeté (3 vérifications stale-cookie en
    bout-en-bout).
  - **Test atomicité d'invite** : déjà fixé en Tier 8 (concurrent
    `Promise.all` sur `/finish` avec le même token).
  - **Refacto helpers** : `fullRegister` / `startRegistration` /
    `finishRegistration` / `defaultUsernameFor` promus de
    `auth-register-v2.test.ts` vers
    [`helpers.ts`](../../packages/api/src/test/helpers.ts) pour
    réutilisation cross-test.
  - **`wipeMainKeyMaterial` audit** : déjà couvert dans le
    sweep crypto du Tier 8 (cf.
    [`security-audit.md`](../security-audit.md) §1) — la
    fonction `wipeRawBytes` est appelée à tous les sites de
    dérivation de KEK, et le doc-bloc explique que les
    CryptoKey opaques sont laissées au garbage collector.

- [x] Couverture crypto mesurée (93.54 % vs target 90 %).
- [x] Seuil bloquant CI configuré dans `vitest.config.ts`.
- [x] Test bout-en-bout register → login → change-password →
       logout → stale-cookie écrit.
- [x] Test concurrent invite atomicity (livré au Tier 8).
- [x] Audit `wipeMainKeyMaterial` (livré au Tier 8).

---

## Tier D — performance

À traiter en dernier. Sans mesure, on optimise à l'aveugle.

### 10. Bundle + load profiling

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

### 11. Doc-code reconciliation

**Pain** :
- CLAUDE.md référence à la fois `docs/` et `documentation/`
  comme s'il s'agissait d'un même dossier — alors qu'**un
  seul existe** (à confirmer).
- [`Modules.md`](../Modules.md) liste Habits + Library +
  Review comme « non implémentés », mais Library est
  largement développé maintenant.
- [`security-audit.md`](../security-audit.md) et
  [`global-audit.md`](../global-audit.md) référencés mais
  absents (cf. Tier 8).
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
3. **Tier C.8 (security-audit)** ensuite — l'app est e2e
   encrypted, on ne devrait pas pousser de Phase 5+ sans
   baseline figé.
4. **Tier A.2 (legacy JSX)** + **Tier B.4 (errors unifiés)**
   en cycle court — les deux se feront naturellement avec
   un linter qui hurle.
5. **Tier C.9 (crypto + auth integration tests)** — c'est le
   moment de rattraper la dette de tests une fois la carte
   de couverture lue.
6. **Tier B.5 (shared keystone)** + **Tier E.11 (docs)** —
   chantiers continus à tisser dans toutes les autres PRs.
7. **Tier B.6 (factory contextes)** — extraction faite (4
   modules migrés), Habits + Review hériteront du même
   contrat sans effort.
8. **Tier D.10 (perf)** — en dernier. Mesurer avant
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
