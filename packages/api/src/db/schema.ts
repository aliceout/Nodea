/**
 * Drizzle schema — barrel re-export.
 *
 * The 678-LOC monolith was split by domain into
 * `schema/<domain>.ts` ; this file keeps a stable
 * `import { ... } from '../db/schema.ts'` surface so the
 * 200+ call sites across the api don't need touching.
 *
 * Domains :
 *   - `schema/enums.ts` — `securityMode`, `registerState`,
 *     `sessionKind`, `authFactorKind`, `mfaFactor`,
 *     `emailVerificationKind`.
 *   - `schema/users.ts` — `users`, `sessions`.
 *   - `schema/auth.ts` — OPAQUE records, auth factors
 *     (passkeys), TOTP enrollment + backup codes, MFA
 *     bypass requests, email verifications, password reset
 *     tokens.
 *   - `schema/admin.ts` — invites, app settings,
 *     announcements.
 *   - `schema/entries.ts` — the `createEntryTable` factory
 *     + the nine per-module entry tables.
 *   - `schema/modules.ts` — `modulesConfig`,
 *     `userPreferences`.
 *
 * Inferred row types live at the bottom of this file so
 * consumers continue importing them from the canonical
 * `db/schema.ts` path.
 */

import { announcements, appSettings, invites } from './schema/admin.ts';
import {
  authFactors,
  emailVerifications,
  mfaBypassRequests,
  mfaTotp,
  mfaTotpRecoveryCodes,
  opaqueRecords,
  passwordResetTokens,
} from './schema/auth.ts';
import { moodEntries } from './schema/entries.ts';
import { modulesConfig, userPreferences } from './schema/modules.ts';
import { sessions, users } from './schema/users.ts';

export {
  authFactorKind,
  emailVerificationKind,
  mfaFactor,
  registerState,
  securityMode,
  sessionKind,
} from './schema/enums.ts';

export { sessions, users } from './schema/users.ts';

export {
  authFactors,
  emailVerifications,
  mfaBypassRequests,
  mfaTotp,
  mfaTotpRecoveryCodes,
  opaqueRecords,
  passwordResetTokens,
} from './schema/auth.ts';

export { announcements, appSettings, invites } from './schema/admin.ts';

export {
  cycleEntries,
  goalsEntries,
  hrtAdminLogsEntries,
  hrtLabResultsEntries,
  hrtSchedulesEntries,
  hrtSuppliersEntries,
  journalEntries,
  libraryCoversEntries,
  libraryItemsEntries,
  libraryReviewsEntries,
  moodEntries,
  reviewEntries,
  type EntryTable,
} from './schema/entries.ts';

export { modulesConfig, userPreferences } from './schema/modules.ts';

// --- Inferred row types ----------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
export type NewInvite = typeof invites.$inferInsert;
export type EntryRow = typeof moodEntries.$inferSelect;
export type NewEntryRow = typeof moodEntries.$inferInsert;
export type ModulesConfig = typeof modulesConfig.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;

// --- Auth v2 types ---------------------------------------------------------
export type OpaqueRecord = typeof opaqueRecords.$inferSelect;
export type NewOpaqueRecord = typeof opaqueRecords.$inferInsert;
export type AuthFactor = typeof authFactors.$inferSelect;
export type NewAuthFactor = typeof authFactors.$inferInsert;
export type MfaTotp = typeof mfaTotp.$inferSelect;
export type NewMfaTotp = typeof mfaTotp.$inferInsert;
export type MfaTotpRecoveryCode = typeof mfaTotpRecoveryCodes.$inferSelect;
export type NewMfaTotpRecoveryCode = typeof mfaTotpRecoveryCodes.$inferInsert;
export type MfaBypassRequest = typeof mfaBypassRequests.$inferSelect;
export type NewMfaBypassRequest = typeof mfaBypassRequests.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
