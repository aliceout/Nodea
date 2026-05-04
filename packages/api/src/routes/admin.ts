import { makeAuthedRouter } from '../openapi/index.ts';

import { adminAnnouncementsRoutes } from './admin-announcements.ts';
import { adminInvitesRoutes } from './admin-invites.ts';
import { adminSettingsRoutes } from './admin-settings.ts';
import { adminSourcesRoutes } from './admin-sources.ts';
import { adminUsersRoutes } from './admin-users.ts';

/**
 * Admin barrel — re-exports `adminRoutes` mounting the 5 sub-routers
 * (invites / settings / users / announcements / sources). Same
 * pattern as `auth.ts` (cf. ADR-0008). Adding a new admin
 * sub-domain = adding one file + one mount line here.
 *
 * The external surface (`/admin/invites`, `/admin/users` ...) is
 * preserved because `app.ts` mounts this barrel at `/admin` and each
 * sub-router declares paths starting at `/<subdomain>`. The OpenAPI
 * doc aggregates routes from every sub-router via the `route('/', …)`
 * mounts below.
 */
export const adminRoutes = makeAuthedRouter();
adminRoutes.route('/', adminInvitesRoutes);
adminRoutes.route('/', adminSettingsRoutes);
adminRoutes.route('/', adminUsersRoutes);
adminRoutes.route('/', adminAnnouncementsRoutes);
adminRoutes.route('/', adminSourcesRoutes);
