# Audit Global — Nodea

**Date :** 2026-03-04
**Périmètre :** Architecture, qualité de code, DX, performance, documentation, état du projet

---

## Note préliminaire

Il est important de contextualiser : Nodea est un projet open source personnel, auto-hébergeable, avec une ambition de confidentialité réelle (E2EE). Pour ce type de projet, l'état du code est **globalement bon** — la documentation est sérieuse, l'architecture crypto est rigoureuse, et le code est cohérent. Ce rapport liste des irritants, des dettes techniques, et des améliorations potentielles, pas un projet bancal.

---

## Ce qui fonctionne bien

### Architecture globale
La séparation en trois couches (`core/`, `ui/`, `app/`) est claire et respectée dans l'ensemble. Le principe de centralisation de la crypto dans `core/crypto/` est un bon choix : toutes les primitives sensibles sont au même endroit, avec des interfaces stables.

### Cryptographie
Le choix des primitives est solide : Argon2id pour la dérivation, AES-256-GCM pour le chiffrement symétrique, HMAC-SHA256 pour l'intégrité. Les CryptoKey sont non-extractibles. Les IV sont aléatoires par enregistrement. Le flux de création en deux temps (POST init → PATCH guard) est bien pensé.

### Documentation
C'est le point le plus remarquable du projet. `Security.md`, `Architecture.md`, `Database.md`, `Modules.md` et les fiches modules sont précis, honnêtes, et à jour. Le fait que `Architecture.md` documente explicitement la « transition incomplète » est une marque de maturité rare. Pour un projet solo, c'est excellent.

### Cohérence des services modules
`Goals.js`, `Mood.js`, `Passage.js` suivent le même schéma (assertSid, assertMainKey, encryptPayload, decryptRecord, pbError) — la lecture du premier suffit à comprendre les autres.

### Gestion des erreurs de clé
Le flux `markMissing()` → logout immédiat est implémenté de façon systématique. Le hook de vérification de présence de clé sur `visibilitychange`, `focus`, `pageshow`, `online` est une bonne précaution.

---

## Ce qui ne va pas (ou moins bien)

### 1. Violation DRY sévère sur les utilitaires base64

Il existe **4 implémentations distinctes** de la conversion base64 dans le projet :

| Lieu | Fonctions |
|------|-----------|
| `webcrypto.js` | `arrayBufferToBase64`, `base64ToArrayBuffer`, `bytesToBase64`, `base64ToBytes` |
| `crypto-utils.js` | `toBase64url`, `fromBase64url` |
| `Register.jsx` | `toB64` (locale, lignes 9-11) |
| `modules-config.js` | `toStdB64` (locale, ligne 40-45) |

`randomBytes` est également **défini deux fois** : dans `crypto-utils.js` (ligne 46) et dans `webcrypto.js` (ligne 106). Ces deux implémentations font exactement la même chose.

Ce n'est pas grave individuellement, mais accumulé, cela signifie que si une correction est nécessaire (ex. compatibilité navigateur, encodage spécial), elle doit être appliquée partout manuellement.

**Piste :** Unifier dans `crypto-utils.js` et importer de là dans `webcrypto.js` et les pages.

---

### 2. Deux systèmes d'état parallèles

Le projet gère l'état avec deux mécanismes distincts :
- **React Context** (`StoreProvider.jsx`) pour `mainKey`, `keyStatus`, le thème, la nav, etc.
- **Singleton module-level** (`modulesRuntime.js`) pour l'état runtime des modules.

Le singleton utilise `useSyncExternalStore`, ce qui fonctionne, mais crée une dualité : une partie de l'état est dans React, l'autre est en dehors. Cela complique le debug et le reset complet de l'état (ex. lors d'un bug de session).

**Impact concret :** `setModulesState({})` au logout remet le singleton à zéro, mais si le composant qui consomme `useModulesRuntime` est remonté après, l'état vide n'est peut-être pas rechargé correctement sans `mainKey`.

---

### 3. `modules_list.jsx` instancie les composants à l'import

```jsx
export const MODULES = [
  { id: "mood", element: <Mood />, ... },  // ← instancié ici
  { id: "goals", element: <Goals />, ... },
  // ...
];
```

Les JSX éléments sont créés **au moment de l'import du module**, pas au moment du rendu. Cela signifie que tous les composants de module sont importés et instantiés dès le démarrage de l'app, sans lazy loading.

**Conséquence :** pas de code splitting possible en l'état. Si les modules deviennent lourds, le bundle initial grossit inutilement.

**Piste :** Stocker des références de composants (`component: Mood`) et créer l'élément à la demande (`<module.component />`), puis utiliser `React.lazy`.

---

### 4. Pas de tests

Il n'existe aucun fichier de test dans le projet. Pour une application dont le cœur est une architecture crypto complexe, c'est un risque réel. Un bug de régression sur la dérivation de guard, la rotation de clé ou l'import/export pourrait être invisible jusqu'en production.

**Priorités de test suggérées :**
1. `deriveGuard` (déterministe, facile à tester)
2. Cycle encrypt/decrypt (`encryptAESGCM` + `decryptAESGCM`)
3. Flux import/export pour chaque module
4. `createMainKeyMaterialFromBase64` → `wipeMainKeyMaterial`

---

### 5. Pas de TypeScript

Le projet est entièrement en JavaScript. Avec une architecture aussi complexe (plusieurs formats de clé possibles dans `hasMainKeyMaterial`, des `sealed` objects `{ iv, data }` ou `{ iv, cipher }`, des configs modules dynamiques), l'absence de types entraîne des coûts cognitifs élevés lors de chaque modification.

`main-key.js` illustre le problème : `hasMainKeyMaterial` accepte une `string | Uint8Array | CryptoKey | { base64, aesKey, hmacKey }`. Sans types, il faut lire toute la fonction pour comprendre ce qu'on lui passe.

---

### 6. Modules documentés mais non implémentés

`documentation/Modules/` contient des fiches pour **Habits**, **Library**, **Review**, mais il n'existe pas de `app/flow/Habits/`, `app/flow/Library/`, ni `app/flow/Review/` dans le frontend.

Le schéma DB (`Database.md`) les référence également. Ces modules sont dans un état « documentés, schématisés, mais non UI ». Ce n'est pas un problème en soi, mais :
- La collection `habits_items_entries` et `habits_logs_entries` semblent exister côté DB → risque d'entrées orphelines.
- Les utilisateurs ne savent pas que ces modules sont en cours de développement.

---

### 7. Chaîne d'installation non cohérente avec le README

Le README décrit une installation en 5 étapes simples, mais le projet possède également :
- `install.sh` (script d'orchestration complet)
- `config/script/apply_schema.mjs` (applique le schéma PocketBase)
- `config/script/repair_user_modules.mjs`

Le README ne mentionne pas `install.sh` ni l'étape d'application du schéma. Un nouvel utilisateur qui suit le README aura une instance PocketBase sans schéma.

---

### 8. `listDistinctThreads` charge tous les objectifs en mémoire

```js
// Goals.js:262
const entries = await listGoals(moduleUserId, mainKey, { page: 1, perPage: 200 });
const set = new Set(entries.map((entry) => (entry.thread || "").trim()).filter(Boolean));
```

Pour extraire les valeurs uniques du champ `thread`, la fonction charge les 200 premiers enregistrements, les déchiffre tous, puis fait un `Set` côté client. À 200 entrées c'est acceptable, mais si les goals deviennent nombreux, ce n'est pas scalable.

---

### 9. `getPreferredName` référence des champs inexistants dans le schéma

```js
// Homepage/index.jsx:22
if (user.firstname && user.lastname) {
  return `${user.firstname} ${user.lastname}`.trim();
}
if (user.firstname) return user.firstname;
```

`Database.md` ne mentionne pas de champs `firstname` ou `lastname` dans la collection `users`. Ces branches de code ne s'exécuteront jamais — elles sont du code mort.

---

### 10. `guard.pb.js` ne couvre que 3 collections sur les modules documentés

```js
const targets = ["mood_entries", "passage_entries", "goals_entries"];
```

Les collections `habits_items_entries`, `habits_logs_entries`, `library_items_entries`, `library_reviews_entries`, `review_entries` ne sont pas couvertes par le hook guard. Si ces modules sont activés, les guards ne seront pas validés côté serveur.

---

### 11. Deux bibliothèques de dates, deux bibliothèques de charts

**Dates :** `date-fns` (v4) et `dayjs` (v1.11) — les deux sont dans les dépendances. Il faudrait choisir l'une ou l'autre et supprimer l'autre pour réduire le bundle.

**Charts :** `chart.js + react-chartjs-2` et `recharts` — même situation. Ces deux bibliothèques ne sont pas légères. Si les deux sont utilisées en pratique, c'est acceptable, mais si une seule l'est réellement, c'est du poids inutile.

---

### 12. `param _prevEntry` inutilisé systématiquement

```js
export async function updateGoal(moduleUserId, mainKey, id, _prevEntry, payload) {
```

Le paramètre `_prevEntry` (préfixé `_` pour signaler qu'il n'est pas utilisé) apparaît dans `updateGoal` et `deleteGoal`. Il est passé depuis les composants qui ont l'ancienne valeur en mémoire. S'il n'est jamais utilisé, supprimer ce paramètre clarifie l'API.

---

### 13. `modules-config.js` gère trop de responsabilités

`loadModulesConfig` gère en un seul endroit :
- la lecture PocketBase
- la détection du format (clair vs chiffré)
- la normalisation base64url → base64 standard
- le déchiffrement
- la gestion des erreurs crypto

Ces responsabilités multiples rendent la fonction difficile à tester et à lire (113 lignes). Idéalement, la normalisation de format et la détection de format seraient des fonctions séparées.

---

### 14. Pas d'Error Boundary React

Si une erreur JavaScript non catchée se produit dans un composant (ex. tentative de rendu avec des données corrompues), l'app entière plante avec un écran blanc. Il n'existe pas d'`ErrorBoundary` React pour intercepter ces erreurs et afficher un message de récupération.

---

### 15. Pas de pagination UI

Les services paginent côté serveur (`page`, `perPage`), mais il n'existe pas de composant de pagination dans l'UI. La plupart des `listGoals`, `listRecords` utilisent `perPage: 50` ou `200`. Si un utilisateur a plus de 50 objectifs, les suivants sont invisibles sans pagination.

---

## Propositions d'amélioration par priorité

### Priorité haute (impact direct sur la stabilité)

1. **Écrire des tests** pour le noyau crypto (`deriveGuard`, encrypt/decrypt, import/export)
2. **Corriger le hook guard** pour couvrir toutes les collections actives
3. **Supprimer `window.mainKey`** (voir audit sécu)
4. **Fixer la chaîne d'installation** — aligner le README avec `install.sh`

### Priorité moyenne (qualité / maintenabilité)

5. **Unifier les utilitaires base64** — un seul fichier source de vérité
6. **Supprimer `randomBytes` en doublon** dans `webcrypto.js`
7. **Choisir une bibliothèque de dates** (`date-fns` ou `dayjs`) et une de charts
8. **Supprimer `_prevEntry`** des signatures si inutilisé
9. **Supprimer les branches mortes** dans `getPreferredName`
10. **Lazy loading des routes** (`React.lazy` + `Suspense` dans `App.jsx`)

### Priorité basse (confort DX, moyen terme)

11. **Migrer vers TypeScript** progressivement — commencer par `core/crypto/*`
12. **Unifier la gestion d'état** — intégrer `modulesRuntime` dans le store React
13. **Découper `loadModulesConfig`** en fonctions plus petites
14. **Error Boundary** React globale
15. **Composant de pagination** réutilisable

---

## Évaluation globale

| Axe | Note | Commentaire |
|-----|------|-------------|
| Architecture | 7/10 | Couches bien définies, transition incomplète assumée |
| Qualité du code | 6/10 | Cohérent, mais DRY violations et code mort |
| Crypto / Sécurité | 7/10 | Architecture solide, quelques failles (voir audit sécu) |
| Documentation | 9/10 | Exceptionnellement bonne pour un projet solo |
| Tests | 1/10 | Absents |
| DX & outillage | 5/10 | Pas de TS, pas de tests, deux libs redondantes |
| Performance | 6/10 | Pas de lazy loading, quelques requêtes non optimales |
| Complétude | 5/10 | 3 modules documentés mais non implémentés |

**Score global estimé : 6/10** pour un projet en développement actif, avec un potentiel réel si la dette technique est adressée.

---

## Avis général

Nodea est un projet cohérent, avec une vision claire et une exécution sérieuse pour ce qui est de la cryptographie et de la documentation. Les choix techniques fondamentaux sont bons. La dette principale est concentrée autour de l'absence de tests, de l'absence de TypeScript, et de quelques violations DRY sur les utilitaires crypto.

La direction la plus rentable pour améliorer le projet est : **tests d'abord, TypeScript ensuite**. Ces deux investissements permettraient de refactorer la crypto et l'architecture en toute confiance, et de terminer les modules manquants (Habits, Library, Review) sans risque de régression.
