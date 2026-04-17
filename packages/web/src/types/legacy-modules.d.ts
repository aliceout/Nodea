/**
 * Ambient declarations for the legacy JSX module entry points.
 *
 * Each module is a JSX file that TS refuses to parse (strict parser,
 * valid JSX expressions that aren't valid TSX). We declare them here so
 * imports from TS code resolve without flipping `allowJs: true` — which
 * would pull every JSX file into the type-check pass.
 *
 * Remove an entry from this file as soon as the corresponding module is
 * migrated to TSX and gets real types from its own index.tsx.
 */
declare module '@/app/flow/Homepage' {
  import type { ComponentType } from 'react';
  const Home: ComponentType<Record<string, unknown>>;
  export default Home;
}
declare module '@/app/flow/Mood' {
  import type { ComponentType } from 'react';
  const Mood: ComponentType<Record<string, unknown>>;
  export default Mood;
}
declare module '@/app/flow/Passage' {
  import type { ComponentType } from 'react';
  const Passage: ComponentType<Record<string, unknown>>;
  export default Passage;
}
declare module '@/app/flow/Goals' {
  import type { ComponentType } from 'react';
  const Goals: ComponentType<Record<string, unknown>>;
  export default Goals;
}
declare module '@/app/flow/Account' {
  import type { ComponentType } from 'react';
  const Account: ComponentType<Record<string, unknown>>;
  export default Account;
}
declare module '@/app/flow/Settings' {
  import type { ComponentType } from 'react';
  const Settings: ComponentType<Record<string, unknown>>;
  export default Settings;
}
declare module '@/app/flow/Admin' {
  import type { ComponentType } from 'react';
  const Admin: ComponentType<Record<string, unknown>>;
  export default Admin;
}
