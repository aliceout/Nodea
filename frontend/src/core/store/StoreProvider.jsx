import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
} from "react";
import pb from "@/core/api/pocketbase";
import { reducer, initialState } from "./reducer";
import { setModulesState } from "./modulesRuntime";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Shared throttle for key presence checks (60s)
  const lastCheckRef = useRef(0);
  const THROTTLE_MS = 60000;

  const hasKey = useCallback(() => !!state.mainKey, [state.mainKey]);

  const markMissing = useCallback(() => {
    dispatch({ type: "key/status", payload: "missing" });
    if (process.env.NODE_ENV === "development") {
      console.warn("KEY:missing");
    }
  }, [dispatch]);

  // Logout: clear key material, invalidate PB session and redirect
  const logout = useCallback(async () => {
    try {
      pb.authStore?.clear?.();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("PB logout failed", err);
      }
    }
    dispatch({ type: "key/set", payload: null });
    dispatch({ type: "key/status", payload: "ready" });
    setModulesState({});
    window.location.href = "/login";
  }, [dispatch]);

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

    const events = [
      ["visibilitychange", () => document.visibilityState === "visible"],
      ["focus", () => true],
      ["pageshow", () => true],
      ["online", () => true],
    ];

    function handler(event) {
      const shouldCheck = events.find(([name]) => name === event.type)?.[1];
      if (shouldCheck && shouldCheck()) {
        checkKeyPresence(event.type);
      }
    }

    for (const [name] of events) {
      window.addEventListener(name, handler, true);
    }

    return () => {
      for (const [name] of events) {
        window.removeEventListener(name, handler, true);
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
  if (!ctx) {
    throw new Error("useStore must be used within StoreProvider");
  }
  return ctx;
}
