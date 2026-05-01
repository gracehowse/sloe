/**
 * Per-meal Apple HealthKit nutrition writer (audit/2026-04-30 — competitive
 * parity vs MyFitnessPal / Cal AI).
 *
 * Suppr already pulls workouts / weight / energy FROM Apple Health, but
 * historically only pushed nutrition back at end-of-day via the "Complete
 * Day" CTA (`exportDayToHealth`). Apple-loyal users open Health and see
 * zero meals from Suppr until they remember to tap Complete Day. MFP and
 * Cal AI write per-meal on log; matching that posture removes the trust
 * gap.
 *
 * Design:
 *  - Reads the existing AsyncStorage flag `health_export_nutrition`
 *    (set by Settings → Health Sync → "Share meals to Health"). If the
 *    flag is unset or "false", this is a no-op.
 *  - Writes the meal as a single `saveFoodSample` (energy + protein +
 *    carbs + fat + fibre) — the same shape `exportDayToHealth` uses.
 *  - Idempotent at the meal-id level: a per-device `Set<mealId>` plus
 *    AsyncStorage-backed `health_export_written_ids` (capped at 5k
 *    entries; LRU eviction by insertion order). Re-logging an already-
 *    written meal is a silent no-op so re-render / debounce cycles
 *    don't double-count.
 *  - Fire-and-forget — every entry point calls
 *    `void writeMealToHealthKitIfEnabled(...)` so HK latency / errors
 *    cannot block the actual log persist.
 *  - Skips low-confidence rows: any meal whose source contains
 *    "ai-estimate" or "low-confidence" is excluded so unconfirmed AI
 *    guesses never reach Apple Health (CLAUDE.md non-negotiable —
 *    no low-confidence nutrition data without explicit confirmation).
 */

import { writeNutritionToHealth } from "./healthSync";

const FLAG_KEY = "health_export_nutrition";
const WRITTEN_IDS_KEY = "health_export_written_ids";
const WRITTEN_IDS_CAP = 5_000;

/** In-memory dedupe — cleared on app restart, AsyncStorage backs it. */
const writtenIdsMemory: Set<string> = new Set();
let writtenIdsHydrated = false;

async function hydrateWrittenIds(): Promise<void> {
  if (writtenIdsHydrated) return;
  writtenIdsHydrated = true;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(WRITTEN_IDS_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const v of parsed) {
      if (typeof v === "string" && v.length > 0) writtenIdsMemory.add(v);
    }
  } catch {
    // ignore — fresh start is fine
  }
}

async function persistWrittenIds(): Promise<void> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    // Drop oldest entries when over cap (Set preserves insertion order).
    if (writtenIdsMemory.size > WRITTEN_IDS_CAP) {
      const overflow = writtenIdsMemory.size - WRITTEN_IDS_CAP;
      const it = writtenIdsMemory.values();
      for (let i = 0; i < overflow; i++) {
        const next = it.next();
        if (next.done) break;
        writtenIdsMemory.delete(next.value);
      }
    }
    await AsyncStorage.setItem(WRITTEN_IDS_KEY, JSON.stringify(Array.from(writtenIdsMemory)));
  } catch {
    // ignore — best effort
  }
}

async function isExportEnabled(): Promise<boolean> {
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const v = await AsyncStorage.getItem(FLAG_KEY);
    return v === "true";
  } catch {
    return false;
  }
}

function isLowConfidenceSource(source: string | null | undefined): boolean {
  if (!source) return false;
  const s = String(source).toLowerCase();
  return s.includes("ai-estimate") || s.includes("low-confidence") || s.includes("low_confidence");
}

export type WriteMealToHealthKitInput = {
  /** Stable meal id used for idempotency; usually the `nutrition_entries.id` UUID. */
  mealId: string;
  name: string;
  /** Required — the only macro guaranteed to be present on every log path. */
  calories: number;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiberG?: number | null;
  /** ISO timestamp; defaults to "now". */
  date?: string | null;
  /** Provenance from `nutrition_entries.source`; used to skip AI-estimated rows. */
  source?: string | null;
  /**
   * Origin of the call (logging surface). Not persisted to HealthKit;
   * available only for debug logging if we ever wire one up.
   */
  origin?: "barcode" | "manual" | "recipe" | "plan" | "duplicate" | "journal-sync" | string;
};

export type WriteMealResult =
  | { ok: true; written: boolean; reason?: "disabled" | "duplicate" | "low-confidence" | "no-calories" | "hk-failed" };

/**
 * Write a single meal to Apple HealthKit if the user has the
 * "Share meals to Health" toggle on. Idempotent by `mealId`.
 *
 * Always returns — never throws — so callers can `void` it. Returns a
 * result object so tests can assert which branch ran.
 */
export async function writeMealToHealthKitIfEnabled(
  input: WriteMealToHealthKitInput,
): Promise<WriteMealResult> {
  if (!input || !input.mealId) return { ok: true, written: false, reason: "duplicate" };
  if (!Number.isFinite(input.calories) || input.calories <= 0) {
    return { ok: true, written: false, reason: "no-calories" };
  }
  if (isLowConfidenceSource(input.source)) {
    return { ok: true, written: false, reason: "low-confidence" };
  }

  const enabled = await isExportEnabled();
  if (!enabled) return { ok: true, written: false, reason: "disabled" };

  await hydrateWrittenIds();
  if (writtenIdsMemory.has(input.mealId)) {
    return { ok: true, written: false, reason: "duplicate" };
  }

  // Optimistically mark before the bridge call so a synchronous re-entry
  // for the same id (e.g. byDay debounce firing twice) never queues a
  // second write. If the bridge ultimately rejects we keep the id marked
  // — re-trying a bad sample on every render is noisier than skipping it.
  writtenIdsMemory.add(input.mealId);

  let bridgeWroteCount = 0;
  try {
    bridgeWroteCount = await writeNutritionToHealth([
      {
        name: input.name || "Suppr meal",
        calories: Math.max(0, Math.round(input.calories)),
        protein: input.protein ?? undefined,
        carbs: input.carbs ?? undefined,
        fat: input.fat ?? undefined,
        fiber: input.fiberG ?? undefined,
        date: input.date ?? new Date().toISOString(),
      },
    ]);
  } catch {
    bridgeWroteCount = 0;
  }

  // Persist after every successful write so a restart inherits the
  // dedupe set. Wait until persist for cap eviction so the first 5k
  // writes are a single cheap set-add per call.
  await persistWrittenIds();

  if (bridgeWroteCount === 0) {
    return { ok: true, written: false, reason: "hk-failed" };
  }
  return { ok: true, written: true };
}

/**
 * Mark a batch of meal ids as already-written without actually writing
 * them. Used at first journal hydrate to prevent the debounced byDay
 * sync from back-filling every historical meal to HealthKit on the
 * first launch after this feature shipped — those meals were logged
 * before the feature existed and Apple Health users don't expect them
 * to suddenly appear.
 *
 * Idempotent — safe to call repeatedly.
 */
export async function primeWrittenMealIds(ids: ReadonlyArray<string>): Promise<void> {
  if (!ids || ids.length === 0) return;
  await hydrateWrittenIds();
  let added = 0;
  for (const id of ids) {
    if (typeof id === "string" && id.length > 0 && !writtenIdsMemory.has(id)) {
      writtenIdsMemory.add(id);
      added++;
    }
  }
  if (added > 0) await persistWrittenIds();
}

/** Test-only — reset in-memory + AsyncStorage dedupe state. */
export async function _resetHealthKitMealWriterForTests(): Promise<void> {
  writtenIdsMemory.clear();
  writtenIdsHydrated = false;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.removeItem(WRITTEN_IDS_KEY);
  } catch {
    // ignore
  }
}
