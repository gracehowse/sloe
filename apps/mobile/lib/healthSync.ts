/**
 * Apple Health (iOS) via `react-native-health` (callback API wrapped in promises).
 *
 * Requires a **development or production native build** — not Expo Go.
 * Opt out with `EXPO_PUBLIC_HEALTH_SYNC_ENABLED=false`.
 *
 * After adding or changing the `react-native-health` config plugin in `app.json`, run:
 * `npx expo prebuild --platform ios` then rebuild in Xcode (or `expo run:ios --device`).
 */

import { Platform } from "react-native";
import Constants from "expo-constants";
import { supabase } from "./supabase";
import { refreshAdaptiveTdeeForUser } from "./refreshAdaptiveTdee";

const isExpoGo = Constants.appOwnership === "expo";

/** On by default in native builds; off in Expo Go; opt-out with env `false`. */
const ENABLED =
  !isExpoGo &&
  process.env.EXPO_PUBLIC_HEALTH_SYNC_ENABLED !== "false" &&
  (Platform.OS === "ios" || Platform.OS === "android");

/** Native module shape (react-native-health uses callbacks, not promises). */
type AppleHealthKitNative = {
  isAvailable(callback: (err: object, results: boolean) => void): void;
  initHealthKit(
    permissions: { permissions: { read: string[]; write?: string[] } },
    callback: (error: string, result: unknown) => void,
  ): void;
  getDailyStepCountSamples(
    options: { startDate: string; endDate: string },
    callback: (err: string, results: Array<{ value: number; startDate: string }>) => void,
  ): void;
  getWeightSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (err: string, results: Array<{ value: number; startDate: string }>) => void,
  ): void;
  getActiveEnergyBurned(
    options: { startDate: string; endDate: string },
    callback: (err: string, results: Array<{ value: number; startDate: string }>) => void,
  ): void;
};

let cachedNative: AppleHealthKitNative | null | undefined;

function loadAppleHealthKit(): AppleHealthKitNative | null {
  if (!ENABLED || Platform.OS !== "ios") return null;
  if (cachedNative !== undefined) return cachedNative;
  try {
    const mod = require("react-native-health") as { default?: AppleHealthKitNative } & AppleHealthKitNative;
    const hk = (mod && typeof mod === "object" && "default" in mod && mod.default ? mod.default : mod) as AppleHealthKitNative;
    if (hk && typeof hk.initHealthKit === "function" && typeof hk.isAvailable === "function") {
      cachedNative = hk;
      return hk;
    }
    cachedNative = null;
    return null;
  } catch {
    cachedNative = null;
    return null;
  }
}

function isAvailablePromise(hk: AppleHealthKitNative): Promise<boolean> {
  return new Promise((resolve) => {
    hk.isAvailable((err, results) => {
      if (err) resolve(false);
      else resolve(!!results);
    });
  });
}

function initHealthKitPromise(
  hk: AppleHealthKitNative,
  permissions: { permissions: { read: string[]; write?: string[] } },
): Promise<void> {
  return new Promise((resolve, reject) => {
    hk.initHealthKit(permissions, (error) => {
      if (error) reject(new Error(String(error)));
      else resolve();
    });
  });
}

function getDailyStepCountSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<Array<{ value: number; startDate: string }>> {
  return new Promise((resolve, reject) => {
    hk.getDailyStepCountSamples(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

function getWeightSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string; unit: string },
): Promise<Array<{ value: number; startDate: string }>> {
  return new Promise((resolve, reject) => {
    hk.getWeightSamples(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
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
  if (!ENABLED) return false;
  if (Platform.OS === "ios") return loadAppleHealthKit() !== null;
  return false;
}

export async function requestHealthPermissions(): Promise<boolean> {
  const hk = loadAppleHealthKit();
  if (!hk) return false;

  try {
    const available = await isAvailablePromise(hk);
    if (!available) return false;

    await initHealthKitPromise(hk, {
      permissions: {
        read: ["StepCount", "Weight", "ActiveEnergyBurned"],
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
  const hk = loadAppleHealthKit();
  if (!hk) return { stepsUpdated: false, weightUpdated: false };

  const startDate = daysAgo(7);
  const endDate = new Date();
  let stepsUpdated = false;
  let weightUpdated = false;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("steps_by_day, weight_kg_by_day, weight_kg")
      .eq("id", userId)
      .maybeSingle();

    const existingSteps = (profile?.steps_by_day ?? {}) as Record<string, number>;
    const existingWeight = (profile?.weight_kg_by_day ?? {}) as Record<string, number>;
    const todayKey = dateKey(new Date());

    try {
      const stepSamples = await getDailyStepCountSamplesPromise(hk, {
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

    try {
      const weightSamples = await getWeightSamplesPromise(hk, {
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
        const todayWeight = weightByDay[todayKey];
        const profileWeightKg = profile && "weight_kg" in profile ? (profile as { weight_kg?: number | null }).weight_kg : null;
        const { error } = await supabase
          .from("profiles")
          .update({
            weight_kg_by_day: weightByDay,
            weight_kg: todayWeight ?? profileWeightKg ?? null,
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
