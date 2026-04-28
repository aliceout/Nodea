# Module Review

Version numérique du carnet **YearCompass** (https://yearcompass.com/fr/),
fidèle au livret A4 imprimable. Chaque rubrique du carnet correspond à
une étape du parcours guidé ; les libellés et l'ordre suivent le livret
exactement.

## 1. Table `review_entries`

Schéma commun à tous les modules (cf. [Modules.md §1](../Modules.md#1-structure-commune)).
Validation des mutations via `requireGuard(reviewEntries)` côté
api — le tuple `(user, sid, guard)` est vérifié dans une seule
passe centralisée par le `collection-factory`.

**Accès** :

* `list/view` : par `module_user_id` (query `?sid=`).
* `update/delete` : `?sid=...&d=<guard>` ; le guard est validé
  contre la valeur stockée serveur, jamais renvoyée en lecture.

**Champs système** (5 colonnes seulement, design surface minimum) :

| Champ            | Type           | Requis | Notes                                          |
| ---------------- | -------------- | ------ | ---------------------------------------------- |
| `id`             | `text` PK      | oui    | UUID généré côté serveur, handle pour `/records/:id` |
| `module_user_id` | `text`         | oui    | Sid opaque — **seule clé d'accès** (le mapping user→sid vit chiffré dans `modules_config`) |
| `payload`        | `text`         | oui    | Base64 d'un blob AES-GCM (contenu chiffré, **+ `updated_at` applicatif** pour le tri « modifié le ») |
| `cipher_iv`      | `text`         | oui    | IV AES-GCM (12 octets, base64)                 |
| `guard`          | `text`         | oui    | HMAC stocké, jamais renvoyé en lecture         |

**Pas de `user_id`, pas de timestamps colonnes.** Le serveur ne sait pas à qui appartient une review ni quand elle a été écrite côté DB.

---

## 2. Payload clair attendu (chiffré côté client)

L'ordre et les noms reprennent le livret YearCompass, page par page.
Le schéma `ReviewPayloadSchema` (`packages/shared/src/schemas/modules.ts`)
est `passthrough` — ajouter ou retirer un champ ne casse pas la
validation, mais le wizard et le reader ne rendront que ce qui est
listé ici.

```json
{
  "year": 2026,

  "last_year": {
    // Page 4 — Consulte ton agenda
    "agenda_review": ["string"],

    // Page 5 — Voici ce qu'a été mon année passée
    // (huit domaines de vie, exactement comme le livret)
    "life_areas": {
      "personal_family":   ["string"],   // vie personnelle, famille
      "career_studies":    ["string"],   // carrière, études
      "friends_community": ["string"],   // amis, communauté
      "leisure_creativity":["string"],   // relaxation, loisirs, créativité
      "physical_health":   ["string"],   // santé physique, vitalité
      "mental_health":     ["string"],   // santé mentale, émotionnelle
      "habits":            ["string"],   // habitudes qui te définissent
      "better_world":      ["string"]    // un avenir meilleur (note de bas de page)
    },

    // Page 6 — Six phrases à propos de mon année précédente
    // (ordre du livret)
    "six_phrases": {
      "wisest_decision":       "string", // La décision la plus sage que j'ai prise…
      "biggest_lesson":        "string", // La plus grande leçon que j'ai apprise…
      "biggest_risk":          "string", // Le plus gros risque que j'ai pris…
      "biggest_surprise":      "string", // La plus grande surprise de l'année…
      "service_rendered":      "string", // Le plus grand service que j'ai rendu à d'autres…
      "biggest_accomplishment":"string"  // La plus grande chose que j'ai accomplie…
    },

    // Page 7 — Six questions à propos de mon année précédente
    // (ordre du livret)
    "six_questions": {
      "proud_of":            "string",   // De quoi es-tu le plus fier·ère ?
      "influenced_by":       ["string"], // Trois personnes qui ont eu le plus d'influence sur toi
      "influenced":          ["string"], // Trois personnes sur lesquelles tu as eu le plus d'influence
      "not_realized":        "string",   // Qu'est-ce que tu n'as pas pu réaliser ?
      "best_self_discovery": "string",   // La meilleure chose que tu aies découverte en toi
      "gratitude":           "string"    // De quoi es-tu le ou la plus reconnaissant·e ?
    },

    // Page 8 — Les meilleurs moments (texte libre, remplace le dessin)
    "best_moments": "string",

    // Page 9 — Mes trois plus grands succès + Mes trois plus grands défis
    // (les deux blocs cohabitent sur la même page du livret)
    "successes_and_challenges": {
      "three_successes":  ["string"], // Note tes trois plus grandes réussites
      "successes_how":    "string",   // Qu'as-tu fait pour les accomplir ? Qui t'a aidé, comment ?
      "three_challenges": ["string"], // Note tes trois plus grandes épreuves
      "challenges_how":   "string"    // Qui ou quoi t'a aidé ? Qu'as-tu appris sur toi-même ?
    },

    // Page 10 — Pardonner
    "forgiveness": "string",

    // Page 11 — Lâcher prise (texte libre, remplace le dessin)
    "letting_go": "string",

    // Page 12 — Clôture de l'année écoulée
    "closing": {
      "three_words": ["string"], // L'année précédente en trois mots
      "book_title":  "string",   // Le livre / film de mon année dernière
      "farewell":    "string"    // Dis au revoir à ton année passée
    }
  },

  "next_year": {
    // Page 14 — Ose rêver en grand !
    "dream_big": "string",

    // Page 15 — Cette nouvelle année ressemblera à ça pour moi
    // (mêmes huit domaines que last_year)
    "life_areas": {
      "personal_family":   ["string"],
      "career_studies":    ["string"],
      "friends_community": ["string"],
      "leisure_creativity":["string"],
      "physical_health":   ["string"],
      "mental_health":     ["string"],
      "habits":            ["string"],
      "better_world":      ["string"]
    },

    // Pages 16-17 — Le triplet magique pour l'année à venir
    // (ordre exact du livret)
    "triplets": {
      "self_love":       ["string"], // trois choses à propos de moi que je vais aimer
      "let_go":          ["string"], // trois choses sur lesquelles je suis prêt·e à lâcher prise
      "main_goals":      ["string"], // trois choses les plus importantes que je veux accomplir
      "support":         ["string"], // trois personnes qui seront mon soutien
      "discover":        ["string"], // trois choses que je vais oser découvrir
      "say_no":          ["string"], // trois choses auxquelles j'aurai le pouvoir de dire non
      "environment":     ["string"], // trois choses pour rendre mon environnement plus confortable
      "morning_routines":["string"], // trois choses que je ferai tous les matins
      "self_care":       ["string"], // trois choses pour prendre soin de moi régulièrement
      "places":          ["string"], // trois endroits que je visiterai
      "get_closer":      ["string"], // trois manières de me rapprocher de ceux que j'aime
      "rewards":         ["string"]  // trois récompenses pour mes succès
    },

    // Page 18 — Six phrases sur mon année à venir
    // (ordre du livret)
    "six_phrases": {
      "no_procrastination":"string", // Cette année, je ne remettrai plus à demain de…
      "energy_source":     "string", // Cette année, je tirerai le plus de mon énergie de…
      "courage":           "string", // Cette année je vais être le·la plus courageux·se quand…
      "positive_answer":   "string", // Cette année, je répondrai positivement lorsque…
      "advice":            "string", // Pour cette nouvelle année, je me conseille de…
      "special_because":   "string"  // Cette année sera spéciale pour moi, parce que…
    },

    // Page 19 — Mon mot pour l'année prochaine
    "word_of_year": "string",

    // Page 19 — Souhait secret
    "secret_wish": "string"
  }
}
```

### Différences voulues avec le livret papier

* **Pages 2-3 (Bienvenue / Prépare-toi)** sont remplacées par un
  écran d'intro court adapté au ton de l'app (calme, brouillon
  chiffré, pas de jugement) — pas de payload associé.
* **Dessins** (best_moments, letting_go, dream_big) deviennent du
  texte libre — l'écriture remplace le dessin.
* **Pages 12-13 (transition entre parties)** ne sont pas un écran
  séparé : le wizard enchaîne directement, la barre de progression
  marque le passage à la deuxième moitié.
* **Page 20 (date + signature sous le credo)** retirée — le
  timestamp `updatedAt` du record et l'identité du compte
  remplacent le rituel papier ; le souhait secret (page 19)
  ferme le parcours.

---

## 3. Export / Import

**Export clair** (comme Mood/Goals) :

```json
{
  "meta": {
    "version": 1,
    "exported_at": "2026-01-15T20:00:00Z",
    "app": "Nodea"
  },
  "modules": {
    "review": [
      {
        "year": 2026,
        "last_year": {
          "agenda_review": ["séjour à Tana", "départ mission"],
          "life_areas": {
            "personal_family":    ["plus proche de ma sœur"],
            "career_studies":     ["terminé un projet"],
            "friends_community":  ["voyage avec Eva"],
            "leisure_creativity": ["atelier écriture"],
            "physical_health":    ["plus de sport"],
            "mental_health":      ["thérapie démarrée"],
            "habits":             ["lecture quotidienne"],
            "better_world":       ["bénévolat régulier"]
          },
          "six_phrases":  { "wisest_decision": "…", "...": "..." },
          "six_questions":{ "proud_of": "…", "...": "..." },
          "best_moments": "soirée plage avec Anouk…",
          "successes_and_challenges": {
            "three_successes":  ["création Nodea"],
            "successes_how":    "j'ai pris le temps, j'ai appris à demander de l'aide",
            "three_challenges": ["burnout"],
            "challenges_how":   "ma sœur m'a sortie la tête de l'eau"
          },
          "forgiveness": "je pardonne à…",
          "letting_go":  "je laisse partir…",
          "closing": {
            "three_words": ["fatigue", "apprentissage", "amour"],
            "book_title":  "Un long chemin",
            "farewell":    "Au revoir 2025, merci pour tout."
          }
        },
        "next_year": {
          "dream_big": "m'imaginer en poste qui me correspond",
          "life_areas": { "...": "..." },
          "triplets":   { "self_love": ["mes mains"], "...": "..." },
          "six_phrases":{ "no_procrastination": "écrire", "...": "..." },
          "word_of_year": "ancrage",
          "secret_wish":  "me sentir plus libre"
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

* **Fidèle au livret YearCompass** : libellés, ordre des questions
  et regroupement (page 9 succès+défis, page 12 trois sections de
  clôture, etc.) reproduisent le livret papier.
* **Dessins → texte** : trois rubriques où le livret demande de
  dessiner (best_moments, letting_go, dream_big) acceptent du
  texte libre.
* **Pas d'image symbolique** : le `year_image` de l'ancienne version
  n'existe pas dans le livret, il a été retiré.
* **Confidentialité totale** : tout est chiffré côté client (AES-GCM
  + HMAC guard). Rien ne quitte le navigateur en clair.
* **Rythme** : 1 entrée par an, mais on peut en refaire quand on
  veut.
* **UX** : parcours guidé question par question, comme tourner les
  pages du carnet. Auto-save chiffrée en `localStorage` pendant la
  saisie.
