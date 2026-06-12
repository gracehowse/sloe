import { useCallback } from "react";
import { InteractionManager } from "react-native";
import { useFocusEffect } from "expo-router";

import {
  syncHealthDataThrottled,
  isHealthSyncAvailable,
} from "@/lib/healthSync";

/** Cap focus-time body sync so a hung native bridge cannot block Today forever. */
const FOCUS_HEALTH_SYNC_TIMEOUT_MS = 15_000;

/**
 * 2026-05-16 — first extraction from the Today God-component
 * (`apps/mobile/app/(tabs)/index.tsx`, 6,200+ LoC, 182 hooks).
 *
 * Pulls HealthKit body metrics (steps, burn, workouts) on Today focus,
 * then refreshes profile targets so burn/steps update without a manual
 * Health Sync trip. Throttled + serialized inside `syncHealthDataThrottled`.
 *
 * Meal import from Health is intentionally **not** run here — it queues
 * 30+ native HK reads and has been observed to wedge / crash the dev
 * client on iOS 26 device builds. Users import from More → Health Sync.
 *
 * @param userId — current user; the hook no-ops when null
 * @param loadProfileTargets — refreshes `profiles` after a body sync
 */
export function useHealthSyncOnFocus(
  userId: string | null | undefined,
  loadProfileTargets: () => Promise<void>,
): void {
  useFocusEffect(
    useCallback(() => {
      if (!userId || !isHealthSyncAvailable()) return;

      let cancelled = false;
      const interactionTask = InteractionManager.runAfterInteractions(() => {
        void (async () => {
          try {
            await Promise.race([
              syncHealthDataThrottled(userId),
              new Promise<never>((_, reject) => {
                setTimeout(
                  () => reject(new Error(`focus health sync timed out (${FOCUS_HEALTH_SYNC_TIMEOUT_MS}ms)`)),
                  FOCUS_HEALTH_SYNC_TIMEOUT_MS,
                );
              }),
            ]);
          } catch {
            // HealthKit hang/deny/timeout — still refresh profile from Supabase.
          }
          if (cancelled) return;
          try {
            await loadProfileTargets();
          } catch {
            // Network — Today can still render cached profile state.
          }
        })();
      });

      return () => {
        cancelled = true;
        interactionTask.cancel();
      };
    }, [userId, loadProfileTargets]),
  );
}
