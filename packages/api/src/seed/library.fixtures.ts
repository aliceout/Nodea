import type {
  LibraryItemPayload,
  LibraryReviewPayload,
} from '@nodea/shared';
import { daysAgo, monthsAgo } from './shared.ts';

/**
 * Hand-written Library fixtures — small but realistic.
 *
 * Coverage goals :
 *   - Mix of statuses (planned / in_progress / finished /
 *     abandoned) so each filter chip has data.
 *   - Mix of formats (paper / ebook / audio).
 *   - At least one favorite + one rated book.
 *   - At least one book has reviews of both kinds (`quote` +
 *     `note`) so the Library reader exercises both renderers.
 *   - One book has zero reviews — the « pas encore de notes »
 *     empty state is more frequent than the populated one.
 *
 * Each fixture is a (item, reviews[]) pair so the seeder can
 * insert items first, capture their freshly-minted ids, then
 * insert reviews with the right `itemRid`. Covers are skipped
 * v1 — base64 cover blobs would inflate the seed for little
 * test value, and the manual Composer flow exercises that path.
 */

interface LibraryItemFixture extends Omit<LibraryItemPayload, 'coverRid'> {
  coverRid: null;
}

type LibraryReviewFixture = Omit<LibraryReviewPayload, 'itemRid'>;

export interface LibrarySeedFixture {
  /** Stable handle used to wire reviews to their parent item — the
   *  seeder remaps it to the item's freshly-generated record id. */
  handle: string;
  item: LibraryItemFixture;
  reviews: LibraryReviewFixture[];
}

export function buildLibraryFixtures(): LibrarySeedFixture[] {
  return [
    {
      handle: 'slow-productivity',
      item: {
        type: 'book',
        title: 'Slow Productivity',
        creators: [{ name: 'Cal Newport', role: 'author' }],
        year: 2024,
        language: 'fr',
        originalLanguage: 'en',
        publisher: 'Alisio',
        summary:
          'Trois principes pour faire moins, mieux, plus longtemps : choisir peu de choses, travailler à un rythme naturel, viser la qualité.',
        coverRid: null,
        status: 'in_progress',
        format: 'paper',
        startedAt: monthsAgo(1),
        finishedAt: null,
        rating: null,
        tags: ['essai', 'travail'],
        isFavorite: false,
      },
      reviews: [
        {
          date: daysAgo(7),
          kind: 'quote',
          title: null,
          content:
            '« Faire moins, à un meilleur niveau, sur une plus longue durée. »',
          page: 64,
          spoiler: false,
        },
        {
          date: daysAgo(5),
          kind: 'note',
          title: 'Sur la « pseudo-productivité »',
          content:
            'Sa critique tient en une phrase : on a confondu *l’apparence d’être occupé* avec *travailler*. Reste à voir si le remède proposé (un bon backlog visible) tient face à un manageur qui veut juste voir des yeux à l’écran.',
          page: null,
          spoiler: false,
        },
      ],
    },
    {
      handle: 'pavillon-or',
      item: {
        type: 'book',
        title: 'Le Pavillon d’Or',
        creators: [{ name: 'Yukio Mishima', role: 'author' }],
        year: 1956,
        language: 'fr',
        originalLanguage: 'jp',
        publisher: 'Gallimard',
        collection: 'Folio',
        summary:
          'Confession romanesque d’un jeune moine bouddhiste qui finit par incendier le temple le plus beau du monde.',
        coverRid: null,
        status: 'in_progress',
        format: 'paper',
        startedAt: monthsAgo(2),
        finishedAt: null,
        rating: null,
        tags: ['fiction', 'classique', 'japon'],
        isFavorite: true,
      },
      reviews: [
        {
          date: daysAgo(28),
          kind: 'quote',
          title: null,
          content:
            '« La beauté est une chose hostile, qui me défie chaque fois que je me crois sur le point de la posséder. »',
          page: 42,
          spoiler: false,
        },
      ],
    },
    {
      handle: 'la-horde',
      item: {
        type: 'book',
        title: 'La Horde du Contrevent',
        creators: [{ name: 'Alain Damasio', role: 'author' }],
        year: 2004,
        language: 'fr',
        publisher: 'La Volte',
        summary:
          'Vingt-trois êtres humains marchent contre le vent depuis l’Aval jusqu’à l’Extrême-Amont, à la recherche de l’origine du vent.',
        coverRid: null,
        status: 'finished',
        format: 'paper',
        startedAt: monthsAgo(8),
        finishedAt: monthsAgo(5),
        rating: 5,
        tags: ['fiction', 'sf', 'coup de cœur'],
        isFavorite: true,
      },
      reviews: [
        {
          date: monthsAgo(5),
          kind: 'note',
          title: 'Bilan',
          content:
            'Lu en deux mois et demi, ce qui est *long* pour moi mais juste pour ce livre. La structure polyphonique demande une vigilance de chaque ligne — impossible à lire fatigué·e. **À relire dans dix ans.**',
          page: null,
          spoiler: false,
        },
      ],
    },
    {
      handle: 'eutopia',
      item: {
        type: 'book',
        title: 'Eutopia',
        creators: [{ name: 'Camille Leboulanger', role: 'author' }],
        year: 2022,
        language: 'fr',
        publisher: 'Argyll',
        summary:
          'Une société post-effondrement où l’abondance n’est plus une promesse mais une contrainte douce.',
        coverRid: null,
        status: 'planned',
        format: 'paper',
        startedAt: null,
        finishedAt: null,
        rating: null,
        tags: ['fiction', 'utopie'],
        isFavorite: false,
      },
      reviews: [],
    },
    {
      handle: 'sapiens',
      item: {
        type: 'book',
        title: 'Sapiens : une brève histoire de l’humanité',
        creators: [{ name: 'Yuval Noah Harari', role: 'author' }],
        year: 2014,
        language: 'fr',
        originalLanguage: 'he',
        publisher: 'Albin Michel',
        summary:
          'Survol des grandes ruptures de l’histoire humaine — révolution cognitive, agricole, scientifique.',
        coverRid: null,
        status: 'abandoned',
        format: 'audio',
        startedAt: monthsAgo(10),
        finishedAt: null,
        rating: 2,
        tags: ['essai', 'histoire'],
        isFavorite: false,
      },
      reviews: [
        {
          date: monthsAgo(9),
          kind: 'note',
          title: 'Pourquoi j’abandonne',
          content:
            'Les généralisations m’ont fini par lasser. Le format audio n’aide pas — je perds le fil dès qu’il commence à théoriser sur des dizaines de milliers d’années.',
          page: null,
          spoiler: false,
        },
      ],
    },
    {
      handle: 'la-tresse',
      item: {
        type: 'book',
        title: 'La Tresse',
        creators: [{ name: 'Laetitia Colombani', role: 'author' }],
        year: 2017,
        language: 'fr',
        publisher: 'Grasset',
        summary:
          'Trois femmes, trois continents, trois combats reliés par un fil qu’on ne voit qu’à la fin.',
        coverRid: null,
        status: 'finished',
        format: 'ebook',
        startedAt: monthsAgo(3),
        finishedAt: monthsAgo(3),
        rating: 4,
        tags: ['fiction'],
        isFavorite: false,
      },
      reviews: [],
    },
  ];
}
