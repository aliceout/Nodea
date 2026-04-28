# Internationalisation

Le client utilise un provider React maison
([`packages/web/src/i18n/I18nProvider.jsx`](../packages/web/src/i18n/I18nProvider.jsx))
qui charge toutes les ressources de traduction depuis des fichiers
JSON statiques. La langue active est conservée dans `localStorage`
(`nodea:language`) et peut être changée depuis la page **Paramètres
→ Langue de l'application**.

Langues actuellement supportées : **français** (`fr`, défaut),
**anglais** (`en`).

## Structure des ressources

```
packages/web/src/i18n/
├── I18nProvider.jsx
└── locales/
    ├── fr/
    │   ├── auth.json
    │   ├── common.json
    │   ├── home.json
    │   ├── modules.json
    │   ├── settings.json
    │   └── ... (~13 namespaces)
    └── en/
        └── ... (mêmes fichiers, mêmes clés)
```

Chaque fichier JSON est un namespace (`auth`, `common`, `home`, …).
Les clés sont stables ; ce sont les valeurs qui changent par
langue.

## Ajouter une nouvelle langue

1. **Créer les fichiers de ressources**
   - Dupliquer `packages/web/src/i18n/locales/fr/` vers
     `packages/web/src/i18n/locales/<code ISO>/`.
   - Remplir chaque fichier JSON avec les traductions
     correspondantes ; conserver les mêmes clés. Les valeurs
     manquantes retombent sur le français.

2. **Enregistrer la langue dans le provider**
   - Dans [`I18nProvider.jsx`](../packages/web/src/i18n/I18nProvider.jsx),
     importer chaque JSON de la nouvelle langue et l'ajouter aux
     constantes `RESOURCES` et `SUPPORTED_LANGUAGES` (clé ISO +
     label humain affiché dans le sélecteur).

3. **Mettre à jour le sélecteur de langue**
   - Le composant `LanguagePreferences` (sous Settings) lit
     `availableLanguages` exposé par le provider — vérifier que
     le label défini dans `SUPPORTED_LANGUAGES` est celui qui
     doit s'afficher dans la liste.

4. **Traduire les textes encore en dur**
   - `rg "[\"']" packages/web/src/app` pour repérer les chaînes
     littérales dans les composants. Remplacer par
     `t('namespace.key')`.

5. **Tester la bascule**
   - Lancer le dev (`pnpm dev`), aller dans **Paramètres →
     Langue**, sélectionner la nouvelle langue et vérifier que
     l'interface reflète bien le changement (le store Zustand
     persiste la sélection au prochain reload).

## Notes

- Les langues sont chargées **statiquement** : toute nouvelle
  ressource doit être importée à la main dans `I18nProvider`.
- La synchronisation cross-device de la langue passerait par
  `user_preferences` (table chiffrée déjà en place) —
  fonctionnalité non implémentée à ce jour, la sélection reste
  locale au navigateur.
- Conserver les fichiers JSON en **UTF-8 sans BOM**, accents
  préservés (les fichiers FR contiennent `é`, `à`, `ç`, etc.
  directement, pas d'échappement Unicode).
- Inclusivité française : `utilisateur.ice.s` pour les humain·e·s,
  jamais pour les objets (« un critère actif », pas « actif·ve »).
