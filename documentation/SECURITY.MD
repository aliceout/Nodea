# SECURITY.md

## 🔐 Sécurité & Chiffrement

Ce document décrit **tout le protocole de sécurité** de l’application : gestion des clés, modules, entrées, et les étapes suivies par l’UI (client) et le serveur.

---

## 1. Fichiers de chiffrement

- `src/services/crypto.js`
  - Chiffrement symétrique AES-GCM (`seal` / `open`).
  - Helpers aléatoires (`randomBytes`).
  - PBKDF2 (legacy, à éviter sauf compatibilité).

- `src/services/webcrypto.js`
  - Dérivation de clé robuste avec Argon2id.
  - Hash SHA-256, HMAC.
  - Encodage base64url, génération aléatoire sécurisée.

- `src/services/crypto-utils.js`
  - Helpers métiers :
    - `generateModuleUserId` (identifiant secondaire),
    - `hmac` (utilisé pour la dérivation de `guard`).

---

## 2. Concepts clés

- **mainKey** : clé AES unique par utilisateur·rice, jamais stockée en clair côté serveur.  
- **modules** : configuration chiffrée, stockée dans `users.modules`.  
- **module_user_id** : identifiant secondaire, opaque, sert à grouper les entrées d’un module.  
- **guard** : valeur **dérivée par HMAC** (déterministe) pour chaque entrée (`*_entries`), utilisée comme preuve de capacité pour modification/suppression. Le serveur ne recalcule rien : il stocke le `guard` (champ hidden) et vérifie l’égalité avec `?d=` sur UPDATE/DELETE.  
- **payload** : données métier (mood, goals, etc.), toujours chiffrées côté client.  
- **cipher_iv** : vecteur d’initialisation unique par payload.

### Dérivation HMAC du `guard`

Objectif : ne rien stocker côté client, tout en pouvant toujours recalculer le secret pour une entrée donnée.

- **Clé par module (côté client)** :  
  `guardKey = HMAC_SHA256(mainKey, "guard:" + module_user_id)`  
  *(via WebCrypto/HMAC)*

- **Guard d’une entrée** (déterministe) :  
  `guard = "g_" + HEX( HMAC_SHA256(guardKey, record.id) )`  
  (HEX sur 32 octets → 64 caractères, préfixés par `g_`)

- **Flux de création en 2 temps** :  
  1) **POST create** avec `guard="init"` (placeholder).  
     Un **hook PocketBase** copie le `guard` reçu dans le **champ hidden** de l’enregistrement (le client ne peut pas écrire un champ hidden).  
  2) Le client reçoit `id`, calcule le `guard` (HMAC ci-dessus), puis **PATCH** l’entrée pour remplacer `"init"` par la vraie valeur, en passant `?sid=<module_user_id>&d=init` (autorisé car la valeur actuelle est `"init"`).

- **Update/Delete ultérieurs** :  
  le client recalcule à la volée `guard = "g_" + HEX(HMAC_SHA256(guardKey, id))` et appelle  
  `...?sid=<module_user_id>&d=<guard>`.

👉 Résultat : **pas de stockage local** du `guard` ; suppression/modif toujours possibles tant que `mainKey` et `module_user_id` sont connus.

---

## 3. Processus détaillés

### 3.1 Création de compte
1. L’utilisateur choisit un mot de passe.  
2. **UI** : génère un `salt` aléatoire.  
3. **UI** : dérive une clé de protection avec Argon2id(password, salt).  
4. **UI** : génère une `mainKey` aléatoire (AES).  
5. **UI** : chiffre la `mainKey` avec la clé de protection (`seal`).  
6. **UI → serveur** : envoie `{ encrypted_key, encryption_salt }`.  
7. **Serveur** : stocke dans `users.encrypted_key` et `users.encryption_salt`.

### 3.2 Connexion / déverrouillage
1. L’utilisateur entre son mot de passe.  
2. **UI** : récupère `encrypted_key` + `encryption_salt` depuis `users`.  
3. **UI** : dérive la clé de protection avec Argon2id(password, salt).  
4. **UI** : déchiffre `encrypted_key` pour retrouver la `mainKey`.  
5. La `mainKey` reste uniquement en mémoire côté client.

### 3.3 Activation d’un module
1. **UI** : génère un `module_user_id` (aléatoire, base64url).  
2. **UI** : construit un objet `{ enabled: true, id: module_user_id }`.  
3. **UI** : chiffre l’objet complet `modules` avec la `mainKey` (`seal`).  
4. **UI → serveur** : met à jour `users.modules`.

### 3.4 Création d’une entrée (2 temps)
1. **UI** : prépare `payloadObj`.  
2. **UI** : chiffre avec la `mainKey` → obtient `{ payload, cipher_iv }`.  
3. **UI → serveur (A)** : `POST /<module>_entries` avec `{ module_user_id, payload, cipher_iv, guard: "init" }`.  
   - Hook PB : copie `"init"` vers le champ **hidden** `guard`.  
4. **UI ← serveur** : reçoit `record.id`.  
5. **UI** : dérive `guardKey = HMAC_SHA256(mainKey, "guard:" + module_user_id)` puis  
   `guard = "g_" + HEX(HMAC_SHA256(guardKey, record.id))`.  
6. **UI → serveur (B)** : **PATCH de promotion** de l’entrée avec `?sid=<module_user_id>&d=init` et body `{ guard: <guard dérivé> }`.

### 3.5 Lecture d’une entrée
1. **UI → serveur** : `GET /<module>_entries?sid=<module_user_id>`.  
2. **Serveur** : renvoie les entrées chiffrées (payload + iv, **sans** `guard`).  
3. **UI** : déchiffre chaque `payload` avec la `mainKey`.

### 3.6 Modification / suppression
1. **UI** : recalcule `guard` à partir de `mainKey`, `module_user_id` et `record.id`.  
2. **UI → serveur** : `PATCH`/**`DELETE`** `/.../{id}?sid=<module_user_id>&d=<guard>`.  
3. **PocketBase** : vérifie `module_user_id` ET `guard` (égalité stricte) avant d’accepter.

### 3.7 Changement de mot de passe
1. **UI** : demande l’ancien + le nouveau mot de passe.  
2. **UI** : redérive la `mainKey` avec l’ancien mot de passe (comme connexion).  
3. **UI** : dérive une nouvelle clé de protection (Argon2id) avec le nouveau mot de passe.  
4. **UI** : re-scelle la `mainKey` avec cette nouvelle clé.  
5. **UI → serveur** : met à jour `users.encrypted_key` et `users.encryption_salt`.

---

## 4. Rôles : qui fait quoi ?

- **UI (client)**  
  - Génère les secrets (`mainKey`, `module_user_id`, `iv`).  
  - Dérive `guardKey` et `guard` via HMAC (déterministe).  
  - Chiffre/déchiffre tous les `payloads`.  
  - Envoie uniquement des données chiffrées au serveur.

- **Serveur (PocketBase)**  
  - Stocke les blobs chiffrés (`encrypted_key`, `modules`, `payloads`).  
  - Stocke le `guard` (champ hidden) et applique les règles d’accès (`module_user_id` + `guard`).  
  - Ne connaît jamais les clés réelles.

---

## 5. Résumé sécurité

- **End-to-end** : le serveur ne voit jamais les données déchiffrées.  
- **Capability-based** : l’accès dépend uniquement de `module_user_id` + `guard`.  
- **Pas de lien direct avec user.id** : empêche la corrélation entre données chiffrées et utilisateurs.  
- **Argon2id** : empêche le brute-force des mots de passe.  
- **AES-GCM** : assure confidentialité + intégrité des données.  
- **HMAC (guard)** : suppression/modif sans stockage local, recalcul à la demande.

---

## 6. FAQ technique

**Que se passe-t-il si l’utilisateur ouvre un autre onglet ou redémarre l’app ?**  
La `mainKey` est volatile. Elle est dérivée du mot de passe à chaque session via Argon2id et **n’est jamais persistée**. Aucune donnée n’est accessible tant que `mainKey` n’est pas disponible en mémoire.

**Peut-on précharger les modules automatiquement après connexion ?**  
Oui. Une fois la `mainKey` dérivée, l’UI peut décrypter `users.modules` et initialiser les modules actifs.

---

## 7. Règles d’accès PocketBase (résumé)

- **list/view** :  
  `request.query.sid != ""` **et** `record.module_user_id = request.query.sid`

- **update/delete** :  
  `request.query.sid != ""` **et** `request.query.d != ""` **et**  
  `record.module_user_id = request.query.sid` **et** `record.guard = request.query.d`

*(En création, le hook autorise `guard="init"` puis le PATCH de promotion avec `?d=init`.)*

---

## 8. Glossaire rapide

- `module_user_id` : identifiant secondaire unique par module  
- `payload` : contenu chiffré  
- `guard` : preuve HMAC requise pour update/delete (champ hidden côté serveur)  
- `mainKey` : clé AES propre à l’utilisateur·rice

---

## 9. Convention de nommage

- Préfixes d’`id` : `m_` pour Mood, `g_` pour Goals, etc.  
- Tables PB : `<module>_entries`  
- Stores frontend : `modulesState`  
- Clés JSON de `users.modules` = noms de modules dans le code
