import { useEffect, useMemo, useRef, type Dispatch, type SetStateAction } from "react";

import { supabase } from "@/lib/supabase";
import { dateKeyFromDate, type ByDay } from "@/lib/nutritionJournal";
import {
  journalRowToMeal,
  NUTRITION_ENTRY_SELECT_COLUMNS,
} from "@/lib/nutritionEntryRow";
import { journalBootWindowStartKey } from "@suppr/shared/nutrition/journalWindow";
import { mergeJournalByDay } from "@suppr/shared/nutrition/mergeJournalByDay";

/**
 * ENG-1325 — out-of-window day navigation for the mobile journal (web
 * parity with ENG-1290's effect in `useNutritionJournalState`).
 *
 * The Today boot load only carries the last 35 days (ENG-542 /
 * `journalBootWindowStartKey`), but the calendar picker can jump up to
 * `JOURNAL_HISTORY_DAYS_BACK` (1095) days back — those days rendered
 * silently empty because nothing ever fetched them. When the selected day
 * predates the boot window, fetch that single day on demand and merge it
 * into the in-memory journal so historical browsing keeps working.
 *
 * Guards mirror the web implementation exactly:
 * - one fetch per day key per mount (empty days included) via a stable
 *   per-mount Set, so browsing a historical week doesn't refetch the same
 *   day on every re-render;
 * - a failed fetch deletes its key so revisiting the day retries;
 * - navigating away before the fetch settles deletes the key so returning
 *   retries;
 * - the merge goes through `mergeJournalByDay` (fetched rows as the server
 *   side) so optimistic local rows for that day are preserved.
 */
export function useOutOfWindowJournalDay(args: {
  userId: string | null | undefined;
  selectedDate: Date;
  setByDay: Dispatch<SetStateAction<ByDay>>;
}): void {
  const { userId, selectedDate, setByDay } = args;

  /**
   * Inclusive lower bound of the boot-load window. Memoised once per
   * mount: the window is a boot concept, not a live clock — re-deriving
   * it mid-session would churn the effect for no benefit (web parity).
   */
  const bootWindowStartKey = useMemo(() => journalBootWindowStartKey(), []);
  const outOfWindowFetchedRef = useRef<Set<string>>(new Set());

  const selectedDateKey = dateKeyFromDate(selectedDate);

  useEffect(() => {
    if (!userId) return;
    if (selectedDateKey >= bootWindowStartKey) return;
    // Stable per-mount Set; captured locally so the cleanup reads the
    // same instance (react-hooks/exhaustive-deps ref-in-cleanup rule).
    const fetchedDays = outOfWindowFetchedRef.current;
    if (fetchedDays.has(selectedDateKey)) return;
    fetchedDays.add(selectedDateKey);
    let cancelled = false;
    let settled = false;
    (async () => {
      const { data, error } = await supabase
        .from("nutrition_entries")
        .select(NUTRITION_ENTRY_SELECT_COLUMNS)
        .eq("user_id", userId)
        .eq("date_key", selectedDateKey)
        .order("created_at", { ascending: true });
      if (error) {
        // Retry on the next visit rather than caching the failure.
        fetchedDays.delete(selectedDateKey);
        return;
      }
      settled = true;
      if (cancelled) return;
      if (data && data.length > 0) {
        const fetched: ByDay = {
          [selectedDateKey]: (data as Record<string, unknown>[]).map(journalRowToMeal),
        };
        setByDay((prev) => mergeJournalByDay(fetched, prev));
      }
    })();
    return () => {
      cancelled = true;
      // Navigated away before the fetch settled — allow a refetch when
      // the user returns to this day.
      if (!settled) fetchedDays.delete(selectedDateKey);
    };
  }, [userId, selectedDateKey, bootWindowStartKey, setByDay]);
}
