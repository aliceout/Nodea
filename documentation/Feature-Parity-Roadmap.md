# Feature-Parity Roadmap — restauration post-migration

> **Contexte.** Pendant la migration PocketBase → Hono (voir
> [`Migration-Roadmap.md`](Migration-Roadmap.md)), j'ai coupé ou simplifié
> des features sans demander l'accord explicite. Ce document dresse la
> liste exacte de ce qui manque par rapport à la version pré-migration,
> et propose un ordre de restauration. **Aucune régression n'est
> acceptable** : l'UX / UI doit redevenir identique.

---

## Stratégie

**Option retenue : résurrection des JSX legacy + rewiring data-layer.**

Les composants JSX supprimés sont disponibles dans l'historique git
(commits antérieurs aux suppressions). La façon la plus rapide et la
plus fiable de retrouver l'UX/UI pixel-perfect est de les restaurer
tels quels via `git show <commit>:<path>`, puis de remplacer leurs
imports data par les nouveaux clients :

| Legacy                                        | Nouveau                                     |
| --------------------------------------------- | ------------------------------------------- |
| `pb.collection(...)` / `pb.send(...)`         | `moodClient` / `goalsClient` / etc.         |
| `@/core/crypto/webcrypto` (encrypt/decrypt)   | Les clients gèrent déjà la crypto en interne |
| `@/core/crypto/guards` `deriveGuard`          | Idem (interne aux clients)                  |
| `@/core/store/StoreProvider` `useStore`       | `useNodeaStore(selectX)`                    |
| `@/core/auth/useAuth`                         | `useSession()`                              |
| `@/core/store/modulesRuntime`                 | `useNodeaStore(selectModules)`              |

Les JSX restent JSX (typés via ambient declarations). On les portera
vers TSX module par module plus tard, **après** la parité
fonctionnelle — pas avant.

### Commits de référence pour `git show`

| Feature                    | Présente jusqu'à (inclus) | Supprimée au commit      |
| -------------------------- | ------------------------- | ------------------------ |
| ExportData / ImportData    | `fb68d85`                 | `1cf0987` (Step 4b-d)    |
| ChangeUsername             | `22c975d`                 | `30d0e9f` (Step 3d)      |
| Mood components + hooks    | `fb68d85`                 | `1cf0987`                |
| Goals components + views   | `fb68d85`                 | `1cf0987`                |
| Passage views              | `fb68d85`                 | `1cf0987`                |
| Homepage AnnouncementSpot. | `30d0e9f`                 | `fb68d85` (Step 4a)      |
| Homepage MoodOverview      | `30d0e9f`                 | `fb68d85`                |
| AnnouncementsManager       | `22c975d`                 | `251f7f1` (Step 3b)      |
| OnboardingModal            | `aad487c`                 | `aad487c`  (Step 6)      |
| useUserPreferences         | `aad487c`                 | `aad487c`                |
| `users.username` colonne   | `30d0e9f`                 | **Jamais créée** (Phase 2) |
| Announcements table        | —                         | **Jamais créée**          |

---

## Vue d'ensemble des phases

```
R1   ExportData + ImportData (archive chiffrée)                  ✅ d0d1970
R2   users.username + ChangeUsername                             ✅ (current)
R3   Mood — features complètes (chart, emoji picker, positives, questions)
R4   Goals — features complètes (inline edit, autosuggest thread)
R5   Passage — features complètes (thread view)
R6   Habits — features complètes (heatmap, target, archive, durée)
R7   Library — features complètes (creators, rating, tags, providers)
R8   Review — parcours YearCompass guidé (15 sections)
R9   Homepage — AnnouncementSpotlight + MoodOverview
R10  Admin — AnnouncementsManager (nécessite table + routes back)
R11  Onboarding flow (onboarding_status déjà en DB)
R12  User preferences synchronisées (theme/langue cross-device)
R13  SMTP + reset-password par email
R14  Ports UI atoms JSX → TSX (finition)
R15  Documentation (Architecture.md + Database.md) mise à jour
```

**Dépendances** : R1 est indépendante. R2 dépend d'une migration
DB. R3-R8 sont indépendantes entre elles. R9 dépend de R3+R10.
R10 et R13 demandent chacune une nouvelle table + nouvelles routes.

---

## R1 — ExportData + ImportData (priorité absolue)

**Pourquoi en premier.** L'app est E2E chiffrée. L'utilisateur·ice ne
peut compter sur personne d'autre pour ses sauvegardes. Sans export,
perdre son mot de passe = perdre tout.

**Récupérer depuis git :**

```bash
git show fb68d85:packages/web/src/app/flow/Account/components/ExportData.jsx > packages/web/src/app/flow/Account/components/ExportData.jsx
git show fb68d85:packages/web/src/app/flow/Account/components/ImportData.jsx > packages/web/src/app/flow/Account/components/ImportData.jsx
git show fb68d85:packages/web/src/core/utils/ImportExport/Mood.jsx > packages/web/src/core/utils/ImportExport/Mood.jsx
git show fb68d85:packages/web/src/core/utils/ImportExport/Goals.jsx > packages/web/src/core/utils/ImportExport/Goals.jsx
git show fb68d85:packages/web/src/core/utils/ImportExport/Passage.jsx > packages/web/src/core/utils/ImportExport/Passage.jsx
git show fb68d85:packages/web/src/core/utils/ImportExport/registry.data.js > packages/web/src/core/utils/ImportExport/registry.data.js
git show fb68d85:packages/web/src/core/utils/ImportExport/utils.js > packages/web/src/core/utils/ImportExport/utils.js
```

**Rewiring data-layer :**

- Remplacer `pb.send(...)` / `pb.collection(...)` par `moodClient.list()`,
  `moodClient.create()`, etc. dans chaque helper de `ImportExport/*.jsx`
- Remplacer `useStore`'s `mainKey` par `useNodeaStore(selectMainKey)`
- Ajouter les helpers équivalents pour Habits / Library / Review (ils
  n'existaient pas en legacy)
- Préserver le format JSON d'export documenté dans
  `documentation/Modules/*.md` (champ `meta: { version, exported_at, app }`
  + `modules: { mood: [...], goals: [...], ... }`)

**Réintégrer dans Account/index.tsx :**

```tsx
import ImportData from './components/ImportData.jsx';
import ExportData from './components/ExportData.jsx';
// ... restaurer la section "Données"
```

**Critère de sortie** : exporter sur un compte, vider la base, ré-importer,
retrouver toutes les entrées identiques.

---

## R2 — `users.username` + ChangeUsername

**Back**

- Migration Drizzle : `ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT '';`
- Remettre `username` optionnel ou unique selon ce qui était en PB
- `GET /auth/me` : ajouter `username` dans la réponse
- `POST /auth/register` : accepter `username` optionnel
- Nouvelle route `PATCH /auth/username` (password-gated, comme change-email)
- Shared Zod : `RegisterBodySchema` + `AuthMeResponseSchema` + nouveau `ChangeUsernameBodySchema`

**Front**

```bash
git show 30d0e9f:packages/web/src/app/flow/Account/components/ChangeUsername.jsx > packages/web/src/app/flow/Account/components/ChangeUsername.jsx
```

Rewiring : `apiChangeUsername` au lieu de `pb.collection('users').update()`.

- Remettre dans Account/index.tsx section "Informations personnelles"
- Header.tsx : revenir à `user.username || fallback` (actuellement :
  email local-part uniquement)
- Admin UserTable.tsx : afficher `username` comme colonne principale

**Critère de sortie** : un user peut changer son username, Header
affiche le username, Admin voit les usernames.

---

## R3 — Mood : restauration complète

**Fichiers à restaurer depuis `fb68d85`**

```
packages/web/src/app/flow/Mood/index.jsx
packages/web/src/app/flow/Mood/views/Form.jsx
packages/web/src/app/flow/Mood/views/History.jsx
packages/web/src/app/flow/Mood/views/Graph.jsx
packages/web/src/app/flow/Mood/hooks/useMoodTrend.js
packages/web/src/app/flow/Mood/components/Chart.jsx
packages/web/src/app/flow/Mood/components/ChartBody.jsx
packages/web/src/app/flow/Mood/components/Comment.jsx
packages/web/src/app/flow/Mood/components/Entry.jsx
packages/web/src/app/flow/Mood/components/Filters.jsx
packages/web/src/app/flow/Mood/components/Frame.jsx
packages/web/src/app/flow/Mood/components/List.jsx
packages/web/src/app/flow/Mood/components/Mood.jsx
packages/web/src/app/flow/Mood/components/Positives.jsx
packages/web/src/app/flow/Mood/components/Question.jsx
```

Supprimer l'`index.tsx` et `views/Form.tsx` / `views/History.tsx`
MVP actuels — les vrais remplacent.

**Rewiring data-layer (Form.jsx + History.jsx + useMoodTrend.js)**

- `createMoodEntry(...)` → `moodClient.create(moduleUserId, mainKey, payload)`
- `listMoodEntries(...)` → `moodClient.list(moduleUserId, mainKey)` (renvoie déjà déchiffré)
- `deleteMoodEntry(...)` → `moodClient.remove(moduleUserId, mainKey, id)`
- `mainKey` depuis Zustand, `moduleUserId` depuis Zustand `selectModules`
- Décryptage : supprimé des composants (le client le fait)

**Deps à remettre dans `packages/web/package.json`**

- `recharts` (Chart / ChartBody)
- `emoji-picker-react` (Mood.jsx / Entry.jsx)

**Critère de sortie** : flow identique au legacy — emoji picker visuel,
3 positives, question aléatoire, commentaire, chart mensuel dans Graph.

---

## R4 — Goals : restauration complète

**Fichiers à restaurer depuis `fb68d85`**

```
packages/web/src/app/flow/Goals/index.jsx
packages/web/src/app/flow/Goals/views/Form.jsx
packages/web/src/app/flow/Goals/views/History.jsx
packages/web/src/app/flow/Goals/components/Card.jsx
packages/web/src/app/flow/Goals/components/EditCard.jsx
packages/web/src/app/flow/Goals/components/Filters.jsx
packages/web/src/app/flow/Goals/components/List.jsx
```

Supprimer l'`index.tsx` et `views/*.tsx` MVP.

**Rewiring**

- `createGoal` / `updateGoal` / `deleteGoal` / `listGoals` →
  `goalsClient.*`
- `listDistinctThreads` : le legacy chargeait 200 entries pour
  reconstruire la liste des threads distincts (voir finding
  `listDistinctThreads` → FAIBLE). **À restaurer tel quel** pour garder
  l'autosuggest ; l'optimisation reste un TODO indépendant.

**Critère de sortie** : inline edit via EditCard fonctionne,
autosuggest thread fonctionne, filtres statut actifs.

---

## R5 — Passage : restauration complète

**Fichiers à restaurer depuis `fb68d85`**

```
packages/web/src/app/flow/Passage/index.jsx
packages/web/src/app/flow/Passage/views/Form.jsx
packages/web/src/app/flow/Passage/views/History.jsx
```

Même pattern que R3/R4 pour le rewiring (`passageClient`).

**Critère de sortie** : vue par thread + autosuggest thread
identiques au legacy.

---

## R6 — Habits : features complètes (documentation/Modules/Habits.md)

**Il n'y a pas de JSX legacy à restaurer** — le module n'a jamais eu
d'UI. Il faut construire ce que la doc décrit :

- **items** form : `title`, `category` (sport/santé/créativité/relation/autre),
  `frequency` (daily/weekly/monthly/custom), `target` (nombre),
  `duration` (ISO 8601 type `P6M`), `started_at`, `archived`
- **logs** : création datée par item
- **Heatmap GitHub-style** sur les logs (365 jours, couleurs selon
  intensité) — lib suggérée : `react-calendar-heatmap` ou
  implémentation maison en SVG
- **Taux de régularité** : `nb logs / nb attendus` calculé depuis
  `frequency` + `target` sur une période
- **Archivage** : `archived: true` masque l'item sans effacer les logs

**Critère de sortie** : ajouter Tennis weekly target 1, logger 3 fois
sur 1 mois, voir la heatmap avec 3 cases colorées et le taux.

---

## R7 — Library : features complètes (documentation/Modules/Library.md)

**Pas de JSX legacy.** Construire :

- **items** form complet : `type` (book/movie/tv/doc), `provider`
  (openlibrary/googlebooks/tmdb) optionnel, `external_id` optionnel,
  `title`, `creators[]` (tags-input style), `year`, `language`,
  `cover_url` (preview miniature), `status`
  (planned/in_progress/finished/abandoned), `started_at`, `finished_at`,
  `rating` (0-5 étoiles), `tags[]`
- **reviews** form : `date`, `note` (texte libre), `page` optionnel,
  `snippet` optionnel
- **Intégration providers externes** (openlibrary/googlebooks/tmdb) :
  documenté mais **à discuter** — ça ajoute des appels API externes
  non chiffrés qui pourraient leak la bibliothèque au provider. Flag
  opt-in utilisateur recommandé.
- Affichage des covers en grille

**Critère de sortie** : ajouter un livre avec couverture, auteur·ice·s,
rating, 2 fiches de lecture datées. Affichage en grille lisible.

---

## R8 — Review : parcours YearCompass guidé

**Le plus gros morceau.** La doc
[`documentation/Modules/Review.md`](Modules/Review.md) décrit un
parcours en ~15 sections groupées en 3 parties :

- **Année qui se termine** (8 sections) : agenda_review, life_areas (7
  sous-catégories), six_phrases, six_questions, best_moments,
  three_challenges, three_successes, forgiveness, letting_go, closing
  (book_title + three_words)
- **Année à venir** (6 sections) : dream_big, life_areas, triplets (12
  clés), six_phrases, secret_wish, word_of_year, year_image (image
  symbolique chiffrée)
- **Clôture** : letter_to_self, commitment, signature, date

**UI à construire**

- Wizard pas-à-pas avec barre de progression
- Sauvegarde auto des brouillons en cours (clé : `year-draft`)
- Possibilité de sauter une section puis y revenir
- Upload d'image chiffrée pour `year_image` (base64url stocké dans
  payload)
- Vue "lecture" d'un bilan passé : rendu typographique soigné

**Critère de sortie** : compléter un bilan entier pour 2025, le
retrouver dans l'historique, le relire avec la mise en forme du PDF
YearCompass.

---

## R9 — Homepage : AnnouncementSpotlight + MoodOverview

**Dépend de R3 (MoodOverview utilise useMoodTrend) et R10 (annonces).**

**Fichiers à restaurer depuis `30d0e9f`**

```
packages/web/src/app/flow/Homepage/components/AnnouncementSpotlight.jsx
packages/web/src/app/flow/Homepage/components/MoodOverview.jsx
```

Réintégrer dans `Homepage/index.tsx` selon le layout d'origine
(hero 2/3 + spotlight 1/3, puis quick-actions 1/3 + mood-overview 2/3,
puis available-modules en bas).

**Rewiring**

- MoodOverview : `useMoodTrend` récupéré + rebranché (R3)
- AnnouncementSpotlight : `useLatestAnnouncement` → nouvelle fonction
  qui interroge `GET /announcements` (introduit en R10)

**Critère de sortie** : homepage identique visuellement au legacy.

---

## R10 — Admin AnnouncementsManager + back support

**Back**

- Nouvelle table Drizzle `announcements` :
  ```ts
  {
    id: text PK,
    title: text,
    message: text,
    publishedAt: timestamp,
    expiresAt: timestamp | null,
    createdBy: text FK users.id,
    createdAt: timestamp default now,
  }
  ```
- Migration Drizzle
- Routes :
  - `GET /announcements` (public authenticated, renvoie l'annonce
    active la plus récente : `published_at <= now < expires_at`)
  - `POST /admin/announcements` (admin)
  - `PATCH /admin/announcements/:id` (admin)
  - `DELETE /admin/announcements/:id` (admin)
- Tests d'intégration (cycle complet)

**Front**

- `git show 22c975d:packages/web/src/app/flow/Admin/components/AnnouncementsManager.jsx`
- API client : `apiAdminCreateAnnouncement`, etc.
- Nouveau hook `useLatestAnnouncement` (remplace le legacy)
- Réintégrer dans `Admin/index.tsx` la section "Annonces"

**Critère de sortie** : admin peut créer une annonce avec date
d'expiration, elle apparaît sur la homepage de tous les users, se
masque après expiration.

---

## R11 — Onboarding

**État actuel** : `users.onboarding_status` existe en DB, `/auth/me`
l'expose, mais aucune UI ne le lit.

**Back** : rien à ajouter — la colonne est là, une route
`PATCH /auth/onboarding` (sets `complete`) suffit.

**Front**

- `git show aad487c:packages/web/src/ui/atoms/specifics/OnboardingModal.jsx`
  pour récupérer l'UI originale du tour
- Nouveau hook `useOnboarding` lié à `selectUser().onboardingStatus`
- Modal qui s'ouvre si `status === 'pending'` à la première
  navigation protégée
- Bouton "OK" → `apiFinishOnboarding()` → `onboardingStatus =
  'complete'` → modal se ferme

**Critère de sortie** : nouveau user voit la modal au premier login,
la valide, elle ne revient plus.

---

## R12 — User preferences synchronisées (theme, langue)

**Aujourd'hui** : theme + langue dans `localStorage` uniquement. Un
user qui se connecte sur un autre navigateur perd ses préférences.

**Décision back** : deux options

- **A** : nouvelle table `user_preferences (user_id PK, cipher_iv,
  payload)` chiffrée comme `modules_config`. Cohérent, chiffrable
  (si les prefs contiennent un jour des choses sensibles), mais
  surdimensionné pour "langue=fr".
- **B** : étendre `modules_config` avec une section `_prefs` dans le
  payload existant (1 seul blob, pas de nouvelle table).

Ma recommandation : **B** — moins d'infra pour un besoin simple.

**Front**

- `useTheme` + `useI18n` lisent en priorité
  `modulesRuntime._prefs.{theme,language}` si présent, sinon fallback
  localStorage (transition douce)
- Changement → écrit dans les deux (`modules_config` encrypted + local
  pour latence)

**Critère de sortie** : connexion sur un nouveau navigateur →
recharger les prefs depuis le serveur.

---

## R13 — SMTP + reset-password par email

**Le seul bloqué par une décision produit.** Installer une route SMTP
c'est :

- Env vars : `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  `SMTP_FROM`
- Lib : `nodemailer`
- Nouvelle table `password_reset_tokens (token_hash PK, user_id,
  expires_at, used_at)`
- Routes :
  - `POST /auth/request-reset {email}` — envoie un mail avec un token
    signé (ignore si email inconnu, pas d'énumération)
  - `POST /auth/reset-confirm {token, newPassword, encryptionSalt,
    encryptedKey}` — le client doit ré-encapsuler sa clé principale
    avec le nouveau mot de passe **(nécessite qu'il connaisse encore
    son ancien mot de passe pour unwrap — sinon perte des données E2E,
    comportement attendu)**

Front : nouvelle page `/request-reset` + email template.

**À discuter avec toi** : est-ce qu'un reset SANS connaître l'ancien
mot de passe (donc réinitialisation E2E = reset = perte des données
chiffrées) est acceptable, ou on garde un reset uniquement pour
récupérer l'accès au compte mais pas aux données ?

---

## R14 — Ports UI atoms JSX → TSX

**Non bloquant fonctionnellement.** Les ambient declarations font le
job. Mais CLAUDE.md demande "TS strict partout pour le nouveau code",
et dès qu'une modification doit se faire dans un UI atom, on devrait
le porter.

À faire module par module, au fil des besoins. Liste :

```
ui/atoms/base/{Alert, Button, Card, Modal}.jsx
ui/atoms/data/TableShell.jsx
ui/atoms/feedback/{Badge, StatusBanner}.jsx
ui/atoms/form/{DateMonthPicker, FormError, FormField, Input, Select, SuggestInput, Textarea}.jsx
ui/atoms/layout/Surface.jsx
ui/atoms/specifics/{KeyMissingModal, SurfaceCard, ThemeSelector}.jsx
ui/atoms/typography/SectionHeader.jsx
ui/atoms/actions/EditDeleteActions.jsx
ui/layout/Layout.tsx (DONE)
ui/layout/headers/{Header.tsx (DONE), Subheader.jsx}
ui/layout/navigation/{Navigation.ts (DONE), Sidebar.jsx}
ui/layout/components/{HeaderNav, SideLinks, SubNavDesktop, SubNavMobile, UserAvatar, UserMenu}.jsx
ui/branding/LogoLong.jsx
i18n/I18nProvider.jsx
```

---

## R15 — Documentation refresh

- `documentation/Architecture.md` : remplacer toutes les sections PB
  par Hono / Drizzle / session cookies
- `documentation/Database.md` : remplacer le schéma PB par le schéma
  Drizzle
- `documentation/Security.md` : déjà cohérent (mentionne HMAC guard +
  HKDF), vérifier juste les références PB résiduelles
- README : déjà refait (Step 7)

---

## Ordre de priorité recommandé

1. **R1** — Export / Import (critique pour E2E)
2. **R2** — Username (identité user cassée sans ça)
3. **R3, R4, R5** — parité des 3 modules existants en parallèle
4. **R9** — Homepage (nécessite R3 pour MoodOverview, peut attendre R10 pour annonces)
5. **R10** — Annonces
6. **R6, R7, R8** — nouveaux modules (Habits / Library / Review) dans cet ordre de complexité
7. **R11** — Onboarding
8. **R12** — prefs synchro (low-stakes)
9. **R13** — SMTP reset (décision produit)
10. **R14, R15** — polish

---

## Engagement

- Je ne coupe ni simplifie plus rien sans accord explicite.
- Chaque phase R fait l'objet d'un commit (ou plusieurs) avec vérif
  visuelle pixel-à-pixel contre le legacy (via `git show` comparaison
  ou rendu côte à côte).
- Je te tiens au courant avant chaque phase R et en fin de phase
  (notification toast comme actuellement).

---

## Décisions à prendre avant de démarrer

1. **R12** : option A (table dédiée) ou B (dans `modules_config`) ?
2. **R13** : reset-password qui préserve les données (= avec ancien
   mot de passe) ou qui réinitialise tout (= perte données E2E) ?
3. **R7** : intégration providers externes (openlibrary/googlebooks/
   tmdb) opt-in ou jamais ?
4. **Ordre** : tu valides l'ordre recommandé ou tu veux prioriser
   autrement ?
