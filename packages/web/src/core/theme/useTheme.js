import { useCallback } from "react";
import { useStore } from "@/core/store/StoreProvider";
import { selectTheme } from "@/core/store/selectors";
import { setTheme as setThemeAction } from "@/core/store/actions";

export function useTheme() {
  const { state, dispatch } = useStore();
  const theme = selectTheme(state);

  const setTheme = useCallback(
    (nextTheme) => {
      const normalized =
        nextTheme === "dark" || nextTheme === "light" ? nextTheme : "system";
      dispatch(setThemeAction(normalized));
    },
    [dispatch]
  );

  return { theme, setTheme };
}

