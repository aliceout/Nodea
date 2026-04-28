/**
 * Docs — onglet « Comment ça marche ».
 *
 * Audience : lecteur·ice avec un peu de bagage technique (sait ce
 * qu'est un mot de passe haché, a déjà entendu parler de chiffrement
 * symétrique). On vulgarise la mécanique sans rentrer dans les
 * détails crypto formels — pour ça, l'onglet Tech sécu prend la
 * suite.
 *
 * Contrat de contenu : ce tier décrit la mécanique vulgarisée. Il
 * ne change que si on remplace OPAQUE ou si on bouleverse le modèle
 * KEK — événement rare. Reste léger en maintenance.
 */
export default function DocsTierAdvanced() {
  return (
    <div className="space-y-10">
      <Section title="Le principe en une phrase">
        <p>
          Ton mot de passe ne sort jamais de ton navigateur ; il sert à
          dériver localement la clé qui chiffre / déchiffre tes données. Le
          serveur stocke des fichiers chiffrés et la preuve cryptographique
          que c'est bien toi — jamais ta clé, jamais ton mot de passe.
        </p>
      </Section>

      <Section title="Au login : OPAQUE, ou comment prouver son mot de passe sans l'envoyer">
        <p>
          La méthode classique pour se connecter, c'est d'envoyer le mot de
          passe au serveur qui le compare à un hash. Ça veut dire que pendant
          quelques millisecondes, le serveur a le mot de passe en clair en
          mémoire. Ça veut dire aussi qu'un serveur malicieux pourrait le
          collecter.
        </p>
        <p>
          Nodea utilise <strong>OPAQUE</strong>, un protocole d'échange
          conçu pour qu'on prouve qu'on connaît un mot de passe{' '}
          <strong>sans jamais l'envoyer</strong>. Ton navigateur et le
          serveur échangent quelques messages cryptographiques ; à la fin,
          le serveur sait que tu connais le bon mot de passe, mais lui ne
          le connaît toujours pas. C'est le cœur de la sécurité du login
          chez Nodea.
        </p>
        <p>
          En sortie d'OPAQUE, ton navigateur récupère une clé — la{' '}
          <em>clé d'export</em> — qui n'existe que là, à ce moment-là. Cette
          clé sert à déchiffrer une seconde clé (la « KEK » : key
          encryption key) qui elle-même chiffre la clé maîtresse de tes
          données. Trois étages de clés au total ; le détail vit dans
          l'onglet Tech sécu.
        </p>
      </Section>

      <Section title="Ce que voit ton navigateur, ce que voit le serveur">
        <p>
          <strong>Côté navigateur</strong> : la clé maîtresse en mémoire (jamais
          écrite sur le disque), le contenu de tes entrées en clair pour
          que tu puisses les lire / éditer, et tout ce qu'il faut pour
          chiffrer une nouvelle entrée avant de l'envoyer.
        </p>
        <p>
          <strong>Côté serveur</strong> : pour chaque entrée, un identifiant
          opaque, un blob chiffré (AES-GCM), un IV aléatoire, et une
          empreinte HMAC qu'on appelle « guard » — calculée à partir de ta
          clé maîtresse, qui sert à empêcher quiconque sans la clé de
          modifier une entrée. Aucun de ces champs ne révèle quoi que ce
          soit du contenu en clair.
        </p>
      </Section>

      <Section title="Code de récupération : la deuxième porte">
        <p>
          Le mot de passe peut s'oublier. Pour ne pas perdre tes données,
          Nodea génère à l'inscription un code de 12 mots (BIP39 — la même
          liste de mots que les portefeuilles crypto, choisie pour être
          mémorisable et résistante aux fautes de frappe).
        </p>
        <p>
          Ces 12 mots dérivent une <strong>seconde</strong> clé qui déchiffre
          une copie séparée de ta KEK. Le serveur ne stocke jamais les 12
          mots — il stocke un hash anti-DoS pour valider la requête, mais
          les mots eux-mêmes ne sont jamais envoyés en clair (même
          principe qu'OPAQUE).
        </p>
        <p>
          Quand tu utilises ce code pour te récupérer, tu choisis un nouveau
          mot de passe, et ta clé maîtresse reste la même — donc{' '}
          <strong>tes anciennes données restent lisibles</strong>. C'est
          différent du « reset password » classique qui efface tout : ici,
          on rotate uniquement les enveloppes autour de la clé.
        </p>
      </Section>

      <Section title="Passkeys : pour les utilisations courantes, les passkeys peuvent même être plus sûres qu'un mot de passe">
        <p>
          Tu peux ajouter une passkey (Touch ID, Face ID, Windows Hello,
          Yubikey…) comme méthode de connexion à la place ou en complément
          du mot de passe.
        </p>
        <p>
          <strong>Si ta passkey supporte PRF</strong> (la plupart des passkeys
          modernes), elle peut déchiffrer tes données toute seule, comme le
          ferait ton mot de passe. <strong>Sinon</strong>, elle te connecte
          mais le déchiffrement nécessite encore ton mot de passe (Nodea le
          détecte et te le demande à ce moment-là).
        </p>
      </Section>

      <Section title="Le scénario qu'on ne peut pas neutraliser : le serveur compromis">
        <p>
          Soyons honnêtes sur les limites. Le code qui chiffre tes données
          est servi par le serveur. Si quelqu'un prend le contrôle du
          serveur (intrusion, compromission de la chaîne de build, employé
          malveillant chez l'hébergeur…), il pourrait remplacer le
          JavaScript par une version qui exfiltre ton mot de passe au
          moment où tu te connectes.
        </p>
        <p>
          Cette limite est <strong>inhérente à toute application web</strong>{' '}
          chiffrée bout-en-bout — pas spécifique à Nodea. Bitwarden,
          Standard Notes, Cryptee partagent la même limite.
        </p>
        <p>
          Ce qu'on fait pour la mitiger :
        </p>
        <ul className="space-y-2">
          <Bullet>
            <strong>Subresource Integrity</strong> — le HTML qui charge le
            JavaScript principal contient une empreinte cryptographique du
            fichier ; si le JS est modifié, le navigateur refuse de
            l'exécuter.
          </Bullet>
          <Bullet>
            <strong>Manifest <code className="font-mono text-[13px]">INTEGRITY.txt</code></strong>{' '}
            — chaque release publie les empreintes de tous les fichiers du
            bundle. Tu peux les comparer avec ce que ton instance sert pour
            détecter une divergence.
          </Bullet>
          <Bullet>
            <strong>Recommandation auto-hébergement</strong> — si tu manipules
            des données très sensibles, fais tourner ta propre instance.
            Tu réduis drastiquement la surface (ton serveur, tes
            employé·es… toi-même).
          </Bullet>
        </ul>
        <p>
          On n'a pas la prétention de neutraliser ce scénario. On le
          documente, on borne ses dégâts, et on te donne les outils pour le
          détecter.
        </p>
      </Section>

      <NextTabHint>
        Tu veux le threat model formel, les algos figés, et les détails
        crypto auditables ? L'onglet <strong>« Pour les profils sécu »</strong>{' '}
        a tout — avec liens vers la spec exhaustive et le code.
      </NextTabHint>
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

function NextTabHint({ children }: { children: React.ReactNode }) {
  return (
    <aside className="rounded-lg border border-hair bg-bg-2 px-5 py-4 text-[14px] leading-[1.6] text-ink-soft">
      {children}
    </aside>
  );
}
