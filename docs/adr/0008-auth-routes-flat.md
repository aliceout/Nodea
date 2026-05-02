# 0008 — Dossier `auth/` plat plutôt que séparé en couches

- **Status** : Accepted
- **Date** : 2026-05 (cycle d'audit, Tier 4)

## Context

Le code d'authentification serveur vit dans `packages/api/src/routes/` avec une dizaine de fichiers à plat : `auth-login.ts`, `auth-recovery.ts`, `auth-passkey-enroll.ts`, `auth-passkey-login.ts`, `auth-passkey-manage.ts`, `auth-totp.ts`, `auth-mfa.ts`, `auth-mfa-bypass.ts`, `auth-reauth.ts`, `auth-register-v2.ts`, `auth-account.ts`, `auth-security-mode.ts`, `auth-change-password.ts`, `auth-reset.ts`. Chaque fichier mélange handlers HTTP, validation Zod, appels DB et logique cryptographique.

L'alternative classique en architecture serveur est de séparer en couches :
- `auth/services/` — business logic (orchestrateurs OPAQUE, gestion des sessions).
- `auth/domain/` — entités métier (User, Session, RecoveryCode).
- `auth/infra/` — accès DB, mailer, services externes.
- Les fichiers `routes/` ne feraient plus que le binding HTTP → service.

C'est le pattern du Domain-Driven Design appliqué à une couche auth. Beaucoup de codebases le font.

## Decision

**Garder l'organisation plate, ne pas séparer en couches.**

## Consequences

**Positives :**
- **Pas de couches vides ou maigrement remplies.** Le domaine d'auth de Nodea, c'est de la cryptographie d'infrastructure (OPAQUE handshake, dérivation de clés, vérification HMAC, gestion de sessions). Il n'y a pas de logique métier riche du genre "calculer le score de risque d'un login" ou "appliquer la règle d'éligibilité X" qui justifierait une couche `domain/` propre. Découper produirait surtout des dossiers mostly-vides ou avec un seul fichier dedans.
- **Chaque flow lit en un seul fichier.** Comprendre comment fonctionne le passkey enrollment se fait en lisant `auth-passkey-enroll.ts` du début à la fin. En séparation par couches, il faudrait sauter entre `routes/auth-passkey-enroll.ts`, `services/passkey-service.ts`, `domain/passkey.ts`, `infra/passkey-repository.ts` — friction inutile sur un flow déjà complexe par lui-même.
- **Tests faciles.** `supertest(buildApp())` avec une DB de test, on appelle l'endpoint et on vérifie le résultat. Pas besoin de mocker un service ou d'injecter une dépendance — la logique est appelable directement via HTTP.

**Négatives :**
- **Les fichiers `auth-*.ts` ont des comportements transverses qui se répètent un peu.** Genre la dérivation OPAQUE est utilisée dans `auth-login.ts`, `auth-change-password.ts` et `auth-recovery.ts`. C'est mitigé par les helpers extraits dans `packages/api/src/auth/` (les modules `opaque.ts`, `cookies.ts`, `mfa-bypass.ts`, etc.) qui jouent le rôle d'une couche de service implicite, sans le formalisme d'un dossier `services/`.
- **Risque qu'un dev "bien intentionné" tente la séparation en couches** parce que c'est ce qu'il a fait sur un autre projet. Cet ADR sert précisément à éviter ce coût.

## Alternatives considered

- **Séparation classique services/domain/infra.** Écarté pour la raison principale ci-dessus : pas de domaine métier riche à isoler. La couche `domain/` serait un ensemble d'interfaces TypeScript et trois fonctions, et `infra/` serait surtout du wrapping de Drizzle. Coût (boilerplate, sauts entre fichiers) plus élevé que le bénéfice (lisibilité conceptuelle).
- **Séparation à mi-chemin** : un dossier `auth/services/` qui contient les helpers (OPAQUE, cookies, sessions) et les routes au niveau racine de `routes/`. C'est en gros ce qu'on a déjà — `packages/api/src/auth/` joue ce rôle. La distinction est implicite plutôt qu'explicite, ce qui est OK tant qu'elle reste évidente à la lecture.

## Quand reconsidérer

Si la couche auth gagne un vrai domaine métier (genre une politique de risque évaluée au login basée sur l'historique de l'utilisateur, ou une stratégie multi-tenant avec des règles différentes par organisation), à ce moment-là le coût de la séparation en couches devient justifié. Tant qu'on est dans le pattern actuel (handlers HTTP + helpers cryptographiques + accès DB direct), garder plat.
