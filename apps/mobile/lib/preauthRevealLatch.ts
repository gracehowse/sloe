/**
 * ENG-1563 — latch `mobile_preauth_reveal_v1` once PostHog resolves true,
 * so a cold relaunch mid-reveal does not bounce the user to /login.
 *
 * When PostHog is cold, `isFeatureEnabled` returns false. Without a latch,
 * a user mid pre-auth reveal who force-quits and reopens gets sent to
 * /login until PostHog hydrates — a jarring one-screen detour.
 */

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { isFeatureEnabled } from "@/lib/analytics";

export const PREAUTH_REVEAL_LATCH_KEY = "suppr.flag.latch.mobile_preauth_reveal_v1";

/** Read the persisted latch (null while AsyncStorage is loading). */
export function usePreauthRevealLatched(): boolean | null {
  const live = isFeatureEnabled("mobile_preauth_reveal_v1");
  const [latched, setLatched] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PREAUTH_REVEAL_LATCH_KEY);
        if (cancelled) return;
        const stored = raw === "1";
        if (live && !stored) {
          await AsyncStorage.setItem(PREAUTH_REVEAL_LATCH_KEY, "1");
          if (!cancelled) setLatched(true);
          return;
        }
        if (!cancelled) setLatched(stored || live);
      } catch {
        if (!cancelled) setLatched(live);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [live]);

  // While loading: if live is already true, treat as on (no flash to login).
  if (latched === null) return live ? true : null;
  return latched || live;
}
