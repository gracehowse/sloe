"use client";

/**
 * useAiMethodTooltip (web) — ENG-1252 host hook that decides whether the
 * LogSheet should show its first-session "AI logging — available with Pro."
 * discoverability tooltip under the locked Voice / Snap chip.
 *
 * Owns the per-device session counter (read → increment → persist) against
 * `localStorage`, then folds the persisted session number through the shared
 * pure gate {@link shouldShowAiMethodTooltip} (flag × tier × session window).
 * Returns `false` until storage has hydrated, so the tooltip never flashes
 * before we know the real session number.
 *
 * Mirror of `apps/mobile/lib/useAiMethodTooltip.ts` (AsyncStorage transport).
 * The gate logic + constants are the single shared source in
 * `./aiMethodTooltip`; only the storage transport differs per platform.
 */

import { useEffect, useState } from "react";
import { isFeatureEnabled } from "../analytics/track";
import {
  AI_METHOD_TOOLTIP_FLAG,
  AI_METHOD_TOOLTIP_SESSION_KEY,
  nextSessionNumber,
  parseSessionCount,
  serializeSessionCount,
  shouldShowAiMethodTooltip,
} from "./aiMethodTooltip";

/**
 * @param userTier the viewer's billing tier ("free" / "base" / "pro").
 * @returns whether the AI-method tooltip should render right now.
 */
export function useAiMethodTooltip(userTier: string): boolean {
  // `null` until localStorage has hydrated this session's number — keeps the
  // tooltip off on the very first render so it can't flash then disappear.
  const [sessionNumber, setSessionNumber] = useState<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(AI_METHOD_TOOLTIP_SESSION_KEY);
      const current = nextSessionNumber(parseSessionCount(raw));
      setSessionNumber(current);
      window.localStorage.setItem(
        AI_METHOD_TOOLTIP_SESSION_KEY,
        serializeSessionCount(current),
      );
    } catch {
      /* storage denied — leave session number null so the tooltip stays off */
    }
  }, []);

  if (sessionNumber === null) return false;
  return shouldShowAiMethodTooltip({
    flagOn: isFeatureEnabled(AI_METHOD_TOOLTIP_FLAG),
    userTier,
    sessionNumber,
  });
}
