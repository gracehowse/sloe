"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_TREND_ONLY_WEIGHT,
  TREND_ONLY_WEIGHT_STORAGE_KEY,
  resolveTrendOnlyWeight,
} from "./trendOnlyWeight";

/**
 * React hook backing the web "Trend-only weight" preference (ENG-713). SSR-safe
 * (returns the default until the localStorage value is read on mount) and writes
 * to the same storage key as the mobile counterpart. A `storage` event listener
 * keeps other open tabs in sync without a refresh. Mirrors `useCalmMode`.
 */
export function useTrendOnlyWeight(): readonly [boolean, (next: boolean) => void] {
  const [trendOnly, setTrendOnlyState] = useState<boolean>(
    DEFAULT_TREND_ONLY_WEIGHT,
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      setTrendOnlyState(
        resolveTrendOnlyWeight(
          window.localStorage.getItem(TREND_ONLY_WEIGHT_STORAGE_KEY),
        ),
      );
    } catch {
      /* storage denied — keep default */
    }
    function onStorage(e: StorageEvent) {
      if (e.key !== TREND_ONLY_WEIGHT_STORAGE_KEY) return;
      setTrendOnlyState(resolveTrendOnlyWeight(e.newValue));
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setTrendOnly = useCallback((next: boolean) => {
    setTrendOnlyState(next);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(TREND_ONLY_WEIGHT_STORAGE_KEY, String(next));
    } catch {
      /* storage denied — value lives in memory only this session */
    }
  }, []);

  return [trendOnly, setTrendOnly] as const;
}
