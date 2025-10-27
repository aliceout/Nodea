# Module Mood (`mood_entries`)

## Description fonctionnelle

Module quotidien pour suivre l’humeur et consigner trois éléments positifs.  
- Rythme idéal : une entrée par jour (facultatif).  
- UI : score d’humeur (−2 à +2), emoji, trois positifs, commentaire facultatif, éventuellement une question/réponse d’introspection.

## Payload clair attendu

```json
{
  "date": "YYYY-MM-DD",
  "mood_score": "<-2..+2|string|number>",
  "mood_emoji": "🙂",
  "positive1": "string",
  "positive2": "string",
  "positive3": "string",
  "comment": "string|optional",
  "question": "string|optional",
  "answer": "string|optional"
}
```

Les champs `positive1..3` sont requis (objectif « gratitude »). `question`/`answer` alimentent les modules d’analyse ultérieurs.

## Sécurité

- Chiffrement AES-GCM avec la clé maîtresse (CryptoKey non extractible).  
- Guard HMAC dérivé de la clé maîtresse + `module_user_id + id`.  
- Création en deux temps (`POST guard:"init"` puis `PATCH` promotion).  
- Update/Delete nécessitent `?sid=<module_user_id>&d=<guard>`.  
- Le cache de guards (`nodea.guards.v1`) est purgé au login/logout.

## Export / Import

- Export clair : tableau `modules.mood[]` dans `export.json`.  
- Import : re-chiffre localement puis rejoue `POST` + promotion.  
- Les plugins `core/utils/ImportExport/Mood.jsx` :  
  - détectent les doublons via `date` (`getNaturalKey`).  
  - paginent les lectures (`perPage=200`).  
  - ignorent les payloads illisibles (log local uniquement).  

### Exemple d’export

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

## Points clés

1. Une entrée = une journée (mais pas obligatoire).  
2. Serveur aveugle : le contenu clair n’existe qu’après déchiffrement dans le navigateur.  
3. Les guards empêchent toute modification serveur sans la clé maîtresse.  
4. L’export clair est lisible et réimportable sans perte.
