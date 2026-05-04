# Guide de contribution

Bienvenue dans le guide de contribution de **Nodea**.

Merci d'investir ton temps pour contribuer à ce projet — un suivi personnel chiffré de bout en bout, auto-hébergeable, qu'on construit pour qu'il reste honnête avec ses utilisateur·rice·s même si le code change de mainteneur·euse demain.

Ce guide couvre le flux de contribution **upstream** : ouvrir une issue, créer une pull request, faire reviewer, fusionner. Si tu cherches plutôt à **télécharger Nodea pour t'en faire ta propre version** (forker pour toi sans soumettre upstream), va voir [`nodea.app/docs/fork`](https://nodea.app/docs/fork) — audience différente, contraintes différentes.

## Contributions

De nombreuses manières de contribuer existent, et écrire du code n'est pas la seule.

Liste non-exhaustive :

- Signaler un bug que tu as croisé en utilisant Nodea (instance officielle ou ta fork).
- Améliorer la documentation publique sur [`nodea.app/docs`](https://nodea.app/docs) (sections Sécurité / Reprendre le projet / Auto-héberger).
- Traduire (FR / EN sont déjà actifs ; toute autre langue passe par les fichiers de `packages/web/src/i18n/locales/`).
- Améliorer l'accessibilité — Nodea touche à des données personnelles sensibles, l'app doit être utilisable par tout le monde.
- Auditer le code crypto et signaler les findings — toute revue extérieure est précieuse, surtout sur la couche OPAQUE / WebAuthn / AES-GCM.
- Tester une PR ouverte et commenter ce qui marche / ne marche pas.
- Participer aux discussions sur les issues — un point de vue extérieur sur un trade-off est souvent ce qui fait avancer.

D'autres pistes : <https://opensource.guide/fr/how-to-contribute>

### Ouvrir une nouvelle issue

Avant de poser une issue, vérifie qu'une issue similaire n'existe pas déjà (cherche en particulier dans les issues fermées). S'il n'y en a pas, ouvre une nouvelle issue avec :

- Un **titre descriptif** : « Le bouton X ne fonctionne pas sur Firefox » plutôt que « bug ».
- La **version de Nodea** concernée (commit SHA visible sur `/version`).
- Le **navigateur + OS**, surtout pour les bugs UI.
- **Étapes de reproduction**, en numérotant les actions.
- Le **comportement attendu** vs **observé**.
- Des captures d'écran ou un extrait de log si pertinent — **jamais** de cookies de session, de mots de passe ou de tokens dans les logs partagés.

### Résoudre un problème

Parcours les issues existantes pour trouver une qui t'intéresse. Tu peux filtrer par label (`good first issue`, `bug`, `feature`, `crypto`, etc.).

Si tu prends une issue, **assigne-toi-la** ou laisse un commentaire « je m'en occupe » — ça évite que deux personnes travaillent en parallèle sur la même chose. Si tu finis par ne pas avoir le temps, dis-le, quelqu'un d'autre pourra reprendre.

### Reproduire un bug signalé

Tu peux contribuer en confirmant qu'une issue se reproduit (ou ne se reproduit pas) sur ta machine, et en ajoutant les détails manquants. C'est un service immense pour les mainteneur·euse·s.

### Tester une pull request

Tu peux fusionner une PR localement dans ta copie du projet, lancer la suite de tests (`pnpm --filter @nodea/api test && pnpm --filter @nodea/web test`), naviguer dans l'app pour valider le comportement, puis commenter ton retour sur la PR.

### Apporter des modifications au code

#### 1. Forker le repo

Tu peux ainsi modifier sans affecter le projet original jusqu'à ce que tu sois prêt·e à proposer la fusion.

#### 2. Setup local

Détaillé sur [`nodea.app/docs/fork`](https://nodea.app/docs/fork). En version express :

```bash
git clone https://github.com/<toi>/Nodea.git
cd Nodea
pnpm install
cp .env.example .env
# édite .env (au moins COOKIE_SECRET et OPAQUE_SERVER_SETUP)
docker compose up -d postgres mailpit
pnpm --filter @nodea/api db:migrate
```

#### 3. Créer une branche de travail

À partir de la branche de dev courante (voir [Organisation des branches](#organisation-des-branches) ci-dessous). Convention de nommage : `<type>-<description_courte>` en snake_case.

```bash
git checkout -b feature-add_review_export
```

#### 4. Faire ses modifications

Garde la PR **focalisée** : un seul sujet par PR. Ajoute / mets à jour les tests. Lance les suites avant de commiter pour catcher les régressions :

```bash
pnpm --filter @nodea/api typecheck && pnpm --filter @nodea/api test
pnpm --filter @nodea/web typecheck && pnpm --filter @nodea/web test
```

#### 5. Valider les changements

Format de commit : préfixe + message à l'impératif, en français ou en anglais (cohérent dans toute la PR).

```text
feat(library): support import Goodreads
fix(auth): empêche la double-soumission du formulaire register
docs(security): clarifier le modèle de menaces sur change-email
refactor(store): déplacer les sélecteurs dans selectors.ts
chore(deps): bump react-hook-form 7.54 → 7.55
```

Préfixes acceptés : `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `style`, `perf`, `ci`. Évite `wip` ou `tmp` — squash-merge les nettoie côté reviewer mais autant ne pas les introduire.

#### 6. Ouvrir la pull request

- **Titre** : court, descriptif (le préfixe `feat:` ou `fix:` est dans le message du commit, pas obligé dans le titre PR).
- **Description** : explique le **pourquoi** (l'utilisateur·rice voit quel changement de comportement ?) plus que le **quoi** (la diff parle d'elle-même).
- **Lier l'issue** si tu en résous une (`Closes #42`).
- **Cocher la case « Allow edits from maintainers »** pour qu'on puisse mettre à jour ta branche en cas de conflit avant merge.
- **Ne marque pas comme "Ready for review"** tant que ta PR est en draft — une PR en draft signale au reviewer que tu sais qu'il reste du travail.

Si tu n'es pas familier·ière avec le système de pull request :

- <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests>
- <https://www.dataschool.io/how-to-contribute-on-github>

#### 7. Process de revue

Une fois ta PR ouverte, un·e mainteneur·euse va l'examiner. **Délai : variable** — Nodea n'a pas de mainteneur·euse à plein temps, compte plusieurs jours pour une première réponse. Si rien après 2 semaines, n'hésite pas à un commentaire de relance polie sur la PR.

Pendant la revue :

- Il se peut qu'on pose des questions ou demande des précisions — l'objectif est de comprendre le contexte de ton changement, pas de te faire réécrire.
- Il se peut qu'on demande des modifications avant fusion (suggestions inline, ou commentaires de revue).
- Au fur et à mesure que tu mets à jour ta PR, marque chaque conversation comme **résolue** quand le sujet est traité.
- Si tu rencontres un conflit de merge, ce tutoriel git aide : <https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/addressing-merge-conflicts>.

#### 8. Ta PR est fusionnée

Bravo 🎉 Merci pour ta contribution ✨ — elle apparaît dans le `CHANGELOG.md` de la prochaine release.

## Organisation des branches

### Principes

- La **branche de production** est `main`. Publiée sur <https://nodea.app>.
- La **branche de développement** est la branche de refacto courante (ex. `refacto-design-v2` aujourd'hui). C'est la branche cible de la plupart des PR. Une fois stabilisée, elle est mergée dans `main` et une nouvelle branche de refacto est créée si besoin.
- Une **branche dédiée par feature / bugfix / chore**, partant de la branche de dev courante.

### Schéma

```text
main
└── refacto-design-v2  (branche de dev courante)
    ├── feature-add_review_export
    ├── bugfix-double_submit_register
    ├── docs-clarify_threat_model
    └── chore-bump_react_hook_form
```

### Nommer ses branches

#### Types de branche

Le préfixe rend le but de la branche immédiatement lisible :

- **feature** : ajout d'une nouvelle fonctionnalité.
- **bugfix** : correction d'un bug.
- **hotfix** : correction d'un bug critique en prod (rare).
- **refactor** : restructuration sans changement de comportement.
- **chore** : tâche de maintenance (deps, CI, build).
- **docs** : documentation seulement.
- **test** : ajout / modification de tests.
- **experiment** : exploration, pas garantie d'être mergée.

#### Format

- Préfixe + tiret + description en snake_case.
- Moins de 50 caractères au total.
- Description courte mais explicite : `feature-add_review_export` plutôt que `feature-export`.

Exemples :

```text
feature-add_review_export
bugfix-double_submit_register
hotfix-totp_window_drift
refactor-split_admin_routes
chore-bump_drizzle_kit
docs-clarify_threat_model
```

### Versionnement

Numéro de version sur le format `a.b.c` ([SemVer](https://semver.org/lang/fr/)) :

- **a — Major** : changement breaking pour les clients (mobile, API consumers). Ex. retrait d'un endpoint, changement de contrat OPAQUE.
- **b — Minor** : nouvelle fonctionnalité non-breaking. Ex. nouveau module, nouveau champ optionnel.
- **c — Patch** : correction de bug, changement minime imperceptible. Ex. fix d'un selector mal écrit, dépendance bumpée.

### Sens de fusion

```text
feature-add_review_export
│ Tests verts dans ta fork ?
│ Si oui → pull request
│
└── refacto-design-v2 (branche de dev)
    │ Roadmap de la branche complétée + revue ?
    │ Si oui → merge
    │
    └── main
        │ Mise en production sur https://nodea.app
```

## Convention de codage

### Logique générale

Nodea est un logiciel **open source AGPL**. Le code est lu par autant de personnes qu'il en est écrit — fais en sorte qu'il soit agréable à lire.

C'est comme conduire : tu peux faire des dérapages quand tu es seul·e, c'est ton truc. Mais avec des passagers, l'objectif est de rendre la conduite aussi douce que possible.

### Lisibilité

- **TypeScript strict** — pas de `any` dans le code de production. Si tu dois échapper temporairement, `// eslint-disable-next-line` avec une justification d'une ligne.
- **2 espaces** pour l'indentation (jamais de tab).
- **Espaces après les éléments de liste et les paramètres de méthode** : `[1, 2, 3]` pas `[1,2,3]`. Autour des opérateurs : `x += 1` pas `x+=1`.
- **Pas de commented-out code.** Git se souvient. Si tu hésites, supprime — la commande `git log -p` retrouve.
- **Commentaires en anglais**, mais textes utilisateur en français (i18n via `t()`).
- **Inclusif·ve français** uniquement pour les humain·e·s (« utilisateur·rice·s »), pas pour les objets (« un critère actif », pas « actif·ve »).

### Tailwind CSS

- Préférer `flex` et `grid` aux marges manuelles.
- Éviter les `margin` entre éléments d'un même groupe — utiliser `gap`.
- Réutiliser les primitives `ui/atoms/` avant de créer un nouveau composant.

### Accessibilité

Nodea est utilisé pour des données personnelles sensibles — il doit être accessible par défaut, pas après-coup.

- Toute image porte un `alt` (vide si décorative : `alt=""`).
- Tout bouton à icône seule porte un `aria-label` ou un `<span class="sr-only">`.
- Tout input de formulaire a un `<label>` associé (par `htmlFor` ou wrapping).
- Contraste de couleur WCAG AA minimum (le design token système le respecte par défaut).
- Tout élément cliquable est focusable au clavier ET a un focus visible (`focus-visible:*` Tailwind).

### Invariants crypto à respecter

Nodea est chiffré de bout en bout. Quelques règles cassent silencieusement la sécurité :

- **Jamais de `CryptoKey` ou de matériel cryptographique brut dans un log, le DOM, ou `localStorage`.** Pas de `console.log(mainKey)`, pas de `window.mainKey`. La clé maître vit en mémoire WebCrypto en `extractable: false`.
- **HKDF avec étiquettes distinctes** entre AES-GCM et HMAC-SHA-256 (`"nodea:aes"` et `"nodea:hmac"`).
- **Une seule source pour `randomBytes` et le base64.** Le module partagé existe.
- **Les guards HMAC ne sont JAMAIS persistés en `localStorage`.** Cache mémoire uniquement.
- **Branded types** (`Base64`, `AesMainKey`, `HmacMainKey`, `CipherIV`) — confondre les types doit échouer à la compilation.

Le détail des invariants et leur justification vit sur [`nodea.app/docs/fork`](https://nodea.app/docs/fork) et dans le repo : `docs/Security.md` (prescriptif).

### Tests

Avant d'ouvrir une PR, lance les 3 suites :

```bash
pnpm --filter @nodea/api test  # ~3 min
pnpm --filter @nodea/web test  # ~5 s
pnpm --filter @nodea/e2e test  # ~3-5 min, prérequis Postgres + Mailpit + Chromium
```

Une PR avec des tests rouges sera mise en attente de fix avant revue.

Pour le détail de la structure de tests, voir [`nodea.app/docs/fork`](https://nodea.app/docs/fork) section « Lancer les tests ».

## Licence

Nodea est sous **AGPL-3.0-or-later**. C'est une licence copyleft « réseau » — toute version dérivée distribuée (y compris servie via un serveur) doit elle aussi être publiée sous AGPL.

En contribuant, tu acceptes que ton code soit publié sous cette même licence. C'est ce qui garantit que Nodea reste libre, même si quelqu'un le fork et le commercialise.

## Code de conduite

On veut que cet espace reste accessible à toustes — débutant·e·s comme expert·e·s, indépendamment du genre, de l'âge, de l'expérience technique.

Pas de commentaire offensant, pas de harcèlement, pas de gatekeeping. Désaccord technique OK — désaccord sur la personne pas OK. Les mainteneur·euse·s se réservent le droit de fermer une issue ou une PR sans réponse si le ton est inacceptable.

Tu vois un comportement qui te met mal à l'aise ? Ouvre une issue privée ou contacte directement la personne mainteneur sur le repo.

---

Merci encore pour ta contribution. Le projet existe parce que des gens comme toi s'y mettent.
