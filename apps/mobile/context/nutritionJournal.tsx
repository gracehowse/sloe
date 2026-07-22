import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { supabase } from "@/lib/supabase";
import { useAuth } from "@/context/auth";
import { dateKeyFromDate, type ByDay } from "@/lib/nutritionJournal";
import {
  journalRowToMeal,
  NUTRITION_ENTRY_SELECT_COLUMNS,
} from "@/lib/nutritionEntryRow";
import { journalBootWindowStartKey } from "@suppr/nutrition-core/journalWindow";
import { mergeJournalByDay } from "@suppr/nutrition-core/mergeJournalByDay";
import { useJournalWriteAhead } from "@/hooks/useJournalWriteAhead";

/**
 * ENG-1475 — the ONE in-memory nutrition journal shared by every mobile
 * screen that reads or writes `nutrition_entries` (today: Today + Progress).
 *
 * ## Root cause this fixes
 *
 * Pre-fix, `TodayScreen.tsx` owned `byDay` as a component-local `useState`
 * and `progress.tsx` independently re-fetched `nutrition_entries` into ITS
 * OWN component-local `useState` on every tab focus. The two were never the
 * same object: a meal logged on Today updated Today's copy optimistically
 * (see `persistMealsImmediate`'s `setByDay` calls), but Progress's `byDay`
 * only caught up on its next `nutrition_entries` SELECT — for the same
 * account/week this produced the exact "iOS says 0/3 days logged, web says
 * 1/3" divergence Grace hit, because web's `useNutritionJournalState`
 * (`src/context/appData/useNutritionJournalState.ts`) already mutates a
 * SHARED context journal optimistically at write time.
 *
 * This module is mobile's port of that web pattern: one context, one
 * `byDay`, optimistic local mutation on every write, SELECT reserved for
 * cold-boot hydrate (`refreshJournal`, mirrors web's boot-window load) and
 * history backfill (`ensureJournalHistory`, mirrors web's
 * `ensureJournalHistory` in the same file) — never a wholesale
 * current-week replace.
 *
 * ## What did NOT move here
 *
 * `TodayScreen.tsx`'s write paths (`persistMealsImmediate`,
 * `persistMealUpdateImmediate`, copy/duplicate/quick-add, …) already
 * mutate `byDay` optimistically BEFORE the network round-trip resolves
 * (ENG-1447 write-ahead journal) — exactly the shape this fix needs. They
 * are UNCHANGED by this migration: the only edit `TodayScreen.tsx` needs
 * is sourcing `byDay` / `setByDay` from this context instead of a local
 * `useState`, so every one of those existing `setByDay(prev => …)` calls
 * now mutates the SAME journal Progress reads. `TodayScreen.tsx`'s own
 * `loadJournal` also still owns `meal_plan_days` / `meal_plan_meals`
 * (planned-meal display, not journal state) and its own `hydrated` flag —
 * those stay local; only the `nutrition_entries` boot-window fetch moved
 * into `refreshJournal` below so Today and Progress can both call it
 * without duplicating the query.
 */

type RefreshJournalResult = {
  /** Set when the SELECT itself errored (not a timeout). `byDay` is left
   *  untouched either way — see the note on `setByDay({})` below. */
  error: string | null;
  timedOut: boolean;
  /** Server-confirmed row ids returned by THIS fetch (excludes queued/local
   *  rows) — Today uses this to prime the HealthKit-write dedupe set. */
  loadedIds: string[];
};

export type NutritionJournalContextValue = {
  byDay: ByDay;
  setByDay: Dispatch<SetStateAction<ByDay>>;
  /** True once the first `refreshJournal()` call (from whichever screen
   *  triggers it first — Today or Progress) has settled. Mirrors web's
   *  `journalHydrated`. Neither Today nor Progress currently gate their
   *  own skeleton on this directly (each keeps its existing, more precise
   *  local loading flag — see the module doc) but it's exposed for
   *  correctness parity with web and for future consumers. */
  hydrated: boolean;
  /**
   * Cold-boot / per-focus refresh of the last `JOURNAL_BOOT_WINDOW_DAYS`
   * (35d) window, merged into `byDay` via `mergeJournalByDay` so any
   * optimistic entry not yet confirmed by the server survives the merge.
   * Also layers in write-ahead-queued-but-unflushed rows, mirroring the
   * pre-extraction `TodayScreen.loadJournal` behaviour exactly.
   *
   * Deliberate behaviour change from the pre-extraction code (flagged,
   * not silent): on a SELECT error the old Today-local `loadJournal` did
   * `setByDay({})` — blanking the entire journal. That was safe when the
   * state was Today-only (a transient error just meant Today re-rendered
   * empty until the next successful focus). Now that `byDay` is shared,
   * the same blank-on-error would also wipe Progress's already-loaded
   * data from a Today-triggered refresh gone bad. `refreshJournal` never
   * blanks `byDay` on error — it leaves existing state as-is and returns
   * `error` so the caller can surface its own retry UI (Today already has
   * one via `loadError`).
   */
  refreshJournal: () => Promise<RefreshJournalResult>;
  /**
   * History-backfill ONLY — extends journal coverage back to `startKey`
   * and MERGES the result into `byDay` (never replaces it). Guarded so a
   * given `startKey` (or an earlier one) is fetched at most once per
   * mount, mirroring web's `historyFetchedStartKeyRef` /
   * `historyFetchInFlightRef` in `useNutritionJournalState`. No-ops when
   * `startKey` falls inside the boot window (`refreshJournal` already
   * covers it). This is what Progress now calls instead of running its
   * own independent 90-day `nutrition_entries` SELECT into a second
   * `byDay` copy.
   */
  ensureJournalHistory: (startKey: string) => Promise<void>;
};

const NutritionJournalContext = createContext<NutritionJournalContextValue | null>(null);

export function NutritionJournalProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  const [byDay, setByDay] = useState<ByDay>({});
  const [hydrated, setHydrated] = useState(false);

  // Reuses the same write-ahead-queue reader Today's own hook exposes —
  // `loadQueuedByDay` only reads the durable AsyncStorage queue, no
  // network call, so sharing it here doesn't duplicate any write-path
  // logic (writes still go through Today's `useJournalWriteAhead()`
  // instance and its `writeAhead` / `flushQueue`).
  const { loadQueuedByDay } = useJournalWriteAhead(supabase);

  const refreshInFlightRef = useRef(false);

  const refreshJournal = useCallback(async (): Promise<RefreshJournalResult> => {
    if (!userId) {
      setHydrated(true);
      return { error: null, timedOut: false, loadedIds: [] };
    }
    if (refreshInFlightRef.current) {
      return { error: null, timedOut: false, loadedIds: [] };
    }
    refreshInFlightRef.current = true;
    try {
      const windowStartKey = journalBootWindowStartKey();
      const JOURNAL_ENTRIES_TIMEOUT_MS = 45_000;
      const timeoutSentinel = Symbol("journal_refresh_timeout");
      const entriesPromise = supabase
        .from("nutrition_entries")
        .select(NUTRITION_ENTRY_SELECT_COLUMNS)
        .eq("user_id", userId)
        .gte("date_key", windowStartKey)
        .order("date_key", { ascending: true })
        .order("created_at", { ascending: true });
      const raced = await Promise.race([
        entriesPromise,
        new Promise<typeof timeoutSentinel>((resolve) => {
          setTimeout(() => resolve(timeoutSentinel), JOURNAL_ENTRIES_TIMEOUT_MS);
        }),
      ]);
      if (raced === timeoutSentinel) {
        console.warn("[nutritionJournal] refreshJournal timed out");
        return { error: null, timedOut: true, loadedIds: [] };
      }
      const { data: rows, error } = raced as Awaited<typeof entriesPromise>;
      if (error) {
        console.error("[nutritionJournal] refreshJournal failed:", error.message ?? "");
        return { error: "Could not load your journal.", timedOut: false, loadedIds: [] };
      }

      const loaded: ByDay = {};
      for (const r of rows ?? []) {
        const k = r.date_key as string;
        if (!loaded[k]) loaded[k] = [];
        loaded[k].push(journalRowToMeal(r as Record<string, unknown>));
      }
      // Layer in write-ahead-queued-but-unflushed rows as a second "local"
      // pass so a queued meal survives even a genuine cold start (ENG-1447
      // part 5 parity — `prev` is `{}` right after a kill, not just a
      // backgrounding).
      const queuedByDay = await loadQueuedByDay();
      const queuedMeals: ByDay = {};
      for (const [k, queueRows] of Object.entries(queuedByDay)) {
        queuedMeals[k] = queueRows.map((r) => journalRowToMeal(r));
      }
      setByDay((prev) => mergeJournalByDay(loaded, mergeJournalByDay(queuedMeals, prev)));

      const loadedIds = (rows ?? [])
        .map((r) => r.id as string)
        .filter((id): id is string => typeof id === "string" && id.length > 0);
      return { error: null, timedOut: false, loadedIds };
    } finally {
      setHydrated(true);
      refreshInFlightRef.current = false;
    }
  }, [userId, loadQueuedByDay]);

  /**
   * ENG-1475 secondary fix — history-backfill window start is computed by
   * the caller (Progress passes `journalHistoryWindowStartKey()`, the
   * same UTC-midnight-anchored helper `journalBootWindowStartKey` uses —
   * ENG-1580 already aligned mobile's cutoff onto this shared helper, so
   * there is no separate ad-hoc `ninetyDaysAgo` computation left to drift).
   */
  const bootWindowStartKey = useMemo(() => journalBootWindowStartKey(), []);
  const historyFetchedStartKeyRef = useRef<string | null>(null);
  const historyFetchInFlightRef = useRef(false);

  const ensureJournalHistory = useCallback(
    async (startKey: string) => {
      if (!userId) return;
      // The boot window already covers this start key.
      if (startKey >= bootWindowStartKey) return;
      const fetchedKey = historyFetchedStartKeyRef.current;
      if (fetchedKey != null && fetchedKey <= startKey) return;
      if (historyFetchInFlightRef.current) return;
      historyFetchInFlightRef.current = true;
      try {
        const { data, error } = await supabase
          .from("nutrition_entries")
          .select(NUTRITION_ENTRY_SELECT_COLUMNS)
          .eq("user_id", userId)
          .gte("date_key", startKey)
          .order("date_key", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) return;
        historyFetchedStartKeyRef.current = startKey;
        if (data && data.length > 0) {
          const loaded: ByDay = {};
          for (const r of data) {
            const k = r.date_key as string;
            if (!loaded[k]) loaded[k] = [];
            loaded[k].push(journalRowToMeal(r as Record<string, unknown>));
          }
          // Merge-only — this NEVER replaces the current week. A day
          // already present in `byDay` (e.g. today, optimistically
          // written) keeps any local-only rows the server hasn't
          // confirmed yet; `mergeJournalByDay` unions by id.
          setByDay((prev) => mergeJournalByDay(loaded, prev));
        }
      } finally {
        historyFetchInFlightRef.current = false;
      }
    },
    [userId, bootWindowStartKey],
  );

  const value = useMemo<NutritionJournalContextValue>(
    () => ({ byDay, setByDay, hydrated, refreshJournal, ensureJournalHistory }),
    [byDay, hydrated, refreshJournal, ensureJournalHistory],
  );

  return (
    <NutritionJournalContext.Provider value={value}>
      {children}
    </NutritionJournalContext.Provider>
  );
}

export function useNutritionJournal(): NutritionJournalContextValue {
  const ctx = useContext(NutritionJournalContext);
  if (!ctx) {
    throw new Error("useNutritionJournal must be used within a NutritionJournalProvider");
  }
  return ctx;
}

// Re-exported for convenience so consumers migrating off local `useState`
// don't need a second import line for the shared date-key helper.
export { dateKeyFromDate };
export type { ByDay };
