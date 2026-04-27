import { useEffect, useRef } from 'react';
import { apiCompleteOnboarding, apiMe } from '@/core/api/client';
import { saveEncryptedModulesConfig } from '@/core/api/modules-config-client';
import { generateModuleUserId } from '@/core/crypto/ids';
import { MODULES } from '@/app/config/modules_list';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  selectUser,
  type ModuleRuntimeEntry,
  type ModulesRuntime,
} from '@/core/store/nodea-store';

/**
 * First-run seed.
 *
 * The previous flow gated the home page behind an inline picker that
 * asked the user to choose modules up front. The picker forced a
 * decision without context — at the very moment the user has no idea
 * what each module does. Friction with no upside.
 *
 * New policy: all toggleable modules turn on by default. On the very
 * first login (`onboardingStatus === 'pending'`), this hook seeds a
 * fresh `moduleUserId` per module, persists the encrypted config,
 * flips the user's onboarding status to `complete`, and re-hydrates
 * the auth slice so the rest of the app sees the new state.
 *
 * Idempotent: a `useRef` latch protects against React 19 strict-mode
 * double-mount, and the `pending` check naturally short-circuits on
 * subsequent runs (we never come back to `pending` once flipped). If
 * a module config already exists with at least one entry, we don't
 * touch it — that handles the edge case of legacy users whose
 * `onboardingStatus` is still `pending` but who already configured
 * modules manually.
 *
 * Mounted once at the app shell (`Layout.tsx`), so the seed runs as
 * soon as the user is authenticated and their preferences /
 * modules-config slices have hydrated, regardless of which route
 * they land on.
 */
export function useFirstRunSeed(): void {
  const mainKey = useNodeaStore(selectMainKey);
  const user = useNodeaStore(selectUser);
  const modules = useNodeaStore(selectModules);
  const setModulesStore = useNodeaStore((s) => s.setModules);
  const setAuth = useNodeaStore((s) => s.setAuth);
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return undefined;
    if (!user || !mainKey) return undefined;
    if (user.onboardingStatus !== 'pending') return undefined;
    // If the user somehow already has a non-empty modules config,
    // don't overwrite their choices. We just complete onboarding so
    // the pending status doesn't keep firing this hook.
    const hasExistingConfig = Object.keys(modules).length > 0;
    seededRef.current = true;

    void (async () => {
      try {
        if (!hasExistingConfig) {
          const seeded: ModulesRuntime = {};
          for (const m of MODULES) {
            if (!m.to_toggle || !m.id) continue;
            const entry: ModuleRuntimeEntry = {
              enabled: true,
              moduleUserId: generateModuleUserId(),
              algo: 'v1',
            };
            seeded[m.id] = entry;
          }
          await saveEncryptedModulesConfig(mainKey.aesKey, seeded);
          setModulesStore(seeded);
        }
        await apiCompleteOnboarding();
        const me = await apiMe();
        if (me) setAuth(me);
      } catch (err) {
        // Soft fail — the user can still toggle modules manually
        // from Mon compte → Modules. We unlatch so a navigation /
        // remount can retry, but only if onboarding is still pending
        // (the natural circuit-breaker for the next pass).
        seededRef.current = false;
        if (import.meta.env.DEV) console.warn('first-run seed failed', err);
      }
    })();
  }, [mainKey, user, modules, setModulesStore, setAuth]);
}
