# Architecture Frontend – État ACTUEL (septembre 2025)

Ce document reflète l'état réel du code après les réorganisations partielles et la « mise sous gel » décidée. Il remplace l'ancienne proposition (basée sur un dossier `features/`) qui n'a pas été totalement mise en œuvre. Aucune section ci‑dessous n'est spéculative : uniquement ce qui existe réellement dans le dépôt.

## Vue d'ensemble des couches

```
frontend/src/
├── main.jsx
├── core/                 # Services, logique transversale et runtime modules
│   ├── api/
│   │   ├── pocketbase.js
│   │   ├── pb-records.js
│   │   ├── modules-config.js
│   │   └── modules/      # Services data chiffrés (Goals, Mood, Passage)
│   │       ├── Goals.js
│   │       ├── Mood.js
│   │       └── Passage.js
│   ├── auth/
│   │   ├── ProtectedRoute.jsx
│   │   └── useAuth.js
│   ├── crypto/
│   │   ├── crypto-utils.js
│   │   ├── guards.js
│   │   └── webcrypto.js
│   ├── hooks/
│   │   ├── useBootstrapModulesRuntime.js
│   │   └── useMainKey.jsx
│   ├── store/
│   │   ├── StoreProvider.jsx
│   │   ├── actions.js
│   │   ├── modulesRuntime.js
│   │   ├── reducer.js
│   │   └── selectors.js
│   └── utils/
│       └── ImportExport/
│           ├── Goals.jsx
│           ├── Mood.jsx
│           ├── Passage.jsx
│           ├── registry.data.js
│           └── utils.js
├── ui/                   # Composants UI (atomes & layout)
│   ├── atoms/
│   │   ├── base/         # Atomes génériques d'affichage
│   │   │   ├── Alert.jsx
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   └── Modal.jsx
│   │   ├── form/         # Champs / éléments de formulaire
│   │   │   ├── DateMonthPicker.jsx
│   │   │   ├── FormError.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── Select.jsx
│   │   │   ├── SuggestInput.jsx
│   │   │   └── Textarea.jsx
│   │   ├── actions/
│   │   │   └── EditDeleteActions.jsx
│   │   └── specifics/    # Atomes contextuels (restés hors "features")
│   │       ├── KeyMissingModal.jsx
│   │       ├── OnboardingModal.jsx
│   │       └── SurfaceCard.jsx
│   ├── branding/
│   │   └── LogoLong.jsx
│   ├── layout/
│   │   ├── Layout.jsx
│   │   ├── headers/
│   │   │   ├── Header.jsx
│   │   │   └── Subheader.jsx
│   │   ├── navigation/
│   │   │   ├── Navigation.jsx
│   │   │   └── Sidebar.jsx
│   │   └── components/   # Fragments de header/navigation
│   │       ├── HeaderNav.jsx
│   │       ├── SideLinks.jsx
│   │       ├── SubNavDesktop.jsx
│   │       ├── SubNavMobile.jsx
│   │       ├── UserAvatar.jsx
│   │       └── UserMenu.jsx
│   └── theme/
│       ├── global.css
│       ├── index.css
│       └── theme.css
├── app/                  # Orchestration application & flux fonctionnels
│   ├── App.jsx
│   ├── config/
│   │   └── modules_list.jsx
│   ├── flow/             # (Remplace l'idée de /features pour l'instant)
│   │   ├── Homepage/
│   │   │   └── index.jsx
│   │   ├── Account/
│   │   │   ├── components/
│   │   │   └── index.jsx
│   │   ├── Admin/
│   │   │   ├── components/
│   │   │   └── index.jsx
│   │   ├── Goals/
│   │   │   ├── components/
│   │   │   ├── views/
│   │   │   └── index.jsx
│   │   ├── Mood/
│   │   │   ├── components/
│   │   │   ├── views/
│   │   │   └── index.jsx
│   │   ├── Passage/
│   │   │   ├── views/
│   │   │   └── index.jsx
│   │   └── Settings/
│   │       ├── components/
│   │       └── index.jsx
│   └── pages/            # Pages transverses (auth / erreur)
│       ├── ChangePassword.jsx
│       ├── Login.jsx
│       ├── NotFound.jsx
│       └── Register.jsx
└── i18n/
    └── fr/
        └── Mood/
            └── questions.json
```

## Différences majeures vs la proposition initiale

1. Pas de dossier `features/` : les flux fonctionnels sont concentrés dans `app/flow/`.
2. Les services métier (Goals, Mood, Passage) sont centralisés dans `core/api/modules/` au lieu de dossiers dédiés par fonctionnalité.
3. Les composants d'import/export (Goals, Mood, Passage) sont dans `core/utils/ImportExport/` et non rapprochés de leur logique d'affichage.
4. Les modales spécifiques (KeyMissing, Onboarding) et `SurfaceCard` restent classées comme atomes "specifics" faute de stratégie de rattachement feature finalisée.
5. L'i18n est minimal (une seule locale `fr/Mood/questions.json`). Pas de mécanisme dynamique généralisé ni d'index d'agrégation.

## Organisation logique actuelle

### core/
Rassemble toutes les couches techniques partagées : accès PocketBase, cryptographie (clé maîtresse, CryptoKey non extractibles, dérivation de guards), état global, runtime des modules chiffrés et utilitaires d'import/export (incluant registre et helpers).  
Fichiers clés :
- `core/crypto/main-key.js` → import/wipe de la clé maîtresse (CryptoKey AES/HMAC).  
- `core/crypto/guards.js` → deriveGuard + cache local (purge login/logout).  
- `core/crypto/webcrypto.js` → primitives (Argon2id, AES-GCM, `decryptWithRetry`).  
- `core/store/StoreProvider.jsx` → détient `state.mainKey`, gère `markMissing()` (logout immédiat).  
Cette centralisation vise la simplicité mais mélange encore logique pure et adaptations modules (voir `utils/ImportExport/*`).

### ui/
Séparé en sous-niveaux :
- atoms/base & atoms/form : découpage effectué pour clarifier les composants basiques vs formulaires.
- atoms/actions : action group (édition/suppression).
- atoms/specifics : éléments transverses restant dépendants de la sécurité (modales clé manquante / onboarding) ou d'une feature (SurfaceCard) non encore isolés.
- layout : structure visuelle et navigation (normalisée : `headers/`, `navigation/`, `components/`).

### app/
Point d'entrée (`App.jsx`), configuration (`modules_list.jsx`) et répertoire `flow/` qui sert d'espace intermédiaire pour regrouper pages/ vues / composants de chaque domaine (Account, Admin, Goals, Mood, Passage, Settings, Homepage). Cette approche hybride remplace temporairement le concept de "feature modules".

### i18n/
Actuellement limité à `fr/Mood/questions.json`. Aucune abstraction de chargement. L'étendue réelle étant faible, la dette est maîtrisée mais documentée.

## Principes de structuration (tels qu'appliqués aujourd'hui)

1. Centralisation sécurité & data dans `core/` (crypto + services PB + store).
2. UI atomisée avec un début de classification (base/form/actions/specifics) – pas encore totalement stabilisée.
3. Flux fonctionnels regroupés sous `app/flow/` pour limiter la surface des refactors non finalisés.
4. Imports uniformisés vers les alias `@/core`, `@/ui`, `@/app` (nettoyage des anciens chemins `@/services/*`).
5. Aucun code mort conservé côté atoms (suppression des doubles exports par réexport interne qui causaient l'erreur Vite « Multiple exports with the same name 'default' »).

## Dette / Incohérences identifiées

| Sujet | État actuel | Risque | Piste future (optionnelle) |
|-------|-------------|--------|-----------------------------|
| Absence de `features/` | Flux dans `app/flow/` | Croissance difficile | Extraire progressivement chaque flux en `features/<nom>` |
| ImportExport centralisé | Couplage modules ↔ core | Mélange couches | Déplacer chaque `<Module>.jsx` près de sa future feature |
| atoms/specifics | Mélange UI + logique (clé manquante) | Difficulté test | Promouvoir en organisms/ ou rattacher aux features |
| i18n minimal | 1 fichier FR isolé | Scalabilité faible | Introduire loader + structure locales/en/* |
| services modules centralisés | Partage OK mais feature isolation absente | Refactor futur coûteux | Garder API stable avant extraction |

## Convention d'import (actuelle)

Exemples (réel) :
```
import pocketbase from "@/core/api/pocketbase";
import { listGoals } from "@/core/api/modules/Goals";
import Button from "@/ui/atoms/base/Button";
import Layout from "@/ui/layout/Layout";
import GoalsView from "@/app/flow/Goals/views/History";
```
Règle : ne plus utiliser d'anciens chemins `@/services/...` ni de doubles réexports locaux.

## Lignes rouges actuelles (gel temporaire)

- Pas de création de `features/` sans décision explicite.
- Pas de déplacement supplémentaire d'atomes sans justification (impact sur imports important).
- Ne pas fragmenter `ImportExport/` tant que l'intégration chiffrée n'est pas revalidée test.

## Étapes futures (OPTIONNEL – hors périmètre immédiat)

1. Stabiliser tests d'intégrité (import/export + dérivation clé) avant tout refactor structurel additionnel.
2. Introduire `features/` en migrant un flux pilote (ex: Mood) pour valider pattern.
3. Déplacer ImportExport de Mood/Goals/Passage proche de leurs vues une fois les features extraites.
4. Normaliser modales spécifiques (dossier `ui/organisms/` si pattern récurrent).
5. Étendre i18n (en/, loader dynamique, fallback) si besoin produit.

## Résumé

Le code reflète une transition incomplète : logique consolidée dans `core/`, UI clarifiée, flux fonctionnels encore agrégés dans `app/flow/`. Ce document sert désormais de référence de vérité pour l'état présent (et remplace la version « proposition »). Toute évolution ultérieure devra partir de cette base.
