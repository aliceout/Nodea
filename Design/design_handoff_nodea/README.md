# Handoff — Nodea (direction K · Sauge)

## Vue d'ensemble

Nodea est un carnet personnel privé : moods (humeurs notées + tags), passages (citations de livres),
goals, habits, library (lectures en cours / à lire / terminées) et review (rétrospectives semaine /
mois / année). Tout est chiffré bout en bout côté client, jamais visible côté serveur.

La direction visuelle retenue est **K — Native-app dense, ton Sauge**.

Référence d'esprit : Things 3, Bear, Reflect, Apple Notes. Aucun chrome décoratif (pas de cartes,
pas d'ombres, pas d'icônes décoratives). La hiérarchie vient des marges, du poids de la typo, et
d'un seul accent vert sauge sourd. Le ton est calme, papier, intime — pas SaaS, pas dashboard.

---

## À propos des fichiers de design

Les fichiers livrés dans `source/` sont **des références de design écrites en HTML/JSX** (prototypes
React inline, transpilés au navigateur via Babel standalone). Ils montrent l'intention visuelle et
les comportements attendus. **Ce ne sont pas du code de production à recopier tel quel.**

La tâche est de **recréer ces écrans dans l'environnement cible** (codebase existante : React /
Next.js / Remix / autre — ou, si aucun choix n'a encore été fait, choisir le framework approprié)
en utilisant les patterns, la structure de composants et le système de styles de la codebase.

Ouvrir `preview.html` dans un navigateur pour voir les 8 écrans côte à côte.

## Fidélité

**Hi-fi.** Les couleurs, la typo, les espacements, les border-radius et les animations sont
définitifs. Le développeur doit reproduire l'UI au pixel près.

---

## Design tokens

### Couleurs — mode clair (par défaut)

| Token         | Hex        | Usage                                               |
| ------------- | ---------- | --------------------------------------------------- |
| `bg`          | `#fcfcfa`  | Fond principal (papier crème)                       |
| `bg2`         | `#f5f4f0`  | Fond sidebar, fond hover, fond bouton secondaire    |
| `ink`         | `#161614`  | Texte principal                                     |
| `inkSoft`     | `#3a3a36`  | Texte secondaire (descriptions, labels longs)       |
| `muted`       | `#88857c`  | Texte tertiaire (méta, dates, compteurs)            |
| `mutedSoft`   | `#bcb9b0`  | Bordures de check inactif, placeholders             |
| `hair`        | `#e7e5dd`  | Hairlines (séparateurs, bordures input)             |
| `accent`      | `#5a7a5e`  | **Sauge — accent unique, boutons, links, dot logo** |
| `accentSoft`  | `#dde8de`  | Fond hover/badge accent, cellules grid actives      |
| `accentDeep`  | `#3d5641`  | Hover du primary button, link hover                 |
| `sync`        | `#7a9a7e`  | Dot synchro (pulsation), texte "+6% vs mars"        |

### Couleurs — mode sombre (Accueil · nuit chaude)

| Token         | Hex        | Note                                              |
| ------------- | ---------- | ------------------------------------------------- |
| `bg`          | `#1d1c18`  | Papier la nuit, **pas** un noir bleuté            |
| `bg2`         | `#262520`  | Sidebar, hover                                    |
| `ink`         | `#ece9dc`  | Texte principal (jaune cassé chaud)               |
| `inkSoft`     | `#c5c2b3`  | Texte secondaire                                  |
| `muted`       | `#7d7a6e`  | Méta                                              |
| `mutedSoft`   | `#4a4842`  | Bordures inactives                                |
| `hair`        | `#34322c`  | Hairlines                                         |
| `accent`      | `#9bbf9f`  | **Sauge clarifié pour contraste sur fond sombre** |
| `accentSoft`  | `#2e3a30`  | Fond hover                                        |
| `accentDeep`  | `#bcd9bf`  | Hover button                                      |
| `sync`        | `#9bbf9f`  | Dot synchro                                       |

### Couleurs systémiques (toujours)

- Erreur / zone rouge : `#dc2626` (bouton "Supprimer définitivement")

### Typographie

| Variable | Stack |
| -------- | ----- |
| `sans`   | `"Instrument Sans", "Inter", "SF Pro Text", system-ui, sans-serif` |
| `serif`  | `"Instrument Serif", "Newsreader", Georgia, serif` |
| `mono`   | `"JetBrains Mono", ui-monospace, monospace` |

Le sans est utilisé partout dans l'UI. Le **serif italique** est réservé aux contenus à valeur
émotionnelle : citations de moods, citations de passages, sous-titre éditorial du Login, citation
dans le composer (champ principal). Le mono ne sert qu'aux raccourcis clavier (`<kbd>`).

### Échelle typographique

| Rôle                             | Taille | Weight | Letter-spacing | Line-height |
| -------------------------------- | ------ | ------ | -------------- | ----------- |
| H1 page (Mon compte, Bonjour…)   | 30 px  | 600    | -0.025em       | 1.1         |
| H1 hero (Login, état vide)       | 44–56 px | 600  | -0.03em        | 1.05        |
| Section title (Mood, Passages)   | 18 px  | 600    | -0.015em       | normal      |
| Body / row title                 | 14.5 px | 500   | normal         | normal      |
| Body / liste                     | 13–14 px | 400  | normal         | 1.5         |
| Section label ("À voir", "Mood récent") | 12 px | 600 | 0.02em       | normal      |
| Méta (dates, compteurs)          | 11–12 px | 400  | normal         | normal      |
| Eyebrow (uppercase Library/Review) | 10 px | 600   | 0.06em uppercase | normal    |
| Citation (serif italic)          | 15–17 px italic | 400 | normal       | 1.45–1.5    |
| Hero serif (login subtitle, état vide) | 18 px italic | 400 | normal | 1.5–1.55   |

### Espacements & rayons

- Border radius : `6` (sidebar item, tab), `7` (input, button), `10` (artboard outer), `12` (modal composer)
- Hairline : 1px solid `hair`
- Pas d'ombres dans le shell — **uniquement** le composer modal a une ombre :
  `0 24px 60px rgba(0,0,0,.18), 0 4px 12px rgba(0,0,0,.08)`

### Animations

Toutes définies en CSS via `@keyframes`. Durées 180–450ms, easing `cubic-bezier(.2,.7,.3,1)`.

| Nom                 | Cible                              | Durée  | Détail                                    |
| ------------------- | ---------------------------------- | ------ | ----------------------------------------- |
| Fade up             | `<main>` au mount                  | 420ms  | opacity 0→1, translateY(6px→0)            |
| Slide in (rangée)   | Rangées de la liste "À voir"       | 450ms  | opacity 0→1, translateX(-8px→0), staggered 80ms par rangée |
| Pulse (dot synchro) | Dot vert en bas de sidebar         | 2.4s loop | box-shadow ring qui se diffuse         |
| Bar fill            | Barres d'objectifs                 | 900ms  | width 0→%, delay 200ms + 120ms par barre  |
| Cell pop            | Cellules du habits-grid            | 350ms  | opacity 0→1, scale .6→1, delay 6ms par cellule |
| Streak pulse        | Compteur "12 j"                    | 2.6s loop | opacity 1↔.55                          |
| Hover lift sidebar  | Items sidebar (sauf actif)         | 180ms  | translateX(0→2px) + bg = bg2              |
| Tab content swap    | Contenu Compte au changement onglet | 420ms  | re-mount + fade up (clé React = `tab`)    |
| Composer overlay    | Fond du modal                      | 250ms  | opacity 0→1                               |
| Composer modal      | Modal lui-même                     | 350ms  | opacity 0→1, translateY(-12px→0), scale .98→1 |
| Focus ring input    | Input au focus                     | 180ms  | border = accent, box-shadow 3px accentSoft |
| Check tick          | Click sur rond de tâche            | 200ms  | bg + border passent à accent, line-through sur le label |

---

## Inventaire des écrans

8 écrans hi-fi, tous en 1280 × 800.

### 1. Login (`DirK_Login` avec `tone="sauge"`)

Layout : 2 colonnes — gauche `1fr` (panneau marketing en `bg2`), droite `480px` (formulaire).

**Gauche** :
- En haut : logo (dot 12×12 sauge + "Nodea" 16px/600).
- Centre : H1 "Te revoilà." (56px/600/-0.03em) + sous-titre serif italique 18px en `inkSoft`.
- Bas : trio "Chiffré bout en bout · Auto-hébergé · AGPL-3.0" en `muted` 12px.

**Droite** : "Connexion" eyebrow + "Entre dans ton carnet" (24px/600), 2 inputs (E-mail, Mot de passe), bouton primary pleine largeur, ligne "Mot de passe oublié" / "Créer un compte".

### 2. Accueil (`DirK_Home` avec `tone="sauge"`)

Layout : sidebar `240px` + main `1fr`. Main = 2 colonnes : `1fr` (contenu) + `280px` (aside droite).

**Sidebar** (réutilisée Accueil/Compte) :
- Header logo + "Alice" à droite en méta tabular-nums.
- Section principale : Aujourd'hui (3) **actif**, Mood (116), Passages (42), Goals (5), Habits (4).
- Eyebrow "LIBRARY" + En cours (3), À lire (14), Terminés (38).
- Eyebrow "REVIEW" + Cette semaine, Ce mois, L'année (sans compteur).
- Footer : dot pulsant + "Synchronisé · à l'instant".

**Topbar** : date FR à gauche ("samedi 25 avril 2025 · jour 116"), bouton ⌘K Recherche + bouton primary "+ Nouvelle entrée".

**Main gauche** :
- H1 "Bonjour, Alice." + sous-titre "Trois choses à voir aujourd'hui."
- Liste **À voir** : 3 rangées avec rond cliquable (tâche cochable), titre + méta, heure ou tiret. La première est cochée par défaut.
- Bloc **Mood récent** : citation serif italique + ligne méta (note 7,8 + tags + "il y a 2 h · éditer").
- Bloc **Passage récent** : citation serif + méta livre/page + lien "voir tous les passages".

**Main droite** :
- **Habits** : titre + streak "12 j" pulsant. Grid 15×4 (60 cellules) avec dégradé sauge/accentSoft/bg2/hair selon `Math.sin(i * 1.7)`. Sous le grid : "78% ce mois" + "+6% vs mars" en couleur `sync`.
- **Intentions** : 3 lignes label + % + barre progressive horizontale (3px haute) qui se remplit au mount.
- **En cours de lecture** : 2 livres (titre + auteur + "p. X / Y" tabular-nums).

### 3. Mon compte (`DirK_Account` avec `tone="sauge"`)

Layout : sidebar + main.

**Topbar** : "Paramètres · Mon compte".

**En-tête main** : H1 "Mon compte" + 4 onglets : Identité (actif), Sécurité, Données, Zone rouge.

Le contenu sous les onglets re-monte avec un fade à chaque changement (clé React = ID de l'onglet).

- **Identité** : 2 inputs (Nom d'affichage, E-mail) + boutons Enregistrer/Annuler. À droite : sidebar "En chiffres" (Entrées 428, Série 12 j en accent, Membre depuis mars 2024).
- **Sécurité** : à gauche bloc "Mot de passe" (2 inputs + bouton "Renouveler la clé"). À droite : "Sessions actives · 2" (MacBook = Actuelle pill accent, iPhone = Déconnecter en lien) + bloc 2FA.
- **Données** : 2 colonnes — "Exporter" (CTA primary "Exporter mes données") et "Importer" (zone dashed pour drag-drop).
- **Zone rouge** : eyebrow rouge "Définitif" + H "Pas de retour." + paragraphe d'avertissement + input de confirmation e-mail + bouton rouge "Supprimer définitivement".

### 4. État vide — premier jour (`DirK_Empty`)

Reset complet quand l'utilisateur n'a encore rien saisi.

- Topbar avec date "mardi 22 avril 2025 · jour 1".
- Eyebrow accent "PREMIER JOUR".
- H1 "Une page blanche." (44px).
- Paragraphe serif italique 18px : invitation calme à commencer.
- Deux CTA : primary "Saisir mon premier mood" + secondaire "Faire le tour d'abord".
- Astuce footer avec `<kbd>⌘K</kbd>` mono.

### 5. Composer ⌘K (`DirK_Composer`)

Overlay modal centré au-dessus de l'accueil flouté/atténué.

- Backdrop : `rgba(22,22,20,0.32)`, fade 250ms.
- Modal : 620px, `bg`, radius 12, ombre forte, slide+fade 350ms.
- En haut : 5 pills cliquables — Mood (actif), Passage, Goal, Habit, Note libre. Active = `accentSoft` + `accentDeep`.
- Champ principal : `<textarea>` autofocus, **serif 19px italic**, sans bordures, lignes générées dynamiquement.
- Métadonnées contextuelles selon le type. Pour Mood : ligne "NOTE" + 10 carrés cliquables 1-10 (≤7 actifs en accent), tags inline ("café", "travail", "marche") + pill dashed "+ tag".
- Footer en `bg2` : raccourcis clavier (`↵` envoyer, `esc` annuler) + mention "chiffré localement" + bouton "Enregistrer".

### 6. Mood — vue détail (`DirK_Mood`)

Sidebar (avec **Mood** actif). Main = 2 colonnes.

**Gauche** :
- H1 "Mood" + méta "116 entrées · moyenne mobile **7,2** sur 30 j".
- Bar chart 30 jours : barres `accentSoft`, sauf "aujourd'hui" en `accent`. Hauteur générée par `4 + (sin(i*0.6)+1)*2.5`.
- Liste : grid 110px / 36px / 1fr — date FR, note grosse (700, accentDeep si ≥7), citation serif italique + tags méta. Une ligne par jour, hairline entre.

**Droite** :
- **Filtres** : pills cliquables ("café" actif en accent), tous les autres en `bg2`.
- **Patterns** : 3 lignes "Tu es plus heureuse les samedis / Café & marche corrèlent / Lundi est ton point bas" + delta tabular-nums.

### 7. Passages — groupés par livre (`DirK_Passages`)

Sidebar (Passages actif). Topbar méta "Passages · 42 extraits · 9 livres".

H1 "Passages" + sous-titre "Ce qui mérite d'être relu."

Pour chaque livre (3 dans le mock) :
- En-tête : titre du livre 18px/600, auteur en serif italic 13px en `inkSoft`, année tabular-nums, droite "X passages · tout voir" lien accent.
- Sous chaque livre : grid 40px / 1fr / 90px — "p. N" tabular-nums, citation serif italique 17px/1.5, "il y a X" en `muted`. Hairline entre passages.

### 8. Accueil — nuit chaude (`DirK_HomeDark`)

Identique à l'accueil, palette dark substituée. Le sauge passe à `#9bbf9f`. Le tick d'une tâche cochée est dessiné en `bg` (le fond sombre) sur un disque sauge clarifié — pas en blanc pur, ça crierait.

---

## Composants à factoriser dans la codebase cible

Suggérés (à adapter aux conventions du projet) :

- **`<Shell>`** — sidebar + main + topbar. Reçoit l'item actif + topbar custom.
- **`<Sidebar>`** — 3 sections (principale, Library, Review) + footer sync dot.
- **`<TaskRow>`** — rond cliquable + titre + méta + valeur droite (utilisé partout : tâches, livres, sessions, lignes mood).
- **`<KbdHint>`** — petit `<kbd>` stylé (mono, hairline, bg2).
- **`<HabitsGrid>`** — 60 cellules colorées par valeur.
- **`<ProgressBar>`** — barre horizontale 3px haute, fill animé.
- **`<TabBar>`** — 4 onglets actif/hover.
- **`<ComposerModal>`** — overlay + modal + type-picker + zone d'édition + footer raccourcis.
- **`<EmptyState>`** — eyebrow + H1 + serif paragraph + CTA pair + astuce kbd.
- **`<SyncDot>`** — dot pulsant utilisé dans le footer sidebar.

Pour les animations, conserver les keyframes en CSS (pas de framer-motion nécessaire — tout est très court et déterministe).

---

## Comportements attendus

### Globalement
- Tous les états doivent avoir un hover visible (background `bg2` ou color shift vers `accent`).
- Tous les inputs ont un focus ring : border `accent` + box-shadow `0 0 0 3px accentSoft`.
- Les boutons primary changent de bg à `accentDeep` au hover, descendent de 1px à l'`active`.

### Composer (⌘K)
- Doit être ouvrable depuis n'importe quelle page via le raccourci ⌘K (à brancher au router/global).
- `Esc` ferme. `Cmd+Enter` ou `Enter` (selon préférence) enregistre.
- Auto-focus sur le textarea à l'ouverture.
- Le type-picker change les métadonnées affichées en dessous (Mood = échelle 1-10 + tags ; Passage = sélecteur de livre + page ; Goal = % + deadline ; Habit = checkbox récurrence ; Note libre = rien).

### Tâches
- Click sur rond → toggle done (bg + border = accent, label barré + couleur `muted`).
- Pas de confirmation, pas de modal — tout en place.

### Onglets Compte
- Re-mount du contenu à chaque switch pour déclencher l'anim de fade.

### Sidebar
- Item actif = bg accent + texte blanc, **pas de hover lift** (transform: none).
- Items inactifs = hover translateX 2px + bg `bg2`.

---

## Copywriting (tout en français)

Le ton est **calme, posé, en deuxième personne du singulier (« tu »)**, jamais corporate.

Quelques exemples à préserver :
- Login H1 : « Te revoilà. »
- Login subtitle : « Un carnet privé, hébergé par toi. Mood, passages, goals, habits, library, review — chiffrés bout en bout, jamais visibles côté serveur. »
- Accueil H1 : « Bonjour, Alice. »
- Accueil sub : « Trois choses à voir aujourd'hui. »
- État vide : « Une page blanche. » / « Tu n'as encore rien écrit. C'est le bon endroit pour commencer. Une humeur, un passage, une intention — l'ordre n'a pas d'importance. »
- Mood/Passages page sub : « Ce qui mérite d'être relu. »
- Données → "Tout emporter." / "Reprendre un export."
- Zone rouge : « Pas de retour. »
- Composer footer : « chiffré localement »
- Sync footer : « Synchronisé · à l'instant »

---

## Assets

Aucun asset binaire utilisé. Tout est SVG inline (uniquement le tick de la checkbox) ou pure CSS.

Polices via Google Fonts : Instrument Sans, Instrument Serif, JetBrains Mono.
Toutes en weight 400/500/600/700 (sans), italique pour le serif.

---

## Fichiers du bundle

```
design_handoff_nodea/
├── README.md                    ← ce fichier
├── preview.html                 ← ouvrir au navigateur, montre les 8 écrans empilés
└── source/
    ├── dir-k.jsx                ← Login, Accueil, Mon compte (3 écrans, accepte tone="sauge")
    └── dir-k-extras.jsx         ← Empty, Composer, Mood, Passages, HomeDark (5 écrans)
```

`dir-k.jsx` exporte `window.DirK_Login / DirK_Home / DirK_Account` — tous avec une prop `tone`
(seul `"sauge"` est validé pour la prod ; les variantes `"foret"` et `"olive"` ont été écartées
mais conservées dans le code pour l'historique).

`dir-k-extras.jsx` exporte `window.DirK_HomeDark / DirK_Empty / DirK_Composer / DirK_Mood /
DirK_Passages` — pas de prop tone, ils héritent du sauge clair (sauf HomeDark qui utilise sa
propre palette dark).

---

## Notes pour l'implémentation

1. **Pas de framework UI lourd nécessaire**. Tout l'UI est custom et délibérément simple. shadcn/ui
   ou Radix Primitives suffisent largement (Dialog pour le composer, rien d'autre).
2. **Pas d'icônes**. C'est volontaire. Si un menu nécessite vraiment un chevron, le dessiner en SVG
   inline (1.5px, `currentColor`).
3. **Tabular-nums partout** où il y a des chiffres (compteurs, dates, pages, %).
4. **Hairlines à 1px**, jamais 2px. Si un séparateur a besoin de plus de présence, ajouter de
   l'espacement plutôt qu'épaissir le trait.
5. **Le serif italique a un rôle sémantique** (citation, contenu personnel) — ne pas l'utiliser
   pour décorer.
6. **Privacy first dans la copy** — chaque mention de "chiffré bout en bout / jamais côté serveur"
   est intentionnelle. Garder.
