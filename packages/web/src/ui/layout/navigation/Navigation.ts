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
 * modules_list.tsx — rendered directly by Layout when its module
 * matches the current `:moduleId` URL segment.
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
