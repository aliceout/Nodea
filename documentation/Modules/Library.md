# Module Library (Livres / Films / etc.)

## Structure

Le module est séparé en **2 tables** :

1. **`library_items_entries`**
   → Une entrée = une œuvre (livre, film, série, documentaire).

2. **`library_reviews_entries`**
   → Une entrée = une note/focus datée sur une œuvre.
   → Permet d’avoir une ou plusieurs “fiches de lecture” par œuvre.

Toutes les règles et le protocole crypto restent identiques aux autres modules (Mood, Goals) :

* `module_user_id` = identifiant secondaire opaque, unique pour ce module.
* `payload` = contenu clair chiffré côté client (AES-GCM).
* `cipher_iv` = IV AES-GCM aléatoire.
* `guard` = HMAC déterministe stocké hidden, utilisé pour update/delete.
* Création en 2 temps : `POST guard:"init"` → `PATCH promotion`.

---

## Payload clair attendu

### A) `library_items_entries` (œuvres)

```json
{
  "type": "book|movie|tv|doc",
  "provider": "openlibrary|googlebooks|tmdb",
  "external_id": "string",
  "title": "string",
  "creators": ["string"],
  "year": "number|optional",
  "language": "string|optional",
  "cover_url": "string|optional",
  "status": "planned|in_progress|finished|abandoned",
  "started_at": "YYYY-MM-DD|optional",
  "finished_at": "YYYY-MM-DD|optional",
  "rating": "0-5|optional",
  "tags": ["string|optional"]
}
```

### B) `library_reviews_entries` (fiches de lecture)

```json
{
  "date": "YYYY-MM-DD",
  "item_rid": "string",   // id PB de l’œuvre associée
  "note": "string",       // réflexion / ressenti
  "page": "number|optional",
  "snippet": "string|optional"
}
```

---

## Export / Import

* L’export suit la structure commune :

```json
{
  "meta": { "version": 1, "exported_at": "<ISO8601Z>", "app": "Nodea" },
  "modules": {
    "library_items": [
      {
        "type": "book",
        "provider": "openlibrary",
        "external_id": "OL123M",
        "title": "Exemple de livre",
        "creators": ["Autrice Inconnue"],
        "year": 2022,
        "language": "fr",
        "status": "in_progress"
      }
    ],
    "library_reviews": [
      {
        "date": "2025-08-20",
        "item_rid": "rec_abc123",
        "note": "Ce passage m’a beaucoup marqué.",
        "page": 54
      },
      {
        "date": "2025-08-22",
        "item_rid": "rec_abc123",
        "note": "J’ai fini le livre, super conclusion."
      }
    ]
  }
}
```

* L’import suit le protocole habituel :

  * l’UI chiffre localement chaque entrée,
  * `POST guard:"init"` → `PATCH promotion` avec le `guard` HMAC,
  * pas d’exposition des données en clair côté serveur.

---

## Points importants

* **Confidentialité** : tout est chiffré E2E, y compris les titres, notes, reviews. Le serveur ne sait pas ce que tu lis/écris.
* **Souplesse** :

  * si tu veux juste “1 fiche par œuvre” → tu ne crées qu’une seule review,
  * si tu veux suivre tes pensées au fil de la lecture → tu crées plusieurs reviews.
* **Interop** : les snapshots (provider, external\_id, cover) servent uniquement côté client pour reconstruire une UI plus jolie.