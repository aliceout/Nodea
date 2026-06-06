import type {
  HrtAdminLogPayload,
  HrtLabResultPayload,
  HrtProductPayload,
} from '@nodea/shared';
import { daysAgo, monthsAgo, nowMinusDays } from './shared.ts';

/**
 * Mock HRT data for the `seed:test` script. Hand-written to read like
 * a real transfeminine regimen so the module's two views have
 * something believable to render :
 *   - admin logs : ~3 weeks of estradiol injections (5-day cadence,
 *     alternating sites) + daily anti-androgen + progesterone,
 *   - lab results : a 6-month trend showing E2 climbing while total
 *     testosterone falls into the suppressed range, plus a couple of
 *     safety markers (prolactin, potassium, SHBG).
 *
 * Dates are relative to the run moment so re-seeding always yields a
 * fresh « today ». Not medical guidance — illustrative numbers only.
 */

export function buildHrtProductFixtures(): HrtProductPayload[] {
  return [
    // Injectable estradiol — dosed in mL, 10 mg/mL (so 0.4 mL = 4 mg).
    { name: 'Préparation magistrale', medication: 'Estradiol valérate', category: 'estrogen', route: 'injection_im', unit: 'mL', concentration: 10, notes: 'préparation magistrale 10 mg/mL', updatedAt: nowMinusDays(40) },
    // Oral products — no concentration, dosed in mg.
    { name: 'Aldactone', medication: 'Spironolactone', category: 'antiandrogen', route: 'oral', unit: 'mg', notes: '', updatedAt: nowMinusDays(40) },
    { name: 'Utrogestan', medication: 'Progestérone', category: 'progestogen', route: 'oral', unit: 'mg', notes: '', updatedAt: nowMinusDays(40) },
  ];
}

export function buildHrtAdminLogFixtures(): HrtAdminLogPayload[] {
  // Each log references a catalog product by name ; molecule / route /
  // unit / concentration come from that product. The estradiol product
  // is 10 mg/mL, so 0.4 mL shows as ≈ 4 mg in the UI.
  return [
    { date: daysAgo(1), time: '08:30', product: 'Préparation magistrale', dose: 0.4, notes: '', updatedAt: nowMinusDays(1) },
    { date: daysAgo(6), time: '08:15', product: 'Préparation magistrale', dose: 0.4, notes: '', updatedAt: nowMinusDays(6) },
    { date: daysAgo(11), time: '08:40', product: 'Préparation magistrale', dose: 0.4, notes: 'léger bleu au point de piqûre', updatedAt: nowMinusDays(11) },
    { date: daysAgo(16), time: '08:20', product: 'Préparation magistrale', dose: 0.4, notes: '', updatedAt: nowMinusDays(16) },
    { date: daysAgo(21), time: '08:25', product: 'Préparation magistrale', dose: 0.4, notes: '', updatedAt: nowMinusDays(21) },
    // Spironolactone — 100 mg/jour, quelques jours.
    { date: daysAgo(0), time: '09:00', product: 'Aldactone', dose: 100, notes: '', updatedAt: nowMinusDays(0) },
    { date: daysAgo(1), time: '09:00', product: 'Aldactone', dose: 100, notes: '', updatedAt: nowMinusDays(1) },
    { date: daysAgo(2), time: '09:05', product: 'Aldactone', dose: 100, notes: '', updatedAt: nowMinusDays(2) },
    // Progestérone — 100 mg le soir.
    { date: daysAgo(0), time: '22:30', product: 'Utrogestan', dose: 100, notes: 'au coucher', updatedAt: nowMinusDays(0) },
    { date: daysAgo(1), time: '22:45', product: 'Utrogestan', dose: 100, notes: '', updatedAt: nowMinusDays(1) },
  ];
}

export function buildHrtLabResultFixtures(): HrtLabResultPayload[] {
  return [
    // Œstradiol (E2) — creux, en hausse au fil des mois.
    { date: monthsAgo(6), marker: 'estradiol', value: 45, unit: 'pg/mL', context: 'trough', lab: '', notes: 'avant ajustement de dose', updatedAt: nowMinusDays(182) },
    { date: monthsAgo(4), marker: 'estradiol', value: 88, unit: 'pg/mL', context: 'trough', lab: '', notes: '', updatedAt: nowMinusDays(121) },
    { date: monthsAgo(2), marker: 'estradiol', value: 132, unit: 'pg/mL', context: 'trough', lab: '', notes: '', updatedAt: nowMinusDays(60) },
    { date: monthsAgo(0), marker: 'estradiol', value: 165, unit: 'pg/mL', context: 'trough', lab: '', notes: '', updatedAt: nowMinusDays(2) },
    // Testostérone totale — chute vers la zone supprimée.
    { date: monthsAgo(6), marker: 'testosterone_total', value: 410, unit: 'ng/dL', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(182) },
    { date: monthsAgo(4), marker: 'testosterone_total', value: 120, unit: 'ng/dL', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(121) },
    { date: monthsAgo(2), marker: 'testosterone_total', value: 55, unit: 'ng/dL', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(60) },
    { date: monthsAgo(0), marker: 'testosterone_total', value: 32, unit: 'ng/dL', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(2) },
    // SHBG — monte avec l'œstrogénothérapie.
    { date: monthsAgo(4), marker: 'shbg', value: 55, unit: 'nmol/L', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(121) },
    { date: monthsAgo(0), marker: 'shbg', value: 72, unit: 'nmol/L', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(2) },
    // Sécurité — prolactine, kaliémie (spironolactone).
    { date: monthsAgo(4), marker: 'prolactin', value: 12, unit: 'µg/L', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(121) },
    { date: monthsAgo(0), marker: 'prolactin', value: 15, unit: 'µg/L', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(2) },
    { date: monthsAgo(4), marker: 'potassium', value: 4.4, unit: 'mmol/L', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(121) },
    { date: monthsAgo(0), marker: 'potassium', value: 4.6, unit: 'mmol/L', context: 'random', lab: '', notes: '', updatedAt: nowMinusDays(2) },
  ];
}
