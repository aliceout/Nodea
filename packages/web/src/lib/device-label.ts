/**
 * Browser-side device-label parser for the « Sessions actives » UI
 * (issue #47).
 *
 * Reads `navigator.userAgent` and produces a short, human-readable
 * label like « MacBook », « iPhone », « iPad », « Android »,
 * « Windows », « Linux ». Deliberately coarse — we don't want to
 * surface anything fingerprint-y (browser version, exact OS build,
 * device model). Just enough so the user can recognise their own
 * sessions in the list.
 *
 * The label is encrypted client-side before being sent to the server
 * (cf. `core/crypto/session-meta.ts`) so the privacy guarantee
 * doesn't leak through the metadata.
 */

export type DeviceKind =
  | 'macbook'
  | 'imac'
  | 'iphone'
  | 'ipad'
  | 'android-phone'
  | 'android-tablet'
  | 'windows'
  | 'linux'
  | 'chromeos'
  | 'unknown';

export interface DeviceHint {
  kind: DeviceKind;
  /** Short user-facing label. French — the UI is FR-first ; the
   *  label is rendered as-is in the « Sessions actives » list. */
  label: string;
}

const UNKNOWN: DeviceHint = { kind: 'unknown', label: 'Appareil inconnu' };

/**
 * Parse a user-agent string into a coarse device hint. Pure function,
 * no side effects, safe to call from any context.
 *
 * Defaults to `unknown` when the user-agent is empty or doesn't match
 * any of the patterns we recognise — we'd rather show a generic
 * label than guess incorrectly.
 */
export function parseDeviceLabel(userAgent: string): DeviceHint {
  if (!userAgent) return UNKNOWN;
  const ua = userAgent;

  // iPad first — it announces itself differently on iPadOS 13+
  // (where Safari uses a Mac UA but adds `iPad` markers via touch
  // points). We catch both the historical `iPad` substring and the
  // newer `Mac OS X` + `iPad` combo.
  if (/iPad/i.test(ua)) return { kind: 'ipad', label: 'iPad' };
  if (/iPhone/i.test(ua)) return { kind: 'iphone', label: 'iPhone' };

  // Android : phone vs tablet split via the « Mobile » marker.
  // Android tablets usually omit `Mobile` in their UA. Not a
  // perfect signal but the common-case heuristic.
  if (/Android/i.test(ua)) {
    if (/Mobile/i.test(ua)) {
      return { kind: 'android-phone', label: 'Téléphone Android' };
    }
    return { kind: 'android-tablet', label: 'Tablette Android' };
  }

  // ChromeOS — recognised by `CrOS` in the UA.
  if (/CrOS/.test(ua)) return { kind: 'chromeos', label: 'Chromebook' };

  // Mac : we report « MacBook » as a generic label since most Mac
  // users are on a laptop. iMac users will see the same label —
  // accepted simplification, the alternative would require
  // hardware probing that's not available to web JS.
  if (/Macintosh|Mac OS X|Mac_PowerPC/i.test(ua)) {
    return { kind: 'macbook', label: 'Mac' };
  }

  // Windows — `Windows NT` is the canonical UA marker for every
  // modern Windows version (10, 11). We don't report the version.
  if (/Windows NT|Windows Phone|Win64|Win32/i.test(ua)) {
    return { kind: 'windows', label: 'Windows' };
  }

  // Linux — last because it's a common substring on Android UAs.
  // Android matched above so we're safe to fall through to `Linux`
  // here. We report `Linux` as a generic ; we don't try to detect
  // distros.
  if (/Linux|X11/i.test(ua)) return { kind: 'linux', label: 'Linux' };

  return UNKNOWN;
}
