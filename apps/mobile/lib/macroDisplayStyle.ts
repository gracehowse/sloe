import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MACRO_DISPLAY_STYLE,
  MACRO_DISPLAY_STORAGE_KEY,
  resolveMacroDisplayStyle,
  type MacroDisplayStyle,
} from "@suppr/shared/preferences/macroDisplayStyle";

/**
 * Mobile-side AsyncStorage hook for the Today macro-display
 * preference. Mirrors `src/lib/preferences/useMacroDisplayStyle.ts`
 * on web; both use the same storage key so the value reads
 * identically when we add cross-device sync.
 *
 * On first mount the default `tiles` value renders while AsyncStorage
 * resolves — the swap to `bars` (if cached) happens silently within
 * a frame or two of boot. Matches the pattern in `context/theme.tsx`.
 */
export function useMacroDisplayStyle(): readonly [
  MacroDisplayStyle,
  (next: MacroDisplayStyle) => void,
] {
  const [style, setStyleState] = useState<MacroDisplayStyle>(
    DEFAULT_MACRO_DISPLAY_STYLE,
  );

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(MACRO_DISPLAY_STORAGE_KEY)
      .then((val) => {
        if (cancelled) return;
        setStyleState(resolveMacroDisplayStyle(val));
      })
      .catch(() => {
        /* storage denied — keep default */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setStyle = useCallback((next: MacroDisplayStyle) => {
    setStyleState(next);
    void AsyncStorage.setItem(MACRO_DISPLAY_STORAGE_KEY, next).catch(() => {
      /* storage denied — value lives in memory only this session */
    });
  }, []);

  return [style, setStyle] as const;
}

export {
  DEFAULT_MACRO_DISPLAY_STYLE,
  MACRO_DISPLAY_STORAGE_KEY,
  resolveMacroDisplayStyle,
  type MacroDisplayStyle,
};
