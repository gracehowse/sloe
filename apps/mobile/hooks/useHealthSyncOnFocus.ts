import { useCallback } from "react";
import { useFocusEffect } from "expo-router";

import {
  syncHealthDataThrottled,
  syncNutritionFromHealthThrottled,
  isHealthSyncAvailable,
} from "@/lib/healthSync";

/**
 * 2026-05-16 — first extraction from the Today God-component
 * (`apps/mobile/app/(tabs)/index.tsx`, 6,200+ LoC, 182 hooks).
 *
 * Pulls HealthKit-driven activity + nutrition syncs on every Today
 * focus, then refreshes profile targets and the journal so any new
 * rows are visible without a manual reload. Throttled internally so
 * a user rapid-tabbing won't hammer HealthKit.
 *
 * Failure mode: HealthKit may not be available (Android, simulator
 * without permissions) or the network may be down — we swallow the
 * error silently so the rest of the screen still loads. The user can
 * trigger a forced sync from Settings → Connections if they care.
 *
 * @param userId           — current user; the hook no-ops when null
 * @param loadProfileTargets — refreshes the `profiles` table-backed targets
 * @param loadJournal      — refreshes `nutrition_entries` so HealthKit-
 *                            written rows show up immediately
 */
export function useHealthSyncOnFocus(
  userId: string | null | undefined,
  loadProfileTargets: () => Promise<void>,
  loadJournal: () => Promise<void>,
): void {
  useFocusEffect(
    useCallback(() => {
      if (!userId || !isHealthSyncAvailable()) return;
      void (async () => {
        try {
          await syncHealthDataThrottled(userId);
          await syncNutritionFromHealthThrottled(userId);
          await loadProfileTargets();
          await loadJournal();
        } catch {
          // HealthKit or network — ignore; user can sync from
          // Settings → Connections.
        }
      })();
    }, [userId, loadProfileTargets, loadJournal]),
  );
}
