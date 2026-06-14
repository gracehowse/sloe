import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import {
  CALM_MODE_STORAGE_KEY,
  DEFAULT_CALM_MODE,
  resolveCalmMode,
} from "@suppr/shared/preferences/calmMode";

/**
 * Mobile AsyncStorage hook for the "Calm mode" preference (ENG-1098). Mirrors
 * `src/lib/preferences/useCalmMode.ts` on web; both use the same storage key so
 * the value reads identically when cross-device sync lands.
 *
 * In-process pub/sub keeps every live hook instance in sync — flipping the
 * toggle in Settings must also quiet the aims on Today/Plan mounted underneath
 * in the navigation stack (web gets this from `storage` events). Matches the
 * `macroDisplayStyle` mobile hook.
 */
const subscribers = new Set<(next: boolean) => void>();

export function useCalmMode(): readonly [boolean, (next: boolean) => void] {
  const [calm, setCalmState] = useState<boolean>(DEFAULT_CALM_MODE);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(CALM_MODE_STORAGE_KEY)
      .then((val) => {
        if (cancelled) return;
        setCalmState(resolveCalmMode(val));
      })
      .catch(() => {
        /* storage denied — keep default */
      });
    subscribers.add(setCalmState);
    return () => {
      cancelled = true;
      subscribers.delete(setCalmState);
    };
  }, []);

  const setCalm = useCallback((next: boolean) => {
    subscribers.forEach((notify) => notify(next));
    void AsyncStorage.setItem(CALM_MODE_STORAGE_KEY, String(next)).catch(() => {
      /* storage denied — value lives in memory only this session */
    });
  }, []);

  return [calm, setCalm] as const;
}

export {
  CALM_MODE_STORAGE_KEY,
  DEFAULT_CALM_MODE,
  resolveCalmMode,
};
