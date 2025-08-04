import { createContext, useContext, useState } from "react";

const MainKeyContext = createContext();

export function MainKeyProvider({ children }) {
  const [mainKey, setMainKey] = useState(null);
  return (
    <MainKeyContext.Provider value={{ mainKey, setMainKey }}>
      {children}
    </MainKeyContext.Provider>
  );
}

export function useMainKey() {
  return useContext(MainKeyContext);
}
