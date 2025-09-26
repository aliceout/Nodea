import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { reducer, initialState } from "./reducer";
// import { useNavigate } from "react-router-dom";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Throttle partagé pour les checks (60s)
  const lastCheckRef = useRef(0);
  const THROTTLE_MS = 60000;

  // Méthode synchrone : la clé est-elle présente ?
  const hasKey = useCallback(() => {
    return !!state.mainKey;
  }, [state.mainKey]);

  // Marque la clé comme manquante et notifie l'UI
  const markMissing = useCallback(() => {
    dispatch({ type: "key/status", payload: "missing" });
    // Log dev
    if (process.env.NODE_ENV === "development") {
      console.warn("KEY:missing");
    }
  }, [dispatch]);

  // Logout : nettoie la mémoire et redirige vers /login
  const logout = useCallback(async () => {
    dispatch({ type: "key/set", payload: null });
    dispatch({ type: "key/status", payload: "ready" });
    // TODO: retirer timers/listeners ici si besoin
    // Redirection via window.location pour éviter le contexte Router
    window.location.href = "/login";
  }, [dispatch]);

  // Listener global : vérifie la présence de la clé
  useEffect(() => {
    function checkKeyPresence(reason) {
      const now = Date.now();
      if (now - lastCheckRef.current < THROTTLE_MS) return;
      lastCheckRef.current = now;
      if (!hasKey()) {
        if (process.env.NODE_ENV === "development") {
          console.warn(`KEY_CHECK:presence:false [${reason}]`);
        }
        markMissing();
      }
    }

    // Liste des événements à surveiller
    const events = [
      ["visibilitychange", () => document.visibilityState === "visible"],
      ["focus", () => true],
      ["pageshow", () => true],
      ["online", () => true],
    ];

    function handler(e) {
      const type = e.type;
      const shouldCheck = events.find(([evt, cond]) => evt === type)?.[1];
      if (shouldCheck && shouldCheck()) checkKeyPresence(type);
    }

    for (const [evt] of events) {
      window.addEventListener(evt, handler, true);
    }

    return () => {
      for (const [evt] of events) {
        window.removeEventListener(evt, handler, true);
      }
    };
  }, [hasKey, markMissing]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      mainKey: state.mainKey,
      keyStatus: state.keyStatus,
      hasKey,
      markMissing,
      logout,
    }),
    [state, dispatch, hasKey, markMissing, logout]
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
