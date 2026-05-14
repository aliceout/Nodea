import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Inlined favicon-64.png as a base64 data URL — used as the email
 * header logo (SEC-07).
 *
 * **Why inlined** : the previous version loaded `${WEB_BASE_URL}/favicon-128.png`
 * via an `<img src=…>`, which turned every email open into a tracking-
 * pixel-style request to the Nodea server (revealing IP, user-agent,
 * and the fact that the email was opened). Inlining as a `data:` URL
 * means the image renders without any network callback when the user's
 * mail client expands the email.
 *
 * **Cost** : ~2.4 KB base64 encoded (favicon-64.png is 1.8 KB raw).
 * Adds ~3 KB to each email after MIME boilerplate. Acceptable trade
 * for the privacy gain.
 *
 * **Source of truth** : a copy of `packages/web/public/favicon-64.png`
 * lives next to this module under `assets/favicon-64.png`. The api
 * package can't reach across to `packages/web/public/` at runtime
 * (different containers in prod), so the file is duplicated. To
 * regenerate after a logo update, copy the new png over and the next
 * server boot picks it up.
 *
 * **Display size** : the email template renders this as 32×32 px, but
 * we ship the 64×64 source so retina mail clients render crisply (the
 * browser / mail client downscales — no upscaling artefact).
 *
 * Read once at module load (server start) and cached.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH = path.join(__dirname, 'assets', 'favicon-64.png');
const LOGO_BUFFER = readFileSync(LOGO_PATH);

export const LOGO_DATA_URL = `data:image/png;base64,${LOGO_BUFFER.toString('base64')}`;
