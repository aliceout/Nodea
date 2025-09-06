# MODULES

## 1. Structure commune
Tous les modules suivent le même modèle :
- Une table dédiée : `<module>_entries`
- Champs communs :  
  - `id` (PocketBase)  
  - `module_user_id` (clé secondaire opaque)  
  - `payload` (contenu chiffré côté client, AES-GCM)  
  - `cipher_iv` (IV AES-GCM)  
  - `guard` (HMAC caché, utilisé pour update/delete, jamais renvoyé)  
  - `created`, `updated`
- Flux :  
  - Création en **2 temps** (`POST guard:"init"` → `PATCH` avec `guard` calculé)  
  - `update/delete` nécessitent `?sid=<module_user_id>&d=<guard>`

Le contenu clair attendu (payload) est défini dans les fiches dédiées de chaque module.

### Onboarding et modules

⚠️ L’ouverture de la modale d’onboarding ne dépend **pas** de la présence de données dans les modules.  
Tous les `payload` sont chiffrés et les tables ont une structure homogène, il est donc impossible de « détecter » l’usage d’un module côté serveur.

La décision d’ouvrir l’onboarding repose uniquement sur les champs `users.onboarding_status` et `users.onboarding_version`.  
Les flux des modules (`POST guard:"init" → PATCH promotion`, `update/delete ?sid&d`) restent inchangés.


---

## 2. Modules

### 2.1 Mood
- **But** : suivi quotidien de l’humeur et des éléments positifs.  
- **Table** : `mood_entries`  
- **Notes** : une entrée = une journée.  
- Voir fiche `documentation/modules/Mood.md` pour le détail.

---

### 2.2 Goals
- **But** : suivi des objectifs annuels.  
- **Table** : `goals_entries`  
- **Notes** : une entrée = un objectif.  
- Voir fiche `documentation/modules/Goals.md`.

---

### 2.3 Habits
- **But** : suivi des habitudes (ex. sport, méditation).  
- **Tables** :  
  - `habits_items_entries` (définition d’une habitude)  
  - `habits_logs_entries` (occurrence d’une habitude à une date)  
- **Notes** : structure items + logs.  
- Voir fiche `documentation/modules/Habits.md`.

---

### 2.4 Library
- **But** : suivi des lectures / visionnages (livres, films, séries, docs).  
- **Tables** :  
  - `library_items_entries` (une œuvre)  
  - `library_reviews_entries` (une note ou fiche datée sur une œuvre)  
- **Notes** : séparation œuvres vs. notes.  
- Voir fiche `documentation/modules/Library.md`.

---

### 2.5 Review
- **But** : bilan annuel et planification (inspiré YearCompass).  
- **Table** : `review_entries`  
- **Notes** : une entrée = une année complète.  
- Voir fiche `documentation/modules/Review.md`.

---

## 3. Export / Import
- Chaque module exporte uniquement ses **payloads clairs** (jamais `id`, `guard`, `cipher_iv`).  
- Format commun :  

```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "<module>": [ ... ]
  }
}
```

* Import : côté client → chiffrage local → flux création en 2 temps.
* Détails par module : voir les fiches correspondantes.
