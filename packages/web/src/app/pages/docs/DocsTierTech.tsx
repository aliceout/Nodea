import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

/**
 * Docs — onglet « Pour les profils sécu ».
 *
 * Audience : auditeur·ice, contributeur·ice, lecteur·ice technique
 * sécu qui veut le threat model formel, les invariants, les algos
 * figés. Ce tier garde un format CONCIS (résumé top-level, listes
 * courtes) et linke vers les docs détaillées sur GitHub —
 * `docs/Auth-Spec.md` est la référence exhaustive (~2700 lignes),
 * dupliquer ici serait ingérable.
 *
 * Contrat de contenu : 30% original (threat model résumé,
 * invariants, périmètre), 70% links sortants. Quand un détail
 * change, on update la spec ; ce tier reste majoritairement stable
 * via ses liens.
 */

const REPO = 'https://github.com/aliceout/Nodea';
const DOCS = `${REPO}/blob/main/docs`;

export default function DocsTierTech() {
  return (
    <div className="space-y-10">
      <Section title="Threat model — résumé">
        <p className="font-medium text-ink">On protège contre :</p>
        <ul className="space-y-2">
          <Bullet>
            Lecture du contenu utilisateur côté serveur (DBA, dump, backup
            volé, requête légale opérante sur le ciphertext seul) — le
            serveur ne possède jamais de clé en clair.
          </Bullet>
          <Bullet>
            Récupération du mot de passe à partir d'un dump DB — OPAQUE,
            pas de hash brute-forçable côté serveur.
          </Bullet>
          <Bullet>
            Énumération des comptes (register / login / recover / bypass MFA
            / reset) — anti-enum systématique, réponses indistinguables.
          </Bullet>
          <Bullet>
            Falsification d'une mutation par un attaquant qui aurait un
            cookie de session valide mais pas la clé maîtresse — guard HMAC
            requis pour toute UPDATE / DELETE sur une entrée chiffrée.
          </Bullet>
          <Bullet>
            Compromission d'un seul facteur d'auth — modes{' '}
            <code className="font-mono text-[13px]">always_totp</code> et{' '}
            <code className="font-mono text-[13px]">maximum</code> exigent
            plusieurs facteurs, code de récupération hors-ligne pour les
            scénarios de perte.
          </Bullet>
        </ul>

        <p className="mt-4 font-medium text-ink">On ne protège pas contre :</p>
        <ul className="space-y-2">
          <Bullet>
            <strong>Serveur compromis qui sert du JS modifié</strong> — limite
            inhérente au modèle web. Mitigations : SRI sur l'entry chunk,{' '}
            <code className="font-mono text-[13px]">INTEGRITY.txt</code> manifest
            par release, recommandation auto-hébergement pour usages
            sensibles. Cf.{' '}
            <ExtLink href={`${DOCS}/Security.md#7-the-web-app-supply-chain-limit-must-read`}>
              Security.md §7
            </ExtLink>
            .
          </Bullet>
          <Bullet>
            Compromission complète du device utilisateur (keylogger, malware
            à privilèges noyau) — la clé maîtresse vit dans le navigateur
            au moment de l'usage ; un attaquant root sur ta machine peut la
            lire.
          </Bullet>
          <Bullet>
            Mot de passe trivial choisi par l'utilisateur — politique zxcvbn
            score ≥ 3 + min 12 chars, mais on ne peut pas garantir
            l'entropie au-delà.
          </Bullet>
          <Bullet>
            Métadonnées résiduelles (timestamps, taille des blobs, fréquence
            d'écriture) — on log le minimum mais quelques signaux fuitent
            inévitablement à un opérateur de l'instance.
          </Bullet>
        </ul>
      </Section>

      <Section title="Invariants permanents">
        <p>
          Quoi qu'il arrive sur le code, ces invariants tiennent. Toute PR
          qui les viole doit être rejetée — c'est le contrat.
        </p>
        <ul className="space-y-2">
          <Bullet>
            La clé maîtresse n'existe jamais sur le serveur, ni en mémoire
            ni en logs. Elle est non-extractible côté navigateur via{' '}
            <code className="font-mono text-[13px]">CryptoKey</code> WebCrypto.
          </Bullet>
          <Bullet>
            HKDF domain separation — la clé maîtresse 32 octets est
            stretchée en deux sous-clés (label{' '}
            <code className="font-mono text-[13px]">"nodea:aes"</code> /{' '}
            <code className="font-mono text-[13px]">"nodea:hmac"</code>) avant
            import. Aucune clé partagée entre AES et HMAC.
          </Bullet>
          <Bullet>
            AAD (additional authenticated data) sur tous les wraps :{' '}
            <code className="font-mono text-[13px]">
              nodea:v1\x1f&lt;userId&gt;\x1f&lt;factor&gt;
            </code>
            . Empêche un row-swap serveur de tromper le client en lui
            servant le wrap d'un autre utilisateur ou d'un autre facteur.
          </Bullet>
          <Bullet>
            Toute mutation d'entrée chiffrée passe par{' '}
            <code className="font-mono text-[13px]">requireGuard</code>. Ajouter
            une nouvelle collection = une ligne dans{' '}
            <code className="font-mono text-[13px]">collections/registry.ts</code>{' '}
            ; impossible d'enrôler une collection sans validation HMAC.
          </Bullet>
          <Bullet>
            Sessions : cookies HttpOnly / Signed / SameSite=Lax / Secure en
            prod. Révocation = DELETE en DB, prend effet immédiatement
            (pas de JWT).
          </Bullet>
          <Bullet>
            Rotation systématique des sessions sur tout changement
            privilège (change-password, security-mode-change, recovery-code
            consommé, MFA bypass appliqué). Auth-Spec §5.4.
          </Bullet>
        </ul>
      </Section>

      <Section title="Algos figés">
        <p>
          La <ExtLink href={`${DOCS}/Auth-Spec.md`}>spec auth complète</ExtLink>{' '}
          (§13) liste tous les paramètres avec leurs valeurs exactes. Versions
          en V1 :
        </p>
        <ul className="space-y-2">
          <Bullet>
            <strong>OPAQUE</strong> — <code className="font-mono text-[13px]">@serenity-kit/opaque</code>{' '}
            1.1.0, ristretto255 + SHA-512.
          </Bullet>
          <Bullet>
            <strong>Symmetric</strong> — AES-256-GCM (12-byte IV aléatoire,
            16-byte tag), via WebCrypto.
          </Bullet>
          <Bullet>
            <strong>HMAC</strong> — HMAC-SHA-256 sur sous-clé HKDF, guard =
            <code className="font-mono text-[13px]">
              "g_" + hex(HMAC(hmacSubKey, sid + ":" + recordId))
            </code>
            .
          </Bullet>
          <Bullet>
            <strong>KDF</strong> — HKDF-SHA-256 avec labels figés (
            <code className="font-mono text-[13px]">nodea:aes</code>,{' '}
            <code className="font-mono text-[13px]">nodea:hmac</code>,{' '}
            <code className="font-mono text-[13px]">nodea:wrap-kek</code>,{' '}
            <code className="font-mono text-[13px]">nodea:wrap-main</code>).
          </Bullet>
          <Bullet>
            <strong>WebAuthn / Passkey</strong> —{' '}
            <code className="font-mono text-[13px]">@simplewebauthn</code> 13.3.0,
            UV obligatoire (vérifié côté serveur), PRF pour déchiffrer la
            KEK quand l'authenticator le supporte.
          </Bullet>
          <Bullet>
            <strong>TOTP</strong> — RFC 6238, SHA-1 / 6 chiffres / 30 s, ±1
            window de skew, anti-replay via stockage du dernier window
            matché.
          </Bullet>
          <Bullet>
            <strong>Recovery code</strong> — BIP39 12 mots (128 bits
            d'entropie), HKDF sur les bytes pour dériver la wrap-key,
            SHA-256 hex pour le gate anti-DoS serveur.
          </Bullet>
        </ul>
      </Section>

      <Section title="Documentation technique de référence">
        <p>
          Tout le détail vit dans le repo, mis à jour avec le code (règle
          CLAUDE.md : doc et code sont une seule source de vérité, dans le
          même PR).
        </p>
        <ul className="space-y-2">
          <Bullet>
            <ExtLink href={`${DOCS}/Auth-Spec.md`}>Auth-Spec.md</ExtLink>{' '}
            — spécification auth complète, ~2700 lignes : threat model
            formel, schéma cryptographique détaillé, flows complets, matrice
            de re-auth, anti-patterns interdits, test matrix.
          </Bullet>
          <Bullet>
            <ExtLink href={`${DOCS}/Security.md`}>Security.md</ExtLink>{' '}
            — politique sécu vivante : invariants, rate-limit catalogue
            (§5.1), protections serveur, supply-chain limit (§7).
          </Bullet>
          <Bullet>
            <ExtLink href={`${DOCS}/Architecture.md`}>Architecture.md</ExtLink>{' '}
            — vue d'ensemble du code (api / web / shared), routes, runtime,
            stack frontend.
          </Bullet>
          <Bullet>
            <ExtLink href={`${DOCS}/Database.md`}>Database.md</ExtLink>{' '}
            — schéma Postgres complet, FK cascades, AAD pour chaque blob
            chiffré.
          </Bullet>
        </ul>
      </Section>

      <Section title="Auditer, contribuer, signaler">
        <ul className="space-y-2">
          <Bullet>
            <strong>Auditer</strong> — clone le repo,{' '}
            <code className="font-mono text-[13px]">pnpm install</code>,{' '}
            <code className="font-mono text-[13px]">pnpm test</code>. La
            suite api couvre 220+ tests d'intégration contre un Postgres
            réel, la suite web couvre les round-trips crypto en unitaire.
          </Bullet>
          <Bullet>
            <strong>Contribuer</strong> — issues étiquetées dans{' '}
            <ExtLink href={`${REPO}/issues`}>le tracker GitHub</ExtLink>.
            CLAUDE.md à la racine du repo décrit les règles dures
            (crypto, monorepo, conventions).
          </Bullet>
          <Bullet>
            <strong>Signaler une vulnérabilité</strong> — ouvre une issue
            <em> non publique</em> via{' '}
            <ExtLink href={`${REPO}/security/advisories`}>
              GitHub Security Advisories
            </ExtLink>{' '}
            (pas une issue normale — la coordination de divulgation passe
            par là).
          </Bullet>
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-[22px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      <div className="space-y-3 text-[15.5px] leading-[1.65] text-ink-soft">
        {children}
      </div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-accent" />
      <span>{children}</span>
    </li>
  );
}

function ExtLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-accent underline-offset-2 hover:text-accent-deep hover:underline"
    >
      {children}
      <ArrowTopRightOnSquareIcon className="h-3 w-3" aria-hidden="true" />
    </a>
  );
}
