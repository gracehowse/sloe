import { useCallback, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";

import { slotForHour } from "@suppr/nutrition-core/recipeJournalSlot";

/**
 * 2026-06-12 — Today extract (audit P2 #5).
 *
 * Owns the three related LogSheet deep-link / dismissal behaviours that
 * lived inline in the 6,700-LoC Today parent
 * (`apps/mobile/app/(tabs)/index.tsx`). Extracted so the logic is
 * unit-testable with `renderHook` + a mocked `useFocusEffect` rather than
 * guarded only by source-grep pins (see
 * `tests/unit/useLogSheetDeepLinks.test.ts`).
 *
 * Semantics are preserved EXACTLY — the openLog `=== "1"` early-returns,
 * the param-clear timing (clear only after the open state commits), and
 * the `@react-navigation/native` `useFocusEffect` source all match the
 * pre-extraction effects.
 *
 * The three behaviours:
 *
 * 1. **Open on `?openLog=1`** — the centered raised Log button in
 *    `<SupprTabBar>` (and external entry: push / Siri / widget URLs)
 *    navigates Today with `?openLog=1`. ENG-1009 (2026-06-10): consumed
 *    via `useFocusEffect` keyed on the `_t` cache-buster so re-navigating
 *    with openLog from any tab re-fires on focus even when the param value
 *    is unchanged. The previous plain `useEffect` without `_t` silently
 *    dropped repeat/warm deliveries. The global tab-bar `+` is generic
 *    (not slot-specific), so `activeMealSlot` is reset to time-of-day
 *    (build-47 follow-up) before opening; the slot-specific `+ Breakfast`
 *    path overrides this immediately via its own `setActiveMealSlot` in
 *    `onOpenFabForSlot`. Params are cleared after the open state commits so
 *    a back-nav doesn't re-open the sheet.
 *
 * 2. **Dismiss on in-tab deep links (PR #391, Launch queue #8)** — when a
 *    `date` jump or `editMealId` arrives WITHOUT `openLog=1` while the
 *    sheet is open, dismiss it. The openLog early-return keeps the
 *    open-and-dismiss paths from fighting when both `openLog=1` and a
 *    `date` arrive together.
 *
 * 3. **Dismiss on tab blur (ENG-1061 / PR #389, Launch queue #8 / F-171)**
 *    — LogSheet is a Modal on Today; if `fabSheetOpen` stays true after
 *    switching tabs, the scrim blocks the tab bar and other screens
 *    (Recipes "not clickable").
 */
export interface LogSheetDeepLinkParams {
  date?: string;
  _t?: string;
  editMealId?: string;
  openLog?: string;
}

export interface UseLogSheetDeepLinksArgs {
  params: LogSheetDeepLinkParams;
  /**
   * Clears the consumed deep-link params after the sheet opens so a
   * back-nav doesn't re-open it. In `index.tsx` this is
   * `router.setParams({ openLog: undefined, _t: undefined })`.
   */
  clearOpenLogParams: () => void;
  setFabSheetOpen: (open: boolean) => void;
  /**
   * Resets the LogSheet's active meal slot to a time-of-day default when
   * the generic tab-bar `+` opens the sheet (build-47 follow-up).
   */
  setActiveMealSlot: (slot: string) => void;
}

export function useLogSheetDeepLinks({
  params,
  clearOpenLogParams,
  setFabSheetOpen,
  setActiveMealSlot,
}: UseLogSheetDeepLinksArgs): void {
  // (2) Launch queue #8 (PR #391) — dismiss LogSheet when an in-tab deep
  // link arrives while the sheet is open (date jump, edit-meal). Tab-blur
  // dismiss when leaving Today is ENG-1061; this covers params that mutate
  // without switching tabs.
  useEffect(() => {
    if (params.openLog === "1") return;
    const hasDate =
      params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date);
    const hasEdit =
      typeof params.editMealId === "string" && params.editMealId.length > 0;
    if (hasDate || hasEdit) {
      setFabSheetOpen(false);
    }
  }, [params.date, params._t, params.editMealId, params.openLog, setFabSheetOpen]);

  // (1) 2026-04-30 — `?openLog=1` deep-link from the centered raised Log
  // button in `<SupprTabBar>` (and external entry: push / Siri / widget
  // URLs). ENG-1009 (2026-06-10): consumed via `useFocusEffect` keyed on
  // the `_t` cache-buster — the same contract as the `date` param above —
  // so re-navigating with openLog from any tab re-fires on focus even
  // when the param value is unchanged. The previous plain `useEffect`
  // without `_t` silently dropped repeat/warm deliveries. Params are
  // cleared after the open state commits so a back-nav doesn't re-open
  // the sheet.
  useFocusEffect(
    useCallback(() => {
      if (params.openLog === "1") {
        // 2026-05-08 build-47 follow-up — global tab-bar `+` is generic
        // (not slot-specific). Reset activeMealSlot to time-of-day so the
        // LogSheet header + the pick-handlers default to the right slot.
        // The slot-specific `+ Breakfast` path overrides this immediately
        // via its own setActiveMealSlot in onOpenFabForSlot.
        setActiveMealSlot(slotForHour(new Date().getHours()));
        setFabSheetOpen(true);
        clearOpenLogParams();
      }
    }, [params.openLog, params._t, clearOpenLogParams, setFabSheetOpen, setActiveMealSlot]),
  );

  // (3) Launch queue #8 / F-171 (ENG-1061) — LogSheet is a Modal on Today.
  // If `fabSheetOpen` stays true after switching tabs, the scrim blocks
  // the tab bar and other screens (Recipes "not clickable").
  useFocusEffect(
    useCallback(() => {
      return () => {
        setFabSheetOpen(false);
      };
    }, [setFabSheetOpen]),
  );
}
