import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TRACKING_EXTRAS_STORAGE_KEY = "suppr.tracking-extras.v1";

/**
 * 2026-05-16 — Today extract #4.
 *
 * Owns the `trackCaffeine` / `trackAlcohol` user preferences that
 * drive whether the Today screen shows the caffeine + alcohol macro
 * tiles + counts them toward daily totals.
 *
 * ## Why a hook
 *
 * Pre-fix: 2 useState + 1 useFocusEffect bundled inline in the
 * 6,000+ LoC Today parent. The setters were ONLY called from this
 * one effect — perfect encapsulation candidate. After: parent calls
 * `const { trackCaffeine, trackAlcohol } = useTrackingExtrasOnFocus()`
 * and the setters never leak.
 *
 * ## Why re-read on every focus
 *
 * P0-3 (2026-04-28) regression: a mount-only `useEffect` left Today
 * stuck on stale prefs after the user toggled them in Settings ->
 * Tracking extras and came back to Today. Re-reading on focus closes
 * that hole.
 *
 * ## Storage shape
 *
 * `AsyncStorage["suppr.tracking-extras.v1"]` is a JSON blob:
 *   `{ trackCaffeine?: boolean; trackAlcohol?: boolean } | null`
 *
 * Both defaults are `false` — caffeine + alcohol tracking is opt-in.
 *
 * ## Failure modes
 *
 * - AsyncStorage unavailable → keep defaults silently
 * - Malformed JSON → keep defaults silently
 * - Missing key (no prefs set) → reset both to `false` so the user
 *   wiping prefs doesn't leave a stale `true`
 */
export function useTrackingExtrasOnFocus(): {
  trackCaffeine: boolean;
  trackAlcohol: boolean;
} {
  const [trackCaffeine, setTrackCaffeine] = useState<boolean>(false);
  const [trackAlcohol, setTrackAlcohol] = useState<boolean>(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(TRACKING_EXTRAS_STORAGE_KEY);
          if (cancelled) return;
          if (!raw) {
            // No prefs set yet — fall back to defaults so a focus
            // event after the user clears the prefs (rare) doesn't
            // leave a stale `true`.
            setTrackCaffeine(false);
            setTrackAlcohol(false);
            return;
          }
          try {
            const parsed = JSON.parse(raw) as
              | { trackCaffeine?: boolean; trackAlcohol?: boolean }
              | null;
            if (parsed && typeof parsed === "object") {
              setTrackCaffeine(typeof parsed.trackCaffeine === "boolean" ? parsed.trackCaffeine : false);
              setTrackAlcohol(typeof parsed.trackAlcohol === "boolean" ? parsed.trackAlcohol : false);
            }
          } catch {
            // Malformed prefs — leave defaults.
          }
        } catch {
          // AsyncStorage unavailable — keep defaults.
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return { trackCaffeine, trackAlcohol };
}
