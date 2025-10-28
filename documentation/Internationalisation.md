## Gestion de l’internationalisation

L’application client utilise un provider React maison (`frontend/src/i18n/I18nProvider.jsx`) qui charge toutes les ressources de traduction à partir de fichiers JSON. La langue active est conservée dans `localStorage` (`nodea:language`) et peut être changée via la page **Paramètres**.

### Ajouter une nouvelle langue

1. **Créer les fichiers de ressources**  
   - Dupliquer la structure existante de `frontend/src/i18n/locales/fr/` vers un nouveau dossier `frontend/src/i18n/locales/<code ISO>/`.  
   - Remplir chaque fichier JSON avec les traductions correspondantes (garder les mêmes clés).

2. **Enregistrer la langue dans le provider**  
   - Dans `frontend/src/i18n/I18nProvider.jsx`, importer les JSON de la nouvelle langue et les ajouter dans les constantes `RESOURCES` et `SUPPORTED_LANGUAGES` (clé ISO + label humain).

3. **Mettre à jour le sélecteur de langue**  
   - Le composant `Settings/components/LanguagePreferences.jsx` s’appuie sur `availableLanguages` fourni par le provider. Vérifier que le label ajouté dans `SUPPORTED_LANGUAGES` est celui qui doit s’afficher dans la liste.

4. **Traduire les textes métier**  
   - Rechercher les chaînes encore en dur (`rg "\"`) et les remplacer par des clés i18n au besoin.

5. **Tester la bascule**  
   - Aller dans la page **Paramètres → Langue de l’application**, sélectionner la nouvelle langue et vérifier que l’interface reflète bien le changement.

### Notes

- Les langues étant chargées statiquement, toute nouvelle ressource doit être importée manuellement dans `I18nProvider`.  
- Si l’on souhaite synchroniser la langue entre plusieurs appareils, prévoir une persistance côté PocketBase (non implémenté actuellement).  
- Pour éviter les problèmes d’encodage, conserver les fichiers JSON en UTF-8 et limiter les caractères spéciaux au strict nécessaire (pas de BOM).
