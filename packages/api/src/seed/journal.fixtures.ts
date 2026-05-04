import type { JournalPayload } from '@nodea/shared';
import { nowMinusDays } from './shared.ts';

/**
 * Hand-written Journal fixtures — small, varied, real-feeling.
 *
 * Coverage goals :
 *   - Multiple fils so the « Par fil » grouping renders several
 *     buckets and the suggestion chips have material.
 *   - Mix of dates spread over ~3 weeks so the « Par mois »
 *     grouping has at least two buckets when the seed runs near
 *     a month boundary.
 *   - Markdown subset (`**bold**`, `*italic*`, `- bullet`) so the
 *     `JournalContent` renderer is exercised.
 *   - One entry includes a blank line between paragraphs to
 *     verify the `min-h: 1lh` saut-de-ligne fix.
 *   - A few short entries (1-2 lines) so the inline list is
 *     readable, plus longer ones to hit the 4-line clamp + fade.
 *   - One entry without a title so the EntryRow's title-less
 *     fallback gets exercised. (Note : the new flow doesn't ship
 *     a title field anymore, but the schema keeps it nullable for
 *     legacy compat — fixtures use `title: null` throughout.)
 *   - No attachments in fixtures — image base64 inflates the seed
 *     payload for little real test value. Attachments are exercised
 *     manually via the composer.
 */

interface JournalFixture
  extends Pick<JournalPayload, 'date' | 'thread' | 'title' | 'content' | 'attachments'> {
  type: 'journal.entry';
}

export function buildJournalFixtures(): JournalFixture[] {
  return [
    {
      type: 'journal.entry',
      date: nowMinusDays(0),
      thread: 'quotidien',
      title: null,
      content:
        'Journée *douce*, sans grande pierre. Je suis content de ne pas avoir essayé de la **forcer**.\n' +
        '\n' +
        'Demain matin : terminer la lecture en cours avant d’ouvrir Slack. Une vraie heure pour moi avant de céder à l’urgence des autres.',
      attachments: [],
    },
    {
      type: 'journal.entry',
      date: nowMinusDays(2),
      thread: 'quotidien',
      title: null,
      content:
        'Lent. Tête lourde toute la matinée, ça va mieux après la pluie.\n' +
        '\n' +
        'À noter pour plus tard : je dors mal quand je mange tard. *Pas une révélation, juste un rappel.*',
      attachments: [],
    },
    {
      type: 'journal.entry',
      date: nowMinusDays(4),
      thread: 'voyage',
      title: null,
      content:
        'Premier jour à Lisbonne. Quartier de l’Alfama, un café accroché à la pente, le Tage en bas qui scintille pour rien.\n' +
        '\n' +
        'Trois choses à retenir :\n' +
        '- la lumière à 17 h, dorée à un point qui ne se reproduit nulle part\n' +
        '- le pastel de nata mangé debout, brûlant, qui répare quelque chose\n' +
        '- le silence dans la cathédrale, **inattendu** un samedi',
      attachments: [],
    },
    {
      type: 'journal.entry',
      date: nowMinusDays(7),
      thread: 'lecture',
      title: null,
      content:
        '*Slow Productivity* (Cal Newport), p. 64 :\n' +
        '\n' +
        '> « Faire moins, à un meilleur niveau, sur une plus longue durée. »\n' +
        '\n' +
        'Ce qui me marque : pas un slogan productiviste de plus, plutôt l’aveu que la *vitesse* qu’on s’impose est un choix, pas une contrainte.',
      attachments: [],
    },
    {
      type: 'journal.entry',
      date: nowMinusDays(10),
      thread: 'pro',
      title: null,
      content:
        'Réunion de cadrage avec le client X. **Cadrage écrit obtenu**, victoire silencieuse — il y a six mois je n’aurais pas demandé.\n' +
        '\n' +
        'À surveiller : la tendance à dire oui une fois que tout est aligné « par politesse », alors que c’est exactement le moment de poser les conditions.',
      attachments: [],
    },
    {
      type: 'journal.entry',
      date: nowMinusDays(14),
      thread: 'voyage',
      title: null,
      content: 'Train du retour. Endormi entre Bordeaux et Tours. Le voyage finit comme il a commencé : *en silence, en regardant dehors*.',
      attachments: [],
    },
    {
      type: 'journal.entry',
      date: nowMinusDays(20),
      thread: 'famille',
      title: null,
      content:
        'Coup de fil avec ma sœur. On a parlé une heure de rien — la cuisine du dimanche, les voisins, son chat qui se prend pour un chien.\n' +
        '\n' +
        'C’est exactement ce qui me manque dans les semaines trop chargées : ces appels où on ne **fait rien**, où on est juste là.',
      attachments: [],
    },
    {
      type: 'journal.entry',
      date: nowMinusDays(28),
      thread: 'lecture, perso',
      title: null,
      content:
        'Repris *Le Pavillon d’Or* après deux ans de pause. Je ne me souvenais plus de la lenteur — chaque chapitre prend son temps comme si Mishima refusait qu’on s’en débarrasse.\n' +
        '\n' +
        'Note : alterner avec un roman plus rapide la prochaine fois. Lire deux livres de front me marche mieux que d’en bloquer un.',
      attachments: [],
    },
  ];
}
