# Module Habits (Suivi des habitudes)

## Structure

Deux tables, comme pour Library :

1. **`habits_items_entries`**
   → Une entrée = une habitude que tu veux suivre (ex. “tennis”, “méditation”).

2. **`habits_logs_entries`**
   → Une entrée = une occurrence datée (ex. “j’ai fait tennis le 2025-08-25”).
   → Sert de base pour une heatmap / mesure de régularité.

Les règles de sécurité et de chiffrement sont identiques aux autres modules (Mood, Goals, Review, ect) :

* `module_user_id` secondaire, opaque.
* `payload` chiffré côté client (AES-GCM).
* `cipher_iv` IV aléatoire.
* `guard` HMAC hidden, flux création en 2 temps (`POST init` → `PATCH promotion`).

---

## Payload clair attendu

### A) `habits_items_entries` (habitudes)

```json
{
  "title": "string",           // ex. "Tennis"
  "category": "sport|santé|créativité|relation|autre",
  "frequency": "daily|weekly|monthly|custom", 
  "target": "number|optional", // nb/jour ou nb/sem si applicable
  "duration": "P6M|optional",  // période prévue, format ISO8601
  "started_at": "YYYY-MM-DD",
  "archived": "boolean|optional"
}
```

### B) `habits_logs_entries` (occurrences)

```json
{
  "date": "YYYY-MM-DD",
  "item_rid": "string",  // id PB de l’habitude associée
  "done": true
}
```

---

## Export / Import

Format clair d’export (comme Mood/Goals/Library) :

```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "habits_items": [
      {
        "title": "Tennis",
        "category": "sport",
        "frequency": "weekly",
        "target": 1,
        "duration": "P6M",
        "started_at": "2025-08-01"
      }
    ],
    "habits_logs": [
      { "date": "2025-08-05", "item_rid": "rec_abc123", "done": true },
      { "date": "2025-08-12", "item_rid": "rec_abc123", "done": true }
    ]
  }
}
```

* Export : uniquement les payloads clairs, jamais `guard`, `cipher_iv`, ni `payload` chiffré.
* Import : flux 2 temps habituel (chiffrement local, `POST init`, `PATCH promotion`).

---

## Points importants

* **Tout est chiffré E2E** (le serveur ne sait pas quelles habitudes tu suis ni quand tu les as faites).
* **Simplicité** :

  * `items` = définition des habitudes,
  * `logs` = enregistrements de “fait/pas fait” à une date.
* **Analyse** :

  * tu peux générer une **heatmap** à la GitHub sur base des `logs`,
  * calculer un taux de respect (nb de logs / nb attendu via `frequency+target`).
* **Souplesse** : si une habitude s’arrête → `archived:true` dans l’item, sans effacer les logs.
