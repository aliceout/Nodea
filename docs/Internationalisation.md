# Internationalisation

Le client utilise un provider React maison
([`packages/web/src/i18n/I18nProvider.jsx`](../packages/web/src/i18n/I18nProvider.jsx))
qui charge toutes les ressources de traduction depuis des fichiers
JSON statiques. La langue active est persistée dans `localStorage`
(`nodea:language`) **et** dans le blob chiffré
`user_preferences` (sync cross-device une fois loggué·e). Elle
peut être changée depuis la page **Paramètres → Langue de
l'application**.

Langues actuellement supportées : **français** (`fr`, défaut),
**anglais** (`en`).

## Structure des ressources

```
packages/web/src/i18n/
├── I18nProvider.jsx        ← provider React + helpers t / tn
├── translate.ts            ← logique pure (resolution, plurals)
├── translate.test.ts
├── parity.ts               ← compareNamespaces (factorisé)
├── parity.test.ts          ← test CI : FR ↔ EN keys match
└── locales/
    ├── fr/
    │   ├── account.json
    │   ├── admin.json
    │   ├── auth.json
    │   ├── common.json
    │   ├── errors.json
    │   ├── goals.json
    │   ├── home.json
    │   ├── layout.json
    │   ├── modals.json
    │   ├── modules.json
    │   ├── mood.json
    │   ├── passage.json
    │   ├── review.json
    │   └── settings.json
    └── en/
        └── ... (mêmes fichiers, mêmes clés — vérifié en CI)
```

Chaque fichier JSON est un namespace. Les clés sont stables ; ce
sont les valeurs qui changent par langue.

## API du provider

```ts
const { t, tn, language, setLanguage, availableLanguages } = useI18n();

t('account.tabs.identity');                        // → 'Identité'
t('errors.api.invalid_credentials');               // → 'E-mail ou mot de passe incorrect.'
t('goals.carryOver.summary.one', { values: { count: 1, fromYear: 2025, toYear: 2026 } });

// Plural-aware — picks .one / .other / .few / .many / .other via
// Intl.PluralRules(language). `count` is auto-injected into values.
tn('mood.topbar.label', total);                    // « Mood · 3 entrées »
tn('account.security.passkey.count', passkeysCount); // FR/EN one/other
```

### Conventions de clés

- **Pluriels** : sous-clés `<key>.{one,other}` (et `few/many/zero`
  si la 3ᵉ langue le demande). Toujours via `tn(...)`, pas un
  ternaire `count === 1 ? t('xxxOne') : t('xxxOther')`.
- **Interpolation** : `{token}` dans la valeur, `values: { token: ... }`
  côté call-site. Token absent → remplacé par chaîne vide (uniquement
  quand `values` est passé).
- **Codes erreur API** : un seul namespace `errors.api.<code>` ; le
  helper `apiErrorMessage(err, t)` (depuis `@/core/api/client`)
  fait le routage avec fallback `errors.api.unknown` /
  `errors.api.network`. Les pages auth ne switchent plus sur
  `err.error` localement.

## Helpers locale-aware

### Dates

[`packages/web/src/core/i18n/date-format.ts`](../packages/web/src/core/i18n/date-format.ts)
expose les formatters partagés. Toutes les fonctions prennent la
langue active :

```ts
formatEntryLabel(iso, today, { language, todayLabel, yesterdayLabel });
formatMonthLabel('2026-03', language);    // FR : « Mars 2026 », EN : « March 2026 »
formatLongDate(iso, language);            // FR : « 8 janvier 2025 », EN : « January 8, 2025 »
formatNumber(12345, language);            // FR : « 12 345 », EN : « 12,345 »
intlLocale('fr');                         // → 'fr-FR' (BCP-47 mapping)
getMonthNames('fr', 'short');             // → ['janv.', 'févr.', ...]
getDayNames('fr', 'long');                // → ['lundi', 'mardi', ...] (Mon → Sun)
```

Les labels « Aujourd'hui » / « Hier » viennent de
`common.time.{today,yesterday}` ; les call-sites les passent à
`formatEntryLabel`.

### Contenu éditorial hors namespace

Deux tableaux de prompts (~100 entrées par langue chacun) ne
vivent pas dans le `t()` mais sous `data/` à côté du module qui
les consomme :

- [`packages/web/src/app/flow/Mood/data/questions-{fr,en}.json`](../packages/web/src/app/flow/Mood/data/) +
  `questions.ts` (`pickQuestion(language)`).
- [`packages/web/src/app/flow/Journal/data/prompts-{fr,en}.json`](../packages/web/src/app/flow/Journal/data/) +
  `prompts.ts` (`pickJournalPrompt(language)`).

**Raison** : `t()` retourne un `string`, pas un array ; les
helpers `pickXxx(language)` font le tirage et le fallback FR
quand une langue n'a pas sa propre liste. Adopter la même règle
pour tout dataset éditorial > ~50 entrées.

### Sous-arbre FR-only (par décision)

Les diagrammes pédagogiques sous
[`packages/web/src/app/pages/docs/`](../packages/web/src/app/pages/docs/)
restent **FR-only** tant qu'aucune audience EN réelle ne le
justifie. Idem pour le contenu YearCompass de Review
(`config/steps.ts` + `config/step-fields.ts`) — ~174 lignes
éditoriales inventées à partir d'un livret FR pédagogique. Les
boutons / nav / erreurs du module Review sont, eux, dans
`review.json` et passent par `t()`.

## CI : parité FR ↔ EN

Deux outils gardent les locales alignés :

1. **Test Vitest** (`parity.test.ts`) — itère les 14 namespaces
   et `expect(... onlyFr / onlyEn)` à `[]`. Passe automatiquement
   en CI dans `pnpm test`.
2. **Script CLI** : `pnpm --filter @nodea/web i18n:diff` imprime
   un récap namespace par namespace (`✓` / `✗ FR-only : ... / EN-only : ...`).
   Utile en review locale ou avant de pousser. Exit code 1 quand
   un drift est détecté.

Les deux comparent les **clés feuilles** (paths dotés à la
résolution finale, pas juste les top-level) : un côté qui aurait
`x.count.one / .other` et l'autre seulement `x.count` est attrapé.

## Ajouter une nouvelle langue

1. **Créer les fichiers de ressources**
   - Dupliquer `packages/web/src/i18n/locales/fr/` vers
     `packages/web/src/i18n/locales/<code ISO>/`.
   - Remplir chaque fichier JSON avec les traductions ; conserver
     les mêmes clés. Lancer `pnpm i18n:diff` pour vérifier la
     parité au fur et à mesure.

2. **Enregistrer la langue dans le provider**
   - Dans [`I18nProvider.jsx`](../packages/web/src/i18n/I18nProvider.jsx),
     importer chaque JSON de la nouvelle langue et l'ajouter aux
     constantes `RESOURCES` et `SUPPORTED_LANGUAGES` (code ISO +
     label humain).

3. **Étendre le BCP-47 mapping**
   - Si le code ISO ne mappe pas trivialement vers une locale
     Intl (ex. `pt` → `pt-PT` ou `pt-BR` ?), enrichir
     `intlLocale(language)` dans `core/i18n/date-format.ts`.

4. **Vérifier les pluriels**
   - Pour les langues à formes riches (russe, polonais, arabe…),
     vérifier que les sous-clés `zero / one / two / few / many /
     other` sont toutes renseignées sur les `tn(...)` qui en ont
     besoin (test de parité ne flague pas une absence de `.few`
     en RU si le FR n'en a pas — c'est un trou résiduel).

5. **Datasets éditoriaux**
   - Ajouter `questions-<lang>.json` à `flow/Mood/data/` et
     `prompts-<lang>.json` à `flow/Journal/data/`. Les sélecteurs
     fallback sur FR si la langue n'a pas sa liste, donc une
     nouvelle langue marche dès le jour 1 sans retraduire les
     prompts.

6. **Tester la bascule**
   - `pnpm dev`, **Paramètres → Langue**, sélectionner la
     nouvelle langue. Vérifier qu'aucun fallback `defaultValue`
     n'apparaît, et que `pnpm test` reste vert.

## Emails (côté API)

Les 7 templates d'emails transactionnels (`invite`,
`password-reset`, `register-activate`, `mfa-bypass` request +
applied, `recovery-applied`, `security-mode-downgraded`) sont
bilingues via un mécanisme distinct du provider web — pas de
React côté Node, juste une fonction pure.

```ts
import { emailT, extractEmailLanguage } from '@/services/email/i18n';

emailT('fr', 'invite.subject');                          // → 'Tu es invité·e à créer ton espace Nodea'
emailT('en', 'invite.validity', { values: { ttl: 7 } }); // → 'The link is valid for 7 days.'

extractEmailLanguage(c);                                 // 'fr' | 'en' (parse `Accept-Language`)
```

- **Sources** :
  [`packages/api/src/services/email/locales/{fr,en}.ts`](../packages/api/src/services/email/locales/) —
  arbres profonds (subject / preheader / heading / texte / HTML
  par template). Le shape `EmailLocaleShape` est exporté depuis
  `fr.ts` ; une clé manquante côté EN est une erreur TS au build.
- **Détection de langue** : pas de colonne `users.email_language`
  en clair (déclassée pour garder la frontière de chiffrement
  propre). On lit `Accept-Language` de la requête qui déclenche
  l'email — ça matche le browser du user pour les flux
  self-service (register, reset, MFA bypass) et l'admin pour les
  invites. Les emails sans contexte (futurs cron) tombent sur
  `DEFAULT_LANGUAGE` (FR).
- **Parité FR ↔ EN** :
  [`packages/api/src/services/email/parity.test.ts`](../packages/api/src/services/email/parity.test.ts) —
  même invariant que côté web, leaf-paths comparés.
- **Layout partagé** : le footer (« — L'équipe Nodea » /
  « — The Nodea team » + ligne « envoyé automatiquement ») et
  l'attribut `<html lang>` viennent de `emailT('layout.*')`.
  Aucun template n'a besoin de re-traduire ces blocs.

Pour ajouter une 3ᵉ langue côté emails : créer
`locales/<code>.ts` mirroir de `fr.ts`, étendre
`SupportedEmailLanguage` dans
[`packages/api/src/services/email/i18n.ts`](../packages/api/src/services/email/i18n.ts),
ajouter le bag dans `RESOURCES`, et ajuster
`parseAcceptLanguage` pour reconnaître le tag primaire.

## Notes

- Les locales sont chargées **statiquement** : toute nouvelle
  ressource doit être importée à la main dans `I18nProvider`.
  C'est volontaire — le bundle reste prédictible et `tsc` valide
  les imports manquants au build.
- La langue est persistée dans **deux** stores : `localStorage`
  (avant login) et `user_preferences` chiffré (après login). Le
  serveur ne lit jamais le blob ; la sync cross-device passe par
  un re-login.
- Conserver les fichiers JSON en **UTF-8 sans BOM**, accents
  préservés (les fichiers FR contiennent `é`, `à`, `ç`, etc.
  directement, pas d'échappement Unicode).
- **Inclusivité française** : `utilisateur·ice·s` pour les
  humain·e·s, jamais pour les objets (« un critère actif », pas
  « actif·ve »).
