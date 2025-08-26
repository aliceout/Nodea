# Module Review 

base sur le projet YearCompass)
## 1. Table `review_entries`

* **Type** : `base`
* **Accès** (règles PocketBase identiques à Mood/Goals) :

  * `list/view` : `record.module_user_id = @request.query.sid`
  * `update/delete` : idem **et** `record.guard = @request.query.d`

**Champs système** (schéma commun à tous les modules) :

| Champ            | Type     | Requis | Hidden | Notes                          |
| ---------------- | -------- | ------ | ------ | ------------------------------ |
| `id`             | text PK  | yes    | no     | Généré PB                      |
| `module_user_id` | text     | yes    | no     | Id secondaire opaque, ex `r_…` |
| `payload`        | text     | yes    | no     | Base64URL d’un blob AES-GCM    |
| `cipher_iv`      | text     | yes    | no     | IV AES-GCM                     |
| `guard`          | text     | yes    | yes    | HMAC déterministe, hidden      |
| `created`        | autodate | auto   | no     |                                |
| `updated`        | autodate | auto   | no     |                                |

---

## 2. Payload clair attendu (chiffré côté client)

```json
{
  "year": 2025,

  "last_year": {
    "agenda_review": ["string"],

    "life_areas": {
      "family": ["string"],
      "friends": ["string"],
      "work": ["string"],
      "health": ["string"],
      "finance": ["string"],
      "fun_creativity": ["string"],
      "better_world": ["string"]
    },

    "six_phrases": {
      "biggest_accomplishment": "string",
      "service_rendered": "string",
      "biggest_surprise": "string",
      "biggest_risk": "string",
      "lesson_learned": "string",
      "best_decision": "string"
    },

    "six_questions": {
      "gratitude": ["string"],
      "best_discovery": ["string"],
      "not_realized": ["string"],
      "influenced": ["string"],       // personnes que j’ai influencées
      "influenced_by": ["string"],    // personnes qui m’ont influencé·e
      "proud_of": ["string"]
    },

    "best_moments": ["string"],        // texte libre (au lieu de dessin)
    "three_challenges": ["string"],
    "three_successes": ["string"],
    "forgiveness": "string",
    "letting_go": "string",            // texte libre (au lieu de dessin)

    "closing": {
      "book_title": "string",
      "three_words": ["string"]
    }
  },

  "next_year": {
    "dream_big": "string",             // texte narratif (au lieu de dessin)

    "life_areas": {
      "family": ["string"],
      "friends": ["string"],
      "work": ["string"],
      "health": ["string"],
      "finance": ["string"],
      "fun_creativity": ["string"],
      "better_world": ["string"]
    },

    "triplets": {
      "say_no": ["string"],
      "discover": ["string"],
      "support": ["string"],
      "main_goals": ["string"],
      "let_go": ["string"],
      "self_love": ["string"],
      "rewards": ["string"],
      "get_closer": ["string"],
      "places": ["string"],
      "self_care": ["string"],
      "morning_routines": ["string"],
      "environment": ["string"]
    },

    "six_phrases": {
      "special_because": "string",
      "advice": "string",
      "positive_answer": "string",
      "courage": "string",
      "energy_source": "string",
      "no_procrastination": "string"
    },

    "secret_wish": "string",
    "word_of_year": "string",

    "year_image": "base64url|optional"  // image symbolique de l’année (chiffrée)
  },

  "closing": {
    "letter_to_self": "string",
    "commitment": "string",
    "signature": "string",
    "date": "YYYY-MM-DD"
  }
}
```

---

## 3. Export / Import

**Export clair** (comme Mood/Goals) :

```json
{
  "meta": {
    "version": 1,
    "exported_at": "2025-08-25T20:00:00Z",
    "app": "Nodea"
  },
  "modules": {
    "review": [
      {
        "year": 2025,
        "last_year": {
          "agenda_review": ["séjour à Tana", "départ mission"],
          "life_areas": {
            "family": ["plus proche de ma sœur"],
            "friends": ["voyage avec Eva"],
            "work": ["terminé un projet"],
            "health": ["plus de sport"],
            "finance": ["budget équilibré"],
            "fun_creativity": ["atelier écriture"],
            "better_world": ["bénévolat régulier"]
          },
          "six_phrases": { "biggest_accomplishment": "mission finie", "...": "..." },
          "six_questions": { "gratitude": ["Anouk"], "...": "..." },
          "best_moments": ["soirée plage"],
          "three_challenges": ["burnout"],
          "three_successes": ["création Nodea"],
          "forgiveness": "je pardonne à…",
          "letting_go": "je laisse partir…",
          "closing": { "book_title": "Un long chemin", "three_words": ["fatigue", "apprentissage", "amour"] }
        },
        "next_year": {
          "dream_big": "m’imaginer en poste qui me correspond",
          "life_areas": { "...": "..." },
          "triplets": { "say_no": ["au surmenage"], "...": "..." },
          "six_phrases": { "special_because": "je change de cap", "...": "..." },
          "secret_wish": "me sentir plus libre",
          "word_of_year": "ancrage",
          "year_image": "<base64url…>"
        },
        "closing": {
          "letter_to_self": "courage pour toi future Alice…",
          "commitment": "je m’engage à ralentir",
          "signature": "Alice",
          "date": "2025-08-25"
        }
      }
    ]
  }
}
```

* **Export** : jamais `payload`, `cipher_iv`, `guard`, `id`.
* **Import** : re-chiffrement local, flux `POST init` → `PATCH promotion`.

---

## 4. Points importants

* **Fidèle à YearCompass** : toutes les rubriques textuelles sont présentes.
* **Dessin remplacé par texte** : tu écris au lieu de dessiner.
* **Photo transformée en champ image symbolique** (toujours chiffrée).
* **Confidentialité totale** : tout est chiffré côté client (AES-GCM + HMAC guard).
* **Rythme** : 1 entrée par an, mais tu peux en refaire quand tu veux.
* **UX** : parcours guidé question par question, comme tourner les pages du carnet.
