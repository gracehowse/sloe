/**
 * useAiMethodTooltip (mobile) — ENG-1252 host hook that decides whether the
 * LogSheet should show its first-session "AI logging — available with Pro."
 * discoverability tooltip under the locked Voice / Snap chip.
 *
 * Owns the per-device session counter (read → increment → persist) against
 * `AsyncStorage`, then folds the persisted session number through the shared
 * pure gate {@link shouldShowAiMethodTooltip} (flag × tier × session window).
 * Returns `false` until storage has hydrated, so the tooltip never flashes
 * before we know the real session number.
 *
 * Mirror of `src/lib/today/useAiMethodTooltip.ts` (web localStorage transport).
 * The gate logic + constants are the single shared source in
 * `@suppr/shared/today/aiMethodTooltip`; only the storage transport differs.
 */

import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { isFeatureEnabled } from "@/lib/analytics";
import {
  AI_METHOD_TOOLTIP_FLAG,
  AI_METHOD_TOOLTIP_SESSION_KEY,
  nextSessionNumber,
  parseSessionCount,
  serializeSessionCount,
  shouldShowAiMethodTooltip,
} from "@suppr/shared/today/aiMethodTooltip";

/**
 * @param userTier the viewer's billing tier ("free" / "base" / "pro").
 * @returns whether the AI-method tooltip should render right now.
 */
export function useAiMethodTooltip(userTier: string): boolean {
  // `null` until AsyncStorage has hydrated this session's number — keeps the
  // tooltip off on the first render so it can't flash then disappear.
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(AI_METHOD_TOOLTIP_SESSION_KEY)
      .then((raw) => {
        if (cancelled) return;
        const current = nextSessionNumber(parseSessionCount(raw));
        setSessionNumber(current);
        return AsyncStorage.setItem(
          AI_METHOD_TOOLTIP_SESSION_KEY,
          serializeSessionCount(current),
        );
      })
      .catch(() => {
        /* storage denied — leave session number null so the tooltip stays off */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (sessionNumber === null) return false;
  return shouldShowAiMethodTooltip({
    flagOn: isFeatureEnabled(AI_METHOD_TOOLTIP_FLAG),
    userTier,
    sessionNumber,
  });
}
