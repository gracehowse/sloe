import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_TREND_ONLY_WEIGHT,
  TREND_ONLY_WEIGHT_STORAGE_KEY,
  resolveTrendOnlyWeight,
} from "@suppr/shared/preferences/trendOnlyWeight";

/**
 * Mobile AsyncStorage hook for the "Trend-only weight" preference (ENG-713).
 * Mirrors `src/lib/preferences/useTrendOnlyWeight.ts` on web; both use the same
 * storage key so the value reads identically when cross-device sync lands.
 *
 * In-process pub/sub keeps every live hook instance in sync — flipping the
 * toggle in Settings must also update Progress mounted underneath in the
 * navigation stack (web gets this from `storage` events). Matches `useCalmMode`.
 */
const subscribers = new Set<(next: boolean) => void>();

export function useTrendOnlyWeight(): readonly [boolean, (next: boolean) => void] {
  const [trendOnly, setTrendOnlyState] = useState<boolean>(
    DEFAULT_TREND_ONLY_WEIGHT,
  );

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(TREND_ONLY_WEIGHT_STORAGE_KEY)
      .then((val) => {
        if (cancelled) return;
        setTrendOnlyState(resolveTrendOnlyWeight(val));
      })
      .catch(() => {
        /* storage denied — keep default */
      });
    subscribers.add(setTrendOnlyState);
    return () => {
      cancelled = true;
      subscribers.delete(setTrendOnlyState);
    };
  }, []);

  const setTrendOnly = useCallback((next: boolean) => {
    subscribers.forEach((notify) => notify(next));
    void AsyncStorage.setItem(TREND_ONLY_WEIGHT_STORAGE_KEY, String(next)).catch(
      () => {
        /* storage denied — value lives in memory only this session */
      },
    );
  }, []);

  return [trendOnly, setTrendOnly] as const;
}

export {
  DEFAULT_TREND_ONLY_WEIGHT,
  TREND_ONLY_WEIGHT_STORAGE_KEY,
  resolveTrendOnlyWeight,
};
