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

### Utilisateurs (métadonnées onboarding)

En plus des champs techniques existants chaque user possède des champs non sensibles servant uniquement à piloter la modale d’onboarding :

- `onboarding_status` (string) : `"needed"` (par défaut) ou `"done"`.
- `onboarding_version` (int) : version courante de l’onboarding (ex. `1`).

Ces champs :
- ne sont **pas chiffrés**, ils sont considérés comme métadonnées techniques.  
- n’interfèrent pas avec la `mainKey`, les `module_user_id` ou les `guard`.  
- sont accessibles en lecture/écriture uniquement par l’utilisateur sur son propre compte.

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