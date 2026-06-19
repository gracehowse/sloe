import { useEffect, useRef } from "react";

import { AnalyticsEvents } from "@suppr/shared/analytics/events";
import { track } from "@/lib/analytics";

type WidgetSnapshotSignature = {
  totalsKey: string;
  fastKey: string | null;
  wroteOnce: boolean;
};

type MacroTargets = {
  protein: number;
  carbs: number;
  fat: number;
};

type MacroTotals = MacroTargets & {
  calories: number;
};

type UseTodayWidgetSnapshotParams = {
  hydrated: boolean;
  isToday: boolean;
  viewMode: "day" | "week";
  totals: MacroTotals;
  effectiveCalorieGoal: number;
  effectiveMacroTargets: MacroTargets;
  activeFastStart: string | null;
  fastTargetHours: number;
};

/**
 * Batch 5.12 — iOS widget snapshot side-effect for Today.
 *
 * Debounces today's macro + fast-state snapshot writes so the native widget
 * never receives historical-day totals, and analytics can distinguish initial
 * liveness writes from macro and fasting changes.
 */
export function useTodayWidgetSnapshot({
  hydrated,
  isToday,
  viewMode,
  totals,
  effectiveCalorieGoal,
  effectiveMacroTargets,
  activeFastStart,
  fastTargetHours,
}: UseTodayWidgetSnapshotParams): void {
  const widgetSnapshotSignatureRef = useRef<WidgetSnapshotSignature>({
    totalsKey: "",
    fastKey: null,
    wroteOnce: false,
  });

  useEffect(() => {
    if (!hydrated || !isToday || viewMode !== "day") return;
    const currentTotalsKey = [
      totals.calories,
      totals.protein,
      totals.carbs,
      totals.fat,
      effectiveCalorieGoal,
      effectiveMacroTargets.protein,
      effectiveMacroTargets.carbs,
      effectiveMacroTargets.fat,
    ].join(":");
    const currentFastKey = activeFastStart ?? null;
    const prev = widgetSnapshotSignatureRef.current;
    let trigger: "totals_changed" | "fast_state_changed" | "scheduled_refresh";
    if (!prev.wroteOnce) {
      // First write after hydrate — classified as a scheduled refresh so the
      // initial liveness ping isn't misattributed to totals.
      trigger = "scheduled_refresh";
    } else if (prev.fastKey !== currentFastKey) {
      trigger = "fast_state_changed";
    } else {
      trigger = "totals_changed";
    }
    let cancelled = false;
    const handle = setTimeout(() => {
      if (cancelled) return;
      (async () => {
        const { buildWidgetSnapshot, writeWidgetSnapshot } = await import("@/lib/widgetSnapshot");
        const snapshot = buildWidgetSnapshot({
          kcalConsumed: totals.calories,
          kcalTarget: effectiveCalorieGoal,
          proteinTargetG: effectiveMacroTargets.protein,
          proteinConsumedG: totals.protein,
          carbsTargetG: effectiveMacroTargets.carbs,
          carbsConsumedG: totals.carbs,
          fatTargetG: effectiveMacroTargets.fat,
          fatConsumedG: totals.fat,
          fastStartsAt: activeFastStart,
          // Threaded from `profiles.fasting_window` (parsed in
          // `loadProfileTargets`). `buildWidgetSnapshot` clamps to 1..48h and
          // defaults to 16 if anything is off — safe to pass directly.
          fastTargetHours,
        });
        const result = await writeWidgetSnapshot(snapshot);
        if (result.ok) {
          widgetSnapshotSignatureRef.current = {
            totalsKey: currentTotalsKey,
            fastKey: currentFastKey,
            wroteOnce: true,
          };
          track(AnalyticsEvents.widget_snapshot_updated, { trigger });
        }
      })().catch(() => {
        // Never let a widget persistence failure break Today.
      });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    hydrated,
    isToday,
    viewMode,
    totals.calories,
    totals.protein,
    totals.carbs,
    totals.fat,
    effectiveCalorieGoal,
    effectiveMacroTargets.protein,
    effectiveMacroTargets.carbs,
    effectiveMacroTargets.fat,
    activeFastStart,
    fastTargetHours,
  ]);
}
