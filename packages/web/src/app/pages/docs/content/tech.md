## Threat model — résumé

**On protège contre :**

- Lecture du contenu utilisateur côté serveur (DBA, dump, backup volé, requête légale opérante sur le ciphertext seul) — le serveur ne possède jamais de clé en clair.
- Récupération du mot de passe à partir d'un dump DB — OPAQUE, pas de hash brute-forçable côté serveur.
- Énumération des comptes (register / login / recover / bypass MFA / reset) — anti-enum systématique, réponses indistinguables.
- Falsification d'une mutation par un attaquant qui aurait un cookie de session valide mais pas la clé maîtresse — guard HMAC requis pour toute UPDATE / DELETE sur une entrée chiffrée.
- Compromission d'un seul facteur d'auth — modes `always_totp` et `maximum` exigent plusieurs facteurs, code de récupération hors-ligne pour les scénarios de perte.

**On ne protège pas contre :**

- **Serveur compromis qui sert du JS modifié** — limite inhérente au modèle web. Mitigations : SRI sur l'entry chunk, `INTEGRITY.txt` manifest par release, recommandation auto-hébergement pour usages sensibles. Cf. [Security.md §7](https://github.com/aliceout/Nodea/blob/main/docs/Security.md#7-the-web-app-supply-chain-limit-must-read).
- Compromission complète du device utilisateur (keylogger, malware à privilèges noyau) — la clé maîtresse vit dans le navigateur au moment de l'usage ; un attaquant root sur ta machine peut la lire.
- Mot de passe trivial choisi par l'utilisateur — politique zxcvbn score ≥ 3 + min 12 chars, mais on ne peut pas garantir l'entropie au-delà.
- Métadonnées résiduelles (timestamps, taille des blobs, fréquence d'écriture) — on log le minimum mais quelques signaux fuitent inévitablement à un opérateur de l'instance.

## Invariants permanents

Quoi qu'il arrive sur le code, ces invariants tiennent. Toute PR qui les viole doit être rejetée — c'est le contrat.

- La clé maîtresse n'existe jamais sur le serveur, ni en mémoire ni en logs. Elle est non-extractible côté navigateur via `CryptoKey` WebCrypto.
- HKDF domain separation — la clé maîtresse 32 octets est stretchée en deux sous-clés (label `"nodea:aes"` / `"nodea:hmac"`) avant import. Aucune clé partagée entre AES et HMAC.
- AAD (additional authenticated data) sur tous les wraps : `nodea:v1\x1f<userId>\x1f<factor>`. Empêche un row-swap serveur de tromper le client en lui servant le wrap d'un autre utilisateur ou d'un autre facteur.
- Toute mutation d'entrée chiffrée passe par `requireGuard`. Ajouter une nouvelle collection = une ligne dans `collections/registry.ts` ; impossible d'enrôler une collection sans validation HMAC.
- Sessions : cookies HttpOnly / Signed / SameSite=Lax / Secure en prod. Révocation = DELETE en DB, prend effet immédiatement (pas de JWT).
- Rotation systématique des sessions sur tout changement privilège (change-password, security-mode-change, recovery-code consommé, MFA bypass appliqué). Auth-Spec §5.4.

## Algos figés

La [spec auth complète](https://github.com/aliceout/Nodea/blob/main/docs/Auth-Spec.md) (§13) liste tous les paramètres avec leurs valeurs exactes. Versions en V1 :

- **OPAQUE** — `@serenity-kit/opaque` 1.1.0, ristretto255 + SHA-512.
- **Symmetric** — AES-256-GCM (12-byte IV aléatoire, 16-byte tag), via WebCrypto.
- **HMAC** — HMAC-SHA-256 sur sous-clé HKDF, guard = `"g_" + hex(HMAC(hmacSubKey, sid + ":" + recordId))`.
- **KDF** — HKDF-SHA-256 avec labels figés (`nodea:aes`, `nodea:hmac`, `nodea:wrap-kek`, `nodea:wrap-main`).
- **WebAuthn / Passkey** — `@simplewebauthn` 13.3.0, UV obligatoire (vérifié côté serveur), PRF pour déchiffrer la KEK quand l'authenticator le supporte.
- **TOTP** — RFC 6238, SHA-1 / 6 chiffres / 30 s, ±1 window de skew, anti-replay via stockage du dernier window matché.
- **Recovery code** — BIP39 12 mots (128 bits d'entropie), HKDF sur les bytes pour dériver la wrap-key, SHA-256 hex pour le gate anti-DoS serveur.

## Documentation technique de référence

Tout le détail vit dans le repo, mis à jour avec le code (règle CLAUDE.md : doc et code sont une seule source de vérité, dans le même PR).

- [Auth-Spec.md](https://github.com/aliceout/Nodea/blob/main/docs/Auth-Spec.md) — spécification auth complète, ~2700 lignes : threat model formel, schéma cryptographique détaillé, flows complets, matrice de re-auth, anti-patterns interdits, test matrix.
- [Security.md](https://github.com/aliceout/Nodea/blob/main/docs/Security.md) — politique sécu vivante : invariants, rate-limit catalogue (§5.1), protections serveur, supply-chain limit (§7).
- [Architecture.md](https://github.com/aliceout/Nodea/blob/main/docs/Architecture.md) — vue d'ensemble du code (api / web / shared), routes, runtime, stack frontend.
- [Database.md](https://github.com/aliceout/Nodea/blob/main/docs/Database.md) — schéma Postgres complet, FK cascades, AAD pour chaque blob chiffré.

## Auditer, contribuer, signaler

- **Auditer** — clone le repo, `pnpm install`, `pnpm test`. La suite api couvre 220+ tests d'intégration contre un Postgres réel, la suite web couvre les round-trips crypto en unitaire.
- **Contribuer** — issues étiquetées dans [le tracker GitHub](https://github.com/aliceout/Nodea/issues). CLAUDE.md à la racine du repo décrit les règles dures (crypto, monorepo, conventions).
- **Signaler une vulnérabilité** — ouvre une issue *non publique* via [GitHub Security Advisories](https://github.com/aliceout/Nodea/security/advisories) (pas une issue normale — la coordination de divulgation passe par là).
