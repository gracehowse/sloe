"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CALM_MODE_STORAGE_KEY,
  DEFAULT_CALM_MODE,
  resolveCalmMode,
} from "./calmMode";

/**
 * React hook backing the web "Calm mode" preference (ENG-1098). SSR-safe
 * (returns the default until the localStorage value is read on mount) and
 * writes to the same storage key as the mobile counterpart. A `storage` event
 * listener keeps other open tabs in sync without a refresh. Mirrors
 * `useMacroDisplayStyle`.
 */
export function useCalmMode(): readonly [boolean, (next: boolean) => void] {
  const [calm, setCalmState] = useState<boolean>(DEFAULT_CALM_MODE);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setCalmState(resolveCalmMode(window.localStorage.getItem(CALM_MODE_STORAGE_KEY)));
    } catch {
      /* storage denied — keep default */
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== CALM_MODE_STORAGE_KEY) return;
      setCalmState(resolveCalmMode(e.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setCalm = useCallback((next: boolean) => {
    setCalmState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(CALM_MODE_STORAGE_KEY, String(next));
    } catch {
      /* storage denied — value lives in memory only this session */
    }
  }, []);

  return [calm, setCalm] as const;
}
