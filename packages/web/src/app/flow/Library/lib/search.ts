/**
 * Diacritic + case folding for the picker search input. « Ernaux »,
 * « ernaux », and « ÉRNAUX » all want to match the same row. Uses
 * NFD + combining-mark strip — works for FR / EN / ES ; broken for
 * scripts that don't use combining marks (CJK, Arabic, …) but those
 * still pass through case-fold which is the main lever.
 */
export function normaliseForSearch(s: string): string {
  return s
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}
