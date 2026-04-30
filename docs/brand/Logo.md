# Logo Nodea — Direction A · Spirale

> *« Tu reviens, mais pas au même endroit. »*

Le cycle qui ne revient jamais au même point. Pour HRT, règles, journal qu'on relit, transition.

---

## Tokens

| | |
|---|---|
| **Sauge** | `#5a7a5e` |
| **Sauge clarifié** (dark mode) | `#9bbf9f` |
| **Encre** | `#161614` |
| **Papier** | `#fcfcfa` |
| **Nuit chaude** | `#1d1c18` |
| **Wordmark** | Instrument Serif · `font-weight: 400` · `letter-spacing: -0.015em` |

---

## Fichiers

### Symbole seul (SVG vectoriel — utiliser de préférence)
- `nodea-symbol-sauge.svg` — sauge sur transparent, **fichier principal**
- `nodea-symbol-ink.svg` — encre sur transparent
- `nodea-symbol-paper.svg` — papier (pour fond foncé)
- `nodea-symbol-sauge-bright.svg` — version dark mode

### Lockup (symbole + « Nodea »)
- `nodea-lockup-horizontal.svg` — horizontal sauge + encre, **fichier principal**
- `nodea-lockup-horizontal-mono-sauge.svg` — tout sauge
- `nodea-lockup-horizontal-mono-ink.svg` — tout encre
- `nodea-lockup-horizontal-dark.svg` — pour fond nuit
- `nodea-lockup-vertical.svg` — empilé

### Favicon web
- `favicon.svg` — vectoriel, **à utiliser en priorité**
- `favicon-16.png` … `favicon-512.png` — PNG aux tailles standards

### App icon (avec fond plein, pour iOS/Android/macOS)
- `app-icon-paper-bg.svg` / `app-icon-paper-bg-rounded.svg` — sauge sur papier
- `app-icon-sauge-bg.svg` — papier sur sauge (inversé)
- `app-icon-dark-bg.svg` — sauge clarifié sur nuit
- `app-icon-1024-paper.png` / `-sauge.png` / `-dark.png` — 1024×1024 PNG

---

## HTML

Pour le `<head>` du site/app :

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png">
<link rel="apple-touch-icon" sizes="256x256" href="/favicon-256.png">
```

---

## Notes d'usage

- Le symbole est un trait monoline ouvert — **ne jamais le remplir**.
- Trait : `stroke-width: 6.5` sur viewBox 100×100. À l'échelle, scale en restant proportionnel.
- Espacement min autour du logo : ½ de la hauteur du symbole.
- Taille minimum du symbole seul : 16 px (favicon ok).
- Taille minimum du lockup horizontal : 96 px de large (sinon utiliser le symbole seul).
- Les fonts sont appelées via `@import` Google Fonts dans les SVG de lockup — ils sont autonomes mais nécessitent une connexion. Pour un export sans dépendance, exporter en PNG ou tracer le wordmark en path.
