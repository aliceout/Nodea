# Sanity-check manuel — Mood + Goals avant prod

Cette checklist couvre ce que les tests automatisés (vitest unitaires +
Playwright e2e) ne voient pas : ergonomie, flicker visuel, comportement
réel quand tu cliques vite, cohérence i18n FR/EN, stabilité du déchiffrement
sur des entrées existantes.

À faire à la main dans un navigateur réel après chaque cycle de refactoring
lourd (le dernier en date : Tier 4 Phase 2 + 4 chantiers de découpage +
FRONT-13 + sweep i18n).

Marquer chaque case quand vérifiée. Si une case échoue, noter le bug et le
contexte (browser, OS, date) pour reproduire.

**Ce qui est partiellement automatisé** (lance `pnpm --filter @nodea/e2e test`
pour skipper les parties déterministes) :

- Section 1 (auth bootstrap) — couvert en grande partie par spec 01.
- Section 2 (Mood CRUD) — couvert par spec 07 (sauf parties throttle / heatmap visuelle).
- Section 3 (Goals CRUD) — couvert par spec 08 (sauf throttle / status cycling visuel).
- Section 4 (crypto invariants) — couvert par specs 03 / 05.
- **Section 5 (i18n FR↔EN)** — couvert par spec 11.
- **Section 6 (Admin)** — couvert par spec 12.
- Section 7 (browser compat) — pas automatisable, reste manuel.
- **Section 8 (privacy invariants)** — couvert par spec 13.

Restent **strictement manuels** : ressenti visuel (flicker, animations),
browser compat (Safari macOS, Firefox), throttle Slow 3G en réel pour
voir les races condition, et tout ce qui demande un jugement humain
(« est-ce que ça se sent fluide ? »).

---

## 1. Bootstrap & auth

- [ ] **Cold reload** sur `/flow` après une session : redirige vers `/login`,
      pas de flash de `/flow` blanc avant la redirection.
- [ ] **Login** avec email + password : land sur `/flow/home`, sidebar visible,
      `document.title === 'Nodea'` (pas `Mood — Nodea` etc.).
- [ ] **`/auth/me`** dans Network tab : ne contient PAS `wrappedMainKey`,
      `wrappedKekPassword` (déplacé sur `/auth/me/crypto`).
- [ ] **`/auth/me/crypto`** : appelé seulement au login (pas à chaque page-load
      de la sidebar).
- [ ] **Logout** : redirige vers `/login`, le bouton Back ne ramène pas sur
      `/flow` (full reload via `location.replace`).

## 2. Mood module

### Création

- [ ] Sidebar → « Humeur » : page se charge, heatmap visible.
- [ ] **« + Nouvelle entrée »** ouvre le Composer en mode Mood.
- [ ] Score : les 5 boutons -2 / -1 / 0 / +1 / +2 sélectionnent.
- [ ] 3 positifs + commentaire saisis.
- [ ] **Cmd+Enter** depuis n'importe quel input soumet.
- [ ] **Enregistrer** : modal se ferme, entry apparaît dans la liste +
      heatmap se met à jour pour la date.

### Édition

- [ ] Hover sur une row → bouton crayon visible.
- [ ] Click crayon → Composer rouvre avec valeurs préfillées.
- [ ] Modifier un positif → Enregistrer → texte mis à jour dans la liste.

### Suppression (FRONT-13 — race conditions)

- [ ] Click trash → confirm `Supprimer l'entrée du …` (texte i18n,
      pas de `Supprimer cette entrée ?` générique).
- [ ] Accept → entrée disparaît, heatmap se met à jour.
- [ ] **Throttle Slow 3G** (DevTools → Network → Throttling) →
      delete deux entrées rapidement (clic-clic sans attendre).
      → Les deux disparaissent (pas une qui réapparait à cause d'un
      rollback racey).

### Filtres

- [ ] Year filter : sélectionner une année avec entrées → heatmap +
      liste filtrent. Sélectionner « Tout » → tout réapparaît.
- [ ] Donut + patterns côté droit reflètent la sélection.

## 3. Goals module

### Création

- [ ] Sidebar → « Goals » : page se charge.
- [ ] **« + Nouvel objectif »** ouvre Composer en mode Goal.
- [ ] Title autoFocus.
- [ ] Mois (select) + Année (4 chiffres input) saisis.
- [ ] Status 3-button toggle : un seul actif à la fois (Ouvert / En cours / Terminé).
- [ ] Thread input + chips de threads existants (s'ils existent dans
      d'autres goals) cliquables pour les ajouter.
- [ ] Note Markdown : visual / source toggle marche.
- [ ] **Cmd+Enter** soumet.
- [ ] Enregistrer → entry apparaît, statusPill avec la bonne couleur.

### Status cycling (FRONT-13 + completedAt)

- [ ] Click le statusPill : cycle Ouvert → En cours → Terminé → Ouvert.
- [ ] Quand status devient « Terminé », `completedAt` est seedée à `now`
      (vérifier via DB ou via re-edit : la date de complétion apparaît).
- [ ] Quand status sort de « Terminé » vers Ouvert, `completedAt` est
      cleared.
- [ ] **Throttle Slow 3G** + click rapide deux fois sur le même statusPill :
      le statut final reflète le dernier clic, pas le 1er. Le rollback
      racey ne devrait plus se produire.

### Édition

- [ ] Click crayon → Composer rouvre avec valeurs préfillées (title,
      mois/année, status, thread, note).
- [ ] Modifier title → Mettre à jour → texte mis à jour dans la liste.

### Suppression

- [ ] Click trash → confirm i18n `Supprimer « <title> » ?` (FR) ou
      `Delete « <title> » ?` (EN).
- [ ] Accept → entrée disparaît.
- [ ] **Throttle** + delete 2 goals rapidement → les deux disparaissent.

### Carry-over

- [ ] Sidebar → « Reporter sur l'année prochaine » : ouvre dialog.
- [ ] De l'année X vers Y, summary correct (`N goals de X vont être reportés
      sur Y`).
- [ ] Confirmer → goals open / wip de l'année X passent à Y. Goals done
      restent à X.

### Filtres / display

- [ ] Search Title/note/thread filtre la liste.
- [ ] Status filter (Tous / open / wip / done) filtre.
- [ ] Group by Thread / Année.
- [ ] Sort by Date / Récent / A→Z.
- [ ] « Masquer les terminés » cache les done.

## 4. Crypto invariants

- [ ] **Login** : à l'ouverture de la modal Composer, les valeurs
      préfillées d'un goal existant sont décryptées correctement (pas
      de blob brut, pas de fields manquants).
- [ ] **Heatmap Mood** sur entrées chiffrées il y a plusieurs jours :
      les couleurs reflètent les bons scores (pas de `undefined` qui
      passe en gris).
- [ ] **Logout** → DevTools → Sources → `useNodeaStore.getState().crypto.main`
      retourne `null` (clé wipe au logout).
- [ ] **Change password** depuis Settings → Sécurité :
      - Re-auth password → Saisir nouveau password (2 fois) → Enregistrer.
      - Forced logout (cookie effacé).
      - Re-login avec nouveau password → entrées Mood + Goals encore
        lisibles (la KEK est re-wrappée mais la main key elle-même
        n'a pas bougé).
- [ ] **Recovery code** depuis Settings → Sécurité :
      - Activer recovery → 12 mots BIP39 affichés une fois → ack.
      - Logout.
      - `/recover` → email + 12 mots + nouveau password → land sur `/flow`.
      - Entrées Mood + Goals encore lisibles.
      - Le tip « configurer un code de récupération » réapparaît
        (Tier 3 : code consommé, pas re-rotated).

## 5. i18n FR ↔ EN

- [ ] Settings → Préférences → Language → English.
- [ ] Chaque page traduite :
    - [ ] Sidebar entries (Mood = Mood, Goals = Goals — les deux gardent
          leur titre anglais en FR aussi par convention).
    - [ ] Composer body : labels, placeholders, save button.
    - [ ] Goals row : aria-labels (Edit goal / Delete goal).
    - [ ] Goals confirm `Delete « <title> » ?` quand on supprime.
    - [ ] Goals statusPill aria-label.
    - [ ] Admin → Announcements : tous les labels, button states.
- [ ] Switch back to FR : tout retraduit, pas de strings restées en
      anglais (signe d'une clé manquante).

## 6. Admin (utilisateur admin)

- [ ] Settings → Admin → Annonces : labels FR (« Nouvelle annonce »,
      « Titre », « Message », « Publier ») viennent du i18n catalog.
- [ ] Créer une annonce → apparaît dans la liste avec date formatée
      en FR (`5 mai 2026 à 12:34` style français).
- [ ] Switch language EN → date reformatée en `May 5, 2026, 12:34 PM`.
- [ ] Toggle Activer / Désactiver fonctionne.
- [ ] Trash button avec aria-label « Supprimer » + confirm dialog.
- [ ] Settings → Admin → Utilisateurs : aria-label du delete button
      utilise `{label}` (email/username injecté).

## 7. Browser compat (à faire au moins une fois)

- [ ] Chromium (Chrome ou Edge) : tout fonctionne.
- [ ] Firefox : same. Attention à la passkey enrollment (PRF varie).
- [ ] Safari macOS : `<input type=month>` ne rend pas — Goals utilise
      paire month + year custom, vérifier que ça marche.

## 8. Privacy invariants (CLAUDE.md)

- [ ] URL reste `/flow` quel que soit le module actif (pas `/flow/mood`,
      `/flow?subview=...`).
- [ ] `document.title === 'Nodea'` partout sur l'app authentifiée
      (PAS `Mood — Nodea` ou `Goals — Nodea`).
- [ ] Network tab : pas de query string `?token=...`, pas de
      `?d=<guard>` dans aucune URL (SEC-01 — guards en headers seulement).
- [ ] Network tab `/auth/me` body : pas de `wrappedKek*` (API-14 split).

---

## Notes de remplissage

- Cocher au crayon (ou via `[x]` dans l'éditeur) au fur et à mesure.
- Si tu trouves un bug pendant la check, noter le finding sur
  `docs/security-audit.md` ou créer un ticket avant de corriger
  pour ne pas perdre le contexte de découverte.
- La checklist N'EST PAS exhaustive — elle couvre les regressions
  attendues du dernier cycle de refactor. Pour un audit profond,
  reprendre `docs/Modules/*` module par module.
