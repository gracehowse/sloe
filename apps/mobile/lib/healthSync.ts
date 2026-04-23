/**
 * Apple Health (iOS) via `react-native-health` (callback API wrapped in promises).
 *
 * Requires a **development or production native build** — not Expo Go.
 * Opt out with `EXPO_PUBLIC_HEALTH_SYNC_ENABLED=false`.
 *
 * After adding or changing the `react-native-health` config plugin in `app.json`, run:
 * `npx expo prebuild --platform ios` then rebuild in Xcode (or `expo run:ios --device`).
 */

import { NativeModules, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { supabase } from "./supabase";
import { refreshAdaptiveTdeeForUser } from "./refreshAdaptiveTdee";
import { captureException } from "./errorTracking";
import {
  HEALTH_DIETARY_IMPORT_PERMISSION_KEYS,
  buildFiberAndMicrosFromHealthTotals,
  unitForDietaryImportKey,
} from "./healthDietaryNutrients";
import {
  bucketEnergyShares,
  buildQuantityIdToCorrelationId,
  detectBulkSync,
  dietaryCorrelationKeyForSample,
  type CorrelationParentRow,
} from "./healthSyncCorrelation";

/** Expo Go (no custom native modules). Prefer executionEnvironment; appOwnership is legacy. */
export function isExpoGoRuntime(): boolean {
  return (
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    Constants.appOwnership === "expo"
  );
}

/** On by default in native builds; off in Expo Go; opt-out with env `false`. */
const ENABLED =
  !isExpoGoRuntime() &&
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
  getBodyFatPercentageSamples(
    options: { startDate: string; endDate: string; ascending?: boolean; limit?: number },
    callback: (err: string, results: Array<{ value: number; startDate: string; endDate?: string }>) => void,
  ): void;
  getActiveEnergyBurned(
    options: { startDate: string; endDate: string },
    callback: (err: string, results: Array<{ value: number; startDate: string }>) => void,
  ): void;
  getEnergyConsumedSamples(
    options: { startDate: string; endDate: string },
    callback: (
      err: string,
      results: Array<{
        value: number;
        startDate: string;
        endDate?: string;
        id?: string;
        metadata?: Record<string, unknown>;
        sourceName?: string;
        sourceBundleId?: string;
        sourceId?: string;
      }>,
    ) => void,
  ): void;
  getProteinSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (
      err: string,
      results: Array<{
        value: number;
        startDate: string;
        endDate?: string;
        id?: string;
        metadata?: Record<string, unknown>;
        sourceName?: string;
        sourceBundleId?: string;
        sourceId?: string;
      }>,
    ) => void,
  ): void;
  getCarbohydratesSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (
      err: string,
      results: Array<{
        value: number;
        startDate: string;
        endDate?: string;
        id?: string;
        metadata?: Record<string, unknown>;
        sourceName?: string;
        sourceBundleId?: string;
        sourceId?: string;
      }>,
    ) => void,
  ): void;
  getFatTotalSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (
      err: string,
      results: Array<{
        value: number;
        startDate: string;
        endDate?: string;
        id?: string;
        metadata?: Record<string, unknown>;
        sourceName?: string;
        sourceBundleId?: string;
        sourceId?: string;
      }>,
    ) => void,
  ): void;
  getFiberSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (err: string, results: Array<{ value: number; startDate: string; endDate?: string; id?: string; sourceName?: string; sourceBundleId?: string; sourceId?: string; metadata?: Record<string, unknown> }>) => void,
  ): void;
  getSugarSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (err: string, results: Array<{ value: number; startDate: string; endDate?: string; id?: string; sourceName?: string; sourceBundleId?: string; sourceId?: string; metadata?: Record<string, unknown> }>) => void,
  ): void;
  getSodiumSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (err: string, results: Array<{ value: number; startDate: string; endDate?: string; id?: string; sourceName?: string; sourceBundleId?: string; sourceId?: string; metadata?: Record<string, unknown> }>) => void,
  ): void;
  getFatSaturatedSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (err: string, results: Array<{ value: number; startDate: string; endDate?: string; id?: string; sourceName?: string; sourceBundleId?: string; sourceId?: string; metadata?: Record<string, unknown> }>) => void,
  ): void;
  getCholesterolSamples(
    options: { startDate: string; endDate: string; unit: string },
    callback: (err: string, results: Array<{ value: number; startDate: string; endDate?: string; id?: string; sourceName?: string; sourceBundleId?: string; sourceId?: string; metadata?: Record<string, unknown> }>) => void,
  ): void;
  getDietaryQuantitySamplesForPermission?: (
    options: { startDate: string; endDate: string; permissionKey: string; unit: string },
    callback: (
      err: string,
      results: Array<{
        value: number;
        startDate: string;
        endDate?: string;
        id?: string;
        sourceName?: string;
        sourceBundleId?: string;
        sourceId?: string;
        metadata?: Record<string, unknown>;
      }>,
    ) => void,
  ) => void;
  getFoodCorrelationSamples?: (
    options: { startDate: string; endDate: string },
    callback: (err: string, results: unknown[]) => void,
  ) => void;
  saveFoodSample(
    options: {
      name: string;
      biotin?: number;
      caffeine?: number;
      calcium?: number;
      energy: number;
      fatTotal?: number;
      protein?: number;
      carbohydrates?: number;
      dietaryFiber?: number;
      date?: string;
    },
    callback: (err: string, result: boolean) => void,
  ): void;
  getSamples(
    options: { startDate: string; endDate: string; type: string },
    callback: (err: string, results: Array<{
      start: string; end: string; value: number;
      activityName?: string; sourceName?: string; sourceBundleId?: string;
      calories?: number; distance?: number;
    }>) => void,
  ): void;
  getBasalEnergyBurned(
    options: { startDate: string; endDate: string },
    callback: (err: string, results: Array<{ value: number; startDate: string }>) => void,
  ): void;
};

let cachedNative: AppleHealthKitNative | null | undefined;

/**
 * Resolve the HealthKit native module at call time.
 * Do not use `require("react-native-health")` — its index reads NativeModules when the module
 * loads, which is empty under RN 0.76+ New Architecture / bridgeless until later, so methods
 * stay undefined ("not available in this install").
 */
function loadAppleHealthKit(): AppleHealthKitNative | null {
  if (!ENABLED || Platform.OS !== "ios") return null;
  if (cachedNative !== undefined) return cachedNative;
  try {
    const native =
      (NativeModules.AppleHealthKit as AppleHealthKitNative | undefined) ??
      (NativeModules.RCTAppleHealthKit as AppleHealthKitNative | undefined);
    if (native && typeof native.initHealthKit === "function" && typeof native.isAvailable === "function") {
      cachedNative = native;
      return native;
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

function getBodyFatPercentageSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string; ascending?: boolean; limit?: number },
): Promise<Array<{ value: number; startDate: string; endDate?: string }>> {
  return new Promise((resolve, reject) => {
    if (!hk.getBodyFatPercentageSamples) {
      resolve([]);
      return;
    }
    hk.getBodyFatPercentageSamples(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

/** HK `percent` unit is 0–1; UI / `profiles.body_fat_pct` store 0–100. */
function bodyFatPercentFromHealthKitValue(raw: number): number | null {
  if (!Number.isFinite(raw) || raw <= 0) return null;
  const asPct = raw <= 1 ? raw * 100 : raw;
  if (!Number.isFinite(asPct) || asPct <= 0 || asPct > 60) return null;
  return Math.round(asPct * 10) / 10;
}

function getActiveEnergyBurnedPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<Array<{ value: number; startDate: string }>> {
  return new Promise((resolve, reject) => {
    hk.getActiveEnergyBurned(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

type WorkoutSample = {
  start: string; end: string; value: number;
  activityName?: string; sourceName?: string; sourceBundleId?: string;
  calories?: number; distance?: number;
};

function getWorkoutSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<WorkoutSample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getSamples) { resolve([]); return; }
    hk.getSamples({ ...options, type: "Workout" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve((results ?? []) as WorkoutSample[]);
    });
  });
}

function getBasalEnergyBurnedPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<Array<{ value: number; startDate: string }>> {
  return new Promise((resolve, reject) => {
    if (!hk.getBasalEnergyBurned) { resolve([]); return; }
    hk.getBasalEnergyBurned(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

type DietarySample = {
  value: number;
  startDate: string;
  /** When present and after `startDate`, often holds the real meal time (e.g. third-party apps). */
  endDate?: string;
  /** HKQuantitySample UUID from HealthKit (react-native-health exposes as `id`). */
  id?: string;
  sourceName?: string;
  sourceBundleId?: string;
  /** Native bridge sometimes sends bundle id as `sourceId`. */
  sourceId?: string;
  metadata?: Record<string, unknown>;
};

/** HKCorrelationTypeIdentifierFood row from native (child quantity UUIDs + correlation metadata). */
type FoodCorrelationSampleRow = {
  id: string;
  startDate: string;
  endDate: string;
  quantitySampleIds: string[];
  metadata: Record<string, unknown>;
  sourceBundleId: string;
  sourceName: string;
};

function metadataValueAsString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
}

function firstMetadataString(meta: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const s = metadataValueAsString(meta[k]);
    if (s) return s;
  }
  return null;
}

function getEnergyConsumedSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getEnergyConsumedSamples) { resolve([]); return; }
    hk.getEnergyConsumedSamples(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

function getProteinSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getProteinSamples) { resolve([]); return; }
    hk.getProteinSamples({ ...options, unit: "gram" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

function getCarbsSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getCarbohydratesSamples) { resolve([]); return; }
    hk.getCarbohydratesSamples({ ...options, unit: "gram" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

function getFatSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getFatTotalSamples) { resolve([]); return; }
    hk.getFatTotalSamples({ ...options, unit: "gram" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

function getFiberSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getFiberSamples) { resolve([]); return; }
    hk.getFiberSamples({ ...options, unit: "gram" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve((results ?? []) as DietarySample[]);
    });
  });
}

function getSugarSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getSugarSamples) { resolve([]); return; }
    hk.getSugarSamples({ ...options, unit: "gram" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve((results ?? []) as DietarySample[]);
    });
  });
}

function getSodiumSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getSodiumSamples) { resolve([]); return; }
    hk.getSodiumSamples({ ...options, unit: "gram" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve((results ?? []) as DietarySample[]);
    });
  });
}

function getFatSaturatedSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getFatSaturatedSamples) { resolve([]); return; }
    hk.getFatSaturatedSamples({ ...options, unit: "gram" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve((results ?? []) as DietarySample[]);
    });
  });
}

function getCholesterolSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  return new Promise((resolve, reject) => {
    if (!hk.getCholesterolSamples) { resolve([]); return; }
    hk.getCholesterolSamples({ ...options, unit: "gram" }, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve((results ?? []) as DietarySample[]);
    });
  });
}

async function getDietaryQuantitySamplesForPermissionPromise(
  hk: AppleHealthKitNative,
  permissionKey: string,
  unit: "gram" | "kilocalorie",
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  if (typeof hk.getDietaryQuantitySamplesForPermission === "function") {
    return new Promise((resolve, reject) => {
      hk.getDietaryQuantitySamplesForPermission!(
        { ...options, permissionKey, unit },
        (err, results) => {
          if (err) reject(new Error(String(err)));
          else resolve((results ?? []) as DietarySample[]);
        },
      );
    });
  }
  switch (permissionKey) {
    case "EnergyConsumed":
      return getEnergyConsumedSamplesPromise(hk, options);
    case "Protein":
      return getProteinSamplesPromise(hk, options);
    case "Carbohydrates":
      return getCarbsSamplesPromise(hk, options);
    case "FatTotal":
      return getFatSamplesPromise(hk, options);
    case "Fiber":
      return getFiberSamplesPromise(hk, options);
    case "Sugar":
      return getSugarSamplesPromise(hk, options);
    case "Sodium":
      return getSodiumSamplesPromise(hk, options);
    case "FatSaturated":
      return getFatSaturatedSamplesPromise(hk, options);
    case "Cholesterol":
      return getCholesterolSamplesPromise(hk, options);
    default:
      return Promise.resolve([]);
  }
}

async function getDietaryImportSamplesSafe(
  hk: AppleHealthKitNative,
  permissionKey: string,
  options: { startDate: string; endDate: string },
): Promise<DietarySample[]> {
  const unit = unitForDietaryImportKey(permissionKey);
  try {
    return await getDietaryQuantitySamplesForPermissionPromise(hk, permissionKey, unit, options);
  } catch {
    return [];
  }
}

function saveFoodSamplePromise(
  hk: AppleHealthKitNative,
  options: {
    name: string;
    energy: number;
    protein?: number;
    carbohydrates?: number;
    fatTotal?: number;
    dietaryFiber?: number;
    /** Grams of caffeine (react-native-health convention). */
    caffeine?: number;
    date?: string;
  },
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    if (!hk.saveFoodSample) { resolve(false); return; }
    hk.saveFoodSample(options, (err, result) => {
      if (err) reject(new Error(String(err)));
      else resolve(!!result);
    });
  });
}

/** Our own bundle ID — used to filter out samples we wrote to avoid re-importing them. */
const OUR_BUNDLE_ID = "com.supprclub.suppr";

function dateKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseSampleInstant(isoOrDate: string | Date): Date {
  const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
  return Number.isFinite(d.getTime()) ? d : new Date();
}

function sourceBundleIdOf(s: DietarySample): string {
  return s.sourceBundleId ?? s.sourceId ?? "";
}

function isOwnAppSample(s: DietarySample): boolean {
  const bid = sourceBundleIdOf(s);
  return Boolean(bid && bid.startsWith(OUR_BUNDLE_ID));
}

/**
 * Many apps set `startDate` to midnight on the log day and `endDate` to actual consumption time.
 * third-party apps often syncs several items with the same wall-clock `startDate` (bulk sync) — then
 * `HKFoodMeal` metadata + this instant fix meal buckets and ordering.
 */
function effectiveConsumptionInstant(sample: DietarySample): Date {
  const start = parseSampleInstant(sample.startDate);
  if (!sample.endDate) return start;
  const end = parseSampleInstant(sample.endDate);
  if (!Number.isFinite(end.getTime())) return start;
  const deltaMs = end.getTime() - start.getTime();
  if (deltaMs <= 60_000) return start;
  const sameLocalDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  if (sameLocalDay && deltaMs >= 5 * 60_000) return end;
  if (deltaMs > 0) return end;
  return start;
}

type JournalMealSlot = "Breakfast" | "Lunch" | "Dinner" | "Snacks";

function mealSlotLabelFromHKMealEnum(n: number): JournalMealSlot | null {
  const k = Math.trunc(n);
  if (k === 1) return "Breakfast";
  if (k === 2) return "Lunch";
  if (k === 3) return "Dinner";
  if (k === 4 || k === 6) return "Snacks";
  if (k === 5) return "Breakfast";
  return null;
}

function isMealLabelString(value: string): boolean {
  const t = value.trim().toLowerCase();
  return (
    t === "breakfast" ||
    t === "lunch" ||
    t === "dinner" ||
    t === "snacks" ||
    t === "snack" ||
    t === "brunch" ||
    t === "dessert"
  );
}

/** HealthKit `HKMetadataKeyFoodMeal` (often bridged as `HKFoodMeal`) — preferred over clock-time for slot. */
function mealSlotFromMetadata(meta: Record<string, unknown> | undefined): JournalMealSlot | null {
  if (!meta) return null;
  const keys = ["HKFoodMeal", "HKMetadataKeyFoodMeal", "mealType", "MealType", "meal", "MEAL_TYPE"];
  for (const key of keys) {
    const raw = meta[key];
    if (raw == null) continue;
    if (typeof raw === "number" && Number.isFinite(raw)) {
      const m = mealSlotLabelFromHKMealEnum(raw);
      if (m) return m;
    }
    if (typeof raw === "string") {
      const str = raw.trim();
      if (!str) continue;
      if (/^\d+$/.test(str)) {
        const m = mealSlotLabelFromHKMealEnum(Number(str));
        if (m) return m;
      }
      const lower = str.toLowerCase();
      if (lower.includes("breakfast") || lower.includes("brunch")) return "Breakfast";
      if (lower.includes("lunch")) return "Lunch";
      if (lower.includes("dinner")) return "Dinner";
      if (lower.includes("snack") || lower.includes("dessert")) return "Snacks";
    }
  }
  return null;
}

const METADATA_KEYS_EXCLUDED_FROM_FOOD_GUESS: ReadonlySet<string> = new Set(
  [
    "HKFoodMeal",
    "HKMetadataKeyFoodMeal",
    "mealType",
    "MealType",
    "meal",
    "MEAL_TYPE",
    "HKWasUserEntered",
    "HKMetadataKeyWasUserEntered",
    "HKTimeZone",
    "HKDeviceManufacturerName",
    "HKDeviceSerialNumber",
    "HKDeviceName",
    "HKExternalUUID",
    "HKFoodImageName",
    "HKSyncIdentifier",
    "HKFoodTypeUUID",
  ].map((k) => k.toLowerCase()),
);

function longestPlausibleFoodMetadataValue(meta: Record<string, unknown>, sourceApp: string): string | null {
  let best: string | null = null;
  const src = sourceApp.trim();
  for (const [rawKey, val] of Object.entries(meta)) {
    const keyLower = rawKey.toLowerCase();
    if (METADATA_KEYS_EXCLUDED_FROM_FOOD_GUESS.has(keyLower)) continue;
    if (keyLower.includes("uuid") || keyLower.includes("syncidentifier")) continue;
    if (keyLower.includes("barcode") || keyLower.includes("gtin") || keyLower.includes("upc")) continue;
    const s = metadataValueAsString(val);
    if (!s) continue;
    if (s.length < 3 || s.length > 220) continue;
    if (/^\d{8,}$/.test(s)) continue;
    if (isMealLabelString(s)) continue;
    if (src && s === src) continue;
    if (/^(true|false)$/i.test(s)) continue;
    if (!best || s.length > best.length) best = s;
  }
  return best;
}

/**
 * Many apps (e.g. other apps) save `HKMetadataKeyFoodType` on the **food HKCorrelation** parent;
 * the child dietary-energy quantity sample can carry sparse metadata. Fill empty keys only.
 */
function mergeCorrelationMetadataIntoSampleMetadata(
  sampleMeta: Record<string, unknown> | undefined,
  correlationMeta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const base =
    sampleMeta && typeof sampleMeta === "object" && !Array.isArray(sampleMeta) ? { ...sampleMeta } : {};
  if (!correlationMeta || typeof correlationMeta !== "object" || Array.isArray(correlationMeta)) {
    return Object.keys(base).length > 0 ? base : sampleMeta;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(correlationMeta)) {
    const cur = out[k];
    const curEmpty = cur == null || (typeof cur === "string" && cur.trim() === "");
    if (curEmpty && v != null) {
      if (typeof v === "string" && !v.trim()) continue;
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function parseFoodCorrelationRows(raw: unknown): FoodCorrelationSampleRow[] {
  if (!Array.isArray(raw)) return [];
  const out: FoodCorrelationSampleRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const o = row as Record<string, unknown>;
    const idsRaw = o.quantitySampleIds;
    const quantitySampleIds = Array.isArray(idsRaw)
      ? idsRaw.filter((x): x is string => typeof x === "string" && x.length > 0)
      : [];
    const metaRaw = o.metadata;
    const metadata =
      metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw) ? (metaRaw as Record<string, unknown>) : {};
    if (typeof o.startDate !== "string" || typeof o.endDate !== "string") continue;
    out.push({
      id: typeof o.id === "string" ? o.id : "",
      startDate: o.startDate,
      endDate: o.endDate,
      quantitySampleIds,
      metadata,
      sourceBundleId: typeof o.sourceBundleId === "string" ? o.sourceBundleId : "",
      sourceName: typeof o.sourceName === "string" ? o.sourceName : "",
    });
  }
  return out;
}

/** Map HKQuantitySample UUID → merged metadata from every food correlation that references it. */
function buildQuantitySampleIdToCorrelationMetadata(rows: FoodCorrelationSampleRow[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    for (const qid of row.quantitySampleIds) {
      const prev = map.get(qid) ?? {};
      map.set(qid, { ...prev, ...row.metadata });
    }
  }
  return map;
}

function getFoodCorrelationSamplesPromise(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    if (typeof hk.getFoodCorrelationSamples !== "function") {
      resolve([]);
      return;
    }
    hk.getFoodCorrelationSamples!(options, (err, results) => {
      if (err) reject(new Error(String(err)));
      else resolve(results ?? []);
    });
  });
}

async function getFoodCorrelationSamplesSafe(
  hk: AppleHealthKitNative,
  options: { startDate: string; endDate: string },
): Promise<FoodCorrelationSampleRow[]> {
  try {
    const raw = await getFoodCorrelationSamplesPromise(hk, options);
    return parseFoodCorrelationRows(raw);
  } catch {
    return [];
  }
}

function resolveFoodLabelFromHealthMetadata(
  meta: Record<string, unknown> | undefined,
  calories: number,
  sourceApp: string,
): string {
  const brand =
    firstMetadataString(meta, [
      "HKBrandName",
      "HKMetadataKeyBrandName",
      "brandName",
      "BrandName",
      "BRAND",
      "Brand",
    ]) ?? null;
  const food =
    firstMetadataString(meta, [
      "HKFoodType",
      "HKMetadataKeyFoodType",
      "HKFoodName",
      "HKMetadataKeyFoodName",
      "foodName",
      "FoodName",
      "food_name",
      "FoodItemName",
      "foodItemName",
      "ITEM_NAME",
      "itemName",
      "productName",
      "displayName",
      "DisplayName",
      "title",
      "Title",
      "longDescription",
      "LongDescription",
      "originalFoodName",
      "OriginalFoodName",
      "recipeName",
      "RecipeName",
      "entryName",
      "EntryName",
      "logName",
      "LogName",
      "userFoodName",
      "UserFoodName",
      "primaryFoodName",
      "PrimaryFoodName",
      "foodDescription",
      "FoodDescription",
      "HKFoodDescription",
      "Notes",
      "Note",
      "note",
    ]) ?? null;

  let label: string | null = null;
  if (food && brand) label = `${brand} · ${food}`;
  else label = food ?? brand;

  if (!label) {
    const maybeName = firstMetadataString(meta, [
      "mealName",
      "HKFoodMealName",
      "HKMetadataKeyMealName",
      "mealTitle",
      "MealTitle",
      "loggedMealName",
      "LoggedMealName",
      "name",
      "Name",
      "description",
      "Description",
    ]);
    if (maybeName && !isMealLabelString(maybeName)) label = maybeName;
  }

  if (!label) label = meta ? longestPlausibleFoodMetadataValue(meta, sourceApp) : null;

  return label ?? `Food log (${calories} kcal)`;
}

/**
 * Journal `name` is the meal slot on Today (Breakfast / Lunch / Dinner / Snacks).
 * Prefer HealthKit meal metadata; otherwise infer from **effective** consumption local time.
 */
function inferMealSlotFromLocalTime(when: Date): JournalMealSlot {
  const h = when.getHours() + when.getMinutes() / 60;
  if (h < 5) return "Snacks";
  if (h < 11) return "Breakfast";
  if (h < 15) return "Lunch";
  if (h < 21) return "Dinner";
  return "Snacks";
}

function journalMealSlotForSample(sample: DietarySample, when: Date, meta: Record<string, unknown> | undefined): JournalMealSlot {
  return mealSlotFromMetadata(meta) ?? inferMealSlotFromLocalTime(when);
}

/**
 * Group dietary samples produced by the same logged food. See
 * `healthSyncCorrelation.ts` for the full strategy: prefer the parent
 * `HKCorrelationTypeIdentifierFood` UUID (via the `quantitySampleId →
 * correlationId` map built from `getFoodCorrelationSamples`); fall back to the
 * sample's own `metadata.HKCorrelationUUID`; only use the legacy
 * `effectiveMinute|bundleId` heuristic for samples with no correlation
 * information at all.
 *
 * Without per-correlation grouping, third-party loggers (e.g. MFP) that bulk
 * sync a day's meals at one wall-clock instant collapsed every food into one
 * inflated `nutrition_entries` row — see TestFlight `AJHZNp8NHTiFNk9TjQfdYBk`.
 */
function dietaryCorrelationKey(
  s: DietarySample,
  quantityIdToCorrelationId: ReadonlyMap<string, string> | null,
): string {
  return dietaryCorrelationKeyForSample(s, quantityIdToCorrelationId).key;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

const HEALTH_BODY_LOOKBACK_STORAGE_KEY = "health_body_lookback_days";

/** Presets for how far back body metrics (weight, body fat, steps, energy, etc.) sync from Apple Health. */
export const HEALTH_BODY_LOOKBACK_PRESETS = [
  { label: "3 mo", days: 93 },
  { label: "6 mo", days: 186 },
  { label: "9 mo", days: 275 },
  { label: "12 mo", days: 366 },
  { label: "All", days: 4000 },
] as const;

// F-44 / F-46 (2026-04-22): bumped from 366 → 730 so weight-chart range
// buttons (3M / 6M / 9M / 1Y / 2Y) have real historical weight points to
// filter against on first connect. Tester reported the range filter
// "didn't change anything" on builds 20/21; root cause was no deep
// history to switch between, not a bug in the filter itself.
const DEFAULT_HEALTH_BODY_LOOKBACK_DAYS = 730;

export async function getHealthBodyLookbackDays(): Promise<number> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(HEALTH_BODY_LOOKBACK_STORAGE_KEY);
    const n = raw != null ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(n) && n >= 30 && n <= 5000) return n;
  } catch {
    /* ignore */
  }
  return DEFAULT_HEALTH_BODY_LOOKBACK_DAYS;
}

export async function setHealthBodyLookbackDays(days: number): Promise<void> {
  const clamped = Math.max(30, Math.min(5000, Math.round(days)));
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.setItem(HEALTH_BODY_LOOKBACK_STORAGE_KEY, String(clamped));
  } catch {
    /* ignore */
  }
}

export function isHealthSyncAvailable(): boolean {
  if (!ENABLED) return false;
  if (Platform.OS === "ios") return loadAppleHealthKit() !== null;
  return false;
}

export async function requestHealthPermissions(): Promise<boolean> {
  // Top-level try/catch so a native-side throw during `loadAppleHealthKit`
  // (module-resolution failure in an RN 0.76 newArch build) or during the
  // permission sheet callback (iOS 26.5 HKHealthStore edge cases)
  // surfaces as `false` rather than crashing the `Connect Apple Health`
  // tap. The Sentry capture lets us symbolicate the stack for the next
  // build (F-1, 2026-04-19).
  try {
    const hk = loadAppleHealthKit();
    if (!hk) return false;

    try {
      const available = await isAvailablePromise(hk);
      if (!available) return false;

      // F-50 (2026-04-22): consolidate F-37's split-init back into a
      // single pass. iOS HealthKit shows the permission sheet once for
      // the union of types requested per call; the second call in the
      // split was either silently being skipped by iOS ("already
      // asked") or not presenting a sheet, which meant dietary read
      // perms were never actually granted — root cause of TestFlight
      // build-25 feedback "says no meals to import but there are
      // meals to import". The G-7 native-queue fix already prevents
      // the iOS 26.5 ObjC crash on `initHealthKit`, so the split is
      // no longer needed. One call = one sheet = all perms granted.
      await initHealthKitPromise(hk, {
        permissions: {
          read: [
            "StepCount",
            "Weight",
            "BodyFatPercentage",
            "ActiveEnergyBurned",
            "BasalEnergyBurned",
            "Workout",
            "FoodCorrelation",
            ...HEALTH_DIETARY_IMPORT_PERMISSION_KEYS,
          ],
          write: [
            "EnergyConsumed",
            "Protein",
            "Carbohydrates",
            "FatTotal",
            "Fiber",
          ],
        },
      });
      return true;
    } catch (inner) {
      captureException(inner);
      return false;
    }
  } catch (outer) {
    captureException(outer);
    return false;
  }
}

const EMPTY_BODY_SYNC_RESULT = {
  stepsUpdated: false,
  weightUpdated: false,
  bodyFatUpdated: false,
  activeEnergyUpdated: false,
  workoutsUpdated: false,
  basalBurnUpdated: false,
} as const;

export async function syncHealthData(userId: string): Promise<{
  stepsUpdated: boolean;
  weightUpdated: boolean;
  bodyFatUpdated: boolean;
  activeEnergyUpdated: boolean;
  workoutsUpdated: boolean;
  basalBurnUpdated: boolean;
}> {
  // F-1 (2026-04-19): top-level try/catch so a native-bridge throw during
  // body sync does not crash the Today-tab focus effect or the Sync Now
  // button. Callers (Today, weight-tracker, burn-detail, progress) all
  // expect a populated result object, never a rejection.
  try {
    return await syncHealthDataImpl(userId);
  } catch (err) {
    captureException(err);
    return { ...EMPTY_BODY_SYNC_RESULT };
  }
}

async function syncHealthDataImpl(userId: string): Promise<{
  stepsUpdated: boolean;
  weightUpdated: boolean;
  bodyFatUpdated: boolean;
  activeEnergyUpdated: boolean;
  workoutsUpdated: boolean;
  basalBurnUpdated: boolean;
}> {
  const hk = loadAppleHealthKit();
  if (!hk)
    return {
      stepsUpdated: false,
      weightUpdated: false,
      bodyFatUpdated: false,
      activeEnergyUpdated: false,
      workoutsUpdated: false,
      basalBurnUpdated: false,
    };

  /** How far back to read HealthKit (user preference; default ~12 months). "All" uses 4000d (~11y) cap. */
  const lookbackDays = await getHealthBodyLookbackDays();
  const startDate = daysAgo(lookbackDays);
  const endDate = new Date();
  let stepsUpdated = false;
  let weightUpdated = false;
  let bodyFatUpdated = false;
  let activeEnergyUpdated = false;
  let workoutsUpdated = false;
  let basalBurnUpdated = false;

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "steps_by_day, weight_kg_by_day, weight_kg, body_fat_pct, activity_burn_by_day, workouts_by_day, basal_burn_by_day",
      )
      .eq("id", userId)
      .maybeSingle();

    const existingSteps = (profile?.steps_by_day ?? {}) as Record<string, number>;
    const existingWeight = (profile?.weight_kg_by_day ?? {}) as Record<string, number>;
    const existingActivityBurn = (profile?.activity_burn_by_day ?? {}) as Record<string, number>;
    const existingWorkouts = (profile?.workouts_by_day ?? {}) as Record<string, unknown[]>;
    const existingBasalBurn = (profile?.basal_burn_by_day ?? {}) as Record<string, number>;
    const todayKey = dateKey(new Date());

    try {
      const stepSamples = await getDailyStepCountSamplesPromise(hk, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      /**
       * `getDailyStepCountSamples` uses HKStatisticsCollection with a short interval (default 60 min)
       * and returns one row per bucket. Daily total = sum of all buckets for that calendar day — not max.
       */
      const fromHealthSteps: Record<string, number> = {};
      for (const sample of stepSamples) {
        const dk = dateKey(sample.startDate);
        fromHealthSteps[dk] = (fromHealthSteps[dk] ?? 0) + Math.round(sample.value);
      }
      const stepsByDay: Record<string, number> = { ...existingSteps };
      for (const [dk, v] of Object.entries(fromHealthSteps)) {
        stepsByDay[dk] = v;
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

    try {
      const bodyFatSamples = await getBodyFatPercentageSamplesPromise(hk, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        ascending: false,
      });

      let latestMs = -Infinity;
      let latestPct: number | null = null;
      for (const sample of bodyFatSamples) {
        const t = new Date(sample.startDate).getTime();
        if (!Number.isFinite(t)) continue;
        const pct = bodyFatPercentFromHealthKitValue(Number(sample.value));
        if (pct == null) continue;
        if (t >= latestMs) {
          latestMs = t;
          latestPct = pct;
        }
      }

      if (latestPct != null) {
        const existingBf =
          profile && "body_fat_pct" in profile
            ? (profile as { body_fat_pct?: number | null }).body_fat_pct
            : null;
        const existingRounded =
          existingBf != null && Number.isFinite(Number(existingBf))
            ? Math.round(Number(existingBf) * 10) / 10
            : null;
        if (existingRounded !== latestPct) {
          const { error } = await supabase
            .from("profiles")
            .update({ body_fat_pct: latestPct })
            .eq("id", userId);
          if (!error) bodyFatUpdated = true;
        }
      }
    } catch {
      // Body fat sync failed silently
    }

    try {
      const energySamples = await getActiveEnergyBurnedPromise(hk, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      /**
       * Sum HealthKit buckets per calendar day only, then **overwrite** those days on the profile map.
       * Do not add fresh samples onto existing stored values — that double-counts on every sync.
       * (Same pattern as steps: merge `fromHealth` keys into a copy of `existing`.)
       */
      const fromHealthActivity: Record<string, number> = {};
      for (const sample of energySamples) {
        const dk = dateKey(sample.startDate);
        fromHealthActivity[dk] = (fromHealthActivity[dk] ?? 0) + Math.round(sample.value);
      }
      const activityBurnByDay: Record<string, number> = { ...existingActivityBurn };
      for (const [dk, v] of Object.entries(fromHealthActivity)) {
        activityBurnByDay[dk] = v;
      }

      if (JSON.stringify(activityBurnByDay) !== JSON.stringify(existingActivityBurn)) {
        const { error } = await supabase
          .from("profiles")
          .update({ activity_burn_by_day: activityBurnByDay })
          .eq("id", userId);
        if (!error) activeEnergyUpdated = true;
      }
    } catch {
      // Active energy sync failed silently
    }

    // ── Workouts ──
    try {
      const workoutSamples = await getWorkoutSamplesPromise(hk, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      type WorkoutEntry = { type: string; minutes: number; calories: number; source: string };
      const fromHealthWorkouts: Record<string, WorkoutEntry[]> = {};
      for (const w of workoutSamples) {
        const dk = dateKey(w.start);
        const startMs = new Date(w.start).getTime();
        const endMs = new Date(w.end).getTime();
        const mins = Math.round((endMs - startMs) / 60000);
        if (!fromHealthWorkouts[dk]) fromHealthWorkouts[dk] = [];
        fromHealthWorkouts[dk].push({
          type: w.activityName ?? "Workout",
          minutes: mins > 0 ? mins : 0,
          calories: Math.round(w.calories ?? w.value ?? 0),
          source: w.sourceName ?? "Apple Health",
        });
      }

      const workoutsByDay: Record<string, WorkoutEntry[]> = {};
      for (const k of Object.keys(existingWorkouts)) {
        const v = existingWorkouts[k];
        if (Array.isArray(v)) workoutsByDay[k] = v as WorkoutEntry[];
      }
      for (const [dk, arr] of Object.entries(fromHealthWorkouts)) {
        workoutsByDay[dk] = arr;
      }

      if (JSON.stringify(workoutsByDay) !== JSON.stringify(existingWorkouts)) {
        const { error } = await supabase
          .from("profiles")
          .update({ workouts_by_day: workoutsByDay })
          .eq("id", userId);
        if (!error) workoutsUpdated = true;
      }
    } catch {
      // Workout sync failed silently
    }

    // ── Basal (resting) energy burned ──
    try {
      const basalSamples = await getBasalEnergyBurnedPromise(hk, {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      });

      const fromHealthBasal: Record<string, number> = {};
      for (const sample of basalSamples) {
        const dk = dateKey(sample.startDate);
        fromHealthBasal[dk] = (fromHealthBasal[dk] ?? 0) + Math.round(sample.value);
      }
      const basalBurnByDay: Record<string, number> = { ...existingBasalBurn };
      for (const [dk, v] of Object.entries(fromHealthBasal)) {
        basalBurnByDay[dk] = v;
      }

      if (JSON.stringify(basalBurnByDay) !== JSON.stringify(existingBasalBurn)) {
        const { error } = await supabase
          .from("profiles")
          .update({ basal_burn_by_day: basalBurnByDay })
          .eq("id", userId);
        if (!error) basalBurnUpdated = true;
      }
    } catch {
      // Basal energy sync failed silently
    }
  } catch {
    // Profile load failed
  }

  return {
    stepsUpdated,
    weightUpdated,
    bodyFatUpdated,
    activeEnergyUpdated,
    workoutsUpdated,
    basalBurnUpdated,
  };
}

const HEALTH_BODY_SYNC_MIN_MS = 4 * 60 * 1000;
let lastThrottledHealthBodySyncAt = 0;

/* ─────────────────────────────────────────────────────────────────────
 * health_snapshots write path (D4, 2026-04-21)
 *
 * Append a row to `health_snapshots` after each successful HealthKit
 * fetch so the web Apple Health card has something to read. Design:
 * `docs/design/apple-health-card.md` §7.
 *
 * Cadence: at most once per 15 minutes per process. `explicit: true`
 * bypasses the throttle for user-triggered refresh.
 * ───────────────────────────────────────────────────────────────────── */
const HEALTH_SNAPSHOT_MIN_MS = 15 * 60 * 1000;
/** Exported for tests only. */
export const __healthSnapshotThrottleMs = HEALTH_SNAPSHOT_MIN_MS;
let lastHealthSnapshotWriteAt = 0;

/** Test-only hook: reset the snapshot throttle so specs can rerun
 *  without needing to mock Date. Production code must not call this. */
export function __resetHealthSnapshotThrottleForTests(): void {
  lastHealthSnapshotWriteAt = 0;
}

/** Stable-ish device id for this install. Uses `expo-constants`
 *  `sessionId` (per-process) as a best-effort tag — we don't have a
 *  persisted install-id today, and the `device_id` column is nullable,
 *  so this is a nice-to-have, not load-bearing. Returns `null` if the
 *  native module is unavailable (e.g. under vitest). */
async function resolveHealthSnapshotDeviceId(): Promise<string | null> {
  try {
    const c = Constants as { sessionId?: string | null; installationId?: string | null };
    return c.installationId ?? c.sessionId ?? null;
  } catch {
    return null;
  }
}

export async function writeHealthSnapshot(
  userId: string,
  opts?: { explicit?: boolean },
): Promise<{ wrote: boolean; throttled: boolean }> {
  if (!userId) return { wrote: false, throttled: false };
  const now = Date.now();
  if (!opts?.explicit && now - lastHealthSnapshotWriteAt < HEALTH_SNAPSHOT_MIN_MS) {
    return { wrote: false, throttled: true };
  }

  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("steps_by_day, activity_burn_by_day, basal_burn_by_day, weight_kg_by_day, weight_kg")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) return { wrote: false, throttled: false };

    const todayKey = dateKey(new Date());
    const steps_by_day = (profile.steps_by_day ?? {}) as Record<string, number>;
    const activity_by_day = (profile.activity_burn_by_day ?? {}) as Record<string, number>;
    const basal_by_day = (profile.basal_burn_by_day ?? {}) as Record<string, number>;
    const weight_by_day = (profile.weight_kg_by_day ?? {}) as Record<string, number>;

    const steps = typeof steps_by_day[todayKey] === "number" ? steps_by_day[todayKey] : null;
    const active_energy_kcal =
      typeof activity_by_day[todayKey] === "number" ? activity_by_day[todayKey] : null;
    const resting_burn_kcal =
      typeof basal_by_day[todayKey] === "number" ? basal_by_day[todayKey] : null;
    // Weight: today's entry if present, otherwise the profile's latest
    // cached weight (most recent weigh-in across any day).
    const weight_kg =
      typeof weight_by_day[todayKey] === "number"
        ? weight_by_day[todayKey]
        : typeof (profile as { weight_kg?: number | null }).weight_kg === "number"
          ? (profile as { weight_kg: number }).weight_kg
          : null;

    // Never fabricate: if HealthKit hasn't reported anything for today
    // AND we have no weight on file, don't append a useless row.
    if (
      steps == null &&
      active_energy_kcal == null &&
      resting_burn_kcal == null &&
      weight_kg == null
    ) {
      return { wrote: false, throttled: false };
    }

    const device_id = await resolveHealthSnapshotDeviceId();

    const { error } = await supabase.from("health_snapshots").insert({
      user_id: userId,
      steps,
      active_energy_kcal,
      resting_burn_kcal,
      weight_kg,
      source: "healthkit",
      device_id,
    } as never);

    if (error) {
      captureException(error);
      return { wrote: false, throttled: false };
    }

    lastHealthSnapshotWriteAt = Date.now();
    return { wrote: true, throttled: false };
  } catch (err) {
    captureException(err);
    return { wrote: false, throttled: false };
  }
}

/**
 * Steps, weight, body fat, and active energy: read HealthKit and upsert `profiles` (throttled app-wide).
 * Use on Today / Progress focus so the UI does not rely on a manual trip to Health settings.
 */
export async function syncHealthDataThrottled(
  userId: string,
  opts?: { bypassThrottle?: boolean },
): Promise<void> {
  if (!userId || !isHealthSyncAvailable()) return;
  const now = Date.now();
  if (!opts?.bypassThrottle && now - lastThrottledHealthBodySyncAt < HEALTH_BODY_SYNC_MIN_MS) return;
  await syncHealthData(userId);
  lastThrottledHealthBodySyncAt = Date.now();

  // D4 (2026-04-21) — after a successful profile upsert, append a
  // `health_snapshots` row so the web Apple Health card has fresh
  // data. Independent 15-min throttle (vs the 4-min body throttle)
  // so we don't flood the table on every screen focus. Explicit
  // refreshes bypass both throttles.
  await writeHealthSnapshot(userId, { explicit: opts?.bypassThrottle === true });
}

/* ─────────────────────────────────────────────────────────────────────────────
 * NUTRITION IMPORT  –  read individual meal items from HealthKit → nutrition_entries
 *
 * Strategy:
 * 1. Read energy consumed samples — each one is usually one food item from another app.
 * 2. Group all dietary quantities (third-party apps) by effective minute + bundle id.
 * 3. Meal slot: prefer HealthKit `HKFoodMeal` / `HKMetadataKeyFoodMeal` (third-party apps); else local time.
 *    Food title: merge **food HKCorrelation** metadata onto the energy sample (third-party app pattern),
 *    then HKFoodType + HKBrandName, other metadata strings, else "Food log (N kcal)".
 *    Optional `health_import_generic_labels` (AsyncStorage): skip names — use "Imported food (N kcal)" only.
 * 4. When `endDate` is later same calendar day as `startDate`, treat `endDate` as consumption time
 *    (common for third-party apps day-anchored samples).
 * 5. Each imported sample becomes its own nutrition_entry row; de-dupe via `health_sample_id` when present.
 * ─────────────────────────────────────────────────────────────────────────────*/

function roundMealMacro(n: number, decimals = 1): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** `minute|bundle` → summed HK values per react-native-health permission key (gram or kcal). */
function newCorrelatedTotalsMap(): Map<string, Map<string, number>> {
  return new Map();
}

function bumpCorrelatedTotals(
  correlated: Map<string, Map<string, number>>,
  correlationKey: string,
  permissionKey: string,
  delta: number,
): void {
  let inner = correlated.get(correlationKey);
  if (!inner) {
    inner = new Map();
    correlated.set(correlationKey, inner);
  }
  inner.set(permissionKey, (inner.get(permissionKey) ?? 0) + delta);
}

function totalsRecordFromInner(inner: Map<string, number> | undefined): Record<string, number> {
  const o: Record<string, number> = {};
  if (!inner) return o;
  for (const [k, v] of inner) o[k] = v;
  return o;
}

export type ImportedMeal = {
  dateKey: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  sourceApp: string;
};

/**
 * Read individual dietary samples from HealthKit, correlate energy with macros,
 * and insert identifiable meal items into `nutrition_entries`.
 *
 * Skips samples Suppr itself wrote (by bundle ID). Skips non-positive calories.
 */
export async function syncNutritionFromHealth(
  userId: string,
  lookbackDays = 120,
): Promise<{ imported: ImportedMeal[]; skippedOwn: number; skippedNoName: number }> {
  // F-1 (2026-04-19): top-level try/catch so any failure inside the
  // correlation / bulk-sync pipeline (native bridge returning unexpected
  // shapes, supabase insert rejection, metadata-parse throws) degrades
  // to "no import" instead of crashing the Today-tab focus effect that
  // calls the throttled wrapper on every resume.
  try {
    return await syncNutritionFromHealthImpl(userId, lookbackDays);
  } catch (err) {
    captureException(err);
    return { imported: [], skippedOwn: 0, skippedNoName: 0 };
  }
}

async function syncNutritionFromHealthImpl(
  userId: string,
  lookbackDays = 120,
): Promise<{ imported: ImportedMeal[]; skippedOwn: number; skippedNoName: number }> {
  const hk = loadAppleHealthKit();
  if (!hk) return { imported: [], skippedOwn: 0, skippedNoName: 0 };

  let genericHealthImportLabels = false;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    genericHealthImportLabels = (await AsyncStorage.getItem("health_import_generic_labels")) === "true";
  } catch {
    /* ignore */
  }

  const startDate = daysAgo(lookbackDays).toISOString();
  const endDate = new Date().toISOString();
  const opts = { startDate, endDate };

  const isExternal = (s: DietarySample) => !isOwnAppSample(s);

  const [dietaryFetches, foodCorrelationRows] = await Promise.all([
    Promise.all(
      HEALTH_DIETARY_IMPORT_PERMISSION_KEYS.map((permissionKey) =>
        getDietaryImportSamplesSafe(hk, permissionKey, opts),
      ),
    ),
    getFoodCorrelationSamplesSafe(hk, opts),
  ]);

  const quantityIdToFoodCorrelationMeta = buildQuantitySampleIdToCorrelationMetadata(foodCorrelationRows);
  const correlationParentRows: CorrelationParentRow[] = foodCorrelationRows.map((row) => ({
    id: row.id,
    quantitySampleIds: row.quantitySampleIds,
  }));
  const quantityIdToCorrelationId = buildQuantityIdToCorrelationId(correlationParentRows);

  const correlated = newCorrelatedTotalsMap();
  for (let i = 0; i < HEALTH_DIETARY_IMPORT_PERMISSION_KEYS.length; i++) {
    const permissionKey = HEALTH_DIETARY_IMPORT_PERMISSION_KEYS[i]!;
    const rows = dietaryFetches[i] ?? [];
    for (const s of rows.filter(isExternal)) {
      bumpCorrelatedTotals(
        correlated,
        dietaryCorrelationKey(s, quantityIdToCorrelationId),
        permissionKey,
        s.value,
      );
    }
  }

  const energyIdx = HEALTH_DIETARY_IMPORT_PERMISSION_KEYS.findIndex((k) => k === "EnergyConsumed");
  const energy = (energyIdx >= 0 ? dietaryFetches[energyIdx] : []) ?? [];
  const extEnergy = energy.filter(isExternal);
  let skippedOwn = energy.length - extEnergy.length;

  // Diagnostic: log once per sync if MFP-style bulk batches were detected (multiple
  // food correlations sharing one effective minute + bundle id). Helps confirm in
  // production that the per-correlation grouping is doing real work.
  const bulk = detectBulkSync(extEnergy, quantityIdToCorrelationId);
  if (bulk.detected) {
    // eslint-disable-next-line no-console
    console.log(
      `[healthSync] bulk-sync detected: ${extEnergy.length} energy samples, bundles=[${bulk.bundles.join(",")}] — using per-correlation grouping`,
    );
  }

  // MFP bulk-sync macro mitigation (TestFlight build 7 follow-up,
  // 2026-04-18): when multiple energy samples share a *legacy*
  // `minute|bundle` bucket (no HKCorrelationUUID parent), the bucket's
  // macros must be split proportionally by kcal across the samples
  // instead of duplicated to all of them. See
  // `healthSyncCorrelation.bucketEnergyShares` for the rationale.
  const energyShares = bucketEnergyShares(extEnergy, quantityIdToCorrelationId);
  if (energyShares.legacyAmbiguousBuckets > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[healthSync] proportional macro split applied to ${energyShares.legacyAmbiguousBuckets} legacy-fallback bucket(s) holding multiple energy samples`,
    );
  }

  // Now walk each external energy sample — this is the anchor for each food item.
  const skippedNoName = 0;
  const imported: ImportedMeal[] = [];

  // Pre-fetch existing apple_health entries for this user in the lookback window
  // so we can de-dup without N+1 queries.
  const windowStart = dateKey(daysAgo(lookbackDays));
  const { data: existingRows } = await supabase
    .from("nutrition_entries")
    .select("date_key, name, recipe_title, calories, created_at, health_sample_id")
    .eq("user_id", userId)
    .eq("source", "apple_health")
    .gte("date_key", windowStart);

  /** De-dupe re-sync: HealthKit sample UUID when available (see `health_sample_id` column). */
  const existingHkIds = new Set<string>();
  /** Legacy / samples without HK id: title + minute fingerprint. */
  const existingSet = new Set<string>();
  for (const r of existingRows ?? []) {
    const row = r as {
      date_key: string;
      recipe_title: string;
      calories: number;
      created_at?: string;
      health_sample_id?: string | null;
    };
    if (row.health_sample_id) existingHkIds.add(row.health_sample_id);
    const ct = row.created_at ? parseSampleInstant(row.created_at).getTime() : NaN;
    const minute = Number.isFinite(ct) ? Math.floor(ct / 60000) : 0;
    existingSet.add(`${row.date_key}|${row.recipe_title}|${row.calories}|${minute}`);
  }

  // Batch inserts for efficiency
  const toInsert: Array<{
    user_id: string;
    date_key: string;
    name: string;
    recipe_title: string;
    time_label: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber_g: number | null;
    portion_multiplier: number;
    nutrition_micros: Record<string, number>;
    source: string;
    created_at: string;
    health_sample_id: string | null;
  }> = [];

  for (const sample of extEnergy) {
    const sourceApp = sample.sourceName?.trim() || sourceBundleIdOf(sample) || "Unknown app";
    const when = effectiveConsumptionInstant(sample);
    const cal = Math.round(sample.value);
    if (cal <= 0) continue;

    if (sample.id && existingHkIds.has(sample.id)) continue;

    const dk = dateKey(when);

    const rawMeta = sample.metadata as Record<string, unknown> | undefined;
    const correlationOverlay = sample.id ? quantityIdToFoodCorrelationMeta.get(sample.id) : undefined;
    const meta = mergeCorrelationMetadataIntoSampleMetadata(rawMeta, correlationOverlay);

    const foodLabel = genericHealthImportLabels
      ? `Imported food (${cal} kcal)`
      : resolveFoodLabelFromHealthMetadata(meta, cal, sourceApp);

    const recipeTitle = genericHealthImportLabels ? foodLabel : `${foodLabel} (via ${sourceApp})`;
    const minuteBucket = Math.floor(when.getTime() / 60000);
    const dedupKey = `${dk}|${recipeTitle}|${cal}|${minuteBucket}`;
    if (!sample.id && existingSet.has(dedupKey)) continue;
    if (!sample.id) existingSet.add(dedupKey);
    if (sample.id) existingHkIds.add(sample.id);

    const correlationKey = dietaryCorrelationKey(sample, quantityIdToCorrelationId);
    const inner = correlated.get(correlationKey);
    const rawTotals = totalsRecordFromInner(inner);
    // Apply proportional share so the bucket's macros are split by kcal
    // when multiple energy samples share a legacy `minute|bundle` bucket
    // (MFP bulk-sync mitigation, 2026-04-18). Single-sample buckets get
    // share=1, so the existing single-meal pathway is unaffected.
    const share = energyShares.shareForSample(sample.id, correlationKey);
    const totals: typeof rawTotals = share === 1
      ? rawTotals
      : Object.fromEntries(
          Object.entries(rawTotals).map(([k, v]) => [k, (v ?? 0) * share]),
        ) as typeof rawTotals;
    const { fiberG, micros: builtMicros } = buildFiberAndMicrosFromHealthTotals(totals);
    const microsJson = builtMicros;

    const slot = journalMealSlotForSample(sample, when, meta);
    const timeLabel = when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });

    // `name` = meal slot; `recipe_title` = food line; `created_at` = when logged in Health
    // so the journal orders chronologically like manual entries.
    const entry = {
      user_id: userId,
      date_key: dk,
      name: slot,
      recipe_title: recipeTitle,
      time_label: timeLabel,
      calories: cal,
      protein: roundMealMacro(totals.Protein ?? 0),
      carbs: roundMealMacro(totals.Carbohydrates ?? 0),
      fat: roundMealMacro(totals.FatTotal ?? 0),
      fiber_g: fiberG,
      portion_multiplier: 1,
      nutrition_micros: microsJson,
      source: "apple_health",
      created_at: when.toISOString(),
      health_sample_id: sample.id ?? null,
    };

    toInsert.push(entry);
    imported.push({
      dateKey: dk,
      name: foodLabel,
      calories: cal,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      sourceApp,
    });
  }

  // Bulk insert
  if (toInsert.length > 0) {
    // Insert in batches of 50 to stay within Supabase limits
    for (let i = 0; i < toInsert.length; i += 50) {
      const batch = toInsert.slice(i, i + 50);
      await supabase.from("nutrition_entries").insert(batch);
    }
  }

  return { imported, skippedOwn, skippedNoName };
}

const NUTRITION_IMPORT_THROTTLE_MS = 5 * 60 * 1000;
let lastNutritionImportSyncAt = 0;

/**
 * When the user has enabled “Import meals from Health” in Connected, pull dietary energy
 * samples on a modest throttle (Today tab focus + manual sync).
 */
export async function syncNutritionFromHealthThrottled(userId: string): Promise<void> {
  // F-1 (2026-04-19): called from the Today-tab focus effect after a
  // `Connect Apple Health` grant. Must never throw — Today's catch is a
  // safety net, but letting this propagate hides the root cause and
  // leaves the throttle timestamp unadvanced (retry storm).
  try {
    if (!userId || !isHealthSyncAvailable()) return;
    try {
      const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
      const imp = await AsyncStorage.getItem("health_import_nutrition");
      if (imp !== "true") return;
    } catch {
      return;
    }
    const now = Date.now();
    if (now - lastNutritionImportSyncAt < NUTRITION_IMPORT_THROTTLE_MS) return;
    // F-44: extended lookback — matches user expectation from MFP/LoseIt
    // that past months of meals backfill on first connect.
    await syncNutritionFromHealth(userId, 730);
    // Batch 2.5 — piggyback caffeine import on the same throttle. Alcohol
    // is not imported (see backlog note in `exportDayToHealth`).
    try {
      await syncCaffeineFromHealth(userId, 30);
    } catch (caffeineErr) {
      // Caffeine import is best-effort; don't let it suppress the primary
      // nutrition import's completion.
      captureException(caffeineErr);
    }
    lastNutritionImportSyncAt = Date.now();
  } catch (err) {
    captureException(err);
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
 * NUTRITION EXPORT  –  write Suppr meals → HealthKit so other apps can see them
 * ─────────────────────────────────────────────────────────────────────────────*/

export type MealToExport = {
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  /** ISO date string, defaults to now. */
  date?: string;
};

/**
 * Push a batch of Suppr-logged meals to Apple HealthKit.
 * Returns the number of samples successfully written.
 */
export async function writeNutritionToHealth(
  meals: MealToExport[],
): Promise<number> {
  const hk = loadAppleHealthKit();
  if (!hk) return 0;

  let written = 0;
  for (const meal of meals) {
    try {
      const ok = await saveFoodSamplePromise(hk, {
        name: meal.name || "Suppr meal",
        energy: meal.calories,
        protein: meal.protein,
        carbohydrates: meal.carbs,
        fatTotal: meal.fat,
        dietaryFiber: meal.fiber,
        date: meal.date,
      });
      if (ok) written++;
    } catch {
      // Individual sample write failed — continue with the rest
    }
  }
  return written;
}

/**
 * Convenience: export all of a user's Suppr-logged meals for a given date to HealthKit.
 * Skips entries that were themselves imported from Health (to avoid a feedback loop).
 *
 * Batch 2.5 — also writes today's caffeine total (mg) as a single
 * `saveFoodSample` record named "Suppr caffeine". Alcohol is **not**
 * written: Apple's HealthKit exposes alcohol only via
 * `HKQuantityTypeIdentifierNumberOfAlcoholicBeverages` (count, not mass),
 * which sits outside the dietary saveFoodSample path we already use.
 * Documented as a backlog item in `docs/health-platform-phase-b.md`.
 */
export async function exportDayToHealth(
  userId: string,
  dateKeyStr: string,
): Promise<number> {
  const { data: entries } = await supabase
    .from("nutrition_entries")
    .select("name, recipe_title, calories, protein, carbs, fat, fiber_g, created_at, source")
    .eq("user_id", userId)
    .eq("date_key", dateKeyStr);

  const meals: MealToExport[] = (entries ?? [])
    .filter((e: any) => e.source !== "apple_health") // don't re-export imports
    .map((e: any) => ({
      name: e.recipe_title || e.name || "Suppr meal",
      calories: e.calories ?? 0,
      protein: e.protein ?? undefined,
      carbs: e.carbs ?? undefined,
      fat: e.fat ?? undefined,
      fiber: e.fiber_g ?? undefined,
      date: e.created_at,
    }));

  const mealsWritten = meals.length > 0 ? await writeNutritionToHealth(meals) : 0;

  // Caffeine: write today's quick-add total as a single HK food sample.
  // Writing only when the total is positive avoids empty placeholder rows
  // in Apple Health's "Nutrition" source list.
  try {
    const { data: profile } = await supabase
      .from("profiles")
      .select("extra_caffeine_by_day")
      .eq("id", userId)
      .maybeSingle();
    const map = (profile?.extra_caffeine_by_day as Record<string, number> | null) ?? null;
    const mg = map && typeof map === "object" ? Math.max(0, Math.round(Number(map[dateKeyStr] ?? 0))) : 0;
    if (mg > 0) {
      const hk = loadAppleHealthKit();
      if (hk) {
        const ok = await saveFoodSamplePromise(hk, {
          name: "Suppr caffeine",
          energy: 0,
          caffeine: mg / 1000, // react-native-health expects grams, UI stores mg
          date: new Date(`${dateKeyStr}T12:00:00`).toISOString(),
        });
        return mealsWritten + (ok ? 1 : 0);
      }
    }
  } catch {
    // Swallow: caffeine write is best-effort; main meals already persisted.
  }

  return mealsWritten;
}

/**
 * Batch 2.5 — pull dietary caffeine samples from HealthKit for the
 * lookback window, bucket them by date, and merge into
 * `profiles.extra_caffeine_by_day`. Skips samples that Suppr itself
 * wrote (by bundle ID) so exportDayToHealth round-trips don't double-count.
 *
 * Does nothing if HealthKit isn't available or the "Import meals from
 * Health" AsyncStorage flag is unset. Returns the number of days touched.
 */
export async function syncCaffeineFromHealth(
  userId: string,
  lookbackDays = 30,
): Promise<{ daysTouched: number }> {
  const hk = loadAppleHealthKit();
  if (!hk || !userId) return { daysTouched: 0 };
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const imp = await AsyncStorage.getItem("health_import_nutrition");
    if (imp !== "true") return { daysTouched: 0 };
  } catch {
    return { daysTouched: 0 };
  }

  const startDate = daysAgo(lookbackDays).toISOString();
  const endDate = new Date().toISOString();

  // `Caffeine` uses the `gram` unit in `unitForDietaryImportKey`, but HK
  // stores caffeine in grams — converted back to mg before we persist.
  const samples = await getDietaryImportSamplesSafe(hk, "Caffeine", { startDate, endDate });

  const byDay: Record<string, number> = {};
  for (const s of samples) {
    if (isOwnAppSample(s)) continue;
    const mg = Math.max(0, Math.round(Number(s.value) * 1000));
    if (mg <= 0) continue;
    const whenStr = s.startDate;
    if (!whenStr) continue;
    const d = parseSampleInstant(whenStr);
    const k = dateKey(d);
    byDay[k] = (byDay[k] ?? 0) + mg;
  }

  if (Object.keys(byDay).length === 0) return { daysTouched: 0 };

  // Merge into existing map, preferring max(existing, imported) per day to
  // avoid double-counting if the user also logged caffeine via quick-add
  // in Suppr. Using max (not sum) is the same shape as the web debounce
  // and keeps re-syncs idempotent.
  const { data: prof } = await supabase
    .from("profiles")
    .select("extra_caffeine_by_day")
    .eq("id", userId)
    .maybeSingle();
  const existing = (prof?.extra_caffeine_by_day as Record<string, number> | null) ?? {};
  const merged: Record<string, number> = { ...existing };
  for (const [k, v] of Object.entries(byDay)) {
    merged[k] = Math.max(existing[k] ?? 0, v);
  }
  await supabase.from("profiles").update({ extra_caffeine_by_day: merged }).eq("id", userId);
  return { daysTouched: Object.keys(byDay).length };
}

// ─── Health data card "last values" ──────────────────────────────────────────
// Persisted under `health_last_values` in AsyncStorage so the data rows on the
// Health Sync screen render on cold open without a fresh sync.

export type HealthLastValues = {
  steps: string | null;
  weight: string | null;
  activeEnergy: string | null;
  restingEnergy: string | null;
  workouts: string | null;
  syncedAt: string | null;
};

const HEALTH_LAST_VALUES_KEY = "health_last_values";

export async function persistHealthLastValues(userId: string): Promise<void> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const { data } = await supabase
      .from("profiles")
      .select("steps_by_day, weight_kg_by_day, weight_kg, activity_burn_by_day, basal_burn_by_day, workouts_by_day")
      .eq("id", userId)
      .maybeSingle();
    if (!data) return;

    const today = dateKey(new Date());
    const stepsVal = (data.steps_by_day as Record<string, number> | null)?.[today];
    const activeVal = (data.activity_burn_by_day as Record<string, number> | null)?.[today];
    const restingVal = (data.basal_burn_by_day as Record<string, number> | null)?.[today];
    const workoutsToday = (data.workouts_by_day as Record<string, unknown[]> | null)?.[today];

    // Weight: today's if available, else most recent from weight_kg_by_day, else profile cached
    const weightByDay = (data.weight_kg_by_day as Record<string, number> | null) ?? {};
    const weightKg =
      weightByDay[today] ??
      (Object.entries(weightByDay).sort((a, b) => b[0].localeCompare(a[0]))[0]?.[1] ?? null) ??
      (typeof data.weight_kg === "number" ? (data.weight_kg as number) : null);

    const weightDayKey = weightByDay[today]
      ? undefined
      : Object.entries(weightByDay).sort((a, b) => b[0].localeCompare(a[0]))[0]?.[0];
    const weightDayLabel = weightDayKey ? ` · ${new Date(weightDayKey + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short" })}` : "";

    const vals: HealthLastValues = {
      steps: stepsVal != null ? `${stepsVal.toLocaleString()} today` : null,
      weight: weightKg != null ? `${weightKg} kg${weightDayLabel}` : null,
      activeEnergy: activeVal != null ? `${Math.round(activeVal).toLocaleString()} kcal today` : null,
      restingEnergy: restingVal != null ? `${Math.round(restingVal).toLocaleString()} kcal today` : null,
      workouts: workoutsToday != null ? `${workoutsToday.length} today` : null,
      syncedAt: new Date().toISOString(),
    };

    await AsyncStorage.setItem(HEALTH_LAST_VALUES_KEY, JSON.stringify(vals));
  } catch {
    // non-critical
  }
}

export async function loadHealthLastValues(): Promise<HealthLastValues | null> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(HEALTH_LAST_VALUES_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as HealthLastValues;
  } catch {
    return null;
  }
}
