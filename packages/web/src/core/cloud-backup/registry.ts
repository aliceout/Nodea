/**
 * Provider registry — maps a `cloudBackup.provider` id to its adapter.
 *
 * Static: the adapters are tiny (a few fetches + the popup/handshake glue); the
 * heavy `age-encryption` / `fflate` stay lazy inside `backup-crypto`. The UI
 * offers a picker over `CLOUD_PROVIDERS`; the orchestrator resolves the active
 * one via `getProvider`. New providers are one import + one line here.
 */
import type { CloudBackup } from '@nodea/shared';

import type { CloudProvider } from './types';
import { dropboxProvider } from './providers/dropbox';
import { pcloudProvider } from './providers/pcloud';
import { webdavProvider } from './providers/webdav';

type ProviderId = CloudBackup['provider'];

const PROVIDERS: Partial<Record<ProviderId, CloudProvider>> = {
  dropbox: dropboxProvider,
  pcloud: pcloudProvider,
  webdav: webdavProvider,
};

/** Provider ids that are wired + connectable today (drives the UI picker). */
export const CLOUD_PROVIDERS = Object.keys(PROVIDERS) as ProviderId[];

export function getProvider(id: ProviderId): CloudProvider {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`cloud backup: provider "${id}" is not available`);
  }
  return provider;
}
