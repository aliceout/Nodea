# Normalisation de l’interface Nodea

## Design tokens
- Surfaces `--surface-default`, `--surface-muted`, `--surface-inverse`, etc. gèrent les fonds light/dark.
- Couleurs de texte `--text-primary`, `--text-secondary`, `--text-muted` et accents (`--accent-primary`, `--accent-info`, ...).
- Bordures (`--border-default`, `--border-strong`) et ombres (`--shadow-xs`, `--shadow-sm`, `--shadow-md`).
- Rayons (`--radius-sm|md|lg`) et espacements internes (`--surface-padding-*`).

> Tous les tokens sont définis dans `frontend/src/ui/theme/global.css` et s’adaptent automatiquement au thème clair/sombre.

## Atomes réutilisables
- `Surface` (`@/ui/atoms/layout/Surface.jsx`)
  - Props: `tone` (`base|muted|subtle|inverse`), `border`, `padding`, `radius`, `shadow`, `interactive`.
  - Utiliser pour tout conteneur qui doit gérer fond + bordure + hover.
- `SurfaceCard` (`@/ui/atoms/specifics/SurfaceCard.jsx`)
  - Surcouche de `Surface` avec gestion `title`, `description`, `bodyClassName`.
- `SectionHeader` (`@/ui/atoms/typography/SectionHeader.jsx`)
  - Titre + description + zone d’actions optionnelles. À placer en tête de chaque section de page.
- `Badge` (`@/ui/atoms/feedback/Badge.jsx`)
  - Variantes `neutral | info | success | warning | danger`.
- `TableShell` (`@/ui/atoms/data/TableShell.jsx`)
  - Encapsule une table HTML et applique bordures/hover/espacement cohérent.
- `FormField` (wrapper) + `Input`/`Textarea`
  - Les champs utilisent désormais les tokens; toujours envelopper dans un `Surface` ou un formulaire pour conserver les espacements.

## Patterns de composition
- Une page = `Surface` globale (ou fond `bg-surface-subtle` via body) + `Subheader`.
- Chaque section débute par `SectionHeader`, suivi d’un ou plusieurs `SurfaceCard`.
- Les listes de cartes (modules, annonces, etc.) utilisent `SurfaceCard interactive` pour gérer les hover uniformes.
- Les tables s’appuient sur `TableShell`; les boutons d’action à l’intérieur utilisent `Button` en mode `unstyled` + classes tokens.
- Les badges de statut (module actif/inactif) passent par `Badge`.

## Règles d’usage
1. **Pas de couleurs directes** (`#fff`, `text-gray-500`, etc.) : privilégier les tokens via classes ou CSS utilitaires.
2. **Hover/Focus** : utiliser l’attribut `interactive` de `Surface`/`SurfaceCard` ou des classes basées sur les tokens (`hover:text-[var(--accent-info)]`).
3. **Nouveau composant ?** vérifier si un atome existe déjà. Sinon, créer l’atome sous `ui/atoms/` en s’appuyant sur `Surface` ou les tokens plutôt que de dupliquer la mise en forme.
4. **I18n** : tous les titres/descriptions de sections passent dans `SectionHeader` et sont traduits (`home.sections.*`, `admin.sections.*`, etc.).
5. **Documentation** : toute nouvelle variante doit être ajoutée ici pour garder la cohérence.

## À faire / suivi
- Étendre la normalisation à tous les formulaires (ChangePassword, Import/Export) avec `FormField`.
- Harmoniser les boutons (`Button`) autour d’un futur jeu de variantes (`primary`, `secondary`, `ghost`).
- Ajouter un Storybook ou un catalogue minimal pour visualiser les atomes.
