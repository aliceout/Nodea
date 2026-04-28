/**
 * Docs — onglet « Les bases ».
 *
 * Audience : visiteur·e qui découvre Nodea et veut comprendre
 * en deux minutes ce que ça change pour ses données. Zéro jargon
 * technique, des analogies concrètes, l'essentiel dit honnêtement.
 *
 * Contrat de contenu : ce tier parle de **concepts stables** (ce
 * qui se passe pour les données) et ne dépend pas des choix
 * d'implémentation. Il ne devrait jamais avoir besoin d'une mise
 * à jour quand on change un détail technique — c'est ce qui le
 * rend bon marché à maintenir.
 */
export default function DocsTierNewbie() {
  return (
    <div className="space-y-10">
      <Section title="C'est quoi « chiffré » exactement ?">
        <p>
          Imagine un coffre dont seul·e toi as la clé. Tu mets ce que tu veux
          dedans, tu fermes, tu envoies le coffre fermé à Nodea pour qu'on le
          garde. On le stocke, on s'en occupe — mais on ne peut pas l'ouvrir.
          Personne d'autre ne peut, à part toi.
        </p>
        <p>
          Concrètement, ton ordinateur (ton navigateur, en fait) chiffre
          tout ce que tu écris <strong>avant</strong> que ça ne quitte ta
          machine. Le serveur de Nodea ne reçoit que des données
          incompréhensibles. C'est ça, l'« E2E » ou le « bout-en-bout » :
          du début (ton navigateur) jusqu'au stockage, ce n'est jamais
          en clair côté serveur.
        </p>
      </Section>

      <Section title="Qui peut lire ce que j'écris dans Nodea ?">
        <p>
          <strong>Toi, et personne d'autre.</strong> Pas l'équipe qui développe
          Nodea, pas l'hébergeur qui fait tourner le serveur, pas un·e
          stagiaire qui ferait du SQL un dimanche soir. Le serveur ne stocke
          que des fichiers chiffrés et il n'a pas la clé pour les ouvrir.
        </p>
        <p>
          Cette propriété n'est pas une promesse marketing — elle est une
          conséquence de la façon dont l'app est construite. La clé qui
          déchiffre tes données est dérivée de ton mot de passe à toi, et
          on ne reçoit jamais ce mot de passe en clair non plus (on en
          envoie une preuve cryptographique au login, jamais le mot lui-
          même).
        </p>
      </Section>

      <Section title="Et si je perds mon mot de passe ?">
        <p>
          C'est la contrepartie : si <strong>personne</strong> ne peut lire tes
          données sans ton mot de passe, alors si tu le perds et que tu n'as
          aucune sauvegarde, on ne peut pas t'aider à le récupérer. Tes
          données existent toujours sur le serveur, mais elles sont
          inaccessibles — y compris pour nous.
        </p>
        <p>
          Pour éviter ça, Nodea te génère à l'inscription un{' '}
          <strong>code de récupération</strong> de 12 mots. Tu le notes une
          fois, tu le gardes hors-ligne (sur papier, dans un gestionnaire de
          mots de passe…). Si un jour tu perds ton mot de passe, ces 12 mots
          servent à choisir un nouveau mot de passe sans rien casser de tes
          données.
        </p>
        <p>
          Tu peux régénérer ce code à tout moment depuis{' '}
          <em>Compte → Sécurité</em> ; l'ancien devient invalide.
        </p>
      </Section>

      <Section title="Sur quoi on est explicites">
        <ul className="space-y-2">
          <Bullet>Pas de tracking, pas de cookie pub, pas d'analytics tiers.</Bullet>
          <Bullet>Pas de revente, pas d'entraînement d'IA sur tes données — on n'a même pas accès au contenu.</Bullet>
          <Bullet>Pas de partage de tes données avec un tiers, sauf injonction légale (et ce qu'on pourrait remettre, c'est du chiffré inutilisable).</Bullet>
          <Bullet>Code source <a href="https://github.com/aliceout/Nodea" target="_blank" rel="noopener noreferrer" className="text-accent underline-offset-2 hover:text-accent-deep hover:underline">consultable publiquement</a>. Si tu doutes, tu peux vérifier.</Bullet>
        </ul>
      </Section>

      <NextTabHint>
        Tu veux comprendre comment tout ça marche concrètement ?
        L'onglet <strong>« Comment ça marche »</strong> explique la
        mécanique du chiffrement avec des mots simples.
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
