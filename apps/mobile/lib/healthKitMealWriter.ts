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
 *  - Writes the meal as a single `saveFood` (energy + protein +
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
/**
 * 2026-05-05 (audit Y02) — userId-scoped key. Was a global
 * `health_export_written_ids` until today; that meant when User A signed
 * out and User B signed in on the same device, B's writes were silently
 * suppressed because A's id set was still in AsyncStorage. Now scoped:
 * User A's set lives at `health_export_written_ids:<A.id>`, User B's at
 * `:<B.id>`. The `clearUserScopedAsyncStorage` helper called on signOut
 * removes the previous user's set.
 */
const WRITTEN_IDS_KEY_PREFIX = "health_export_written_ids";
function writtenIdsKeyForUser(userId: string): string {
  return `${WRITTEN_IDS_KEY_PREFIX}:${userId}`;
}
const WRITTEN_IDS_CAP = 5_000;

/** In-memory dedupe — cleared on app restart, AsyncStorage backs it. */
const writtenIdsMemory: Set<string> = new Set();
/** Tracks which userId the in-memory set belongs to so a re-signin under
    a different user invalidates correctly. `null` until first hydrate. */
let writtenIdsHydratedFor: string | null = null;

async function hydrateWrittenIds(userId: string): Promise<void> {
  if (writtenIdsHydratedFor === userId) return;
  // Different user (or first hydrate) — wipe in-memory set and re-load.
  writtenIdsMemory.clear();
  writtenIdsHydratedFor = userId;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    const raw = await AsyncStorage.getItem(writtenIdsKeyForUser(userId));
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

async function persistWrittenIds(userId: string): Promise<void> {
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
    await AsyncStorage.setItem(writtenIdsKeyForUser(userId), JSON.stringify(Array.from(writtenIdsMemory)));
  } catch {
    // ignore — best effort
  }
}

/**
 * Reset the in-memory dedupe set. Called from auth signOut so the next
 * sign-in (potentially as a different user) starts clean.
 */
export function resetHealthKitMealWriterCache(): void {
  writtenIdsMemory.clear();
  writtenIdsHydratedFor = null;
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
  /**
   * Authenticated user id. Required so the AsyncStorage dedupe set is
   * userId-scoped and a sign-out + sign-in as a different user starts
   * with an empty set instead of inheriting the previous user's writes.
   * If undefined, the call is treated as disabled (no write).
   */
  userId?: string | null;
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
 *
 * 2026-05-13 (Grace TF feedback — "meals are not sharing to Health
 * from Suppr"): every non-success branch now logs a structured
 * `console.warn` so the actual failure reason is visible in
 * `xcrun simctl` / Sentry breadcrumb output. The function previously
 * swallowed every reason silently, which meant "writes aren't
 * happening" had no diagnostic trail.
 */
export async function writeMealToHealthKitIfEnabled(
  input: WriteMealToHealthKitInput,
): Promise<WriteMealResult> {
  if (!input || !input.mealId) {
    console.warn("[hk.writeMeal] skipped — empty mealId", { name: input?.name });
    return { ok: true, written: false, reason: "duplicate" };
  }
  if (!Number.isFinite(input.calories) || input.calories <= 0) {
    console.warn("[hk.writeMeal] skipped — no calories", { mealId: input.mealId, calories: input.calories });
    return { ok: true, written: false, reason: "no-calories" };
  }
  if (isLowConfidenceSource(input.source)) {
    console.warn("[hk.writeMeal] skipped — low-confidence source", { mealId: input.mealId, source: input.source });
    return { ok: true, written: false, reason: "low-confidence" };
  }
  // 2026-05-05 — userId required for the dedupe set to be userId-scoped.
  // Missing userId means the caller doesn't have a session yet; skip
  // rather than write to a global key (audit Y02 cross-user leak).
  if (!input.userId) {
    console.warn("[hk.writeMeal] skipped — no userId on input", { mealId: input.mealId });
    return { ok: true, written: false, reason: "disabled" };
  }

  const enabled = await isExportEnabled();
  if (!enabled) {
    console.warn("[hk.writeMeal] skipped — `health_export_nutrition` flag is off", { mealId: input.mealId });
    return { ok: true, written: false, reason: "disabled" };
  }

  await hydrateWrittenIds(input.userId);
  if (writtenIdsMemory.has(input.mealId)) {
    // Duplicate is the expected path — don't warn for these.
    return { ok: true, written: false, reason: "duplicate" };
  }

  // Optimistically mark before the bridge call so a synchronous re-entry
  // for the same id (e.g. byDay debounce firing twice) never queues a
  // second write. If the bridge ultimately rejects we keep the id marked
  // — re-trying a bad sample on every render is noisier than skipping it.
  writtenIdsMemory.add(input.mealId);

  let bridgeWroteCount = 0;
  let bridgeError: unknown = null;
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
  } catch (e) {
    bridgeWroteCount = 0;
    bridgeError = e;
  }

  // Persist after every successful write so a restart inherits the
  // dedupe set. Wait until persist for cap eviction so the first 5k
  // writes are a single cheap set-add per call.
  await persistWrittenIds(input.userId);

  if (bridgeWroteCount === 0) {
    console.warn("[hk.writeMeal] FAILED — `saveFood` wrote 0 samples. Check the diagnostic in More → Health Sync → 'Send a test meal' for the bridge error. Most common cause: WRITE toggles still off in Settings → Health → Data Access & Devices → Suppr.", {
      mealId: input.mealId,
      name: input.name,
      calories: input.calories,
      bridgeError: bridgeError instanceof Error ? bridgeError.message : bridgeError,
    });
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
// Keep main's userId-scoped signature (audit Y02, 2026-05-05) — see
// the function header comment above. PR #93 had pre-Y02 signature
// (no userId); resolved in favour of main on rebase.
export async function primeWrittenMealIds(userId: string | null | undefined, ids: ReadonlyArray<string>): Promise<void> {
  if (!userId || !ids || ids.length === 0) return;
  await hydrateWrittenIds(userId);
  let added = 0;
  for (const id of ids) {
    if (typeof id === "string" && id.length > 0 && !writtenIdsMemory.has(id)) {
      writtenIdsMemory.add(id);
      added++;
    }
  }
  if (added > 0) await persistWrittenIds(userId);
}

/** Test-only — reset in-memory + AsyncStorage dedupe state for a userId. */
export async function _resetHealthKitMealWriterForTests(userId?: string): Promise<void> {
  writtenIdsMemory.clear();
  writtenIdsHydratedFor = null;
  if (!userId) return;
  try {
    const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
    await AsyncStorage.removeItem(writtenIdsKeyForUser(userId));
  } catch {
    // ignore
  }
}
