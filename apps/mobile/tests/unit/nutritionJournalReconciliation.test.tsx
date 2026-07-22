/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, act } from "@testing-library/react-native";

/**
 * ENG-1475 reconciliation test.
 *
 * Root cause: `apps/mobile/app/(tabs)/progress.tsx` used to re-fetch
 * `nutrition_entries` into a SCREEN-LOCAL `useState` on every tab focus,
 * disconnected from `TodayScreen.tsx`'s own screen-local `byDay`. A meal
 * logged on Today updated Today's copy instantly (optimistic write) but
 * Progress only caught up on its NEXT `nutrition_entries` SELECT — for the
 * same account/week this produced "iOS says 0/3 days logged, web says
 * 1/3" (web never had this bug because `useNutritionJournalState.ts`
 * already mutates a SHARED context journal at write time, before the
 * network round-trip resolves — `src/context/appData/useNutritionJournalState.ts:415-418`).
 *
 * The fix: `context/nutritionJournal.tsx`'s `NutritionJournalProvider` is
 * the ONE in-memory journal both `TodayScreen.tsx` and `progress.tsx` now
 * read/write. This test proves the invariant the fix establishes:
 *
 *   1. An optimistic write from the "Today" call site is visible to the
 *      "Progress" call site on the SAME render pass — no fetch involved.
 *   2. `daysWithFood` (Progress's stat surface) / the equivalent
 *      `daysLogged` derivation (`buildDigestWeekView`'s recap surface —
 *      literally the same `bundle.days.filter(d => d.calories > 0).length`
 *      expression, see `src/lib/nutrition/weeklyRecap.ts:199`) computed
 *      from either call site's view of the journal are IDENTICAL.
 *   3. The same optimistic-write SHAPE web's `useNutritionJournalState`
 *      uses (`setNutritionByDay(prev => ({...prev, [dayKey]: [...day, meal]}))`,
 *      mirrored verbatim below as `webOptimisticAppend` since importing the
 *      real web hook here would pull in browser-only deps) fed through the
 *      SAME shared `buildWeekStats` (`@suppr/nutrition-core/progressWeekReport`
 *      — the literal function both platforms call, not a mobile-only port)
 *      produces the identical `daysWithFood` mobile now computes.
 *   4. None of the above touches `supabase.from(...)` — proving the
 *      reconciliation holds WITHOUT an extra fetch round-trip. The
 *      `supabase` mock throws if queried at all, so a regression that
 *      reintroduces a fetch-to-reconcile fails loudly here rather than
 *      passing by accident.
 */

const fromMock = vi.fn<(table: string) => unknown>((_table: string) => {
  throw new Error(
    "supabase.from() must not be called — this reconciliation must hold from the " +
      "in-memory optimistic write alone, with no fetch round-trip.",
  );
});
vi.mock("@/lib/supabase", () => ({
  // Deferred reference (not `{ from: fromMock }` directly) — `vi.mock`
  // factories are hoisted above this file's `const fromMock = vi.fn(...)`,
  // so the object literal must not dereference `fromMock` until call time.
  supabase: { from: (table: string) => fromMock(table) },
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({ session: { user: { id: "user-1" } } }),
}));

import {
  NutritionJournalProvider,
  useNutritionJournal,
  type NutritionJournalContextValue,
} from "@/context/nutritionJournal";
import { dateKeyFromDate, type JournalMeal } from "@/lib/nutritionJournal";
import { buildWeekStats } from "@suppr/nutrition-core/progressWeekReport";

const TARGETS = { calories: 2000, protein: 150, carbs: 200, fat: 70 };

/** Mirrors `buildWeekStats`'s own Monday-week-start math exactly
 *  (`src/lib/nutrition/progressWeekReport.ts`) so the day keys this test
 *  writes to always land inside the SAME 7-day bucket `buildWeekStats`
 *  will compute for `now` — deterministic regardless of which weekday the
 *  suite actually runs on, no fake-timer system-clock juggling needed. */
function mondayWeekFirst(now: Date): Date {
  const dow = now.getDay();
  const startOffset = dow === 0 ? -6 : 1 - dow;
  const weekFirst = new Date(now);
  weekFirst.setDate(now.getDate() + startOffset);
  return weekFirst;
}

function meal(calories: number): Omit<JournalMeal, "id"> & { id: string } {
  return {
    id: `meal-${calories}`,
    name: "Lunch",
    recipeTitle: "Chicken Salad",
    time: "Lunch",
    calories,
    protein: 40,
    carbs: 30,
    fat: 20,
  };
}

/**
 * Verbatim mirror of web's optimistic-write shape in
 * `addLoggedMealForDate` (`src/context/appData/useNutritionJournalState.ts:416-419`):
 *   setNutritionByDay((prev) => {
 *     const day = prev[resolvedDateKey] ?? [];
 *     return { ...prev, [resolvedDateKey]: [...day, newMeal] };
 *   });
 * Reproduced as a plain reducer (not the real hook) so this test doesn't
 * have to pull `sonner` / the browser Supabase client / DOM-only React
 * context into the mobile vitest project just to prove the merge shape
 * is equivalent.
 */
function webOptimisticAppend(
  prev: Record<string, JournalMeal[]>,
  dayKey: string,
  newMeal: JournalMeal,
): Record<string, JournalMeal[]> {
  const day = prev[dayKey] ?? [];
  return { ...prev, [dayKey]: [...day, newMeal] };
}

/** Render-prop harness — repo convention for capturing hook state via
 *  `render()` (see `useJournalWriteAhead.test.tsx`). Two separate
 *  component instances stand in for `TodayScreen.tsx` and `progress.tsx`:
 *  both call `useNutritionJournal()` independently, exactly like the two
 *  real screens do, so this test exercises the actual cross-screen
 *  context wiring rather than a single shared local. */
function ScreenHarness({
  onReady,
}: {
  onReady: (api: NutritionJournalContextValue) => void;
}) {
  const api = useNutritionJournal();
  onReady(api);
  return null;
}

describe("ENG-1475 — shared nutrition journal reconciliation (Today <-> Progress)", () => {
  beforeEach(() => {
    fromMock.mockClear();
  });

  it("an optimistic write from Today is visible to Progress instantly, with identical daysWithFood and no fetch", () => {
    let todayApi!: NutritionJournalContextValue;
    let progressApi!: NutritionJournalContextValue;

    render(
      <NutritionJournalProvider>
        <ScreenHarness onReady={(api) => { todayApi = api; }} />
        <ScreenHarness onReady={(api) => { progressApi = api; }} />
      </NutritionJournalProvider>,
    );

    const now = new Date();
    const weekFirst = mondayWeekFirst(now);
    const dayKeys = [0, 1, 2].map((i) => {
      const d = new Date(weekFirst);
      d.setDate(weekFirst.getDate() + i);
      return dateKeyFromDate(d);
    });

    // Before any log, both screens agree: nothing logged this week.
    expect(buildWeekStats(todayApi.byDay, TARGETS, "monday", now).daysWithFood).toBe(0);
    expect(buildWeekStats(progressApi.byDay, TARGETS, "monday", now).daysWithFood).toBe(0);

    // Simulate three separate "log a meal" actions on Today, one per day
    // this week — the exact `setByDay(prev => ...)` optimistic-append
    // shape `persistMealsImmediate` / `saveEditMeal` / quick-add etc. all
    // use in `TodayScreen.tsx` today (unchanged by ENG-1475 — only the
    // STATE SOURCE moved to this shared context).
    for (const dayKey of dayKeys) {
      act(() => {
        todayApi.setByDay((prev) => ({
          ...prev,
          [dayKey]: [...(prev[dayKey] ?? []), meal(500)],
        }));
      });
    }

    // No re-fetch anywhere in this flow — the reconciliation is instant.
    expect(fromMock).not.toHaveBeenCalled();

    // Progress reads the SAME journal object Today just wrote to — no
    // separate SELECT, no stale copy. This is the literal fix for "iOS
    // says 0/3 days logged, web says 1/3": pre-fix, `progressApi` here
    // would have been a Progress-local `useState` still showing `{}`.
    for (const dayKey of dayKeys) {
      expect(progressApi.byDay[dayKey]?.map((m) => m.id)).toEqual([`meal-500`]);
    }

    const todayStats = buildWeekStats(todayApi.byDay, TARGETS, "monday", now);
    const progressStats = buildWeekStats(progressApi.byDay, TARGETS, "monday", now);

    expect(todayStats.daysWithFood).toBe(3);
    expect(progressStats.daysWithFood).toBe(3);
    // The two screens' data-acquisition paths (Today's write-time state,
    // Progress's read-time state) must agree exactly — this equality is
    // what the bug broke.
    expect(progressStats.daysWithFood).toBe(todayStats.daysWithFood);

    // `daysLogged` (the recap/digest surface, `buildDigestWeekView` in
    // `weeklyRecap.ts`) is literally `bundle.days.filter(d => d.calories >
    // 0).length` — i.e. `daysWithFood` under a different property name off
    // the same `WeekStatsBundle`. Assert that derivation directly too so a
    // future rename of one without the other can't silently decouple them.
    const daysLoggedFromBundle = todayStats.days.filter((d) => d.calories > 0).length;
    expect(daysLoggedFromBundle).toBe(3);

    // Web's data-acquisition path: same three logs, applied via web's own
    // optimistic-write reducer shape, fed through the IDENTICAL shared
    // `buildWeekStats` mobile just used above (not a mobile-only lookalike
    // — `@suppr/nutrition-core/progressWeekReport` is a straight re-export
    // of `src/lib/nutrition/progressWeekReport.ts`, the same module web
    // imports directly). Same input shape -> same function -> must agree.
    let webByDay: Record<string, JournalMeal[]> = {};
    for (const dayKey of dayKeys) {
      webByDay = webOptimisticAppend(webByDay, dayKey, meal(500));
    }
    const webStats = buildWeekStats(webByDay, TARGETS, "monday", now);
    expect(webStats.daysWithFood).toBe(todayStats.daysWithFood);
    expect(webStats.daysWithFood).toBe(progressStats.daysWithFood);

    // Still no fetch, even after computing stats on both platforms' shapes.
    expect(fromMock).not.toHaveBeenCalled();
  });

  it("history backfill (ensureJournalHistory) merges rather than replaces an optimistically-written current day", async () => {
    // ENG-1475 secondary requirement: "the mobile 90-day background SELECT
    // becomes a history-backfill only, never a wholesale current-week
    // replace." This test proves the merge direction: an optimistic
    // write for TODAY survives a concurrent `ensureJournalHistory` call
    // whose server response does NOT (yet) include that just-logged row
    // (e.g. the write is still in flight when Progress mounts).
    fromMock.mockImplementation((table: string) => {
      expect(table).toBe("nutrition_entries");
      return {
        select: () => ({
          eq: () => ({
            gte: () => ({
              order: () => ({
                order: () =>
                  Promise.resolve({
                    // Server snapshot predates the optimistic write below —
                    // it has yesterday's history but NOT today's fresh log.
                    data: [],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      };
    });

    let todayApi!: NutritionJournalContextValue;
    render(
      <NutritionJournalProvider>
        <ScreenHarness onReady={(api) => { todayApi = api; }} />
      </NutritionJournalProvider>,
    );

    const now = new Date();
    const todayKey = dateKeyFromDate(now);
    const optimisticMeal: JournalMeal = { ...meal(400), id: "optimistic-today" };

    act(() => {
      todayApi.setByDay((prev) => ({
        ...prev,
        [todayKey]: [...(prev[todayKey] ?? []), optimisticMeal],
      }));
    });

    const ninetyDaysAgoKey = dateKeyFromDate(new Date(now.getTime() - 89 * 86_400_000));
    await act(async () => {
      await todayApi.ensureJournalHistory(ninetyDaysAgoKey);
    });

    // The backfill's (empty) server response must NOT have wiped the
    // optimistic row — `mergeJournalByDay` unions by id, it never replaces
    // the day wholesale.
    expect(todayApi.byDay[todayKey]?.map((m) => m.id)).toEqual(["optimistic-today"]);
  });
});
