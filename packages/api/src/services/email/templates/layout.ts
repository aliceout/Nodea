import { getConfig } from '../../../config.ts';
import { emailT, type SupportedEmailLanguage } from '../i18n.ts';

/**
 * Common email layout — Auth-Spec.md §10.3.
 *
 * All transactional emails Nodea sends pass through this layout so they
 * share consistent header, typography, and footer. Templates remain pure
 * functions that produce content blocks; this layout wraps them with
 * branding + a uniform sign-off without each template having to repeat
 * the table-based HTML scaffolding email clients require.
 *
 * Design notes for the HTML side:
 *   - Tables, not flexbox/grid — Outlook & older clients still need them.
 *   - Inline CSS only — most clients strip <style> blocks.
 *   - Width capped at 600 px — fits a phone in portrait without horizontal
 *     scroll, sane on desktop too.
 *   - Web-safe font stack — system fonts on every major OS.
 *   - Light theme only in V1. `prefers-color-scheme` is supported by
 *     enough clients to be worth doing later, not now.
 *   - Header logo is served from `${WEB_BASE_URL}/favicon-128.png`
 *     (128 px source rendered at 32 px = sharp on retina). When
 *     `WEB_BASE_URL` is unset (some dev / test setups) we fall back
 *     to the text-only header so the email still renders cleanly.
 *     Empty `alt=""` because the adjacent `<h1>Nodea</h1>` already
 *     carries the brand's accessible name — assistive tech that
 *     announces both would say "Nodea Nodea".
 *
 * Localisation : Tier 5 i18n — caller passes `language`, the layout
 * pipes it through `emailT(language, 'layout.*')` for the footer
 * strings and into the `<html lang="…">` attribute.
 */

export interface LayoutOptions {
  /** Email subject — used as the HTML <title> too for clients that
   *  surface it (Apple Mail in summary view does). */
  subject: string;
  /** Active language for footer translation + `<html lang>` attr. */
  language: SupportedEmailLanguage;
  /** Optional preview / preheader (the line clients show next to the
   *  subject in the inbox list). Kept invisible but readable by the
   *  preview pane. ~100 chars max for best results. */
  preheader?: string;
  /** Plain-text body, already wrapped at ~70 chars, ready to be wrapped
   *  with header / footer. The layout adds nothing inside it — the
   *  template is in full control of the prose. */
  bodyText: string;
  /** HTML body — a string of HTML elements (typically <p>, <h2>, etc.)
   *  to be slotted between the header and footer cells. The layout
   *  provides the surrounding `<table>` + `<td>` so the template just
   *  emits prose. */
  bodyHtml: string;
}

export interface RenderedLayout {
  text: string;
  html: string;
}

/**
 * What template render functions return — subject + text + html.
 * The layout produces `text` and `html`; templates supply the
 * subject themselves.
 */
export interface RenderedEmailContent {
  subject: string;
  text: string;
  html: string;
}

function buildFooterText(language: SupportedEmailLanguage): string {
  return [
    '',
    '—',
    emailT(language, 'layout.footerSignature'),
    '',
    emailT(language, 'layout.footerAutoLine'),
    emailT(language, 'layout.footerIgnoreLine'),
  ].join('\n');
}

function buildFooterHtml(language: SupportedEmailLanguage): string {
  const signature = escapeHtml(emailT(language, 'layout.footerSignature'));
  const autoLine = escapeHtml(emailT(language, 'layout.footerAutoLine'));
  const ignoreLine = escapeHtml(emailT(language, 'layout.footerIgnoreLine'));
  return [
    '<tr>',
    '  <td style="padding:24px 40px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280;line-height:1.5;">',
    `    <p style="margin:0 0 8px 0;font-weight:500;color:#374151;">— ${signature}</p>`,
    `    <p style="margin:0;">${autoLine} ${ignoreLine}</p>`,
    '  </td>',
    '</tr>',
  ].join('\n');
}

function renderHeader(): string {
  const baseUrl = (getConfig().WEB_BASE_URL ?? '').replace(/\/$/, '');
  const wordmark =
    '<h1 style="margin:0;font-size:20px;font-weight:600;color:#111827;letter-spacing:-0.01em;">Nodea</h1>';

  // No base URL configured → text-only header, no broken-image
  // placeholder. Same chrome as before this asset shipped.
  if (!baseUrl) {
    return [
      '<tr>',
      '  <td style="padding:32px 40px 24px 40px;border-bottom:1px solid #e5e7eb;">',
      `    ${wordmark}`,
      '  </td>',
      '</tr>',
    ].join('\n');
  }

  // Inner table to align the symbol + wordmark on the same baseline.
  // `vertical-align:middle` on each cell is the only cross-client
  // reliable way to baseline-align an image and an h1 in a table row.
  return [
    '<tr>',
    '  <td style="padding:32px 40px 24px 40px;border-bottom:1px solid #e5e7eb;">',
    '    <table cellpadding="0" cellspacing="0" border="0" role="presentation">',
    '      <tr>',
    '        <td style="padding-right:12px;vertical-align:middle;">',
    `          <img src="${baseUrl}/favicon-128.png" alt="" width="32" height="32" style="display:block;width:32px;height:32px;border:0;" />`,
    '        </td>',
    '        <td style="vertical-align:middle;">',
    `          ${wordmark}`,
    '        </td>',
    '      </tr>',
    '    </table>',
    '  </td>',
    '</tr>',
  ].join('\n');
}

function renderPreheader(text: string): string {
  // Hidden visually but readable by inbox preview panes. The combo of
  // display:none + max-height:0 + opacity:0 + ZWJ trickery is the cargo
  // cult that actually works across every major client.
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return [
    '<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:#f9fafb;opacity:0;">',
    escaped,
    '</div>',
  ].join('');
}

/**
 * Wrap text + HTML body fragments in the standard Nodea layout.
 *
 * The returned `text` and `html` slot directly into `EmailService.send()`
 * — the template itself only needs to call this once and return the
 * pair.
 */
export function renderLayout(opts: LayoutOptions): RenderedLayout {
  const text = `${opts.bodyText}\n${buildFooterText(opts.language)}`;

  const html = [
    '<!DOCTYPE html>',
    `<html lang="${opts.language}">`,
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    `  <title>${escapeHtml(opts.subject)}</title>`,
    '</head>',
    '<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;color:#111827;-webkit-font-smoothing:antialiased;">',
    opts.preheader ? renderPreheader(opts.preheader) : '',
    '  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#f9fafb;padding:40px 20px;">',
    '    <tr>',
    '      <td align="center">',
    '        <table width="600" cellpadding="0" cellspacing="0" border="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);max-width:600px;width:100%;">',
    renderHeader(),
    '          <tr>',
    '            <td style="padding:32px 40px;font-size:15px;line-height:1.6;color:#111827;">',
    opts.bodyHtml,
    '            </td>',
    '          </tr>',
    buildFooterHtml(opts.language),
    '        </table>',
    '      </td>',
    '    </tr>',
    '  </table>',
    '</body>',
    '</html>',
  ].join('\n');

  return { text, html };
}

/**
 * Minimal HTML-entity escape for places we slot user-controlled text
 * into the layout (subject, preheader). Templates that emit fixed
 * strings don't need this; the layout uses it for safety.
 */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
