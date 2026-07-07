import { useMemo } from "react";

import { isFeatureEnabled } from "@/lib/analytics/track";

/**
 * usePlanEmptyWeekGhostGrid — ENG-1372 (empty-state grammar, Plan empty-week,
 * web legacy grid). Extracted out of `MealPlanner.tsx` (screen-budget pin) so
 * the host only needs one call + the two returned values.
 *
 * When the whole week has zero real meals (behind `empty_state_grammar_v1`):
 * every empty kanban cell collapses to a whisper-weight ghost pill instead of
 * repeating "Aim ~X kcal" ×7 (law 3 — that number is derived noise with
 * nothing behind it yet), and the aim triple renders ONCE as a legend above
 * the grid instead. A week with even one real meal keeps the normal per-slot
 * Aim treatment (still-earned context on the remaining empty cells).
 */
export function usePlanEmptyWeekGhostGrid(
  showSummaryCard: boolean,
  planHasRealMeals: boolean,
  daySlots: readonly string[],
  canonicalSlotAim: Record<string, number | null>,
): {
  showEmptyWeekGhostGrid: boolean;
  weekAimLegendSlots: { slot: string; aimKcal: number }[];
} {
  const showEmptyWeekGhostGrid =
    isFeatureEnabled("empty_state_grammar_v1") && showSummaryCard && !planHasRealMeals;
  const weekAimLegendSlots = useMemo(
    () =>
      daySlots
        .map((s) => ({ slot: s, aimKcal: canonicalSlotAim[s.toLowerCase()] ?? null }))
        .filter((s): s is { slot: string; aimKcal: number } => s.aimKcal != null),
    [daySlots, canonicalSlotAim],
  );
  return { showEmptyWeekGhostGrid, weekAimLegendSlots };
}
