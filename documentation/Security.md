# SECURITY

Ce document décrit l’architecture de sécurité actuellement en production (octobre 2025).  
Il synthétise la gestion des clés, les flux chiffrés et les invariants à respecter côté client et serveur.

---

## 1. Principes fondamentaux

- **Chiffrement de bout en bout (E2E)**  
  Toutes les données métiers sont chiffrées **avant** d’être envoyées à PocketBase.  
  Le serveur ne persiste que des blobs opaques (`payload`) et les métadonnées techniques indispensables.

- **Clé maîtresse aléatoire**  
  - À l’inscription, le client génère une clé maîtresse (`mainKey`) de 32 octets aléatoires.  
  - Cette clé n’est jamais transmise en clair. Elle est stockée sous forme chiffrée dans `users.encrypted_key`.  
  - Le chiffrement utilise une clé dérivée du mot de passe via Argon2id (`password + encryption_salt`).

- **CryptoKey non extractibles**  
  - Au login, la dérivation Argon2id sert uniquement à déchiffrer `encrypted_key`.  
  - La clé maîtresse est immédiatement importée en deux CryptoKey WebCrypto non extractibles :  
    - AES-256-GCM (`encrypt`/`decrypt`),  
    - HMAC SHA-256 (`sign`).  
  - Ces objets vivent en mémoire et sont effacés au logout.

- **Intégrité / autorisations**  
  Les updates et deletes exigent un guard HMAC calculé à partir de la clé maîtresse. Sans cette clé, aucune mutation n’est possible (même pour l’admin serveur).

- **Session cohérente**  
  En cas d’échec de déchiffrement ou de clé absente, la session PocketBase est immédiatement purgeée (`pb.authStore.clear()`) et l’utilisateur est redirigé vers `/login`.  
  ➜ Aucun état « authentifié mais sans clé » n’est toléré.

---

## 2. Cycle de vie de la clé maîtresse

### 2.1 Inscription
1. Génération d’un tableau `Uint8Array(32)` aléatoire.  
2. Dérivation Argon2id (`password + encryption_salt`).  
3. Chiffrement AES-GCM de la clé maîtresse → stockage dans `encrypted_key`.  
4. Effacement local de la version en clair.

### 2.2 Connexion
1. Authentification PB (`authWithPassword`).  
2. Dérivation Argon2id avec le sel utilisateur.  
3. Déchiffrement de `encrypted_key`.  
   - En cas d’échec → purge session + message d’erreur invitant à se reconnecter.  
4. Import en CryptoKey non extractibles (`ensureAesKey`, `ensureHmacKey`).  
5. Mise à disposition dans le store (`state.mainKey`).  
   - `clearGuardsCache()` est appelé pour éviter toute fuite post-session.

### 2.3 Utilisation courante
- Tous les services (`encryptAESGCM`, `decryptWithRetry`, `deriveGuard`) consomment les CryptoKey.  
- `markMissing()` (store) passe l’état clé à `missing` et déclenche un logout si la session PB est encore valide.

### 2.4 Changement de mot de passe
1. Déchiffre `encrypted_key` avec l’ancien mot de passe.  
2. Ré-encode la clé maîtresse avec la dérivation du nouveau mot de passe.  
3. Met à jour `encrypted_key` côté serveur puis reconstruit les CryptoKey.  
➜ La clé maîtresse ne change pas : aucune donnée n’a besoin d’être ré-chiffrée.

### 2.5 Logout
- Efface les CryptoKey (`wipeMainKeyMaterial`), vide le cache `nodea.guards.v1`, nettoie la session PB et redirige vers `/login`.

---

## 3. Données chiffrées

Chaque enregistrement `<module>_entries` contient :

| Champ           | Description |
|-----------------|-------------|
| `module_user_id` | Identifiant secondaire opaque (un par module activé). |
| `payload`        | Contenu JSON chiffré AES-GCM (base64). |
| `cipher_iv`      | IV de 96 bits aléatoire, base64. |
| `guard`          | HMAC caché (champ hidden). |
| `created/updated`| Timestamps PocketBase. |

- Chiffrement : AES-256-GCM avec CryptoKey non extractible.  
- `payload` et `cipher_iv` sont toujours encodés en base64 (standard PocketBase).  
- Le serveur ne peut corréler que des métadonnées (date de création, tailles, …), jamais le contenu.

---

## 4. Guards HMAC

```text
guardSeed = HMAC(mainKey, `guard:${module_user_id}`)
guard     = "g_" + hex( HMAC(guardSeed, recordId) )
```

- Création en deux temps : `POST guard:"init"` → `PATCH` promotion (avec `?sid=<sid>&d=init`).  
- Update/Delete : `?sid=<sid>&d=<guard>` obligatoire. Le serveur compare et rejette si mismatch.  
- Fallback `d=init` possible pour les enregistrements historiques qui n’ont jamais été promus.  
- Le cache local des guards (`nodea.guards.v1`) est purgé au login et au logout.

---

## 5. API : flux standards

| Étape       | Requête                                              | Notes clés |
|-------------|------------------------------------------------------|------------|
| Création    | `POST /<module>_entries` (guard `"init"`)            | Nécessite `module_user_id`, `payload`, `cipher_iv`. |
| Promotion   | `PATCH /<module>_entries/<id>?sid=<sid>&d=init`      | Envoie `guard` calculé localement. |
| Lecture     | `GET /<module>_entries?sid=<sid>`                    | Retourne `payload` chiffré. Aucun guard ni clé. |
| Mise à jour | `PATCH ...?sid=<sid>&d=<guard>`                      | Guard doit correspondre exactement. |
| Suppression | `DELETE ...?sid=<sid>&d=<guard>`                     | Guard requis, fallback `d=init` pris en charge côté client. |

Toute tentative échoue si la clé maîtresse est absente → `markMissing()` force le logout.

---

## 6. Export / Import

### Export (client)
- Format commun :
```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "<module>": [ ...payloads clairs... ]
  }
}
```
- Les plugins (`core/utils/ImportExport/*.jsx`) itèrent paginé (`perPage` 200) via `pb.send`, déchiffrent localement (`decryptWithRetry`) et sérialisent les payloads en clair.

### Import
- Parse le JSON clair, normalise, chiffre localement puis rejoue le flux POST/PATCH.  
- Les plugins gèrent :  
  - `listExistingKeys` (déduplication),  
  - `getNaturalKey` (clé fonctionnelle dérivée du payload),  
  - gestion d’erreurs module par module (ex. log interne, message utilisateur).  
- Importation possible depuis :  
  - export moderne (`{ meta, modules }`),  
  - tableau legacy (Mood),  
  - NDJSON (1 payload / ligne).  
  Le plugin choisit la stratégie adéquate.

---

## 7. Invariants

1. **Confidentialité** : la clé maîtresse reste côté client ; le serveur n’a jamais accès aux données en clair.  
2. **Intégrité** : toute mutation nécessite un guard valide, donc la clé maîtresse.  
3. **Portabilité** : export clair lisible et réimportable ; le format est versionné.  
4. **Session cohérente** : aucune action n’est permise si la clé est absente → logout immédiat.  
5. **Homogénéité** : tous les modules appliquent la même construction (POST init + PATCH guard).  
6. **Auditabilité locale** : les actions de purge/suppression se font en listant puis supprimant chaque enregistrement avec son guard (cf. suppression de compte).

---

## 8. Points d’attention pour les devs

- Générer un IV unique par chiffrement (`crypto.getRandomValues`).  
- Ne jamais logguer les payloads clairs, la clé maîtresse ni les guards.  
- Nettoyer `nodea.guards.v1` au login/logout (`clearGuardsCache`).  
- En cas d’erreur de déchiffrement (`decryptWithRetry`) :  
  - Propager `markMissing()` (ce qui déclenche logout).  
  - Informer l’utilisateur qu’un relogin est nécessaire.  
- Lors d’un changement de mot de passe :  
  - Réutiliser la même clé maîtresse (pas de régénération).  
- Lors des imports massifs :  
  - Coupler progress bar UI et pagination plugin (perPage 200) pour éviter les timeouts.  
- Sur le serveur :  
  - Ne jamais exposer `guard` ni `payload` via des hooks ou logs.  
  - `encrypted_key` est opaque, ne pas tenter de le manipuler en dehors du client.

---

## 9. Métadonnées non sensibles

Certaines informations (ex. `users.onboarding_status`, `users.onboarding_version`) restent en clair pour piloter l’UX. Elles n’ouvrent aucun accès aux données chiffrées ni aux clés.  

Le modèle E2E repose sur deux piliers : **clé maîtresse aléatoire + CryptoKey non extractibles** et **guards HMAC**. Tant que ces invariants sont respectés, la confidentialité et l’intégrité des données utilisateur sont garanties.
