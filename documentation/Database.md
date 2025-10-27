# BDD

## 1. Structure commune
Toutes les collections de modules suivent le même schéma technique :

- `id` (PocketBase)
- `module_user_id` (clé secondaire opaque, généré par client)
- `payload` (JSON chiffré côté client avec AES-GCM)
- `cipher_iv` (IV aléatoire AES-GCM)
- `guard` (HMAC caché, utilisé pour update/delete, jamais renvoyé)
- `created` (timestamp auto PocketBase)
- `updated` (timestamp auto PocketBase)

### Règles
- Accès en lecture/écriture via `?sid=<module_user_id>`
- Création en **2 temps** : `POST` avec `guard:"init"` → `PATCH` de promotion avec `guard` calculé
- `update/delete` nécessitent `?sid=<module_user_id>&d=<guard>`

Le contenu du `payload` dépend du module (voir les fiches dédiées).

### Utilisateurs (`users`)

Champs sensibles / techniques :

| Champ              | Description |
|--------------------|-------------|
| `encrypted_key`    | Clé maîtresse chiffrée (AES-GCM) avec la dérivation Argon2id du mot de passe. |
| `encryption_salt`  | Sel aléatoire utilisé pour Argon2id. |
| `profile`          | Sous-document (peut contenir des métadonnées publiques). |

Méta UX (non sensibles) :
- `onboarding_status` (`"needed"` \| `"done"`).  
- `onboarding_version` (entier).

Ces champs:
- `encrypted_key` / `encryption_salt` sont nécessaires pour reconstruire la clé maîtresse côté client.  
- Les champs d’onboarding restent en clair et n’interfèrent pas avec la clé maîtresse ni les guards.  
- L’accès en écriture est limité à l’utilisateur authentifié (PocketBase rules).

---

## 2. Tables par module

### 2.1 Mood
- **Collection** : `mood_entries`
- **Usage** : une entrée = une journée

---

### 2.2 Goals
- **Collection** : `goals_entries`
- **Usage** : une entrée = un objectif

---

### 2.3 Habits
- **Collections** :  
  - `habits_items_entries` (définition d’une habitude)  
  - `habits_logs_entries` (log d’occurrence datée)

---

### 2.4 Library
- **Collections** :  
  - `library_items_entries` (une œuvre : livre, film, etc.)  
  - `library_reviews_entries` (fiches/notes datées sur une œuvre)

---

### 2.5 Review
- **Collection** : `review_entries`
- **Usage** : une entrée = un carnet annuel (YearCompass)

---

## 3. Export / Import
- Chaque module exporte **uniquement le payload clair** (jamais `id`, `guard`, `cipher_iv`).  
- Format commun (cf. `export.json`) :

```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "<module>": [ ... ]
  }
}
```

* Import : côté client → chiffrement local → création en 2 temps.
