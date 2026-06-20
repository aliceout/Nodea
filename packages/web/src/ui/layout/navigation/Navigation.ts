import { MODULES, type ModuleDef } from '@/app/modules-registry';

export interface NavItem {
  id: string;
  label: string;
  element: ModuleDef['element'];
  display: boolean;
  to_toggle: boolean;
  collection: string | null;
  description: string;
}

/**
 * Flat projection of MODULES used by Layout / Header / Sidebar.
 * The `element` field is the lazy-wrapped module component from
 * modules-registry.tsx — rendered by Layout when its id matches the
 * active module in the Zustand `flow` slice (never a URL segment: the
 * `/flow` privacy invariant keeps the module out of the URL).
 */
export const nav: NavItem[] = MODULES.map((m) => ({
  id: m.id,
  label: m.label,
  element: m.element,
  display: m.display !== false,
  to_toggle: Boolean(m.to_toggle),
  collection: m.collection ?? null,
  description: m.description ?? '',
}));
