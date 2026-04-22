# Audit Global — Nodea

**Date :** 2026-03-04
**Branche analysée :** `main`
**Périmètre :** Architecture, qualité de code, DX, performance, documentation

---

## Résumé exécutif

Nodea est un projet cohérent, avec une vision claire et une documentation remarquable pour un projet solo. L'architecture en couches (`core/`, `ui/`, `app/`) est bien définie, les conventions entre modules sont homogènes, et la cryptographie est sérieusement documentée. Les faiblesses principales se concentrent sur l'absence totale de tests, plusieurs violations DRY dans les utilitaires bas niveau, deux systèmes d'état parallèles qui coexistent, et des modules documentés mais non implémentés.

---

## Problèmes identifiés

### HAUTE — Aucun test dans le projet

Le projet ne contient aucun fichier de test. Pour une application dont le cœur est une architecture cryptographique complexe (dérivation de guards, rotation de clé, import/export chiffré), l'absence de tests automatisés est le risque de régression le plus élevé du projet.

**Impact :** Tout refactoring de `core/crypto/` ou des services modules est un saut dans le vide. Un bug sur `deriveGuard` ou le flux de changement de mot de passe serait invisible jusqu'en production, où il entraînerait une perte permanente d'accès aux données.

**Correction :** Mettre en place les tests par ordre de priorité :
1. `deriveGuard` (fonction déterministe, triviale à tester)
2. `encryptAESGCM` → `decryptAESGCM` (round-trip)
3. `createMainKeyMaterialFromBase64`
4. Flux import/export pour au moins un module (Mood)

---

### HAUTE — Quatre implémentations distinctes de base64

Les conversions base64 sont réimplémentées à quatre endroits différents dans le projet :

**`webcrypto.js:54-78`**
```js
function arrayBufferToBase64(buffer) { ... }
function base64ToArrayBuffer(base64) { ... }
export function bytesToBase64(u8) { ... }
export function base64ToBytes(b64) { ... }
```

**`crypto-utils.js:24-38`**
```js
export function toBase64url(bytes) { ... }
export function fromBase64url(s) { ... }
```

**`Register.jsx:9-11`** (locale, non exportée)
```js
function toB64(u8) {
  return btoa(String.fromCharCode(...u8));
}
```

**`modules-config.js:40-45`** (locale, non exportée)
```js
const toStdB64 = (s) => {
  let t = s.replaceAll("-", "+").replaceAll("_", "/");
  while (t.length % 4) t += "=";
  return t;
};
```

`randomBytes` est également défini deux fois : dans `crypto-utils.js:46` et dans `webcrypto.js:106`, avec des implémentations strictement identiques.

**Impact :** Si une correction est nécessaire (bug d'encodage, compatibilité navigateur), elle doit être appliquée manuellement dans plusieurs fichiers. Le risque d'oubli est réel.

**Correction :** Centraliser toutes les conversions dans `crypto-utils.js`, qui est déjà le fichier destiné aux utilitaires crypto. `webcrypto.js` importe depuis `crypto-utils.js`. Les fonctions locales de `Register.jsx` et `modules-config.js` sont remplacées par les imports appropriés.

---

### HAUTE — Deux systèmes d'état parallèles

L'état de l'application est géré par deux mécanismes distincts et non coordonnés :

**Système 1 — React Context** (`StoreProvider.jsx`)
```js
const [state, dispatch] = useReducer(reducer, initialState);
// contient: mainKey, keyStatus, nav, ui, journal, notifications
```

**Système 2 — Singleton module-level** (`modulesRuntime.js:10-11`)
```js
let _state = {};
const _listeners = new Set();
```

Le singleton est synchronisé avec React via `useSyncExternalStore`, mais il vit en dehors du store React. Il est réinitialisé au logout via `setModulesState({})` directement, sans passer par un action/dispatch.

**Impact :** Le debug est difficile — les outils React DevTools ne voient pas le contenu de `_state`. Si le singleton se désynchronise (bug réseau, rechargement partiel), il n'y a pas de mécanisme de réconciliation. Le code de logout doit appeler deux systèmes séparément.

**Correction :** Intégrer `modulesRuntime` dans le store React (`initialState.modulesRuntime = {}`), avec une action dédiée (`KEY_MODULES_SET`). `setModulesState` devient un dispatch.

---

### HAUTE — Modules documentés et schématisés, mais absents du frontend

Trois modules ont une fiche détaillée dans `documentation/Modules/`, un schéma DB dans `documentation/DB/pb_schema.json`, et une entrée dans `Database.md` — mais n'ont aucune implémentation frontend :

| Module | Documentation | Schéma DB | Frontend |
|--------|--------------|-----------|---------|
| Habits | `Modules/Habits.md` | `habits_items_entries`, `habits_logs_entries` | Absent |
| Library | `Modules/Library.md` | `library_items_entries`, `library_reviews_entries` | Absent |
| Review | `Modules/Review.md` | `review_entries` | Absent |

**Impact :** Les collections DB semblent exister côté PocketBase. Si elles sont accessibles, des enregistrements peuvent y être créés sans guard côté serveur (voir finding suivant). Un utilisateur lisant la documentation s'attend à trouver ces fonctionnalités.

**Correction :** Soit implémenter les modules, soit les marquer explicitement comme "en développement" dans le README et retirer leurs collections DB tant qu'elles ne sont pas couvertes.

---

### HAUTE — `guard.pb.js` ne couvre pas toutes les collections

**Fichier :** `config/pocketbase/pb_hooks/guard.pb.js:6`

```js
const targets = ["mood_entries", "passage_entries", "goals_entries"];
```

Le hook de validation des guards côté serveur ne couvre que trois collections. Les collections `habits_items_entries`, `habits_logs_entries`, `library_items_entries`, `library_reviews_entries`, et `review_entries` ne sont pas dans `targets`.

**Impact :** Si ces collections existent sur l'instance PocketBase, des enregistrements peuvent y être créés ou modifiés sans validation du guard. L'invariant d'intégrité documenté dans `Security.md` n'est pas respecté pour ces collections.

**Correction :** Ajouter toutes les collections actives dans le tableau `targets`. Automatiser cette liste depuis le schéma DB pour éviter les oublis futurs.

---

### MOYENNE — `modules_list.jsx` instancie les composants à l'import

**Fichier :** `frontend/src/app/config/modules_list.jsx:16-87`

```jsx
export const MODULES = [
  { id: "mood",    element: <Mood />,    ... },
  { id: "passage", element: <Passage />, ... },
  { id: "goals",   element: <Goals />,   ... },
  // ...
];
```

Les éléments React sont instanciés **au moment de l'import du fichier**, pas au moment du rendu. Cela force l'import statique de tous les composants de module dès le démarrage de l'application.

**Impact :** Impossible de mettre en place du code splitting ou du lazy loading par module. Si les modules deviennent lourds, le bundle initial croît sans limite. Un module désactivé est quand même chargé en mémoire.

**Correction :** Stocker des références de composants (`component: Mood`) et créer l'élément au moment du rendu (`<module.component />`), puis utiliser `React.lazy` pour les imports :
```js
const Mood = React.lazy(() => import("../flow/Mood"));
{ id: "mood", component: Mood, ... }
```

---

### MOYENNE — Pas de routing URL pour les modules

**Fichier :** `frontend/src/app/App.jsx:18-26`

```jsx
<Route path="/flow" element={<ProtectedRoute><Layout /></ProtectedRoute>} />
<Route path="/flow/*" element={<Navigate to="/flow" replace />} />
```

Toute la navigation interne est gérée par le state (`currentTab` dans le store), pas par l'URL. Un module actif n'a pas de chemin dédié (`/flow/mood`, `/flow/goals`, etc.).

**Impact :** Il est impossible de partager un lien vers un module spécifique. Le bouton "retour" du navigateur ne fonctionne pas pour naviguer entre modules. Les marque-pages ne fonctionnent pas. L'URL reste `/flow` quelle que soit la page affichée.

**Correction :** Remplacer le state `currentTab` par des routes dédiées (`/flow/mood`, `/flow/goals`, etc.) avec `<Route path="/flow/:module">`. Cela s'intégrerait naturellement avec le lazy loading des composants.

---

### MOYENNE — Pas de React Error Boundary

Aucun composant `ErrorBoundary` n'est utilisé dans l'application. React ne propose pas de mécanisme automatique de récupération sur les erreurs de rendu.

**Impact :** Une erreur JavaScript non catchée dans un composant (ex. tentative de rendu d'un enregistrement chiffré corrompu, `JSON.parse` d'un payload invalide) fait crasher toute l'application avec un écran blanc. L'utilisateur ne voit pas de message d'erreur et doit recharger manuellement.

**Correction :** Envelopper au minimum le contenu de chaque module dans un `ErrorBoundary` qui affiche un message de récupération et propose de recharger.

---

### MOYENNE — Chaîne d'installation incohérente avec le README

Le README (`README.md:58-90`) décrit 5 étapes d'installation (clone, `npm install`, lancer PocketBase, `.env`, `npm run dev`). Le projet dispose pourtant de :

- `install.sh` — script d'orchestration complet avec health checks et prompts interactifs
- `config/script/apply_schema.mjs` — applique le schéma PocketBase (étape indispensable)
- `config/script/create_admin.sh` — création de l'admin

Un nouvel utilisateur qui suit le README obtient une instance PocketBase sans schéma. L'application ne fonctionnera pas.

**Correction :** Soit le README pointe vers `install.sh` comme méthode principale, soit il ajoute explicitement l'étape `node config/script/apply_schema.mjs` dans les instructions.

---

### MOYENNE — Imports morts dans `modules-config.js`

**Fichier :** `frontend/src/core/api/modules-config.js:14-24`

```js
import {
  encryptAESGCM,
  decryptAESGCM,
  bytesToBase64,   // ← importé
  base64ToBytes,   // ← importé
  KeyMissingError,
} from "@/core/crypto/webcrypto";

// Note: ici on ne les utilise pas directement car encrypt/decrypt retournent
// et consomment déjà des strings base64 prêtes pour un JSON.
```

`bytesToBase64` et `base64ToBytes` sont importés mais jamais utilisés dans le fichier — et le commentaire le dit explicitement. Ces imports sont du code mort.

**Impact :** Faible — mais le commentaire crée de la confusion sur l'intention du code. Un lecteur cherche pourquoi ces fonctions sont importées.

**Correction :** Supprimer les deux imports et le commentaire associé.

---

### FAIBLE — `_prevEntry` : paramètre inutilisé systématiquement

**Fichier :** `frontend/src/core/api/modules/Goals.js:181, 215`

```js
export async function updateGoal(moduleUserId, mainKey, id, _prevEntry, payload) {
  // _prevEntry n'est jamais utilisé dans le corps de la fonction
}

export async function deleteGoal(moduleUserId, mainKey, id, _prevEntry) {
  // _prevEntry n'est jamais utilisé dans le corps de la fonction
}
```

Le paramètre `_prevEntry` (préfixé `_` pour signaler qu'il est intentionnellement ignoré) est présent dans les signatures de `updateGoal` et `deleteGoal`, et passé par tous les appelants. Il n'est utilisé nulle part.

**Impact :** Chaque appelant doit conserver l'entrée précédente en mémoire et la passer inutilement. L'API est trompeuse — elle laisse croire que la valeur précédente est utilisée (ex. pour un diff ou un optimistic update).

**Correction :** Supprimer le paramètre des signatures et de tous les appels.

---

### FAIBLE — Deux bibliothèques de dates, deux bibliothèques de charts

**`frontend/package.json` (dépendances)**

| Catégorie | Bibliothèques | Taille estimée |
|-----------|--------------|----------------|
| Dates | `date-fns` v4 + `dayjs` v1.11 | ~50 KB + ~7 KB |
| Charts | `chart.js` + `react-chartjs-2` + `recharts` | ~200 KB + ~100 KB |

Utiliser deux bibliothèques différentes pour la même fonction augmente le bundle sans bénéfice.

**Impact :** Bundle initial inutilement gonflé. Deux APIs différentes à maintenir, deux syntaxes à apprendre pour les futurs contributeurs.

**Correction :** Choisir `dayjs` (plus léger) ou `date-fns` et supprimer l'autre. Choisir `recharts` (API React native) ou `chart.js` et supprimer l'autre.

---

### FAIBLE — Chaînes françaises en dur dans `Homepage` malgré l'i18n

**Fichier :** `frontend/src/app/flow/Homepage/index.jsx:47-51`

```js
let currentGreeting = "Bonjour";
if (hour >= 18) currentGreeting = "Bonsoir";
else if (hour >= 12) currentGreeting = "Bon après-midi";
// ...
const formatter = new Intl.DateTimeFormat("fr-FR", { ... });
```

Les messages de salutation et le formateur de date sont codés en dur en français, alors que l'application dispose d'un système i18n complet (EN + FR) utilisé partout ailleurs.

**Impact :** Pour les utilisateurs en anglais, la page d'accueil affiche "Bonjour" et une date en format français.

**Correction :** Passer les salutations par `t("home.greeting.morning")` etc., et utiliser la locale active pour `Intl.DateTimeFormat`.

---

### FAIBLE — `getPreferredName` référence des champs absents du schéma

**Fichier :** `frontend/src/app/flow/Homepage/index.jsx:22-33`

```js
function getPreferredName(user) {
  if (user.firstname && user.lastname) {   // ← 'firstname' n'est pas dans le schéma
    return `${user.firstname} ${user.lastname}`.trim();
  }
  if (user.firstname) return user.firstname; // ← idem
  if (user.name) return user.name;           // ← idem
  // ...
}
```

`Database.md` ne référence pas de champs `firstname`, `lastname`, ni `name` dans la collection `users`. Ces branches de code ne s'exécuteront jamais.

**Impact :** Code mort qui induit en erreur sur la structure de l'objet `user`.

**Correction :** Supprimer les branches `firstname`, `lastname`, `name` et ne conserver que `username` et `email` comme fallbacks, conformément au schéma réel.

---

### FAIBLE — `listDistinctThreads` charge tous les enregistrements en mémoire

**Fichier :** `frontend/src/core/api/modules/Goals.js:261-284`

```js
export async function listDistinctThreads(moduleUserId, mainKey, { markMissing } = {}) {
  const entries = await listGoals(moduleUserId, mainKey, {
    page: 1,
    perPage: 200,   // charge les 200 premiers objectifs
    markMissing,
  });
  const set = new Set(
    entries.map((entry) => (entry.thread || "").trim()).filter(Boolean)
  );
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
```

Pour obtenir la liste des valeurs uniques du champ `thread`, la fonction charge, déchiffre et parse les 200 premiers enregistrements côté client.

**Impact :** Pour un utilisateur avec beaucoup d'objectifs, cette opération est lente et consomme de la mémoire. Au-delà de 200 entrées, les threads des entrées suivantes sont invisibles.

**Correction :** Court terme : augmenter `perPage` et boucler. Long terme : si le backend expose un endpoint d'agrégation, l'utiliser. Sinon, mettre en cache les threads connus dans le store.

---

### INFO — `modules-config.js` accepte silencieusement les configs en clair

**Fichier :** `frontend/src/core/api/modules-config.js:54-69`

```js
const looksPlain =
  parsed && typeof parsed === "object" &&
  !("iv" in parsed) && !("data" in parsed) && !("cipher" in parsed) &&
  keys.some((k) => parsed?.[k] && ("enabled" in parsed[k] || "module_user_id" in parsed[k]));
if (looksPlain) return parsed; // retourne la config en clair sans chiffrement
```

Le chargement de la config modules accepte et retourne silencieusement une config en clair (format legacy). Il n'y a pas d'avertissement ni de migration automatique vers le format chiffré.

**Impact :** Des instances en production peuvent avoir une config modules non chiffrée sans que ce soit visible. La prochaine `saveModulesConfig` chiffrera la config, mais tant qu'elle n'est pas appelée, la config reste en clair.

**Correction :** Loguer un avertissement (`console.warn`) quand le format plaintext est détecté. Déclencher une sauvegarde automatique chiffrée après le chargement plaintext pour migrer immédiatement.

---

## Points positifs

- **Documentation exceptionnelle** : `Security.md`, `Architecture.md`, `Modules.md`, `Database.md` — précis, honnêtes sur la dette, à jour
- **Conventions homogènes** entre les services modules (Goals, Mood, Passage) — le premier lu, les autres sont compris
- **Architecture en couches claire** (`core/`, `ui/`, `app/`) respectée dans l'ensemble
- **Gestion d'erreurs de clé systématique** : `markMissing()` → logout immédiat propagé partout
- **Check de présence de clé** sur `visibilitychange`, `focus`, `pageshow`, `online`
- **`StoreProvider`** proprement découplé, avec `useMemo` et `useCallback` bien appliqués
- **`useBootstrapModulesRuntime`** : pattern cancel correctement implémenté avec le flag `cancelled`
- **`assertSid` + `assertMainKey`** en entrée de chaque service : validation cohérente des préconditions

---

## Récapitulatif des priorités

| Sévérité | Problème | Fichier(s) |
|----------|---------|-----------|
| HAUTE | Aucun test dans le projet | — |
| HAUTE | 4 implémentations distinctes de base64 + `randomBytes` en doublon | `webcrypto.js`, `crypto-utils.js`, `Register.jsx`, `modules-config.js` |
| HAUTE | Deux systèmes d'état parallèles | `StoreProvider.jsx`, `modulesRuntime.js` |
| HAUTE | Modules documentés/schématisés mais absents du frontend | `documentation/Modules/`, `flow/` |
| HAUTE | `guard.pb.js` ne couvre pas toutes les collections | `guard.pb.js:6` |
| MOYENNE | JSX instancié à l'import → pas de lazy loading | `modules_list.jsx:16-87` |
| MOYENNE | Pas de routing URL pour les modules | `App.jsx:18-26` |
| MOYENNE | Pas de React Error Boundary | — |
| MOYENNE | README d'installation incomplet | `README.md:58-90` |
| MOYENNE | Imports morts dans `modules-config.js` | `modules-config.js:14-24` |
| FAIBLE | `_prevEntry` inutilisé dans les signatures | `Goals.js:181, 215` |
| FAIBLE | Deux libs de dates + deux libs de charts | `package.json` |
| FAIBLE | Chaînes FR en dur dans la Homepage | `Homepage/index.jsx:47-51` |
| FAIBLE | Code mort dans `getPreferredName` | `Homepage/index.jsx:22-33` |
| FAIBLE | `listDistinctThreads` charge 200 entrées pour un Set | `Goals.js:261-284` |
| INFO | Config modules plaintext acceptée silencieusement | `modules-config.js:54-69` |
