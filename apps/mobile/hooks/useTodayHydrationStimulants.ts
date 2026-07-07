import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";

import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { NUTRITION_DEFAULTS } from "@/constants/nutritionDefaults";
import {
  isHydrationCardVisible,
  isStepsCardVisible,
} from "@suppr/nutrition-core/todayProgressiveDisclosure";
import type { JournalMeal, ByDay } from "@/lib/nutritionJournal";

/** Supabase JSONB `*_by_day` columns keep at most this many days — a day
 *  older than this is pruned locally before every persist so the payload
 *  never grows unbounded. Mirrors `MAX_JSONB_DAYS` on the web tracker. */
const MAX_JSONB_DAYS = 90;

function pruneByDay<V>(map: Record<string, V>): Record<string, V> {
  const keys = Object.keys(map).sort().reverse().slice(0, MAX_JSONB_DAYS);
  const pruned: Record<string, V> = {};
  for (const k of keys) pruned[k] = map[k];
  return pruned;
}

type UseTodayHydrationStimulantsParams = {
  userId: string | undefined;
  dayKey: string;
  byDay: ByDay;
  mealsToday: JournalMeal[];
  stepsByDay: Record<string, number>;
  activityBurnByDay: Record<string, number>;
  trackCaffeine: boolean;
  trackAlcohol: boolean;
};

export type UseTodayHydrationStimulantsResult = {
  // State (read) — `loadProfileTargets` in TodayScreen hydrates these from
  // the `profiles` row on load/focus via the exposed setters below.
  waterGoalMl: number;
  extraWaterByDay: Record<string, number>;
  targetCaffeineMg: number;
  extraCaffeineByDay: Record<string, number>;
  targetAlcoholGWeekly: number;
  extraAlcoholGByDay: Record<string, number>;
  hydrationManualExpanded: boolean;
  stepsManualExpanded: boolean;

  // Setters — only `loadProfileTargets` (the profile-row hydration path,
  // which stays in TodayScreen since it hydrates ~20 unrelated fields in one
  // network round trip) should call these directly. Every other mutation
  // goes through the callbacks below so the persist + rollback + analytics
  // logic can never be bypassed.
  setWaterGoalMl: (ml: number) => void;
  setTargetCaffeineMg: (mg: number) => void;
  setExtraWaterByDay: (byDay: Record<string, number>) => void;
  setExtraCaffeineByDay: (byDay: Record<string, number>) => void;
  setTargetAlcoholGWeekly: (g: number) => void;
  setExtraAlcoholGByDay: (byDay: Record<string, number>) => void;
  setHydrationManualExpanded: (expanded: boolean) => void;
  setStepsManualExpanded: (expanded: boolean) => void;

  // Derived, read-only.
  extraWaterToday: number;
  extraCaffeineToday: number;
  waterFromMealsMl: number;
  caffeineFromMealsMg: number;
  alcoholFromMealsG: number;
  alcoholByDayMerged: Record<string, number>;
  hydrationCardGateOpen: boolean;
  stepsCardGateOpen: boolean;
  showHydrationCard: boolean;
  showStepsCard: boolean;

  // Mutations — own persist (Supabase `profiles` row) + optimistic-rollback
  // + analytics. Callers never touch the raw setters for these paths.
  addWaterMl: (ml: number) => Promise<void>;
  addCaffeineMg: (mg: number, preset?: string | null) => Promise<void>;
  addAlcoholG: (grams: number, preset?: string | null) => Promise<void>;
  resetHydrationStimulantsForDay: (kind: "water" | "caffeine" | "alcohol") => Promise<void>;
};

/**
 * ENG-1361 — Today extract (round 2, real domain hook, not a re-export
 * shim). Owns the water / caffeine / alcohol "hydration stimulants" quick-add
 * state, the per-day quick-add ledgers, and the persist-with-rollback +
 * analytics logic that mutates them.
 *
 * ## Why a hook
 *
 * All three ledgers (`extra_water_by_day`, `extra_caffeine_by_day`,
 * `extra_alcohol_g_by_day`) share the same shape (JSONB day→amount map on
 * `profiles`), the same 90-day prune, and the same optimistic-update +
 * rollback-on-persist-failure pattern (Build 41, 2026-05-01 — see the
 * closure-capture history preserved in the callback comments below). Bundling
 * them removes ~230 lines of triplicated persistence logic from the Today
 * parent and gives the pattern one place to fix if a fourth ledger
 * (e.g. sodium) is added later.
 *
 * ## What stays in TodayScreen
 *
 * `loadProfileTargets` (the single-round-trip profile loader that hydrates
 * ~20 unrelated fields) still sets the initial values via the exposed
 * setters — pulling that loader apart is out of scope for this pass (ENG-1361
 * step 2 is explicit: group state first, no risky adjacent refactors). Every
 * *mutation* after initial load goes through this hook's callbacks.
 *
 * ## Failure modes
 *
 * - Supabase persist fails (RLS denial / offline) → local state rolls back to
 *   the pre-add snapshot and an `Alert` surfaces so the chip doesn't silently
 *   "not take" (TestFlight `AEsaeOW2Qw-BQa29teBp-Ns`, Build 41).
 * - `userId` not yet resolved → every mutation no-ops rather than writing to
 *   an unscoped row.
 */
export function useTodayHydrationStimulants({
  userId,
  dayKey,
  byDay,
  mealsToday,
  stepsByDay,
  activityBurnByDay,
  trackCaffeine,
  trackAlcohol,
}: UseTodayHydrationStimulantsParams): UseTodayHydrationStimulantsResult {
  const [waterGoalMl, setWaterGoalMl] = useState(NUTRITION_DEFAULTS.water);
  const [extraWaterByDay, setExtraWaterByDay] = useState<Record<string, number>>({});
  const [targetCaffeineMg, setTargetCaffeineMg] = useState<number>(400);
  const [extraCaffeineByDay, setExtraCaffeineByDay] = useState<Record<string, number>>({});
  const [targetAlcoholGWeekly, setTargetAlcoholGWeekly] = useState<number>(0);
  const [extraAlcoholGByDay, setExtraAlcoholGByDay] = useState<Record<string, number>>({});
  const [hydrationManualExpanded, setHydrationManualExpanded] = useState(false);
  const [stepsManualExpanded, setStepsManualExpanded] = useState(false);

  const extraWaterToday = extraWaterByDay[dayKey] ?? 0;

  const waterFromMealsMl = useMemo(
    () => Math.round(mealsToday.reduce((a, m) => a + Math.max(0, m.waterMl ?? 0), 0)),
    [mealsToday],
  );

  /** F-74 (TestFlight `AN3mTmZK5T2Nhj13aMFLk2E`, 2026-04-25): today's
   *  caffeine total in mg = manual quick-add (`extra_caffeine_by_day`)
   *  + per-meal caffeine summed from `nutrition_micros.caffeineMg`.
   *  Before F-74 the Hydration card only read the quick-add ledger,
   *  so logging a coffee in food search left the card at 0/400 mg.
   *  Same shape applies to alcohol below. */
  const caffeineFromMealsMg = useMemo(() => {
    let sum = 0;
    for (const m of mealsToday) {
      const n = Number(m.micros?.caffeineMg ?? 0);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return Math.round(sum);
  }, [mealsToday]);

  const alcoholFromMealsG = useMemo(() => {
    let sum = 0;
    for (const m of mealsToday) {
      const n = Number(m.micros?.alcoholG ?? 0);
      if (Number.isFinite(n) && n > 0) sum += n;
    }
    return Math.round(sum * 10) / 10;
  }, [mealsToday]);

  const extraCaffeineToday = (extraCaffeineByDay[dayKey] ?? 0) + caffeineFromMealsMg;

  /** F-74 — alcohol-by-day merge: HydrationStimulantsCard expects a
   *  per-day map (week summary needs per-day to render the bar chart),
   *  so we fold per-meal alcohol from `nutrition_micros.alcoholG`
   *  into every day key currently loaded in `byDay`. The quick-add
   *  ledger remains the writable persistence; this merge is read-only. */
  const alcoholByDayMerged = useMemo<Record<string, number>>(() => {
    const out: Record<string, number> = { ...extraAlcoholGByDay };
    for (const [k, meals] of Object.entries(byDay)) {
      let dayMeals = 0;
      for (const m of meals) {
        const n = Number(m.micros?.alcoholG ?? 0);
        if (Number.isFinite(n) && n > 0) dayMeals += n;
      }
      if (dayMeals > 0) {
        out[k] = (out[k] ?? 0) + Math.round(dayMeals * 10) / 10;
      }
    }
    return out;
  }, [byDay, extraAlcoholGByDay]);

  // Audit M4 (2026-04-18) — Today progressive disclosure gates.
  // Visibility is "sticky": once true for a returning user it stays true
  // because the underlying state (water target, Health sync) persists.
  // Manual expanders (`hydrationManualExpanded`, `stepsManualExpanded`)
  // let a first-run user open the card on demand without writing any
  // state they might not want.
  const hydrationCardGateOpen = useMemo(
    () =>
      isHydrationCardVisible({
        waterTargetMl: waterGoalMl,
        extraWaterByDay,
        waterFromMealsMl,
        // Phase 2 / B1.4 — caffeine/alcohol logs only contribute to
        // the gate when their respective opt-in toggle is on. When
        // the user has opted out, historical caffeine/alcohol data
        // is preserved but does not surface the card.
        extraCaffeineByDay: trackCaffeine ? extraCaffeineByDay : {},
        extraAlcoholGByDay: trackAlcohol ? extraAlcoholGByDay : {},
      }),
    [waterGoalMl, extraWaterByDay, waterFromMealsMl, extraCaffeineByDay, extraAlcoholGByDay, trackCaffeine, trackAlcohol],
  );
  const stepsCardGateOpen = useMemo(
    () => isStepsCardVisible({ stepsByDay, activityBurnByDay }),
    [stepsByDay, activityBurnByDay],
  );
  const showHydrationCard = hydrationCardGateOpen || hydrationManualExpanded;
  const showStepsCard = stepsCardGateOpen || stepsManualExpanded;

  const addWaterMl = useCallback(
    async (ml: number) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(ml));
      if (add === 0) return;
      // Build 41 (2026-05-01) — same React 18 functional-updater
      // closure-capture trap as `addCaffeineMg` / `addAlcoholG`. The
      // previous `setExtraWaterByDay((prev) => { persisted = next;
      // return next; })` pattern left `persisted` as `null` when the
      // `if (persisted)` branch ran, so the supabase write was
      // silently skipped. Same root cause and same fix: compute
      // `next` from the closure-captured `prev` map before calling
      // setState, then persist with the directly-captured value.
      const prev = extraWaterByDay;
      const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
      setExtraWaterByDay(next);
      // Debug audit 2026-05-04 (code-quality #2): caffeine + alcohol
      // already had persist-error rollback (round 3, 2026-04-26); water
      // was missed. Without rollback, an offline / RLS-denied write
      // left the UI ahead of the server, and the next focus refresh
      // re-read from DB and the bump appeared to "evaporate". Same
      // shape as the addCaffeineMg path now.
      const { error } = await supabase
        .from("profiles")
        .update({ extra_water_by_day: next })
        .eq("id", userId);
      if (error) {
        setExtraWaterByDay(prev);
        console.error("[addWaterMl] persist failed:", error.message, error);
        Alert.alert("Couldn't save water", error.message ?? "Try again.");
        return;
      }
      track(AnalyticsEvents.hydration_logged, {
        type: "water",
        amount: add,
        unit: "ml",
        preset: null,
        // L6 G6 (2026-04-18) — dashboards key off amount_ml + via.
        // All current mobile water entry points are quick chips (the
        // HydrationStimulantsCard, the TodayAddMealDialog meal-row
        // path routes `waterMl` inside the meal entry → food_logged,
        // not here). If a manual `addWaterMl` is introduced, flag it.
        amount_ml: add,
        via: "quick_chip",
      });
    },
    [userId, dayKey, extraWaterByDay],
  );

  /** Batch 2.5 — caffeine quick-add for the selected day.
   *
   * 2026-04-26 polish (round 3): tester reported "adding a coffee still
   * doesn't impact the caffeine numbers". Local state DOES update
   * synchronously (the +chip flips the count to e.g. 95/400 mg
   * immediately), but the supabase persist was happening fire-and-forget
   * — any error (RLS denial, missing column, network failure) was
   * silently swallowed. On next app refresh the count reverted to 0
   * because nothing was actually saved server-side. Now: capture the
   * error, roll back local state, surface a toast so the user knows
   * the chip didn't take. Fixes the symptom of "added a coffee, came
   * back to the screen, count is back at 0".
   *
   * Build 41 (TestFlight `AEsaeOW2Qw-BQa29teBp-Ns`, 2026-05-01):
   * tester reported the same symptom is back ("Adding alcohol or
   * coffee still not impacting these numbers"). Root cause was the
   * round-3 fix relied on capturing `next` inside a `setState((prev)
   * => ...)` updater, then reading `persisted` on the next line —
   * but React 18 invokes functional updaters lazily during the next
   * commit, so `persisted` was still `null` when the persist branch
   * checked it. The supabase write therefore never fired, the
   * round-3 error path never ran, and the round-3 toast never
   * surfaced even though no save happened. On next focus / app
   * relaunch the local state hydrated from the (still-zero) server
   * row and the count appeared to "reset".
   *
   * Fix: compute `next` synchronously from the latest map captured
   * in the closure, persist with that value, and use a direct
   * (non-functional) setState call so the value is immediately
   * available outside the updater. The persist now fires, errors
   * surface, and the local state matches what's actually saved. */
  const addCaffeineMg = useCallback(
    async (mg: number, preset: string | null = null) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(mg));
      if (add === 0) return;
      // Snapshot the previous map for rollback BEFORE we mutate state
      // so a network failure can't leave the UI ahead of the server.
      const prev = extraCaffeineByDay;
      const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
      setExtraCaffeineByDay(next);
      const { error } = await supabase
        .from("profiles")
        .update({ extra_caffeine_by_day: next })
        .eq("id", userId);
      if (error) {
        // Roll back to the captured `prev` — direct restore, no
        // functional updater, so the rollback definitely uses the
        // pre-add value (not whatever the latest state was, which
        // could include other in-flight chip taps).
        setExtraCaffeineByDay(prev);
        console.error("[addCaffeineMg] persist failed:", error.message, error);
        Alert.alert("Couldn't save caffeine", error.message ?? "Try again.");
        return;
      }
      track(AnalyticsEvents.stimulant_logged, {
        type: "caffeine",
        amount: add,
        unit: "mg",
        preset,
        // L6 G6 (2026-04-18) — explicit enum fields so the dashboards
        // don't have to reverse a (unit, type) combo.
        kind: "caffeine",
        amount_mg_or_g: add,
        via: preset ? "quick_chip" : "manual",
      });
    },
    [userId, dayKey, extraCaffeineByDay],
  );

  /** Batch 2.5 — alcohol quick-add (grams ethanol) for the selected day.
   *  Same persist-error rollback hardening as addCaffeineMg above
   *  (2026-04-26 round 3). Build 41 fix: same closure-capture
   *  workaround — see the long doc on `addCaffeineMg` for the
   *  React 18 functional-updater rationale. */
  const addAlcoholG = useCallback(
    async (grams: number, preset: string | null = null) => {
      if (!userId) return;
      const add = Math.max(0, Math.round(grams));
      if (add === 0) return;
      const prev = extraAlcoholGByDay;
      const next = pruneByDay({ ...prev, [dayKey]: (prev[dayKey] ?? 0) + add });
      setExtraAlcoholGByDay(next);
      const { error } = await supabase
        .from("profiles")
        .update({ extra_alcohol_g_by_day: next })
        .eq("id", userId);
      if (error) {
        setExtraAlcoholGByDay(prev);
        console.error("[addAlcoholG] persist failed:", error.message, error);
        Alert.alert("Couldn't save alcohol", error.message ?? "Try again.");
        return;
      }
      track(AnalyticsEvents.stimulant_logged, {
        type: "alcohol",
        amount: add,
        unit: "g",
        preset,
        // L6 G6 (2026-04-18) — explicit enum fields.
        kind: "alcohol",
        amount_mg_or_g: add,
        via: preset ? "quick_chip" : "manual",
      });
    },
    [userId, dayKey, extraAlcoholGByDay],
  );

  /** Batch 2.5 — reset today's value for one of the three hydration rows.
   *
   * Build 41 (2026-05-01) — same React 18 functional-updater
   * closure-capture trap as `addCaffeineMg` / `addAlcoholG` /
   * `addWaterMl`. Compute `next` from the closure-captured map
   * before calling setState so the persist branch sees the value
   * directly. */
  const resetHydrationStimulantsForDay = useCallback(
    async (kind: "water" | "caffeine" | "alcohol") => {
      if (!userId) return;
      const column =
        kind === "water"
          ? "extra_water_by_day"
          : kind === "caffeine"
          ? "extra_caffeine_by_day"
          : "extra_alcohol_g_by_day";
      const apply = (prev: Record<string, number>): Record<string, number> => {
        if (prev[dayKey] == null) return prev;
        const next = { ...prev };
        delete next[dayKey];
        return next;
      };
      let next: Record<string, number>;
      if (kind === "water") {
        next = apply(extraWaterByDay);
        if (next === extraWaterByDay) return; // no-op when day already empty
        setExtraWaterByDay(next);
      } else if (kind === "caffeine") {
        next = apply(extraCaffeineByDay);
        if (next === extraCaffeineByDay) return;
        setExtraCaffeineByDay(next);
      } else {
        next = apply(extraAlcoholGByDay);
        if (next === extraAlcoholGByDay) return;
        setExtraAlcoholGByDay(next);
      }
      await supabase.from("profiles").update({ [column]: next }).eq("id", userId);
      // L6 G6 (2026-04-18) — reset paths stay backwards-compatible
      // (amount: 0, preset: "reset") and add the explicit enum
      // fields. `via: "manual"` because reset is always a deliberate
      // menu action, never a quick chip.
      if (kind === "water") {
        track(AnalyticsEvents.hydration_logged, {
          type: "water",
          amount: 0,
          unit: "ml",
          preset: "reset",
          amount_ml: 0,
          via: "manual",
        });
      } else {
        track(AnalyticsEvents.stimulant_logged, {
          type: kind,
          amount: 0,
          unit: kind === "caffeine" ? "mg" : "g",
          preset: "reset",
          kind,
          amount_mg_or_g: 0,
          via: "manual",
        });
      }
    },
    [userId, dayKey, extraWaterByDay, extraCaffeineByDay, extraAlcoholGByDay],
  );

  return {
    waterGoalMl,
    extraWaterByDay,
    targetCaffeineMg,
    extraCaffeineByDay,
    targetAlcoholGWeekly,
    extraAlcoholGByDay,
    hydrationManualExpanded,
    stepsManualExpanded,

    setWaterGoalMl,
    setTargetCaffeineMg,
    setExtraWaterByDay,
    setExtraCaffeineByDay,
    setTargetAlcoholGWeekly,
    setExtraAlcoholGByDay,
    setHydrationManualExpanded,
    setStepsManualExpanded,

    extraWaterToday,
    extraCaffeineToday,
    waterFromMealsMl,
    caffeineFromMealsMg,
    alcoholFromMealsG,
    alcoholByDayMerged,
    hydrationCardGateOpen,
    stepsCardGateOpen,
    showHydrationCard,
    showStepsCard,

    addWaterMl,
    addCaffeineMg,
    addAlcoholG,
    resetHydrationStimulantsForDay,
  };
}
