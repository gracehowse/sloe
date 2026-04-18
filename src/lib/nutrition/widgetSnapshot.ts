/**
 * Widget snapshot — Batch 5.12.
 *
 * Pure helper that builds a compact JSON summary of "today" for consumption
 * by the iOS home/lock-screen widget. The widget (Swift) reads the JSON from
 * a shared App Group container; the mobile app writes it every time the
 * user's Today totals or active fast state change.
 *
 * This helper is pure — it takes already-computed numbers and produces the
 * canonical snapshot shape. It must never fetch, persist, or read the clock
 * except via an injected `now` param so tests are deterministic.
 *
 * Parity note: web doesn't ship this widget (iOS-only), but the pure helper
 * lives in `src/lib/nutrition/` so that the schema is agreed in one place
 * and the mobile wrapper (`apps/mobile/lib/widgetSnapshot.ts`) handles the
 * I/O. This matches the pattern used by `streakFreeze.ts` / `weeklyRecap.ts`.
 */

/** Canonical widget snapshot shape. All numbers are integers (kcal rounded,
 *  macros rounded to whole grams). Left-of-budget values may be negative
 *  when over-budget — the widget displays them as "−N" or "over by N". */
export type WidgetSnapshot = {
  /** ISO timestamp this snapshot was generated — widget may display
   *  "updated at …" for transparency. */
  updatedAt: string;
  /** Total kcal consumed so far today. Integer, never negative. */
  kcalConsumed: number;
  /** Daily kcal target (effective, after activity adjustment). Integer. */
  kcalTarget: number;
  /** Grams of protein remaining (target − consumed). Integer, may be negative. */
  proteinLeftG: number;
  /** Grams of carbs remaining. Integer, may be negative. */
  carbsLeftG: number;
  /** Grams of fat remaining. Integer, may be negative. */
  fatLeftG: number;
  /** Is the user currently inside an intermittent-fast window? */
  fastActive: boolean;
  /** ISO timestamp the active fast began. Only present when `fastActive`. */
  fastStartsAt?: string;
  /** Target fast length in hours (defaults to 16). Only present when `fastActive`. */
  fastTargetHours?: number;
};

export type WidgetSnapshotInput = {
  now?: Date;
  /** Today's kcal consumed (any real number; clamped to >= 0 and rounded). */
  kcalConsumed: number;
  /** Today's effective kcal target (any real number; clamped to >= 0 and rounded). */
  kcalTarget: number;
  /** Protein target in grams. */
  proteinTargetG: number;
  /** Protein consumed in grams. */
  proteinConsumedG: number;
  /** Carbs target in grams. */
  carbsTargetG: number;
  /** Carbs consumed in grams. */
  carbsConsumedG: number;
  /** Fat target in grams. */
  fatTargetG: number;
  /** Fat consumed in grams. */
  fatConsumedG: number;
  /** ISO timestamp the active fast began, or null/undefined when not fasting. */
  fastStartsAt?: string | null;
  /** Target fast length in hours (e.g. 16). Defaults to 16 when `fastStartsAt`
   *  is set but no explicit target was provided. */
  fastTargetHours?: number | null;
};

function toFiniteNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function nonNegInt(v: unknown): number {
  return Math.max(0, Math.round(toFiniteNumber(v)));
}

function anyInt(v: unknown): number {
  return Math.round(toFiniteNumber(v));
}

function isIsoDateString(v: unknown): v is string {
  if (typeof v !== "string" || v.length === 0) return false;
  const t = Date.parse(v);
  return Number.isFinite(t);
}

/** Clamp fast target hours to a sensible range (1..48). Anything outside
 *  that window (or non-finite) falls back to the conventional 16h default. */
function sanitizeFastTargetHours(v: unknown): number {
  const n = toFiniteNumber(v);
  if (!Number.isFinite(n) || n < 1 || n > 48) return 16;
  return Math.round(n);
}

/**
 * Build a canonical widget snapshot from the current Today state.
 * Defensive against missing / non-finite inputs — returns a well-formed
 * snapshot in every case so the widget never has to parse junk.
 */
export function buildWidgetSnapshot(input: WidgetSnapshotInput): WidgetSnapshot {
  const now = input.now instanceof Date && !Number.isNaN(input.now.getTime())
    ? input.now
    : new Date();

  const kcalConsumed = nonNegInt(input.kcalConsumed);
  const kcalTarget = nonNegInt(input.kcalTarget);

  const proteinLeftG = anyInt(toFiniteNumber(input.proteinTargetG) - toFiniteNumber(input.proteinConsumedG));
  const carbsLeftG = anyInt(toFiniteNumber(input.carbsTargetG) - toFiniteNumber(input.carbsConsumedG));
  const fatLeftG = anyInt(toFiniteNumber(input.fatTargetG) - toFiniteNumber(input.fatConsumedG));

  const fastActive = isIsoDateString(input.fastStartsAt);

  const snapshot: WidgetSnapshot = {
    updatedAt: now.toISOString(),
    kcalConsumed,
    kcalTarget,
    proteinLeftG,
    carbsLeftG,
    fatLeftG,
    fastActive,
  };

  if (fastActive) {
    snapshot.fastStartsAt = input.fastStartsAt as string;
    snapshot.fastTargetHours = sanitizeFastTargetHours(input.fastTargetHours ?? 16);
  }

  return snapshot;
}

/** Deep-link URL the widget tap opens. Keep in sync with
 *  `parseSiriDeepLink` (`today_remaining` action). */
export const WIDGET_TAP_DEEP_LINK = "suppr://today/remaining";

/** Canonical storage keys / paths. The native widget extension is
 *  responsible for reading this file from the App Group container —
 *  the mobile wrapper writes it. */
export const SUPPR_WIDGET_SNAPSHOT_KEY = "pm:widget:snapshot";
export const SUPPR_WIDGET_SNAPSHOT_FILENAME = "suppr-widget-snapshot.json";
