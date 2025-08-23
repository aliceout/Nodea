# Sécurité & Chiffrement

Ce document décrit **tout le protocole de sécurité** de l’application : gestion
des clés, modules, entrées, et les étapes suivies par l’UI (client) et le serveur.

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
    - `makeGuard` (secret guard),
    - `hashPayload`, `hmac`.

---

## 2. Concepts clés

- **mainKey** : clé AES unique par utilisateur, jamais stockée en clair côté serveur.  
- **modules** : config chiffrée, stockée dans `users.modules`.  
- **module_user_id** : identifiant secondaire, opaque, sert à grouper les entrées d’un module.  
- **guard** : secret aléatoire associé à chaque module_user_id, sert de preuve de capacité.  
- **payload** : données métier (journal, goals, etc.), toujours chiffrées côté client.  
- **cipher_iv** : vecteur d’initialisation unique par payload.

---

## 3. Processus détaillés

### 3.1 Création de compte (UI + serveur)
1. L’utilisateur choisit un mot de passe.  
2. **UI** : génère un `salt` aléatoire.  
3. **UI** : dérive une clé de protection avec Argon2id(password, salt).  
4. **UI** : génère une `mainKey` aléatoire (AES).  
5. **UI** : chiffre la `mainKey` avec la clé de protection (`seal`).  
6. **UI → serveur** : envoie `{ encrypted_key, encryption_salt }`.  
7. **Serveur** : stocke dans `users.encrypted_key` et `users.encryption_salt`.

---

### 3.2 Connexion / déverrouillage
1. L’utilisateur entre son mot de passe.  
2. **UI** : récupère `encrypted_key` + `encryption_salt` depuis `users`.  
3. **UI** : dérive la clé de protection avec Argon2id(password, salt).  
4. **UI** : déchiffre `encrypted_key` pour retrouver la `mainKey`.  
5. La `mainKey` reste uniquement en mémoire côté client.

---

### 3.3 Activation d’un module
1. **UI** : génère un `module_user_id` (aléatoire, base64url).  
2. **UI** : génère un `guard` (aléatoire, hex, préfixé `g_`).  
3. **UI** : construit un objet JSON `{ module_user_id, guard, enabled: true, algo: ... }`.  
4. **UI** : chiffre cet objet avec la `mainKey` (`seal`).  
5. **UI → serveur** : envoie la version chiffrée → stockée dans `users.modules`.

---

### 3.4 Création d’une entrée (ex: goal)
1. **UI** : prépare le contenu (`payloadObj`).  
2. **UI** : chiffre avec la `mainKey` → obtient `{ payload, cipher_iv }`.  
3. **UI** : récupère `module_user_id` + `guard` du module.  
4. **UI → serveur** : `POST /goals_entries` avec `{ module_user_id, payload, cipher_iv, guard }`.  
5. **PocketBase rules** :
   - create = user connecté, `guard` requis (schéma).  
   - list/view = `?sid=module_user_id`.  
   - update/delete = `?sid=...&d=guard`.

---

### 3.5 Lecture d’une entrée
1. **UI → serveur** : `GET /goals_entries?sid=<module_user_id>`.  
2. **Serveur** : renvoie les entrées chiffrées (payload + iv).  
3. **UI** : déchiffre chaque `payload` avec la `mainKey`.  
4. L’utilisateur ne voit que les données déchiffrées localement.

---

### 3.6 Modification / suppression
1. **UI → serveur** : `PATCH` ou `DELETE /goals_entries/{id}?sid=<module_user_id>&d=<guard>`.  
2. **PocketBase** : vérifie que `sid` correspond et que `d` = `guard`.  
3. Si OK, l’opération est acceptée.

---

### 3.7 Changement de mot de passe
1. **UI** : demande le mot de passe actuel + le nouveau.  
2. **UI** : redérive la `mainKey` avec l’ancien mot de passe (comme connexion).  
3. **UI** : dérive une nouvelle clé de protection avec le nouveau mot de passe (Argon2id).  
4. **UI** : re-scelle la `mainKey` avec cette nouvelle clé.  
5. **UI → serveur** : met à jour `users.encrypted_key` et `users.encryption_salt`.

---

## 4. Rôles : qui fait quoi ?

- **UI (client)**
  - Génére les secrets (`mainKey`, `module_user_id`, `guard`, `iv`).
  - Dérive les clés à partir du mot de passe (Argon2id).
  - Chiffre/déchiffre tous les payloads.
  - Envoie uniquement des données chiffrées au serveur.

- **Serveur (PocketBase)**
  - Stocke les blobs chiffrés (`encrypted_key`, `modules`, `payloads`).
  - Applique les règles d’accès (`sid` + `guard`).
  - Ne connaît jamais les clés de chiffrement réelles.

---

## 5. Résumé sécurité

- **End-to-end** : le serveur ne voit jamais les données déchiffrées.  
- **Capability-based** : l’accès aux données dépend uniquement de `module_user_id` + `guard`.  
- **Pas de lien direct avec user.id** : empêche la corrélation entre données chiffrées et utilisateurs.  
- **Argon2id** : empêche le brute-force des mots de passe.  
- **AES-GCM** : assure confidentialité + intégrité des payloads.  
- **Random crypto-safe** : toutes les valeurs critiques viennent de `crypto.getRandomValues`.  
