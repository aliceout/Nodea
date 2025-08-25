import { createContext, useContext, useState, useMemo } from "react";

/**
 * mainKey: Uint8Array(32) | null
 * setMainKey: (Uint8Array(32) | null) => void
 */
const MainKeyContext = createContext({ mainKey: null, setMainKey: () => {} });

export function MainKeyProvider({ children }) {
  const [mainKey, setMainKey] = useState(null);

  const value = useMemo(() => ({ mainKey, setMainKey }), [mainKey]);
  return (
    <MainKeyContext.Provider value={value}>{children}</MainKeyContext.Provider>
  );
}

export function useMainKey() {
  return useContext(MainKeyContext);
}
