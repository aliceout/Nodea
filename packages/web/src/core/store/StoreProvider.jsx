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
import { clearGuardsCache } from "@/core/crypto/guards";
import {
  hasMainKeyMaterial,
  wipeMainKeyMaterial,
} from "@/core/crypto/main-key";
import {
  applyTheme,
  watchSystemThemeChanges,
} from "@/core/theme/themeManager";

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Shared throttle for key presence checks (60s)
  const lastCheckRef = useRef(0);
  const THROTTLE_MS = 60000;

  // Logout: clear key material, invalidate PB session and redirect
  const logout = useCallback(() => {
    try {
      pb.authStore?.clear?.();
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.warn("PB logout failed", err);
      }
    }
    clearGuardsCache();
    wipeMainKeyMaterial(state.mainKey);
    dispatch({ type: "key/set", payload: null });
    dispatch({ type: "key/status", payload: "ready" });
    setModulesState({});
    window.location.href = "/login";
  }, [dispatch, state.mainKey]);

  const hasKey = useCallback(
    () => hasMainKeyMaterial(state.mainKey),
    [state.mainKey]
  );

  const markMissing = useCallback(() => {
    dispatch({ type: "key/status", payload: "missing" });
    if (process.env.NODE_ENV === "development") {
      console.warn("KEY:missing");
    }
    if (pb.authStore?.isValid) {
      logout();
    }
  }, [dispatch, logout]);

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

  useEffect(() => {
    const preference = state.ui.theme || "system";
    applyTheme(preference);

    if (preference !== "system") {
      return undefined;
    }

    const unsubscribe = watchSystemThemeChanges(() => {
      applyTheme("system");
    });

    return unsubscribe;
  }, [state.ui.theme]);

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
