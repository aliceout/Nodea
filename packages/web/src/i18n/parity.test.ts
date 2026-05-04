import { describe, expect, it } from 'vitest';

import { compareNamespaces, type Bag } from './parity.ts';

import frAccount from '@/i18n/locales/fr/account.json';
import enAccount from '@/i18n/locales/en/account.json';
import frAdmin from '@/i18n/locales/fr/admin.json';
import enAdmin from '@/i18n/locales/en/admin.json';
import frAuth from '@/i18n/locales/fr/auth.json';
import enAuth from '@/i18n/locales/en/auth.json';
import frCommon from '@/i18n/locales/fr/common.json';
import enCommon from '@/i18n/locales/en/common.json';
import frErrors from '@/i18n/locales/fr/errors.json';
import enErrors from '@/i18n/locales/en/errors.json';
import frGoals from '@/i18n/locales/fr/goals.json';
import enGoals from '@/i18n/locales/en/goals.json';
import frHome from '@/i18n/locales/fr/home.json';
import enHome from '@/i18n/locales/en/home.json';
import frLayout from '@/i18n/locales/fr/layout.json';
import enLayout from '@/i18n/locales/en/layout.json';
import frModals from '@/i18n/locales/fr/modals.json';
import enModals from '@/i18n/locales/en/modals.json';
import frModules from '@/i18n/locales/fr/modules.json';
import enModules from '@/i18n/locales/en/modules.json';
import frMood from '@/i18n/locales/fr/mood.json';
import enMood from '@/i18n/locales/en/mood.json';
import frJournal from '@/i18n/locales/fr/journal.json';
import enJournal from '@/i18n/locales/en/journal.json';
import frReview from '@/i18n/locales/fr/review.json';
import enReview from '@/i18n/locales/en/review.json';
import frSettings from '@/i18n/locales/fr/settings.json';
import enSettings from '@/i18n/locales/en/settings.json';

/**
 * The 14 namespaces under `i18n/locales/{fr,en}/`. Listed
 * explicitly (rather than enumerating the directory at runtime)
 * so a missing locale file fails the type-check before it fails
 * a test — the JSON imports are the contract.
 */
const NAMESPACES: ReadonlyArray<readonly [string, Bag, Bag]> = [
  ['account', frAccount as Bag, enAccount as Bag],
  ['admin', frAdmin as Bag, enAdmin as Bag],
  ['auth', frAuth as Bag, enAuth as Bag],
  ['common', frCommon as Bag, enCommon as Bag],
  ['errors', frErrors as Bag, enErrors as Bag],
  ['goals', frGoals as Bag, enGoals as Bag],
  ['home', frHome as Bag, enHome as Bag],
  ['layout', frLayout as Bag, enLayout as Bag],
  ['modals', frModals as Bag, enModals as Bag],
  ['modules', frModules as Bag, enModules as Bag],
  ['mood', frMood as Bag, enMood as Bag],
  ['journal', frJournal as Bag, enJournal as Bag],
  ['review', frReview as Bag, enReview as Bag],
  ['settings', frSettings as Bag, enSettings as Bag],
];

describe('i18n parity (FR ↔ EN)', () => {
  for (const [name, fr, en] of NAMESPACES) {
    it(`${name}: FR and EN expose the same key set`, () => {
      const { onlyInA: onlyFr, onlyInB: onlyEn } = compareNamespaces(fr, en);
      // Surface the divergence inline so the failure message
      // names the missing keys directly. Plain `toEqual([])` would
      // print « expected [] to be [...] » with the offending list
      // hidden inside the diff.
      expect(
        { fr_only: onlyFr, en_only: onlyEn },
        `i18n drift in namespace « ${name} » :\n` +
          `  FR-only : ${onlyFr.length === 0 ? '∅' : onlyFr.join(', ')}\n` +
          `  EN-only : ${onlyEn.length === 0 ? '∅' : onlyEn.join(', ')}`,
      ).toEqual({ fr_only: [], en_only: [] });
    });
  }
});
