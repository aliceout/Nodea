# Module Mood (`mood_entries`)

## Description

Module quotidien pour suivre ton **humeur** et noter des **éléments positifs**.
→ Fréquence : 1 entrée par jour (mais pas obligatoire).
→ UI : formulaire simple avec score, emoji, 3 points positifs, commentaire facultatif.
→ Sécurité : comme tous les modules → chiffrement côté client, guard HMAC, création en 2 temps.

---

## Payload clair attendu

```json
{
  "date": "YYYY-MM-DD",
  "mood_score": "<-2..+2|string|number>", // humeur globale (-2 = très négatif, +2 = très positif)
  "mood_emoji": "🙂",                     // un emoji pour représenter l’état
  "positive1": "string",                  // élément positif #1
  "positive2": "string",                  // élément positif #2
  "positive3": "string",                  // élément positif #3
  "comment": "string|optional",           // texte libre
  "question": "string|optional",          // question posée ce jour-là (ex. introspection)
  "answer": "string|optional"             // réponse à la question
}
```

---

## Export / Import

* Export clair = tableau `modules.mood[]` dans `export.json`.
* Import = re-chiffrement local + flux création en 2 temps.
* Jamais exportés : `payload` chiffré, `cipher_iv`, `guard`, `id`.

**Exemple d’export clair :**

```json
{
  "modules": {
    "mood": [
      {
        "date": "2025-08-20",
        "mood_score": 1,
        "mood_emoji": "😊",
        "positive1": "Balade avec Eva",
        "positive2": "Avancé sur Nodea",
        "positive3": "Bon repas",
        "comment": "Journée plutôt calme et constructive",
        "question": "Qu’est-ce qui m’a donné de l’énergie ?",
        "answer": "Le soleil et les échanges avec Anouk"
      }
    ]
  }
}
```

---

## Points clés

* **Rythme** : une entrée = une journée, mais optionnel (pas de contrainte stricte).
* **Clair** : champ date, score, emoji + 3 positifs (structurés pour encourager la gratitude).
* **Libre** : zone commentaire + couple question/réponse (pour introspection).
* **Sécurité** : serveur ne voit jamais le clair (tout est chiffré AES-GCM côté client, guard HMAC côté serveur pour update/delete).
* **Export** : simple et lisible, comme Goals/Review.
