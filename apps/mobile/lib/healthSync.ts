/**
 * Apple Health (iOS) and Health Connect (Android) integration scaffold.
 *
 * This module requires native builds (EAS Build) — it will NOT work in Expo Go.
 * All public functions are safe to call regardless; they no-op when the native
 * module is unavailable.
 *
 * To enable:
 *   1. Run `npx expo install react-native-health` (iOS)
 *   2. Run `npx expo install react-native-health-connect` (Android)
 *   3. Create a dev build: `eas build --profile development`
 *   4. Set EXPO_PUBLIC_HEALTH_SYNC_ENABLED=true in .env
 */

import { Platform } from "react-native";
import { supabase } from "./supabase";
import { refreshAdaptiveTdeeForUser } from "./refreshAdaptiveTdee";

const ENABLED = process.env.EXPO_PUBLIC_HEALTH_SYNC_ENABLED === "true";

type HealthKit = {
  isAvailable: () => Promise<boolean>;
  initHealthKit: (permissions: any) => Promise<void>;
  getDailyStepCountSamples: (opts: any) => Promise<Array<{ value: number; startDate: string }>>;
  getWeightSamples: (opts: any) => Promise<Array<{ value: number; startDate: string }>>;
  getActiveEnergyBurned: (opts: any) => Promise<Array<{ value: number; startDate: string }>>;
};

let AppleHealthKit: HealthKit | null = null;

function getHealthKit(): HealthKit | null {
  if (!ENABLED || Platform.OS !== "ios") return null;
  if (AppleHealthKit) return AppleHealthKit;
  try {
    AppleHealthKit = require("react-native-health").default as HealthKit;
    return AppleHealthKit;
  } catch {
    return null;
  }
}

function dateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function isHealthSyncAvailable(): boolean {
  return ENABLED && (Platform.OS === "ios" || Platform.OS === "android");
}

export async function requestHealthPermissions(): Promise<boolean> {
  const hk = getHealthKit();
  if (!hk) return false;

  try {
    const available = await hk.isAvailable();
    if (!available) return false;

    await hk.initHealthKit({
      permissions: {
        read: [
          "StepCount",
          "Weight",
          "ActiveEnergyBurned",
        ],
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function syncHealthData(userId: string): Promise<{
  stepsUpdated: boolean;
  weightUpdated: boolean;
}> {
  const hk = getHealthKit();
  if (!hk) return { stepsUpdated: false, weightUpdated: false };

  const startDate = daysAgo(7);
  const endDate = new Date();
  let stepsUpdated = false;
  let weightUpdated = false;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("steps_by_day, weight_kg_by_day")
      .eq("id", userId)
      .maybeSingle();

    const existingSteps = (profile?.steps_by_day ?? {}) as Record<string, number>;
    const existingWeight = (profile?.weight_kg_by_day ?? {}) as Record<string, number>;

    // Sync steps
    try {
      const stepSamples = await hk.getDailyStepCountSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const stepsByDay: Record<string, number> = { ...existingSteps };
      for (const sample of stepSamples) {
        const dk = dateKey(sample.startDate);
        stepsByDay[dk] = Math.max(stepsByDay[dk] ?? 0, Math.round(sample.value));
      }

      if (JSON.stringify(stepsByDay) !== JSON.stringify(existingSteps)) {
        await supabase.from("profiles").update({ steps_by_day: stepsByDay }).eq("id", userId);
        stepsUpdated = true;
      }
    } catch {
      // Steps sync failed silently
    }

    // Sync weight
    try {
      const weightSamples = await hk.getWeightSamples({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        unit: "kg",
      });

      const weightByDay: Record<string, number> = { ...existingWeight };
      for (const sample of weightSamples) {
        const dk = dateKey(sample.startDate);
        const rounded = Math.round(sample.value * 10) / 10;
        weightByDay[dk] = rounded;
      }

      if (JSON.stringify(weightByDay) !== JSON.stringify(existingWeight)) {
        const { error } = await supabase
          .from("profiles")
          .update({
            weight_kg_by_day: weightByDay,
            weight_kg: weightByDay[dateKey(new Date())] ?? profile?.weight_kg_by_day?.[dateKey(new Date())],
          })
          .eq("id", userId);
        if (!error) {
          void refreshAdaptiveTdeeForUser(supabase, userId);
          weightUpdated = true;
        }
      }
    } catch {
      // Weight sync failed silently
    }
  } catch {
    // Profile load failed
  }

  return { stepsUpdated, weightUpdated };
}
