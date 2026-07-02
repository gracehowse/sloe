"use client";

import { useEffect } from "react";
import { useAppData } from "../context/AppDataContext.tsx";
import { journalHistoryWindowStartKey } from "../lib/nutrition/journalWindow.ts";

/**
 * ENG-1324 — widen the shared journal to the 90-day history window on mount.
 *
 * The journal boot load carries only the last 35 days (ENG-1290, mobile
 * parity with ENG-542), which is correct for Today but starves the surfaces
 * whose stats look further back: Progress (period stat cards + charts,
 * streaks, the 30-day milestone) and Profile (protected streak, days-logged
 * count, milestone strip). On a fresh device those read the context
 * `nutritionByDay` and silently under-count everything older than 35 days.
 *
 * Mobile Progress solves this by fetching its own 90-day
 * `nutrition_entries` slice on focus (`apps/mobile/app/(tabs)/progress.tsx`
 * `loadData` — 90 days is the hard cap there too, regardless of the M/6M/Y
 * period selector). The web equivalents share the context journal instead
 * of owning a fetch, so this hook asks the context to widen its window to
 * the same 90-day key. Dedupe/error semantics live in
 * `ensureNutritionHistory` (one fetch per window start; a failed fetch
 * retries on the next mount).
 */
export function useNutritionHistoryWindow(): void {
  const { ensureNutritionHistory } = useAppData();
  useEffect(() => {
    ensureNutritionHistory(journalHistoryWindowStartKey());
  }, [ensureNutritionHistory]);
}
