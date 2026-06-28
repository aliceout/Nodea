import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/**
 * Per-module mini-settings panel — open/close state shared between its two
 * halves of the grid: the trigger (the « Paramètre du module » link in
 * `ModuleSidebar`, rendered in the shell's `side`) and the panel itself
 * (rendered inline in each module's primary column, like the entry composer).
 *
 * Provided by `ModuleShell` so both sides reach it via context instead of
 * threading props through every module. `useModuleSettings` returns `null`
 * outside a provider (e.g. the Homepage shell, which carries no settings link),
 * so consumers no-op rather than crash.
 */
interface ModuleSettingsValue {
  open: boolean;
  toggle: () => void;
  close: () => void;
}

const ModuleSettingsContext = createContext<ModuleSettingsValue | null>(null);

export function ModuleSettingsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  // Stable identities so consumers can put `close`/`toggle` (and the value) in
  // effect deps without re-firing every render — used by the mutual-exclusion
  // effect that closes the entry form when this panel opens.
  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);
  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close]);
  return (
    <ModuleSettingsContext.Provider value={value}>
      {children}
    </ModuleSettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- provider + hook in one file, like every other context.tsx in the app
export function useModuleSettings(): ModuleSettingsValue | null {
  return useContext(ModuleSettingsContext);
}
