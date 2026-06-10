# Audit complet — juin 2026, deuxième passe

Deuxième passe du même audit (sécurité / performance / correctifs), menée **après** l'exécution de la roadmap de la première passe (branche `audit/corrections-2026-06`, lots A–H). Trois objectifs : trouver ce que la première passe a raté, vérifier de façon adversariale le nouveau code introduit par les correctifs, et creuser la performance sous volume (le ressenti « ça rame quand il y a pas mal de données »).

Périmètre identique : code applicatif uniquement, dédoublonné contre les issues (#59, #127–#132) et contre `docs/Audit-2026-06.md`. Tout a été vérifié sur le code réel ; les coûts chiffrés viennent de micro-benchs exécutés (zod 4.4.3, WebCrypto, corpus simulé 2000 entrées).

**Verdict d'ensemble.** Les correctifs de la première passe tiennent l'examen adversarial sur ~90 % de leur surface (preuves vérifiées une à une), mais **trois ont des trous réels** (1.1, 1.2, 1.3 ci-dessous). Côté performance, le diagnostic est désormais précis : le pipeline crypto n'est **pas** le coupable (~0,3–0,5 s à 2000 entrées, mesuré) — ce qui rame, c'est que (a) la virtualisation ne s'active jamais en pratique, (b) chaque sauvegarde de formulaire re-télécharge tout, (c) chaque navigation re-paye tout le pipeline, (d) plusieurs mémoïsations sont contournées.

---

## 🔴 Priorité 1 — régressions et pertes de données

### 1.1 Le fix du verrouillage change-email ne couvre AUCUN compte existant
`drizzle/0020` (pas de backfill) · `auth-account.ts` (la route n'estampille jamais `user_identifier`)
Le correctif de la passe 1 persiste l'identifiant OPAQUE… mais seulement pour les enveloppes créées **après** le déploiement. Un compte d'avant la migration a `user_identifier = NULL` ; s'il change d'email, le fallback retombe sur le **nouvel** email → verrouillage permanent, exactement le bug qu'on croyait corrigé. Le commentaire du schéma énonce un invariant que la route change-email casse au premier appel.
**Correctif** : migration de backfill (`SET user_identifier = users.email WHERE NULL` — correct car tout compte loggable pré-fix n'a jamais changé d'email) + dans le handler change-email, `COALESCE(user_identifier, ancienEmail)` dans la même transaction.

### 1.2 `modules_config` : un toggle après une hydratation ratée détruit tous les identifiants de modules
`useModulesHydration.ts` (erreur avalée → store vide) · `ModulesManager.tsx` (PUT du blob entier)
Si le chargement du blob échoue (transport, déchiffrement, **ou le nouveau parse Zod de la passe 1, qui rend l'échec plus probable**), le store reste à `{}`. Tous les toggles paraissent OFF ; en réactiver un PUT un blob quasi-vide → **tous les `moduleUserId` existants sont écrasés, toutes les entrées chiffrées de tous les modules deviennent orphelines, irréversiblement**. C'est le jumeau du bug préférences corrigé en passe 1 — le blob le plus critique n'a pas reçu le même rail.
**Correctif** : même latch que les préférences — « blob illisible » ≠ « blob absent », et `ModulesManager` refuse d'écrire (toggles désactivés + bandeau) tant que l'hydratation n'a pas réussi.

### 1.3 Préférences : la fenêtre d'écrasement subsiste sur échec réseau
`use-preferences.ts` (le catch transport « settle ok »)
Le latch de la passe 1 protège du blob corrompu, mais un échec **réseau** du GET initial arme quand même l'écriture : le premier réglage modifié re-PUT l'état quasi-défaut par-dessus le blob serveur (thème, langue, annonces masquées… réinitialisés). Le correctif a déplacé la fenêtre au lieu de la fermer.
**Correctif** : état `failed` distinct ; à la première écriture après un échec, re-tenter le GET et fusionner avant de PUT.

### 1.4 Les exports (clair ET chiffré .age) omettent silencieusement un module en échec
`collect-modules.ts` · `ExportPanel.tsx` · `BackupExportPanel.tsx` · `backup-pack.ts`
Un module dont la collecte échoue est retiré du fichier **sans aucun avertissement** (« ✓ Export réussi »). L'utilisateur·ice découvre le trou le jour où le backup doit servir. Le mécanisme `failed_modules` existe dans le manifest et le code… mais le paramètre n'est jamais passé (mort-né). Divergence doc-vs-code.
**Correctif** : `collectModules` retourne `{out, failed}` ; les panels affichent l'avertissement ; `packBackup` reçoit enfin `failedModules`.

### 1.5 La restauration d'un backup casse tous les liens entre enregistrements
`import-export/*` (les payloads référencent des ids de lignes serveur)
`itemRid` (reviews→livres, logs→habitudes), `scheduleId` (doses→plannings), `coverRid` pointent vers des ids que la restauration **recrée différents** — et l'export ne stocke pas les anciens ids, donc aucun remappage possible. Résultat post-restauration : notes de lecture sans livre, heatmap d'habitudes vide, doses délié​es de leur planning. Les couvertures Library ne sont par ailleurs pas exportées du tout.
**Correctif** : embarquer l'id source dans l'enveloppe d'export, restaurer parents d'abord, table `ancienId → nouvelId`, réécrire les références avant d'importer les collections filles.

---

## 🟠 Priorité 2 — performance (le plan anti-« ça rame »)

Diagnostic mesuré : crypto + zod + JSON ≈ 0,3–0,5 s à 2000 entrées (zod = 10 ms/2000, AES = 105 ms — **pas le problème**). Le problème est ailleurs :

### 2.1 La virtualisation ne s'active jamais (Journal, Goals, Library)
`VirtualWindowList` (seuil 100) est instanciée **par groupe** — or le groupage par fil/statut fait des groupes de ~80 : tout passe sous le seuil, **2000 lignes DOM réelles** montées, chacune parsant son markdown intégral (le clamp 4 lignes est purement CSS) + ses miniatures. Les entrées multi-fils sont en plus dupliquées par bucket. Mood est le seul module réellement virtualisé. **C'est la cause n°1 du lag de rendu.**
**Correctif** : aplatir en une seule liste virtualisée d'items hétérogènes (header de groupe = un item) ; tronquer le texte passé à l'aperçu markdown (~600 caractères).

### 2.2 Chaque « Enregistrer » de formulaire re-télécharge la collection entière
La passe 1 a supprimé le refetch des suppressions/toggles, mais **pas des créations/éditions par formulaire** — l'action la plus fréquente. Journal : ~45 Mo re-téléchargés (images comprises) pour avoir écrit 3 lignes ; Library : les 3 collections + couvertures repartent pour une note éditée.
**Correctif** : `create()`/`update()` retournent déjà l'enregistrement frais — insérer/remplacer localement (le modèle existe dans HRT `use-admin-logs`). Supprimer les 5 bumps de formulaires ; scinder l'effet Library en deux (items+reviews / covers).

### 2.3 Aucune mémoire entre deux visites d'un module
Chaque navigation sidebar démonte le provider et jette les données déchiffrées : Home ↔ Journal = 2 × (réseau + déchiffrement + parse) de la même collection. Les compteurs de version du store n'invalident rien — rien n'y est mis en cache.
**Correctif** : cache mémoire versionné des listes déchiffrées (Map module → `{version, records}` hors React, purgé au logout). Réalisable sans changement serveur, complément naturel de #130.

### 2.4 Trois mémoïsations contournées (dont une de la passe 1)
- `setViewMode` recréé à chaque render (Goals + Library) → la mémoïsation field-by-field de la passe 1 **ne protège plus rien** ; 2 lignes de `useCallback` la restaurent.
- `formOpen`/`editingEntry`/`readingId` vivent dans le contexte *actions* que les lignes mémoïsées consomment → ouvrir un formulaire re-rend **toutes** les lignes (2000 re-parses markdown). Scinder en contexte form-state (consommé par le shell) et contexte actions (callbacks seuls).
- Chaque frappe de recherche re-rend le module entier en priorité urgente (le `useDeferredValue` ne couvre que le recalcul, pas la réconciliation des ~546 cellules de heatmap Mood ou des tuiles BookWall). Isoler `searchQuery` (état local du TopbarSearchInput) + `memo` sur les vues galerie.

### 2.5 Le reste du plan perf
- HRT : produits, analyses et plannings encore re-listés à chaque bascule de sous-vue (seuls les admin-logs ont été hissés en passe 1) — même geste pour les 3 hooks restants ; ExportView crée même une 2ᵉ instance de schedules.
- Recherche : ~45 ms de re-normalisation NFD du corpus entier **par frappe** — pré-normaliser les haystacks une fois par changement d'entries (÷100).
- Library : couvertures téléchargées même en vue liste sans couvertures (15–30 Mo résidents à 300 livres) — fetch à la demande par mode ; envisager les blob-URLs.
- Pièces jointes : double base64 = **+78 % réseau et mémoire** (l'image est base64 dans le JSON, le ciphertext re-base64 pour le transport) — une raison de plus de remonter #59.
- api : `promote-guards` fait N UPDATE séquentiels (2–4 s sur un import de 3000) — un seul UPDATE…FROM VALUES.
- Micro : `base64ToBytes` octet par octet (145 ms vs 35 ms natif pour 63 Mo — `Uint8Array.fromBase64` avec fallback) ; `res.json()` au lieu de text+parse (pic mémoire 3×) ; changement de langue re-télécharge Mood/Journal/HRT (pattern `tRef` de Library à appliquer) ; HRT LabChart re-calcule tout au survol d'un point ; `memo(LiteMarkdown)` ; arrows inline qui cassent `memo(AdminLogRow)` ; heatmap Journal démontée/remontée au toggle (la garder montée + mémoïsée, pattern Mood) ; data-URIs de miniatures reconstruites à chaque render.

---

## 🟡 Priorité 3 — bugs et sécurité (moyens)

| # | Quoi | Où |
|---|---|---|
| 3.1 | PATCH d'une annonce la **ré-active** silencieusement (le `.default(true)` survit au `.partial()` — bug zod confirmé par exécution) | `schemas/announcements.ts` |
| 3.2 | Resend d'invite : l'INSERT s'exécute **hors** de la transaction qui prétend le couvrir (pool global vs tx) | `admin-invites.ts` + `invites.ts` |
| 3.3 | Sentry api : l'intégration `NodeFetch` émet encore des breadcrumbs sortants (host/path des providers lookup) — le filtre de la passe 1 a raté ce 3ᵉ nom d'intégration ; le scrubber de 2ᵉ couche retient le pire (la recherche), mais il ne reste qu'une couche | `api/sentry.ts` |
| 3.4 | HRT : sous le verrou inter-onglets, l'onglet en attente réécrit le planning avec un payload **pré-verrou** (écrase une édition concurrente) — re-lister les schedules sous le lock | `use-schedule-materialization.ts` |
| 3.5 | `restoreEnvelope` : la première erreur d'un module interrompt tout le restore et perd le rapport des modules déjà importés (le doc-comment promet l'inverse) | `restore-envelope.ts` |
| 3.6 | Premier login : la config seedée peut être écrasée par la réponse (périmée) du GET d'hydratation parti avant — la slice modules n'a pas le write-seq des préférences | `useModulesHydration.ts` vs `useFirstRunSeed.ts` |
| 3.7 | Review : un brouillon vide fantôme est créé dès l'ouverture du wizard ; deux bilans possibles la même année + brouillon rendu invisible/insupprimable ; suppression d'un bilan sans aucun feedback d'erreur | `Wizard.tsx`, `List.tsx`, `useReview.ts` |
| 3.8 | Habits : supprimer une habitude promet « et tous ses logs » mais les laisse orphelins (module dormant, mais le data-layer vit via import/export) | `useHabits.ts` |
| 3.9 | `createMany` : pré-check individuel à 16 Mo alors que le serveur borne chaque entrée à 8 Mo → un restore peut échouer chunk entier avec un message générique | `collection-client.ts` |
| 3.10 | Invite : un échec d'envoi d'email laisse une invitation valide « fantôme » (et chaque re-essai en empile une) | `admin-invites.ts` |
| 3.11 | `modules-config`/`user-preferences` : last-write-wins ni documenté ni protégé — deux appareils peuvent se perdre un sid (= données du module inaccessibles) ; décider : précondition 409 ou doc | routes api + docs |
| 3.12 | `NODE_ENV` par défaut `development` (CORS localhost credentialed + garde-fous email inactifs) pour tout déploiement hors compose du repo | `config.ts`, Dockerfile |
| 3.13 | Échec d'envoi du mail de notification change-email loggé **en prod** avec `err.message` (les erreurs SMTP échoent souvent l'adresse) — seul chemin mailer non gate-é des 6 ; même classe sur reset/activation/invites | `auth-account.ts` + 3 autres |

## 🟢 Priorité 4 — faibles (sélection)

- Quota change-email (1/24 h) consommé même sur échec/typo → un 409 bloque 24 h ; consommer après succès.
- change-email : UPDATE users + révocation sessions non transactionnels ; `email_changed_at` (cooldown spec §13) jamais écrit — drift spec/code.
- `dismissedAnnouncements` : union jamais élaguée (élaguer contre la liste live à l'hydratation).
- `/version` public expose commit/branche/date de build — assumer ou gater.
- Deux PUT de préférences rapprochés peuvent s'inverser (file d'écriture sérialisée).
- Index manquant `email_verifications(code_hash)` ; purges manquantes (reset tokens, invites expirées — l'admin les voit comme « valides » —, bypass requests) ; throttle already-exists sans sweep.
- `GET /announcements` expose `createdBy` (id admin) à tout compte ; fenêtre `startAt > endAt` acceptée ; datetimes UTC-only non documentés ; listing admin users sans pagination.
- Exports : `wb.creator='Nodea'` dans les .xlsx ; noms de fichiers `nodea_hrt_*` révèlent le module dans Téléchargements (documenter le compromis dans HRT.md, comme Library l'a fait) ; `revokeObjectURL` immédiat après click (différer d'un tick).
- 3 champs mot de passe sans `autoComplete="current-password"` (wipe, suppression de compte, export clair).
- Pas de feuille de style print : Ctrl+P imprime la surface déchiffrée intégrale — garde-fou peu coûteux pour une app santé mentale.
- `tech.md` sur-promet : « ni Nginx ni Hono n'enregistrent le header » — vrai *par défaut* seulement ; le header `X-Collection` est visible de l'opérateur du proxy TLS, et le motif tailles/cadence des LIST permet le fingerprint. Une phrase d'honnêteté à ajouter.
- Année Review : `Number(x) || currentYear` — champ invidable, « 2 » crée un bilan an 2 ; tri Home arbitraire à deux entrées le même jour ; heatmap Habits décalée d'un jour aux changements d'heure ; popstate retombe parfois sur home ; inventaire des 16 `window.confirm` + 4 `alert()` ; i18n résiduel hors périmètre lot G (pages auth, Admin, Review steps — à trancher) ; doc drift (`Layout.tsx` référence un Onboarding.tsx disparu ; CLAUDE.md dit Habits « shipping » vs registry « dormant » ; CLAUDE.md dit `SameSite=Lax` vs code `Strict`).

---

# Roadmap de correction — passe 2

## Lot P2-A — Régressions de la passe 1 *(à faire en premier, ½ journée)*
- [ ] 1.1 Backfill `user_identifier` + estampillage dans change-email (transaction)
- [ ] 1.2 Latch lecture-seule sur `modules_config` + toggles désactivés tant que non hydraté
- [ ] 1.3 Préférences : état `failed` + re-GET-et-fusion avant première écriture
- [ ] 3.3 Ajouter `NodeFetch` au filtre d'intégrations Sentry api
- [ ] 3.4 Re-lister les schedules sous le verrou HRT avant l'update
- [ ] 3.13 Gate-er les 4 logs mailer en prod

## Lot P2-B — Intégrité des backups *(1-2 jours)*
- [ ] 1.4 Exports : avertissement modules en échec + `failedModules` câblé
- [ ] 1.5 Export/restore : ids sources + remappage des références
- [ ] 3.5 Restore : continuer après un module en échec + rapport fidèle
- [ ] 3.9 Pré-check `createMany` aligné sur la borne serveur 8 Mo

## Lot P2-C — Performance rendu *(1-2 jours — le plan anti-lag)*
- [ ] 2.4a `useCallback` sur `setViewMode` (2 lignes, restaure la passe 1)
- [ ] 2.4b Scission contexte form-state / actions (Mood, Goals, Journal, Library)
- [ ] 2.1 Virtualisation aplatie Journal/Goals/Library + aperçu markdown tronqué
- [ ] 2.4c Recherche : état local input + `memo` des vues galerie/charts
- [ ] `memo(LiteMarkdown)`, fixes HRT (rows, LabChart hover), heatmap Journal montée

## Lot P2-D — Performance données *(1-2 jours)*
- [ ] 2.2 Fin des refetch après create/update des 5 formulaires (insertion locale)
- [ ] 2.5a Hisser les 3 hooks HRT restants
- [ ] 2.5b Haystacks de recherche pré-normalisés
- [ ] 2.5c Couvertures Library à la demande par mode
- [ ] 2.3 Cache inter-montage versionné des listes déchiffrées
- [ ] 2.5d `promote-guards` en un seul UPDATE ; `res.json()` ; `Uint8Array.fromBase64` ; `tRef` sur les effets de fetch

## Lot P2-E — Bugs moyens *(1-2 jours)*
- [ ] 3.1 Schéma Update des annonces sans `.default` résiduel + test
- [ ] 3.2 `createInvite` transactionnel (exécuteur injecté)
- [ ] 3.6 Write-seq sur la slice modules (seed vs hydratation)
- [ ] 3.7 Review : brouillon fantôme, unicité par année, feedback de suppression
- [ ] 3.8 Habits : suppression des logs orphelins
- [ ] 3.10 Invite fantôme sur échec d'email
- [ ] 3.11 Décision LWW (409 ou doc) ; 3.12 garde-fou NODE_ENV

## Lot P2-F — Hygiène *(au fil de l'eau)*
Tout le « Priorité 4 » ci-dessus + drift docs (tech.md, CLAUDE.md SameSite/Habits, Layout.tsx).
