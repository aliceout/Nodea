# Audit de Sécurité — Nodea

**Date :** 2026-03-04
**Branche analysée :** `main`
**Périmètre :** Frontend React + hooks PocketBase + architecture E2E

---

## Résumé exécutif

L'architecture de chiffrement côté client (E2EE) est globalement solide (Argon2id, AES-256-GCM, HMAC-SHA256, WebCrypto). Cependant, plusieurs vulnérabilités significatives ont été identifiées, allant d'une exposition critique de la clé maître en mémoire globale à des failles d'injection de filtre et de réutilisation des codes d'invitation.

---

## Vulnérabilités identifiées

### CRITIQUE — Clé maître exposée dans `window.mainKey`

**Fichier :** `frontend/src/app/flow/Account/components/DeleteAccount.jsx:63`

```js
const effectiveKey = mainKey || window.mainKey || null;
```

Le code fait un fallback sur `window.mainKey`, une variable globale accessible par **tout script** s'exécutant dans la page. Cela annule complètement le modèle de sécurité E2EE : une extension de navigateur malveillante, une dépendance compromise, ou toute injection XSS peut lire la clé maître en clair depuis `window.mainKey`.

**Impact :** Vol complet de la clé de chiffrement → déchiffrement de toutes les données utilisateur.

**Correction :** Supprimer le fallback `window.mainKey`. Si la clé est absente du store, afficher une erreur et demander à l'utilisateur de se reconnecter.

---

### HAUTE — Injection de filtre PocketBase via le code d'invitation

**Fichier :** `frontend/src/app/pages/Register.jsx:33`

```js
filter: `code="${inviteCode}"`,
```

La valeur `inviteCode` est interpolée directement dans le filtre PocketBase sans sanitisation. Un attaquant peut injecter des conditions de filtre arbitraires. Par exemple :

```
" || 1=1 || code="
```

cela pourrait correspondre à n'importe quel code et permettre l'inscription sans code valide.

**Impact :** Contournement du système d'invitation, inscription non autorisée.

**Correction :** Utiliser les paramètres de filtre sécurisés de PocketBase (`filter("code = {:code}", { code: inviteCode })`) ou valider le format du code côté client avant la requête.

---

### HAUTE — Réutilisation possible du code d'invitation

**Fichier :** `frontend/src/app/pages/Register.jsx:61-70`

```js
try {
  // ...
  await pb.collection("invites_codes").delete(codeRecord.id);
} catch (_) {
  console.warn("Erreur suppression code invitation");
}
```

La suppression du code d'invitation est effectuée **après** la création du compte, dans un bloc `try/catch` qui avale silencieusement les erreurs. Si la suppression échoue (erreur réseau, permission refusée, etc.), le code reste valide et peut être utilisé pour créer un second compte.

**Impact :** Un même code d'invitation peut créer plusieurs comptes.

**Correction :** Supprimer le code d'invitation avant (ou atomiquement avec) la création du compte. Si la suppression échoue, annuler et informer l'utilisateur.

---

### HAUTE — `wipeMainKeyMaterial` ne détruit pas les CryptoKeys

**Fichier :** `frontend/src/core/crypto/main-key.js:136-160`

```js
if (material.aesKey?.usages?.length) {
  try {
    window.crypto.subtle.digest("SHA-256", textEncoder.encode(""));
  } catch {
    // ignore
  }
}
```

Cette fonction tente de "wiper" les `CryptoKey` en appelant `crypto.subtle.digest()`, ce qui n'a **aucun effet** sur les objets `CryptoKey` en mémoire. Les clés AES et HMAC importées via WebCrypto restent intactes dans le tas JavaScript après le logout.

**Impact :** La clé maître persiste en mémoire après déconnexion. Un dump mémoire ou une extension malveillante peut l'extraire.

**Correction :** Il n'existe pas de méthode standardisée pour détruire une `CryptoKey` WebCrypto (elles sont non-extractibles intentionnellement). La solution est de ne pas faire croire à une destruction qui n'a pas lieu — supprimer le commentaire trompeur et documenter cette limitation. Si la destruction mémoire est critique, explorer des solutions alternatives (rechargement de page au logout).

---

### HAUTE — Énumération des codes d'invitation sans authentification

**Fichier :** `frontend/src/app/pages/Register.jsx:32-42`

La vérification du code d'invitation est effectuée en tant que requête **non authentifiée** sur la collection `invites_codes`. Cela signifie que :
- N'importe qui peut vérifier si un code existe sans créer de compte.
- Il n'y a pas de rate limiting côté client.
- Un attaquant peut brute-forcer tous les codes valides.

**Impact :** Découverte des codes d'invitation valides → inscription non autorisée.

**Correction :** Ne pas exposer la collection `invites_codes` en lecture non authentifiée. La validation du code doit être effectuée côté serveur lors de la création du compte (via un hook PocketBase qui vérifie et supprime le code atomiquement).

---

### MOYENNE — Réutilisation de la clé maître pour AES et HMAC

**Fichier :** `frontend/src/core/crypto/main-key.js:115-123`

```js
const [aesKey, hmacKey] = await Promise.all([
  importAesKeyFromBytes(bytes),
  window.crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
]);
```

Les 32 mêmes octets de la clé maître sont utilisés pour dériver à la fois la clé AES-GCM (chiffrement) et la clé HMAC-SHA256 (intégrité). C'est une violation du principe de **séparation des clés** (key separation). Bien que non immédiatement exploitable, cela viole les bonnes pratiques cryptographiques.

**Correction :** Dériver des sous-clés distinctes avec domain separation (ex : HKDF avec labels différents : `"nodea:aes"` et `"nodea:hmac"`).

---

### MOYENNE — Cache des guards en `localStorage` (risque XSS)

**Fichier :** `frontend/src/core/crypto/guards.js:42-54`

```js
const STORE_KEY = "nodea.guards.v1";
function loadAll() {
  return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
}
```

Les guards HMAC (dérivés de la clé maître) sont mis en cache dans `localStorage`. Bien que les guards ne soient pas la clé maître elle-même, ils sont des signatures cryptographiques qui prouvent la possession de la clé. Une attaque XSS peut lire `localStorage` et récupérer ces guards.

**Impact :** En combinaison avec une XSS, un attaquant peut rejouer des opérations de suppression/modification sur les enregistrements de la victime.

**Correction :** Utiliser `sessionStorage` à la place de `localStorage` (effacé à la fermeture du navigateur), ou recalculer les guards à la volée sans les mettre en cache.

---

### MOYENNE — Absence de politique de mot de passe

Aucune validation de la robustesse du mot de passe n'est effectuée côté client dans les formulaires d'inscription (`Register.jsx`) et de changement de mot de passe (`ChangePassword.jsx`). Sachant que le mot de passe est la seule protection de la clé maître (et donc de toutes les données), un mot de passe faible compromet l'ensemble du chiffrement.

**Correction :** Implémenter une validation de la complexité du mot de passe (longueur minimale, entropie) et afficher un indicateur de force.

---

### FAIBLE — Logique de `decryptWithRetry` sans effet

**Fichier :** `frontend/src/core/crypto/webcrypto.js:130-148`

```js
try {
  return await decryptAESGCM(encrypted, key);
} catch (err) {
  if (isCryptoError(err)) {
    // ...
    try {
      return await decryptAESGCM(encrypted, key); // même paramètres !
    } catch (err2) {
      // ...
    }
  }
}
```

Le retry est effectué avec exactement les mêmes paramètres. Les opérations cryptographiques étant déterministes, si le premier appel échoue, le second échouera de manière identique. Cette logique n'a aucun effet utile et ajoute de la confusion.

**Correction :** Supprimer le retry ou documenter clairement dans quel scénario il est censé aider.

---

### FAIBLE — Fallback de décodage double-base64 dans `ChangePassword`

**Fichier :** `frontend/src/app/pages/ChangePassword.jsx:92-106`

Le code tente un fallback "double base64" si le déchiffrement initial échoue. Cette logique legacy augmente la surface d'attaque et peut masquer des erreurs de déchiffrement légitimes (mauvais mot de passe → oracle de déchiffrement partiel).

**Correction :** Une fois la migration des anciens formats terminée, supprimer ce code legacy.

---

### INFO — Divulgation d'informations dans les logs

Plusieurs `console.error` exposent des détails techniques sur le schéma de chiffrement :

- `[Login] decrypt mainKey error`
- `[Login] build mainKey material error`
- `[ChangePassword] rebuild mainKey material error`

En production, ces logs sont visibles dans les DevTools. Bien que limités à l'utilisateur lui-même, il est préférable de les désactiver ou de les réduire en production.

**Correction :** Conditionner les logs détaillés à `import.meta.env.DEV`.

---

## Points positifs

- Utilisation correcte de **WebCrypto** (non-extractible par défaut)
- **Argon2id** pour la dérivation de clé (time=3, mem=64MB) — paramètres acceptables
- **AES-256-GCM** avec IV aléatoire par enregistrement
- Architecture **zéro-connaissance** : le serveur ne peut pas accéder aux données en clair
- Clé maître **non transmise au serveur** — chiffrement/déchiffrement entièrement côté client
- **Effacement du sel de dérivation** (`bytes.fill(0)`) dans plusieurs endroits
- Hook PocketBase validant le format des guards côté serveur

---

## Récapitulatif des priorités

| Sévérité | Vulnérabilité | Fichier |
|----------|--------------|---------|
| CRITIQUE | `window.mainKey` fallback | `DeleteAccount.jsx:63` |
| HAUTE | Injection filtre code invitation | `Register.jsx:33` |
| HAUTE | Réutilisation code invitation | `Register.jsx:61-70` |
| HAUTE | `wipeMainKeyMaterial` inefficace | `main-key.js:136-160` |
| HAUTE | Énumération codes invitation | `Register.jsx:32-42` |
| MOYENNE | Réutilisation clé AES/HMAC | `main-key.js:115-123` |
| MOYENNE | Guards en localStorage | `guards.js:42-54` |
| MOYENNE | Pas de politique de mot de passe | `Register.jsx`, `ChangePassword.jsx` |
| FAIBLE | decryptWithRetry inutile | `webcrypto.js:130-148` |
| FAIBLE | Code legacy double-base64 | `ChangePassword.jsx:92-106` |
| INFO | Logs verbeux en production | `Login.jsx`, `ChangePassword.jsx` |
