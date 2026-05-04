<!-- markdownlint-disable -->

> Cette page est en cours d'écriture. Le contenu détaillé sera transféré ici depuis le repo GitHub dans les jours qui viennent. En attendant, les sources de vérité sont dans `docs/Development.md` du repo et les ADR dans `docs/adr/`.

## À qui s'adresse cette page

Tu veux porter une feature, corriger un bug, ou comprendre comment Nodea est agencé sous le capot pour pouvoir contribuer ? Cette page va t'orienter.

Si tu veux **comprendre la sécurité** sans toucher au code, va plutôt sur la section [Sécurité](/docs/security/newbie). Si tu veux **héberger ton propre Nodea**, va sur [Auto-héberger](/docs/self-host).

## Setup local

```bash
git clone https://github.com/aliceout/Nodea.git
cd Nodea
pnpm install
cp .env.example .env
docker compose up -d postgres mailpit
pnpm --filter @nodea/api db:migrate
```

Variables d'environnement minimales : `COOKIE_SECRET` (32 chars random) et `OPAQUE_SERVER_SETUP` (généré une fois). Le détail des commandes pour générer ces secrets, plus toutes les variantes de config, sera ici prochainement.

Pour lancer les services en dev :

```bash
pnpm --filter @nodea/api dev   # API Hono sur :3000
pnpm --filter @nodea/web dev   # Web Vite sur :8089
```

## Lancer les tests

Trois suites cohabitent.

```bash
pnpm --filter @nodea/api test  # ~278 tests, ~3 min
pnpm --filter @nodea/web test  # ~319 tests, ~5 s
pnpm --filter @nodea/e2e test  # 13 specs Playwright, ~3-5 min
```

Pour les tests e2e, prérequis machine : Postgres + Mailpit en route, plus le binaire Chromium (`pnpm --filter @nodea/e2e install:browsers` une fois).

## Invariants à respecter

Nodea est **chiffré de bout en bout**. Quelques règles cassent silencieusement la sécurité — les connaître évite de les casser.

- **Jamais de `CryptoKey` ou de matériel cryptographique brut dans un log, le DOM, ou `localStorage`.** Pas de `console.log(mainKey)`, pas de `window.mainKey`. La clé maître vit en mémoire WebCrypto en mode `extractable: false` ; ré-introduire un fallback global est une régression critique.
- **HKDF avec étiquettes distinctes** entre AES-GCM et HMAC-SHA-256 (`"nodea:aes"` et `"nodea:hmac"`). Ne jamais importer les mêmes octets bruts comme deux clés différentes — chaque sous-clé est dérivée séparément.
- **Une seule source pour `randomBytes` et le base64.** Ne pas réimplémenter ces helpers — utilise le module partagé.
- **Les guards HMAC ne sont JAMAIS persistés en `localStorage`.** Cache mémoire uniquement, purgé au logout.
- **Branded types** (`Base64`, `AesMainKey`, `HmacMainKey`, `CipherIV`) — confondre les types doit échouer à la compilation.

## Décisions architecturales

Avant de remettre en cause un pattern, lis l'ADR correspondant. Il y a souvent une raison non-évidente.

- [ADR-0006 + 0013](https://github.com/aliceout/Nodea/tree/main/docs/adr) — store Zustand mono-instance, splitté en slices.
- [ADR-0011](https://github.com/aliceout/Nodea/tree/main/docs/adr) — migrations Drizzle forward-only, pas de `down.sql`.
- [ADR-0012](https://github.com/aliceout/Nodea/tree/main/docs/adr) — tout-camelCase sur le wire, plus de mapper snake → camel.
- Les autres ADR couvrent l'architecture en couches, le client API web, le routing flat de auth/, la stratégie « pas de cache de requêtes », etc.

## Aller plus loin

Le repo GitHub contient encore quelques pages techniques exhaustives :

- `docs/Architecture.md` — état du code (où vit quoi, runtime, middleware).
- `docs/Database.md` — schéma Postgres complet avec contraintes et AAD.
- `docs/Auth-Spec.md` — spec auth exhaustive (référence, pas une lecture rapide).
- `docs/Security.md` — invariants crypto, rate-limit, modèle de menaces.

Ces pages migreront dans les sections appropriées de cette doc en ligne au fur et à mesure.
