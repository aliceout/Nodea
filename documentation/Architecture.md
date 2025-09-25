# Architecture Frontend - Réorganisation proposée

## Vision générale

Cette architecture propose une réorganisation du frontend actuel basée sur une séparation claire des responsabilités avec les dossiers `core`, `ui`, `app`, et `features`.

## Structure proposée

```
frontend/src/
├── core/                     # Logique métier et services de base
│   ├── api/                  # Services d'API
│   │   ├── pocketbase.js
│   │   ├── pb-records.js
│   │   └── modules-config.js
│   ├── auth/                 # Authentification
│   │   ├── useAuth.js
│   │   ├── guards.js
│   │   └── ProtectedRoute.jsx
│   ├── crypto/               # Services de cryptographie
│   │   ├── crypto-utils.js
│   │   ├── webcrypto.js
│   │   └── guards.js
│   ├── store/                # État global
│   │   ├── StoreProvider.jsx
│   │   ├── actions.js
│   │   ├── reducer.js
│   │   ├── selectors.js
│   │   └── modulesRuntime.js
│   ├── hooks/                # Hooks personnalisés partagés
│   │   ├── useMainKey.jsx
│   │   ├── useUsers.js
│   │   ├── useJournalEntries.js
│   │   └── useBootstrapModulesRuntime.js
│   ├── types/                # Types et interfaces (si TypeScript)
│   └── utils/                # Utilitaires généraux
│       ├── import-export.js
│       └── validation.js
├── ui/                       # Composants d'interface réutilisables
│   ├── components/           # Composants de base
│   │   ├── Button/
│   │   │   ├── Button.jsx
│   │   │   └── Button.module.css
│   │   ├── Input/
│   │   │   ├── Input.jsx
│   │   │   ├── SuggestInput.jsx
│   │   │   └── DateMonthPicker.jsx
│   │   ├── Form/
│   │   │   ├── FormError.jsx
│   │   │   ├── Select.jsx
│   │   │   └── Textarea.jsx
│   │   ├── Display/
│   │   │   ├── Card.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── Alert.jsx
│   │   └── Actions/
│   │       └── EditDeleteActions.jsx
│   ├── layout/               # Composants de layout
│   │   ├── Layout.jsx
│   │   ├── Header/
│   │   │   ├── Header.jsx
│   │   │   ├── HeaderNav.jsx
│   │   │   ├── UserAvatar.jsx
│   │   │   └── UserMenu.jsx
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.jsx
│   │   │   └── SideLinks.jsx
│   │   ├── Navigation/
│   │   │   ├── Navigation.jsx
│   │   │   ├── SubNavDesktop.jsx
│   │   │   └── SubNavMobile.jsx
│   │   └── Subheader.jsx
│   ├── feedback/             # Composants de retour utilisateur
│   │   ├── OnboardingModal.jsx
│   │   ├── KeyMissingModal.jsx
│   │   └── SettingsCard.jsx
│   └── branding/             # Éléments de marque
│       └── LogoLong.jsx
├── app/                      # Configuration et point d'entrée
│   ├── App.jsx               # Composant racine
│   ├── router/               # Configuration du routage
│   │   ├── routes.jsx
│   │   └── guards.jsx
│   ├── config/               # Configuration globale
│   │   ├── modules_list.jsx
│   │   ├── constants.js
│   │   └── env.js
│   ├── providers/            # Providers de contexte
│   │   └── AppProviders.jsx
│   └──                       # (pas de données locales ici — voir src/i18n pour les traductions)
├── features/                 # Modules fonctionnels
│   ├── auth/                 # Feature d'authentification
│   │   ├── Root.jsx          # entrée de la feature (remplace index.jsx)
│   │   ├── views/
│   │   │   ├── Login.jsx
│   │   │   ├── Register.jsx
│   │   │   └── ChangePassword.jsx
│   │   ├── components/
│   │   └── hooks/
│   ├── homepage/             # Page d'accueil
│   │   ├── Root.jsx
│   │   ├── views/
│   │   │   └── Homepage.jsx
│   │   └── components/
│   ├── account/              # Gestion du compte
│   │   ├── Root.jsx
│   │   ├── views/
│   │   │   └── AccountPage.jsx
│   │   ├── components/
│   │   │   ├── ChangeEmail.jsx
│   │   │   ├── ChangeUsername.jsx
│   │   │   ├── DeleteAccount.jsx
│   │   │   ├── ExportData.jsx
│   │   │   ├── ImportData.jsx
│   │   │   └── PasswordReset.jsx
│   │   └── hooks/
│   ├── admin/                # Administration
│   │   ├── Root.jsx
│   │   ├── views/
│   │   │   └── Admin.jsx
│   │   ├── components/
│   │   │   ├── InviteCode.jsx
│   │   │   └── UserTable.jsx
│   │   └── hooks/
│   ├── settings/             # Paramètres
│   │   ├── Root.jsx
│   │   ├── views/
│   │   │   └── Settings.jsx
│   │   └── components/
│   ├── mood/                 # Module Mood
│   │   ├── Root.jsx
│   │   ├── views/
│   │   │   ├── Form.jsx
│   │   │   ├── History.jsx
│   │   │   ├── Graph.jsx
│   │   ├── components/
│   │   │   ├── Comment.jsx
│   │   │   ├── Mood.jsx
│   │   │   ├── Positives.jsx
│   │   │   ├── Question.jsx
│   │   │   ├── Chart.jsx
│   │   │   ├── ChartBody.jsx
│   │   │   ├── Frame.jsx
│   │   │   ├── Entry.jsx
│   │   │   ├── Filters.jsx
│   │   │   └── List.jsx
│   │   ├── services/
│   │   │   └── Mood.js
│   │   ├── importExport/
│   │   │   └── Mood.jsx      # déplacé depuis services/ImportExport/Mood.jsx
│   │   └── types/
│   ├── goals/                # Module Goals
│   │   ├── Root.jsx
│   │   ├── views/
│   │   │   ├── Form.jsx
│   │   │   └── History.jsx
│   │   ├── components/
│   │   │   ├── Card.jsx
│   │   │   ├── EditCard.jsx
│   │   │   ├── Filters.jsx
│   │   │   └── List.jsx
│   │   ├── services/
│   │   │   └── Goals.js
│   │   ├── importExport/
│   │   │   └── Goals.jsx     # déplacé depuis services/ImportExport/Goals.jsx
│   │   └── types/
│   └── passage/              # Module Passage
│       ├── Root.jsx
│       ├── views/
│       │   ├── Form.jsx
│       │   └── History.jsx
│       ├── components/
│       ├── services/
│       │   └── Passage.js
│       ├── importExport/
│       │   └── Passage.jsx   # déplacé depuis services/ImportExport/Passage.jsx
│       └── types/
├── i18n/                     # Traductions (i18n)
│   ├── fr/
│   │   └── questions.json    # locale par défaut actuelle
│   ├── en/
│   │   └── questions.json
│   ├── locales.js            # liste des locales supportées (optionnel)
│   └── index.js              # utilitaire de chargement (optionnel)
└── assets/                   # Ressources statiques
    ├── images/
    └── styles/
        ├── global.css
        ├── theme.css
        └── index.css
```

## Principes de l'architecture

### 1. Core - Logique métier centrale
- **api/** : Services d'accès aux données (PocketBase, configuration modules)
- **auth/** : Gestion de l'authentification et des routes protégées
- **crypto/** : Services de chiffrement/déchiffrement
- **store/** : État global de l'application (Redux/Context)
- **hooks/** : Hooks personnalisés réutilisables dans toute l'app
- **utils/** : Fonctions utilitaires générales
    - inclut les utilitaires partagés d'import/export (ex. `core/utils/importExport/{utils.js, registry.data.js}`) déplacés depuis `services/ImportExport/`

### 2. UI - Composants d'interface
- **components/** : Composants réutilisables organisés par fonction
- **layout/** : Structure et navigation de l'application
- **feedback/** : Modales, alertes, notifications
- **branding/** : Éléments visuels de marque

### 3. App - Configuration et orchestration
- **App.jsx** : Point d'entrée principal
- **router/** : Configuration des routes
- **config/** : Variables de configuration, constantes
- **providers/** : Providers de contexte globaux

### 4. Features - Modules fonctionnels
Chaque feature est organisée selon le même pattern :
- **pages/** : Composants de page principaux
- **components/** : Composants spécifiques à la feature
- **hooks/** : Hooks métier spécifiques
- **services/** : Logique business et API calls
- **types/** : Types spécifiques (si TypeScript)

### 5. i18n — Traductions
- Dossier centralisé pour les traductions de l'application.
- Fichiers par langue, ex. `src/i18n/fr/questions.json`, `src/i18n/en/questions.json` avec les mêmes clés.
- Chargement recommandé via import dynamique selon la locale (ex. `import(\`../i18n/${locale}/questions.json\`)`) avec fallback sur une locale par défaut.
- Optionnel: exposer `src/i18n/index.js` (loader qui gère le fallback) et `src/i18n/locales.js` (locales supportées).

#### Nommage et emplacement
- Nom du dossier: `i18n` plutôt que `data` car explicite et standard pour les traductions.
- Emplacement: sous `src/` afin de bénéficier des imports statiques, du bundling (Vite), du HMR et d'éviter de mélanger les traductions avec des assets bruts.

## Avantages de cette architecture

### 1. Séparation claire des responsabilités
- **Core** : logique métier réutilisable
- **UI** : composants découplés de la logique
- **Features** : modules autonomes et maintenables

### 2. Réutilisabilité et maintenabilité
- Composants UI indépendants et testables
- Services centralisés dans core/
- Features modulaires et extensibles

### 3. Évolutivité
- Ajout facile de nouvelles features
- Modification de l'UI sans impact sur la logique
- Tests unitaires simplifiés

### 4. Cohérence avec les principes du projet
- Respect de la modularité (modules Mood, Goals, Passage)
- Préservation de la sécurité (crypto/ centralisé)
- Structure adaptée au système d'authentification et de chiffrement

## Migration progressive

Cette architecture peut être adoptée progressivement :

1. **Phase 1** : Créer les nouveaux dossiers et migrer les services (core/)
2. **Phase 2** : Réorganiser les composants UI selon la nouvelle structure
3. **Phase 3** : Restructurer les modules en features autonomes
4. **Phase 4** : Centraliser la configuration dans app/
5. **Phase 5 (i18n)** : Déplacer `src/data/questions.json` (actuel) vers `src/i18n/fr/questions.json`, ajouter d'autres locales si besoin, et introduire un petit loader pour sélectionner la locale (avec fallback). Si `src/data/` n'existe pas encore, créer directement `src/i18n/fr/questions.json`.

Cette approche permet de maintenir l'application fonctionnelle pendant la migration tout en améliorant progressivement l'organisation du code.

Note importante — portée de la réorganisation:
- Cette réorga ne crée aucun nouveau fichier métier. Elle déplace uniquement l’existant.
- En particulier: `frontend/src/services/dataModules/{Mood,Goals,Passage}.js` deviennent `frontend/src/features/{mood,goals,passage}/services/{Mood,Goals,Passage}.js`.
- Les composants d’import/export sont déplacés dans chaque feature: `frontend/src/services/ImportExport/{Mood,Goals,Passage}.jsx` deviennent `frontend/src/features/{mood,goals,passage}/importExport/{Mood,Goals,Passage}.jsx`. Les utilitaires partagés `registry.data.js` et `utils.js` sont déplacés en `frontend/src/core/utils/importExport/`.
- Aucun nouveau hook spécifique par feature n’est introduit à ce stade.

### Détails des déplacements (exhaustif)

Mood
- Avant
    - Vues: `frontend/src/modules/Mood/{Form.jsx,History.jsx,Graph.jsx}`
    - Composants: `frontend/src/modules/Mood/components/{FormComment.jsx,FormMood.jsx,FormPositives.jsx,FormQuestion.jsx,GraphChart.jsx,GraphChartBody.jsx,GraphFrame.jsx,HistoryEntry.jsx,HistoryFilters.jsx,HistoryList.jsx}`
    - Service: `frontend/src/services/dataModules/Mood.js`
    - Import/Export: `frontend/src/services/ImportExport/Mood.jsx`
- Après
    - Vues: `frontend/src/features/mood/views/{Form.jsx,History.jsx,Graph.jsx}`
    - Composants (noms simplifiés): `frontend/src/features/mood/components/{Comment.jsx,Mood.jsx,Positives.jsx,Question.jsx,Chart.jsx,ChartBody.jsx,Frame.jsx,Entry.jsx,Filters.jsx,List.jsx}`
        - Renames: GraphChart→Chart, GraphChartBody→ChartBody, GraphFrame→Frame, HistoryEntry→Entry, HistoryFilters→Filters, HistoryList→List
        - Renames: FormComment→Comment, FormMood→Mood, FormPositives→Positives, FormQuestion→Question
    - Service: `frontend/src/features/mood/services/Mood.js`
    - Import/Export: `frontend/src/features/mood/importExport/Mood.jsx`

Goals
- Avant
    - Vues: `frontend/src/modules/Goals/{Form.jsx,History.jsx}`
    - Composants: `frontend/src/modules/Goals/components/{HistoCard.jsx,HistoEditCard.jsx,HistoFilters.jsx,HistoList.jsx}`
    - Service: `frontend/src/services/dataModules/Goals.js`
    - Import/Export: `frontend/src/services/ImportExport/Goals.jsx`
- Après
    - Vues: `frontend/src/features/goals/views/{Form.jsx,History.jsx}`
    - Composants (noms simplifiés): `frontend/src/features/goals/components/{Card.jsx,EditCard.jsx,Filters.jsx,List.jsx}`
        - Renames: HistoCard→Card, HistoEditCard→EditCard, HistoFilters→Filters, HistoList→List
    - Service: `frontend/src/features/goals/services/Goals.js`
    - Import/Export: `frontend/src/features/goals/importExport/Goals.jsx`

Passage
- Avant
    - Vues: `frontend/src/modules/Passage/{Form.jsx,History.jsx}`
    - Service: `frontend/src/services/dataModules/Passage.js`
    - Import/Export: `frontend/src/services/ImportExport/Passage.jsx`
- Après
    - Vues: `frontend/src/features/passage/views/{Form.jsx,History.jsx}`
    - Service: `frontend/src/features/passage/services/Passage.js`
    - Import/Export: `frontend/src/features/passage/importExport/Passage.jsx`