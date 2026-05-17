"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_MACRO_DISPLAY_STYLE,
  MACRO_DISPLAY_STORAGE_KEY,
  resolveMacroDisplayStyle,
  type MacroDisplayStyle,
} from "./macroDisplayStyle";

/**
 * React hook backing the web Today macro-display preference. SSR-safe
 * (returns the default until the localStorage value is read on mount)
 * and writes to the same storage key as the mobile counterpart so the
 * two surfaces share a key even before cross-device sync lands.
 *
 * Updates fire a `storage` event listener so any other open tab picks
 * up a preference change without a refresh.
 */
export function useMacroDisplayStyle(): readonly [
  MacroDisplayStyle,
  (next: MacroDisplayStyle) => void,
] {
  const [style, setStyleState] = useState<MacroDisplayStyle>(
    DEFAULT_MACRO_DISPLAY_STYLE,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(MACRO_DISPLAY_STORAGE_KEY);
      setStyleState(resolveMacroDisplayStyle(raw));
    } catch {
      /* storage denied — keep default */
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== MACRO_DISPLAY_STORAGE_KEY) return;
      setStyleState(resolveMacroDisplayStyle(e.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setStyle = useCallback((next: MacroDisplayStyle) => {
    setStyleState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(MACRO_DISPLAY_STORAGE_KEY, next);
    } catch {
      /* storage denied — value lives in memory only this session */
    }
  }, []);

  return [style, setStyle] as const;
}
